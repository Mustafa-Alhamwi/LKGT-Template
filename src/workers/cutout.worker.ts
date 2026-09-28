/// <reference lib="webworker" />
/* ------------------------------------------------------------------
 * معالجة قناع التفريغ (في Worker حتى لا تتجمد الواجهة):
 * عتبات الشفافية ← إزالة الشوائب ← ملء الفراغات ← تقليص/تنعيم الحواف
 * ← تعديلات الفرشاة ← قص المنتج على حدوده
 * ------------------------------------------------------------------ */

export interface PhotoFixReq {
  auto: boolean
  temp: number
  sharpen: number
  denoise: number
  upscale: 1 | 2
}

export interface CutoutRequest {
  id: number
  /** enhance = تحسين صورة كاملة دون تفريغ (للخلفيات) */
  op?: 'cutout' | 'enhance'
  photo?: PhotoFixReq
  source: Blob
  mask: Blob | null
  paint: Blob | null
  cleanup: {
    low: number
    high: number
    islands: boolean
    fillHoles: boolean
    choke: number
    feather: number
    smooth?: number
    decontaminate?: boolean
  }
  emptyBase?: boolean
}

export interface CutoutResponse {
  id: number
  ok: boolean
  error?: string
  blob?: Blob
  crop?: { x: number; y: number; w: number; h: number }
  srcW?: number
  srcH?: number
}

async function readPixels(blob: Blob, w?: number, h?: number) {
  const bmp = await createImageBitmap(blob)
  const W = w ?? bmp.width
  const H = h ?? bmp.height
  const c = new OffscreenCanvas(W, H)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, W, H)
  bmp.close()
  return { data: ctx.getImageData(0, 0, W, H).data, w: W, h: H }
}

function levels(a: Uint8ClampedArray, low: number, high: number) {
  const lo = Math.min(low, high - 1)
  const k = 255 / Math.max(1, high - lo)
  for (let i = 0; i < a.length; i++) {
    const v = (a[i] - lo) * k
    a[i] = v < 0 ? 0 : v > 255 ? 255 : v
  }
}

/** توسيع قناع ثنائي بمربع نصف قطره r (مجاميع تراكمية — O(n)) */
function dilateBinary(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  const pre = new Int32Array(Math.max(w, h) + 1)
  for (let y = 0; y < h; y++) {
    pre[0] = 0
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + m[y * w + x]
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, x - r)
      const b = Math.min(w, x + r + 1)
      tmp[y * w + x] = pre[b] - pre[a] > 0 ? 1 : 0
    }
  }
  for (let x = 0; x < w; x++) {
    pre[0] = 0
    for (let y = 0; y < h; y++) pre[y + 1] = pre[y] + tmp[y * w + x]
    for (let y = 0; y < h; y++) {
      const a = Math.max(0, y - r)
      const b = Math.min(h, y + r + 1)
      out[y * w + x] = pre[b] - pre[a] > 0 ? 1 : 0
    }
  }
  return out
}

/** إبقاء الجسم الرئيسي + الأجزاء الكبيرة المنفصلة عنه */
function keepMain(a: Uint8ClampedArray, w: number, h: number, ratio = 0.12) {
  const n = w * h
  const labels = new Int32Array(n)
  const areas: number[] = [0]
  const stack = new Int32Array(n)
  let next = 1
  for (let i = 0; i < n; i++) {
    if (labels[i] || a[i] < 128) continue
    let sp = 0
    stack[sp++] = i
    labels[i] = next
    let area = 0
    while (sp) {
      const p = stack[--sp]
      area++
      const x = p % w
      const y = (p - x) / w
      if (x > 0 && !labels[p - 1] && a[p - 1] >= 128) (labels[p - 1] = next), (stack[sp++] = p - 1)
      if (x < w - 1 && !labels[p + 1] && a[p + 1] >= 128) (labels[p + 1] = next), (stack[sp++] = p + 1)
      if (y > 0 && !labels[p - w] && a[p - w] >= 128) (labels[p - w] = next), (stack[sp++] = p - w)
      if (y < h - 1 && !labels[p + w] && a[p + w] >= 128) (labels[p + w] = next), (stack[sp++] = p + w)
    }
    areas.push(area)
    next++
  }
  if (next <= 2) return
  const max = Math.max(...areas)
  const keep = new Uint8Array(n)
  for (let i = 0; i < n; i++) if (labels[i] && areas[labels[i]] >= max * ratio) keep[i] = 1
  const grown = dilateBinary(keep, w, h, 4)
  for (let i = 0; i < n; i++) if (!grown[i]) a[i] = 0
}

/** ملء أي منطقة شفافة محاطة بالكامل بالمنتج */
function fillHoles(a: Uint8ClampedArray, w: number, h: number) {
  const n = w * h
  const outside = new Uint8Array(n)
  const stack = new Int32Array(n)
  let sp = 0
  const push = (p: number) => {
    if (!outside[p] && a[p] < 128) {
      outside[p] = 1
      stack[sp++] = p
    }
  }
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x)
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1)
  while (sp) {
    const p = stack[--sp]
    const x = p % w
    if (x > 0) push(p - 1)
    if (x < w - 1) push(p + 1)
    if (p >= w) push(p - w)
    if (p < n - w) push(p + w)
  }
  for (let i = 0; i < n; i++) if (!outside[i] && a[i] < 255) a[i] = 255
}

function erode(a: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r <= 0) return
  const tmp = new Uint8ClampedArray(a.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255
      for (let k = -r; k <= r; k++) {
        const xx = x + k
        const v = xx < 0 || xx >= w ? 0 : a[y * w + xx]
        if (v < m) m = v
      }
      tmp[y * w + x] = m
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 255
      for (let k = -r; k <= r; k++) {
        const yy = y + k
        const v = yy < 0 || yy >= h ? 0 : tmp[yy * w + x]
        if (v < m) m = v
      }
      a[y * w + x] = m
    }
  }
}

function boxBlur(a: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r <= 0) return
  const tmp = new Float32Array(a.length)
  const d = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += a[y * w + Math.min(w - 1, Math.max(0, k))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / d
      const add = a[y * w + Math.min(w - 1, x + r + 1)]
      const sub = a[y * w + Math.max(0, x - r)]
      s += add - sub
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x]
    for (let y = 0; y < h; y++) {
      a[y * w + x] = s / d
      const add = tmp[Math.min(h - 1, y + r + 1) * w + x]
      const sub = tmp[Math.max(0, y - r) * w + x]
      s += add - sub
    }
  }
}

/** إزالة هالة لون الخلفية: ألوان الحواف تُستبدل بألوان الداخل القريب المعتم */
function decontaminate(rgba: Uint8ClampedArray, alpha: Uint8ClampedArray, w: number, h: number) {
  const n = w * h
  const R = new Uint8ClampedArray(n)
  const G = new Uint8ClampedArray(n)
  const B = new Uint8ClampedArray(n)
  const W = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const solid = alpha[i] >= 245
    W[i] = solid ? 255 : 0
    if (solid) {
      R[i] = rgba[i * 4]
      G[i] = rgba[i * 4 + 1]
      B[i] = rgba[i * 4 + 2]
    }
  }
  const r = 3
  boxBlur(R, w, h, r)
  boxBlur(G, w, h, r)
  boxBlur(B, w, h, r)
  boxBlur(W, w, h, r)
  for (let i = 0; i < n; i++) {
    const a = alpha[i]
    if (a >= 245 || a === 0 || W[i] < 8) continue
    const k = 255 / W[i]
    const t = 1 - a / 255 // كلما كان أشفّ اعتمدنا لون الداخل أكثر
    const m = Math.min(1, 0.55 + t)
    rgba[i * 4] = rgba[i * 4] * (1 - m) + Math.min(255, R[i] * k) * m
    rgba[i * 4 + 1] = rgba[i * 4 + 1] * (1 - m) + Math.min(255, G[i] * k) * m
    rgba[i * 4 + 2] = rgba[i * 4 + 2] * (1 - m) + Math.min(255, B[i] * k) * m
  }
}

/* ------------------------------ تحسين الصور ------------------------------ */

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** مستويات تلقائية + تعديل غاما نحو متوسط إضاءة متوازن + رفع تشبع خفيف */
function autoLevels(d: Uint8ClampedArray) {
  const hist = new Uint32Array(256)
  let n = 0
  let sum = 0
  let satSum = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const l = (0.299 * r + 0.587 * g + 0.114 * b) | 0
    hist[l]++
    n++
    sum += l
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    satSum += mx ? (mx - mn) / mx : 0
  }
  if (n < 64) return
  const pct = (q: number) => {
    let acc = 0
    const t = n * q
    for (let i = 0; i < 256; i++) {
      acc += hist[i]
      if (acc >= t) return i
    }
    return 255
  }
  const lo = Math.min(pct(0.004), 46)
  const hi = Math.max(pct(0.996), 200)
  const mean = Math.min(0.92, Math.max(0.08, (sum / n - lo) / Math.max(1, hi - lo)))
  let ex = Math.log(0.5) / Math.log(mean)
  ex = 1 + (Math.min(1.4, Math.max(0.72, ex)) - 1) * 0.65
  const sat = satSum / n
  const boost = sat < 0.2 ? 1.16 : sat < 0.34 ? 1.07 : 1
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) lut[i] = 255 * Math.pow(Math.min(1, Math.max(0, (i - lo) / Math.max(1, hi - lo))), ex)
  for (let i = 0; i < d.length; i += 4) {
    let r = lut[d[i]]
    let g = lut[d[i + 1]]
    let b = lut[d[i + 2]]
    if (boost !== 1) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b
      r = clamp255(y + (r - y) * boost)
      g = clamp255(y + (g - y) * boost)
      b = clamp255(y + (b - y) * boost)
    }
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
  }
}

function temperature(d: Uint8ClampedArray, temp: number) {
  const t = Math.max(-100, Math.min(100, temp)) / 100
  if (!t) return
  const kr = 1 + 0.12 * t
  const kb = 1 - 0.14 * t
  const kg = 1 + 0.015 * t
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] * kr)
    d[i + 1] = clamp255(d[i + 1] * kg)
    d[i + 2] = clamp255(d[i + 2] * kb)
  }
}

/** مرشّح 3×3 يحافظ على الحواف ويتجاهل البكسلات الشفافة */
function denoise(d: Uint8ClampedArray, w: number, h: number, amount: number) {
  if (amount <= 0) return
  const src = new Uint8ClampedArray(d)
  const thr = 16 + amount * 38
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      if (src[i + 3] < 250) continue
      let r = 0
      let g = 0
      let b = 0
      let c = 0
      for (let yy = -1; yy <= 1; yy++) {
        for (let xx = -1; xx <= 1; xx++) {
          const j = i + (yy * w + xx) * 4
          if (src[j + 3] < 250) continue
          r += src[j]
          g += src[j + 1]
          b += src[j + 2]
          c++
        }
      }
      if (c < 5) continue
      r /= c
      g /= c
      b /= c
      const diff = Math.abs(src[i] - r) + Math.abs(src[i + 1] - g) + Math.abs(src[i + 2] - b)
      const k = amount * (diff < thr * 3 ? 1 : Math.pow((thr * 3) / diff, 2))
      d[i] = src[i] + (r - src[i]) * k
      d[i + 1] = src[i + 1] + (g - src[i + 1]) * k
      d[i + 2] = src[i + 2] + (b - src[i + 2]) * k
    }
  }
}

/** شحذ Unsharp: تمويه 3×3 مرتين ثم إضافة الفرق */
function sharpen(d: Uint8ClampedArray, w: number, h: number, amount: number) {
  if (amount <= 0) return
  const n = w * h
  const planes = [new Uint8ClampedArray(n), new Uint8ClampedArray(n), new Uint8ClampedArray(n)]
  for (let i = 0; i < n; i++) {
    planes[0][i] = d[i * 4]
    planes[1][i] = d[i * 4 + 1]
    planes[2][i] = d[i * 4 + 2]
  }
  const blurred = planes.map((p) => {
    const c = new Uint8ClampedArray(p)
    boxBlur(c, w, h, 1)
    boxBlur(c, w, h, 1)
    return c
  })
  for (let i = 0; i < n; i++) {
    if (d[i * 4 + 3] < 40) continue
    for (let k = 0; k < 3; k++) {
      let diff = planes[k][i] - blurred[k][i]
      if (Math.abs(diff) < 2) diff = 0
      d[i * 4 + k] = clamp255(planes[k][i] + diff * amount * 1.6)
    }
  }
}

/** يطبّق التحسينات على بكسلات RGBA (يعدّل المصفوفة مباشرة) */
function applyPhoto(d: Uint8ClampedArray, w: number, h: number, p: PhotoFixReq) {
  if (p.auto) autoLevels(d)
  if (p.temp) temperature(d, p.temp)
  if (p.denoise > 0) denoise(d, w, h, p.denoise)
  if (p.sharpen > 0) sharpen(d, w, h, p.sharpen)
}

async function upscale2x(data: ImageData, sharpenAmt: number): Promise<{ canvas: OffscreenCanvas; w: number; h: number }> {
  const src = new OffscreenCanvas(data.width, data.height)
  src.getContext('2d')!.putImageData(data, 0, 0)
  const W = data.width * 2
  const H = data.height * 2
  const big = new OffscreenCanvas(W, H)
  const ctx = big.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, W, H)
  if (sharpenAmt > 0) {
    const img = ctx.getImageData(0, 0, W, H)
    sharpen(img.data, W, H, sharpenAmt)
    ctx.putImageData(img, 0, 0)
  }
  return { canvas: big, w: W, h: H }
}

async function enhanceWhole(req: CutoutRequest): Promise<CutoutResponse> {
  const src = await readPixels(req.source)
  const p = req.photo ?? { auto: true, temp: 0, sharpen: 0.35, denoise: 0, upscale: 1 }
  applyPhoto(src.data, src.w, src.h, p)
  const img = new ImageData(src.data as unknown as Uint8ClampedArray<ArrayBuffer>, src.w, src.h)
  let canvas = new OffscreenCanvas(src.w, src.h)
  canvas.getContext('2d')!.putImageData(img, 0, 0)
  if (p.upscale === 2 && Math.max(src.w, src.h) <= 3200) {
    const u = await upscale2x(img, 0.45)
    canvas = u.canvas
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.94 })
  return { id: req.id, ok: true, blob, srcW: src.w, srcH: src.h }
}

async function process(req: CutoutRequest): Promise<CutoutResponse> {
  if (req.op === 'enhance') return enhanceWhole(req)
  const src = await readPixels(req.source)
  const { w, h } = src
  const n = w * h
  const alpha = new Uint8ClampedArray(n)
  let hasMask = false
  if (req.emptyBase) {
    hasMask = true // قناع فارغ: لا شيء ظاهر إلا ما تضيفه الفرشاة/التحديد
  } else if (req.mask) {
    const m = await readPixels(req.mask, w, h)
    let useAlpha = false
    for (let i = 3; i < m.data.length; i += 4 * 97) {
      if (m.data[i] < 250) {
        useAlpha = true
        break
      }
    }
    for (let i = 0; i < n; i++) alpha[i] = useAlpha ? m.data[i * 4 + 3] : m.data[i * 4]
    hasMask = true
  } else {
    for (let i = 0; i < n; i++) alpha[i] = src.data[i * 4 + 3]
  }

  const c = req.cleanup
  if (hasMask) levels(alpha, c.low, c.high)
  if (c.islands) keepMain(alpha, w, h)
  if (c.fillHoles) fillHoles(alpha, w, h)
  if (c.choke > 0) erode(alpha, w, h, Math.round(c.choke))
  if ((c.smooth ?? 0) > 0) {
    // تنعيم الشكل: تمويه ثم شحذ المنحنى فتصبح الحواف ملساء بلا تسنن
    boxBlur(alpha, w, h, Math.max(1, Math.round(c.smooth!)))
    boxBlur(alpha, w, h, Math.max(1, Math.round(c.smooth!)))
    for (let i = 0; i < alpha.length; i++) {
      const v = (alpha[i] - 128) * 2.6 + 128
      alpha[i] = v < 0 ? 0 : v > 255 ? 255 : v
    }
  }
  if (c.feather > 0) boxBlur(alpha, w, h, Math.max(1, Math.round(c.feather)))

  if (req.paint) {
    const p = await readPixels(req.paint, w, h)
    for (let i = 0; i < n; i++) {
      const add = p.data[i * 4]
      const erase = p.data[i * 4 + 1]
      let v = Math.max(alpha[i], add)
      v = v * (1 - erase / 255)
      alpha[i] = v
    }
  }

  if (c.decontaminate) decontaminate(src.data, alpha, w, h)

  // الحدود
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { id: req.id, ok: false, error: 'empty' }
  const pad = 2
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(w - 1, maxX + pad)
  maxY = Math.min(h - 1, maxY + pad)
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const out = new ImageData(cw, ch)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (minY + y) * w + (minX + x)
      const di = (y * cw + x) * 4
      out.data[di] = src.data[si * 4]
      out.data[di + 1] = src.data[si * 4 + 1]
      out.data[di + 2] = src.data[si * 4 + 2]
      out.data[di + 3] = hasMask ? (alpha[si] * src.data[si * 4 + 3]) / 255 : alpha[si]
    }
  }
  let canvas = new OffscreenCanvas(cw, ch)
  const ph = req.photo
  const hasFix = !!ph && (ph.auto || ph.temp !== 0 || ph.sharpen > 0 || ph.denoise > 0)
  if (ph && hasFix) applyPhoto(out.data, cw, ch, ph)
  canvas.getContext('2d')!.putImageData(out, 0, 0)
  if (ph?.upscale === 2 && Math.max(cw, ch) <= 3200) canvas = (await upscale2x(out, 0.45)).canvas
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return { id: req.id, ok: true, blob, crop: { x: minX, y: minY, w: cw, h: ch }, srcW: w, srcH: h }
}

self.onmessage = async (e: MessageEvent<CutoutRequest>) => {
  try {
    const res = await process(e.data)
    ;(self as unknown as Worker).postMessage(res)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id: e.data.id, ok: false, error: String(err) } satisfies CutoutResponse)
  }
}

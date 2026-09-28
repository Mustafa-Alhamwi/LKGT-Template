/// <reference lib="webworker" />
/* ------------------------------------------------------------------
 * معالجة قناع التفريغ (في Worker حتى لا تتجمد الواجهة):
 * عتبات الشفافية ← إزالة الشوائب ← ملء الفراغات ← تقليص/تنعيم الحواف
 * ← تعديلات الفرشاة ← قص المنتج على حدوده
 * ------------------------------------------------------------------ */

export interface CutoutRequest {
  id: number
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
  }
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

async function process(req: CutoutRequest): Promise<CutoutResponse> {
  const src = await readPixels(req.source)
  const { w, h } = src
  const n = w * h
  const alpha = new Uint8ClampedArray(n)
  let hasMask = false
  if (req.mask) {
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
  const canvas = new OffscreenCanvas(cw, ch)
  canvas.getContext('2d')!.putImageData(out, 0, 0)
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

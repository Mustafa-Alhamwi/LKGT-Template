/* ------------------------------------------------------------------
 * عمليات التحديد لاستوديو التفريغ (كلها على مصفوفات 8-بت بحجم الصورة)
 * ------------------------------------------------------------------ */

export type Mask = Uint8ClampedArray

const dist2 = (r: number, g: number, b: number, r2: number, g2: number, b2: number) => (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2

/** متوسط لون حول نقطة (نافذة (2k+1)²) */
export function sampleColor(rgba: Uint8ClampedArray, w: number, h: number, x: number, y: number, k = 2): [number, number, number] {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let j = -k; j <= k; j++) {
    for (let i = -k; i <= k; i++) {
      const xx = x + i
      const yy = y + j
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      const p = (yy * w + xx) * 4
      r += rgba[p]
      g += rgba[p + 1]
      b += rgba[p + 2]
      n++
    }
  }
  return [r / n, g / n, b / n]
}

/** العصا السحرية: كل البكسلات المشابهة للون النقطة (متجاورة أو في كل الصورة) */
export function wandRegion(rgba: Uint8ClampedArray, w: number, h: number, x: number, y: number, tol: number, contiguous: boolean): Mask {
  const out = new Uint8ClampedArray(w * h)
  const [sr, sg, sb] = sampleColor(rgba, w, h, x, y)
  const t2 = (tol * 4.4) ** 2 // 0..100 → 0..440 (أقصى مسافة RGB ≈ 441)
  if (!contiguous) {
    for (let i = 0; i < w * h; i++) if (dist2(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], sr, sg, sb) <= t2) out[i] = 255
    return out
  }
  const stack = new Int32Array(w * h)
  let sp = 0
  const start = y * w + x
  out[start] = 255
  stack[sp++] = start
  while (sp) {
    const p = stack[--sp]
    const px = p % w
    const py = (p - px) / w
    const tryPush = (q: number) => {
      if (out[q]) return
      if (dist2(rgba[q * 4], rgba[q * 4 + 1], rgba[q * 4 + 2], sr, sg, sb) <= t2) {
        out[q] = 255
        stack[sp++] = q
      }
    }
    if (px > 0) tryPush(p - 1)
    if (px < w - 1) tryPush(p + 1)
    if (py > 0) tryPush(p - w)
    if (py < h - 1) tryPush(p + w)
  }
  return out
}

/**
 * تحديد ذكي واعٍ بالحواف: ينمو من النقطة ويتوقف عند حدود الأجسام —
 * شرطان: قرب لون النقطة الأصلية + عدم وجود قفزة لونية حادة بين بكسلين متجاورين.
 */
export function smartRegion(rgba: Uint8ClampedArray, w: number, h: number, x: number, y: number, tol: number, maxPixels = 2_500_000): Mask {
  const out = new Uint8ClampedArray(w * h)
  const [sr, sg, sb] = sampleColor(rgba, w, h, x, y, 3)
  const seed2 = (tol * 3.4 + 10) ** 2
  const step2 = (tol * 0.55 + 5) ** 2
  const stack = new Int32Array(w * h)
  let sp = 0
  let count = 0
  const start = y * w + x
  out[start] = 255
  stack[sp++] = start
  while (sp && count < maxPixels) {
    const p = stack[--sp]
    count++
    const px = p % w
    const py = (p - px) / w
    const pr = rgba[p * 4]
    const pg = rgba[p * 4 + 1]
    const pb = rgba[p * 4 + 2]
    const tryPush = (q: number) => {
      if (out[q]) return
      const r = rgba[q * 4]
      const g = rgba[q * 4 + 1]
      const b = rgba[q * 4 + 2]
      if (dist2(r, g, b, sr, sg, sb) <= seed2 && dist2(r, g, b, pr, pg, pb) <= step2) {
        out[q] = 255
        stack[sp++] = q
      }
    }
    if (px > 0) tryPush(p - 1)
    if (px < w - 1) tryPush(p + 1)
    if (py > 0) tryPush(p - w)
    if (py < h - 1) tryPush(p + w)
  }
  // إغلاق الثقوب الصغيرة داخل المنطقة (نقاط ضجيج)
  return closeSmallHoles(out, w, h)
}

/** ملء الثقوب المحاطة بالمنطقة بالكامل */
export function closeSmallHoles(m: Mask, w: number, h: number): Mask {
  const n = w * h
  const outside = new Uint8Array(n)
  const stack = new Int32Array(n)
  let sp = 0
  const push = (p: number) => {
    if (!outside[p] && m[p] < 128) {
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
  for (let i = 0; i < n; i++) if (!outside[i]) m[i] = 255
  return m
}

/** المكوّن المتصل (على قناع الشفافية النهائي) الذي يحوي النقطة */
export function componentAt(alpha: Mask, w: number, h: number, x: number, y: number, thr = 128): Mask {
  const out = new Uint8ClampedArray(w * h)
  const start = y * w + x
  if (alpha[start] < thr) return out
  const stack = new Int32Array(w * h)
  let sp = 0
  out[start] = 255
  stack[sp++] = start
  while (sp) {
    const p = stack[--sp]
    const px = p % w
    const py = (p - px) / w
    const tp = (q: number) => {
      if (!out[q] && alpha[q] >= thr) {
        out[q] = 255
        stack[sp++] = q
      }
    }
    if (px > 0) tp(p - 1)
    if (px < w - 1) tp(p + 1)
    if (py > 0) tp(p - w)
    if (py < h - 1) tp(p + w)
  }
  return out
}

export function polyMask(points: { x: number; y: number }[], w: number, h: number): Mask {
  const out = new Uint8ClampedArray(w * h)
  if (points.length < 3) return out
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const p of points) ctx.lineTo(p.x, p.y)
  ctx.closePath()
  ctx.fill()
  const d = ctx.getImageData(0, 0, w, h).data
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4 + 3]
  return out
}

export function rectMask(x0: number, y0: number, x1: number, y1: number, w: number, h: number): Mask {
  const out = new Uint8ClampedArray(w * h)
  const a = Math.max(0, Math.floor(Math.min(x0, x1)))
  const b = Math.min(w - 1, Math.ceil(Math.max(x0, x1)))
  const c = Math.max(0, Math.floor(Math.min(y0, y1)))
  const d = Math.min(h - 1, Math.ceil(Math.max(y0, y1)))
  for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) out[y * w + x] = 255
  return out
}

/** تمويه صندوقي (مرتين ≈ غاوسي) على قناع */
export function blurMask(m: Mask, w: number, h: number, r: number): Mask {
  if (r <= 0) return m
  const tmp = new Float32Array(w * h)
  const d = 2 * r + 1
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let s = 0
      for (let k = -r; k <= r; k++) s += m[y * w + Math.min(w - 1, Math.max(0, k))]
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = s / d
        s += m[y * w + Math.min(w - 1, x + r + 1)] - m[y * w + Math.max(0, x - r)]
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x]
      for (let y = 0; y < h; y++) {
        m[y * w + x] = s / d
        s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
      }
    }
  }
  return m
}

/** توسيع (r>0) أو تقليص (r<0) منطقة التحديد */
export function growMask(m: Mask, w: number, h: number, r: number): Mask {
  if (!r) return m
  const dilate = r > 0
  const R = Math.abs(r)
  const tmp = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 255
      for (let k = -R; k <= R; k++) {
        const xx = x + k
        const q = xx < 0 || xx >= w ? (dilate ? 0 : 255) : m[y * w + xx]
        v = dilate ? Math.max(v, q) : Math.min(v, q)
      }
      tmp[y * w + x] = v
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = dilate ? 0 : 255
      for (let k = -R; k <= R; k++) {
        const yy = y + k
        const q = yy < 0 || yy >= h ? (dilate ? 0 : 255) : tmp[yy * w + x]
        v = dilate ? Math.max(v, q) : Math.min(v, q)
      }
      m[y * w + x] = v
    }
  }
  return m
}

export interface Patch {
  x: number
  y: number
  w: number
  h: number
  beforeAdd: Uint8ClampedArray
  beforeErase: Uint8ClampedArray
  afterAdd: Uint8ClampedArray
  afterErase: Uint8ClampedArray
}

function crop(src: Uint8ClampedArray, W: number, x: number, y: number, w: number, h: number) {
  const out = new Uint8ClampedArray(w * h)
  for (let j = 0; j < h; j++) out.set(src.subarray((y + j) * W + x, (y + j) * W + x + w), j * w)
  return out
}

/** يستخلص فرق العملية كرقعة صغيرة (للتراجع/الإعادة بدون نسخ الصورة كاملة كل مرة) */
export function diffPatch(
  W: number,
  H: number,
  beforeAdd: Uint8ClampedArray,
  beforeErase: Uint8ClampedArray,
  add: Uint8ClampedArray,
  erase: Uint8ClampedArray,
): Patch | null {
  let minX = W
  let minY = H
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < H; y++) {
    const row = y * W
    for (let x = 0; x < W; x++) {
      const i = row + x
      if (add[i] !== beforeAdd[i] || erase[i] !== beforeErase[i]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  return {
    x: minX,
    y: minY,
    w,
    h,
    beforeAdd: crop(beforeAdd, W, minX, minY, w, h),
    beforeErase: crop(beforeErase, W, minX, minY, w, h),
    afterAdd: crop(add, W, minX, minY, w, h),
    afterErase: crop(erase, W, minX, minY, w, h),
  }
}

export function applyPatch(p: Patch, W: number, add: Uint8ClampedArray, erase: Uint8ClampedArray, useAfter: boolean) {
  const a = useAfter ? p.afterAdd : p.beforeAdd
  const e = useAfter ? p.afterErase : p.beforeErase
  for (let j = 0; j < p.h; j++) {
    add.set(a.subarray(j * p.w, (j + 1) * p.w), (p.y + j) * W + p.x)
    erase.set(e.subarray(j * p.w, (j + 1) * p.w), (p.y + j) * W + p.x)
  }
}

/** خريطة الحواف (Sobel على السطوع بعد تنعيم خفيف) مقيسة 0..255 */
export function edgeMap(rgba: Uint8ClampedArray, w: number, h: number): Mask {
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) lum[i] = rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114
  const out = new Uint8ClampedArray(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1]
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1]
      out[i] = Math.min(255, Math.hypot(gx, gy) / 2)
    }
  }
  return out
}

/**
 * تحديد الجسم الظاهر تحت المؤشر: نفصل الأجسام المتلاصقة بالحواف القوية
 * (مثل حد القبعة عن القميص) ثم نأخذ المكوّن المتصل ونعيد ما ضاع على الحواف.
 */
export function objectAt(alpha: Mask, edges: Mask, w: number, h: number, x: number, y: number, tol: number): Mask {
  const thr = Math.max(12, 62 - tol * 0.55)
  const ok = (p: number) => alpha[p] >= 128 && edges[p] < thr
  // إن وقع النقر على خط حافة نبحث عن أقرب بكسل سليم
  let sx = x
  let sy = y
  if (!ok(y * w + x)) {
    let found = false
    for (let r = 1; r <= 6 && !found; r++) {
      for (let j = -r; j <= r && !found; j++) {
        for (let i = -r; i <= r; i++) {
          const xx = x + i
          const yy = y + j
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && ok(yy * w + xx)) {
            sx = xx
            sy = yy
            found = true
            break
          }
        }
      }
    }
    if (!found) return componentAt(alpha, w, h, x, y)
  }
  const comp = new Uint8ClampedArray(w * h)
  const stack = new Int32Array(w * h)
  let sp = 0
  comp[sy * w + sx] = 255
  stack[sp++] = sy * w + sx
  while (sp) {
    const p = stack[--sp]
    const px = p % w
    const py = (p - px) / w
    const tp = (q: number) => {
      if (!comp[q] && ok(q)) {
        comp[q] = 255
        stack[sp++] = q
      }
    }
    if (px > 0) tp(p - 1)
    if (px < w - 1) tp(p + 1)
    if (py > 0) tp(p - w)
    if (py < h - 1) tp(p + w)
  }
  closeSmallHoles(comp, w, h)
  growMask(comp, w, h, 3)
  for (let i = 0; i < comp.length; i++) if (alpha[i] < 128) comp[i] = 0
  return comp
}

import { hslToRgb, parseColor, rgbToHsl } from './color'

/* ------------------------------------------------------------------
 * استخراج لوحة الألوان من صورة (k-means) — للألوان المقترحة ومطابقة المرجع
 * ------------------------------------------------------------------ */

export interface PaletteColor {
  hex: string
  weight: number
  h: number
  s: number
  l: number
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

async function pixelsOf(src: Blob | string, max = 96): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  let bmp: ImageBitmap
  if (typeof src === 'string') {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    await img.decode()
    bmp = await createImageBitmap(img)
  } else bmp = await createImageBitmap(src)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k))
  const h = Math.max(1, Math.round(bmp.height * k))
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return { data: ctx.getImageData(0, 0, w, h).data, w, h }
}

/** لوحة ألوان مرتبة بحسب الحضور. الشفاف يُتجاهل */
export async function extractPalette(src: Blob | string, k = 6): Promise<PaletteColor[]> {
  const { data } = await pixelsOf(src)
  const pts: number[][] = []
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 140) pts.push([data[i], data[i + 1], data[i + 2]])
  if (pts.length < 20) return []
  // k-means++ ثابت (بذرة ثابتة لنتائج قابلة للتكرار)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const centers: number[][] = [pts[Math.floor(rnd() * pts.length)]]
  const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  while (centers.length < k) {
    const dist = pts.map((p) => Math.min(...centers.map((c) => d2(p, c))))
    const sum = dist.reduce((a, b) => a + b, 0)
    let r = rnd() * sum
    let idx = 0
    for (; idx < dist.length - 1; idx++) {
      r -= dist[idx]
      if (r <= 0) break
    }
    centers.push(pts[idx])
  }
  let assign = new Array(pts.length).fill(0)
  for (let it = 0; it < 9; it++) {
    assign = pts.map((p) => {
      let best = 0
      let bd = Infinity
      for (let c = 0; c < centers.length; c++) {
        const d = d2(p, centers[c])
        if (d < bd) [bd, best] = [d, c]
      }
      return best
    })
    const sums = centers.map(() => [0, 0, 0, 0])
    pts.forEach((p, i) => {
      const s = sums[assign[i]]
      s[0] += p[0]
      s[1] += p[1]
      s[2] += p[2]
      s[3]++
    })
    sums.forEach((s, c) => {
      if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]
    })
  }
  const counts = new Array(centers.length).fill(0)
  assign.forEach((a) => counts[a]++)
  let out = centers
    .map((c, i) => ({ c, n: counts[i] }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
  // دمج الألوان المتقاربة جداً
  const merged: { c: number[]; n: number }[] = []
  for (const x of out) {
    const near = merged.find((m) => d2(m.c, x.c) < 30 * 30)
    if (near) {
      near.c = near.c.map((v, i) => (v * near.n + x.c[i] * x.n) / (near.n + x.n))
      near.n += x.n
    } else merged.push({ ...x })
  }
  out = merged.sort((a, b) => b.n - a.n)
  return out.map((x) => {
    const [h, s, l] = rgbToHsl(x.c[0], x.c[1], x.c[2])
    return { hex: toHex(x.c[0], x.c[1], x.c[2]), weight: x.n / pts.length, h, s, l }
  })
}

/** أفضل لون مميز (الأكثر تشبعاً مع حضور معقول) */
export function accentOf(p: PaletteColor[]): PaletteColor | null {
  const cands = p.filter((c) => c.s > 0.3 && c.l > 0.14 && c.l < 0.86 && c.weight > 0.025)
  if (!cands.length) return p.find((c) => c.s > 0.18) ?? null
  return cands.sort((a, b) => b.s * (0.5 + Math.sqrt(b.weight)) - a.s * (0.5 + Math.sqrt(a.weight)))[0]
}

/** ألوان متناسقة انطلاقاً من لون */
export function harmonies(hex: string): { name: string; color: string }[] {
  const c = parseColor(hex)
  if (!c) return []
  const [h, s, l] = rgbToHsl(c[0], c[1], c[2])
  const mk = (dh: number, ds = 1, dl = 0) => {
    const [r, g, b] = hslToRgb(h + dh, Math.max(0, Math.min(1, s * ds)), Math.max(0.08, Math.min(0.92, l + dl)))
    return toHex(r, g, b)
  }
  return [
    { name: 'الأصلي', color: hex.toUpperCase() },
    { name: 'داكن', color: mk(0, 1, -0.16) },
    { name: 'فاتح', color: mk(0, 0.85, 0.2) },
    { name: 'مجاور ١', color: mk(28) },
    { name: 'مجاور ٢', color: mk(-28) },
    { name: 'متمّم', color: mk(180) },
  ]
}

export function colorDistance(a: string, b: string): number {
  const p = parseColor(a)
  const q = parseColor(b)
  if (!p || !q) return 441
  return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2)
}

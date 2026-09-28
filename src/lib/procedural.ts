import { mix, parseColor } from './color'

function hexToRgb(c: string) {
  const p = parseColor(c) ?? [128, 128, 128, 1]
  return { r: Math.round(p[0]), g: Math.round(p[1]), b: Math.round(p[2]) }
}

/* ------------------------------------------------------------------
 * مشاهد عرض مولّدة برمجياً (رخام، خرسانة، خشب، تيرازو، بوكيه، غرفة، حرير)
 * بدون أي صور خارجية — تُرسم مرة واحدة لكل (نوع + بذرة + لونين) وتُخزَّن.
 * اللونان يحددان الخامة: الأول أساسي والثاني للعروق/الظل/الحبيبات.
 * ------------------------------------------------------------------ */

export type ProcKind = 'marble' | 'concrete' | 'wood' | 'terrazzo' | 'bokeh' | 'room' | 'silk'

export const PROC_KINDS: ProcKind[] = ['marble', 'concrete', 'wood', 'terrazzo', 'bokeh', 'room', 'silk']
export const isProc = (k: string): k is ProcKind => (PROC_KINDS as string[]).includes(k)

/* ------------------------------ ضجيج ------------------------------ */

function makeRng(seed: number) {
  let t = (seed * 2654435761) >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seed: number) {
  const rnd = makeRng(seed)
  const perm = new Uint8Array(512)
  const val = new Float32Array(256)
  const base = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[base[i], base[j]] = [base[j], base[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255]
  for (let i = 0; i < 256; i++) val[i] = rnd()
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const X = xi & 255
    const Y = yi & 255
    const a = val[perm[perm[X] + Y]]
    const b = val[perm[perm[X + 1] + Y]]
    const c = val[perm[perm[X] + Y + 1]]
    const d = val[perm[perm[X + 1] + Y + 1]]
    const u = fade(xf)
    const v = fade(yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  const fbm = (x: number, y: number, oct = 5) => {
    let s = 0
    let amp = 0.5
    let f = 1
    let norm = 0
    for (let i = 0; i < oct; i++) {
      s += noise(x * f, y * f) * amp
      norm += amp
      amp *= 0.5
      f *= 2.03
    }
    return s / norm
  }
  return { noise, fbm, rnd }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/* ------------------------------ خرائط الخامة (تُحسب مرة لكل بذرة) ------------------------------ */

interface FieldMap {
  w: number
  h: number
  /** قناة أولى: مزج بين اللونين */
  a: Uint8Array
  /** قناة ثانية: ضوء/عروق/حبيبات */
  b: Uint8Array
}

const fieldCache = new Map<string, FieldMap>()

function field(kind: 'marble' | 'concrete' | 'wood' | 'silk', seed: number): FieldMap {
  const key = `${kind}:${seed}`
  const hit = fieldCache.get(key)
  if (hit) return hit
  const w = kind === 'wood' ? 640 : kind === 'silk' ? 300 : 480
  const h = Math.round((w * 4) / 3)
  const { fbm, noise } = makeNoise(seed * 977 + 11)
  const a = new Uint8Array(w * h)
  const b = new Uint8Array(w * h)
  const rnd = makeRng(seed * 31 + 7)
  const ox = rnd() * 50
  const oy = rnd() * 50
  const plank = 5
  const plankShift = Array.from({ length: plank + 1 }, () => rnd())
  for (let y = 0; y < h; y++) {
    const ny = y / h
    for (let x = 0; x < w; x++) {
      const nx = x / w
      const i = y * w + x
      let va = 0
      let vb = 0
      if (kind === 'marble') {
        const turb = fbm(nx * 1.7 + ox, ny * 2.1 + oy, 5)
        const s = Math.sin((nx * 1.9 + ny * 1.15 + turb * 2.5) * Math.PI)
        const vein = Math.pow(1 - Math.abs(s), 9)
        const halo = Math.pow(1 - Math.abs(s), 2.6) * 0.2
        const s2 = Math.sin((nx * 3.7 - ny * 2.3 + turb * 3.6 + 1.7) * Math.PI)
        const vein2 = Math.pow(1 - Math.abs(s2), 22) * 0.5
        va = clamp01(vein + halo + vein2)
        vb = fbm(nx * 1.6 + ox + 9, ny * 1.6 + oy, 4)
      } else if (kind === 'concrete') {
        const cloud = fbm(nx * 3.2 + ox, ny * 3.2 + oy, 6)
        const fine = noise(nx * 90 + ox, ny * 90 + oy)
        const pit = noise(nx * 140 + 5, ny * 140 + 3) > 0.9 ? 1 : 0
        va = clamp01(cloud * 1.15 - 0.08)
        vb = clamp01(fine * 0.7 + pit * 0.55)
      } else if (kind === 'wood') {
        const p = Math.min(plank - 1, Math.floor(ny * plank))
        const local = ny * plank - p
        const grainWarp = fbm(nx * 1.4 + p * 3.1, ny * 4 + ox, 5)
        const grain = 0.5 + 0.5 * Math.sin((ny * plank * 26 + grainWarp * 9 + p * 4) * Math.PI)
        const tone = 0.35 + plankShift[p] * 0.4 + fbm(nx * 0.9 + p, ny * 1.3, 3) * 0.25
        const seam = local < 0.012 || local > 0.988 ? 1 : 0
        // وصلات قصيرة بين الألواح
        const jx = ((nx + plankShift[p] * 2) * 2.3) % 1
        const joint = jx < 0.004 ? 1 : 0
        va = clamp01(tone * 0.6 + grain * 0.4 - (seam || joint ? 0.5 : 0))
        vb = clamp01(grain * 0.6 + (seam || joint ? 1 : 0) * 0.5)
      } else {
        const warp = fbm(nx * 2.2 + ox, ny * 2.2 + oy, 4)
        const t = 0.5 + 0.5 * Math.sin(nx * 6.5 + Math.sin(ny * 3.4 + nx * 2.2) * 2.2 + warp * 2.4)
        va = t
        vb = Math.pow(t, 6)
      }
      a[i] = Math.round(clamp01(va) * 255)
      b[i] = Math.round(clamp01(vb) * 255)
    }
  }
  const f = { w, h, a, b }
  if (fieldCache.size > 10) fieldCache.delete(fieldCache.keys().next().value as string)
  fieldCache.set(key, f)
  return f
}

/* ------------------------------ الرسم ------------------------------ */

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function colorize(f: FieldMap, fn: (a: number, b: number, out: Uint8ClampedArray, o: number) => void): HTMLCanvasElement {
  const c = mk(f.w, f.h)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(f.w, f.h)
  for (let i = 0; i < f.a.length; i++) fn(f.a[i] / 255, f.b[i] / 255, img.data, i * 4)
  ctx.putImageData(img, 0, 0)
  return c
}

function rgb(c: string): [number, number, number] {
  const { r, g, b } = hexToRgb(c)
  return [r, g, b]
}

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function drawMarble(color: string, color2: string, seed: number) {
  const f = field('marble', seed)
  const base = rgb(color)
  const vein = rgb(color2)
  const shade = rgb(mix(color, color2, 0.3))
  return colorize(f, (va, vb, o, i) => {
    let c = lerp3(base, shade, vb * 0.55)
    c = lerp3(c, vein, va * 0.92)
    o[i] = c[0]
    o[i + 1] = c[1]
    o[i + 2] = c[2]
    o[i + 3] = 255
  })
}

function drawConcrete(color: string, color2: string, seed: number) {
  const f = field('concrete', seed)
  const base = rgb(color)
  const dark = rgb(color2)
  return colorize(f, (va, vb, o, i) => {
    let c = lerp3(base, dark, smooth(0.25, 0.85, va) * 0.75)
    c = lerp3(c, dark, vb * 0.28)
    o[i] = c[0]
    o[i + 1] = c[1]
    o[i + 2] = c[2]
    o[i + 3] = 255
  })
}

function drawWood(color: string, color2: string, seed: number) {
  const f = field('wood', seed)
  const light = rgb(color)
  const dark = rgb(color2)
  return colorize(f, (va, vb, o, i) => {
    let c = lerp3(dark, light, va)
    c = lerp3(c, dark, Math.max(0, vb - 0.55) * 0.55)
    o[i] = c[0]
    o[i + 1] = c[1]
    o[i + 2] = c[2]
    o[i + 3] = 255
  })
}

function drawSilk(color: string, color2: string, seed: number) {
  const f = field('silk', seed)
  const a = rgb(color)
  const b = rgb(color2)
  return colorize(f, (va, vb, o, i) => {
    let c = lerp3(b, a, va)
    c = lerp3(c, [255, 255, 255], vb * 0.42)
    o[i] = c[0]
    o[i + 1] = c[1]
    o[i + 2] = c[2]
    o[i + 3] = 255
  })
}

function drawTerrazzo(color: string, color2: string, seed: number) {
  const W = 720
  const H = 960
  const c = mk(W, H)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
  const rnd = makeRng(seed * 131 + 3)
  const palette = [color2, mix(color2, '#ffffff', 0.55), mix(color2, '#000000', 0.4), mix(color, '#000000', 0.18), mix(color2, color, 0.5), '#ffffff']
  const chip = (x: number, y: number, r: number, col: string, alpha: number) => {
    const n = 5 + Math.floor(rnd() * 3)
    const rot = rnd() * Math.PI * 2
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const ang = rot + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.5
      const rr = r * (0.62 + rnd() * 0.5)
      const px = x + Math.cos(ang) * rr
      const py = y + Math.sin(ang) * rr * (0.75 + rnd() * 0.3)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.globalAlpha = alpha
    ctx.fillStyle = col
    ctx.fill()
  }
  const count = 300
  for (let i = 0; i < count; i++) {
    const big = rnd() < 0.18
    const r = big ? 16 + rnd() * 14 : 5 + rnd() * 9
    chip(rnd() * W, rnd() * H, r, palette[Math.floor(rnd() * palette.length)], 0.92)
  }
  // نقاط دقيقة
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.55
    ctx.fillStyle = palette[Math.floor(rnd() * palette.length)]
    ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 2, 2 + rnd() * 2)
  }
  ctx.globalAlpha = 1
  // إضاءة ناعمة
  const g = ctx.createRadialGradient(W * 0.5, H * 0.25, 40, W * 0.5, H * 0.4, H * 0.8)
  g.addColorStop(0, 'rgba(255,255,255,0.16)')
  g.addColorStop(1, 'rgba(0,0,0,0.12)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  return c
}

function drawBokeh(color: string, color2: string, seed: number) {
  const W = 540
  const H = 720
  const c = mk(W, H)
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
  g.addColorStop(0, mix(color, '#ffffff', 0.1))
  g.addColorStop(1, mix(color, '#000000', 0.55))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const rnd = makeRng(seed * 71 + 5)
  const lights = [color2, mix(color2, '#ffffff', 0.55), mix(color2, '#ffcf8a', 0.5), '#ffffff', mix(color2, color, 0.35)]
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 34; i++) {
    const r = 18 + Math.pow(rnd(), 1.7) * 105
    const x = rnd() * W
    const y = rnd() * H
    const col = lights[Math.floor(rnd() * lights.length)]
    const { r: R, g: G, b: B } = hexToRgb(col)
    const a = 0.1 + rnd() * 0.26
    const rg = ctx.createRadialGradient(x, y, r * 0.05, x, y, r)
    rg.addColorStop(0, `rgba(${R},${G},${B},${a * 0.55})`)
    rg.addColorStop(0.78, `rgba(${R},${G},${B},${a * 0.8})`)
    rg.addColorStop(0.94, `rgba(${R},${G},${B},${a * 1.5})`)
    rg.addColorStop(1, `rgba(${R},${G},${B},0)`)
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.85)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
  return c
}

function drawRoom(color: string, color2: string, seed: number) {
  const W = 540
  const H = 720
  const c = mk(W, H)
  const ctx = c.getContext('2d')!
  const { fbm } = makeNoise(seed * 53 + 9)
  const horizon = Math.round(H * 0.66)
  // جدار
  const wall = ctx.createLinearGradient(0, 0, 0, horizon)
  wall.addColorStop(0, mix(color, '#000000', 0.12))
  wall.addColorStop(0.55, color)
  wall.addColorStop(1, mix(color, '#ffffff', 0.12))
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, horizon)
  // أرضية
  const floor = ctx.createLinearGradient(0, horizon, 0, H)
  floor.addColorStop(0, mix(color2, '#ffffff', 0.18))
  floor.addColorStop(1, mix(color2, '#000000', 0.32))
  ctx.fillStyle = floor
  ctx.fillRect(0, horizon, W, H - horizon)
  // نسيج الجص
  const img = ctx.getImageData(0, 0, W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = (fbm(x / 60, y / 60, 4) - 0.5) * (y < horizon ? 22 : 12) + (fbm(x / 3, y / 3, 2) - 0.5) * 7
      const i = (y * W + x) * 4
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
  }
  ctx.putImageData(img, 0, 0)
  // خط التقاء الجدار بالأرض وشريط سفلي
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.fillRect(0, horizon - 10, W, 10)
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillRect(0, horizon, W, 2)
  // ضوء ساقط
  const spot = ctx.createRadialGradient(W * 0.5, H * 0.18, 10, W * 0.5, H * 0.42, H * 0.7)
  spot.addColorStop(0, 'rgba(255,255,255,0.32)')
  spot.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, W, H)
  // ظل الأرضية أسفل الوسط (مكان المنتج)
  const sh = ctx.createRadialGradient(W * 0.5, horizon + 60, 10, W * 0.5, horizon + 60, W * 0.55)
  sh.addColorStop(0, 'rgba(0,0,0,0.34)')
  sh.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.translate(0, horizon + 60)
  ctx.scale(1, 0.32)
  ctx.translate(0, -(horizon + 60))
  ctx.fillStyle = sh
  ctx.fillRect(0, 0, W, H * 3)
  ctx.restore()
  // تعتيم الأطراف
  const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.9)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
  return c
}

/* ------------------------------ الواجهة العامة ------------------------------ */

const urlCache = new Map<string, string>()

/** رابط صورة الخامة (JPEG) — متزامن ومخزَّن */
export function proceduralUrl(kind: ProcKind, color: string, color2: string, seed = 1): string {
  if (typeof document === 'undefined') return ''
  const key = `${kind}|${seed}|${color}|${color2}`
  const hit = urlCache.get(key)
  if (hit) return hit
  let c: HTMLCanvasElement
  switch (kind) {
    case 'marble':
      c = drawMarble(color, color2, seed)
      break
    case 'concrete':
      c = drawConcrete(color, color2, seed)
      break
    case 'wood':
      c = drawWood(color, color2, seed)
      break
    case 'terrazzo':
      c = drawTerrazzo(color, color2, seed)
      break
    case 'bokeh':
      c = drawBokeh(color, color2, seed)
      break
    case 'room':
      c = drawRoom(color, color2, seed)
      break
    default:
      c = drawSilk(color, color2, seed)
  }
  const url = c.toDataURL('image/jpeg', 0.9)
  if (urlCache.size > 30) urlCache.delete(urlCache.keys().next().value as string)
  urlCache.set(key, url)
  return url
}

/** ألوان افتراضية جميلة لكل خامة */
export const PROC_SAMPLES: Record<ProcKind, { color: string; color2: string; label: string }> = {
  marble: { color: '#F4F2EF', color2: '#7C7A78', label: 'رخام' },
  concrete: { color: '#C9CACC', color2: '#7D7E82', label: 'خرسانة' },
  wood: { color: '#D9B48A', color2: '#7A5230', label: 'خشب' },
  terrazzo: { color: '#EFE9E1', color2: '#C1442E', label: 'تيرازو' },
  bokeh: { color: '#151821', color2: '#FFB870', label: 'بوكيه' },
  room: { color: '#E9E4DD', color2: '#B79E85', label: 'غرفة' },
  silk: { color: '#F6D9D6', color2: '#B4535C', label: 'حرير' },
}

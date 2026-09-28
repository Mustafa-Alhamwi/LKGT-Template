/* أدوات ألوان بسيطة */

export function parseColor(c: string): [number, number, number, number] | null {
  c = c.trim()
  if (c.startsWith('#')) {
    let h = c.slice(1)
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('')
    const n = parseInt(h.slice(0, 6), 16)
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
  }
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  if (c === 'transparent') return [0, 0, 0, 0]
  return null
}

export function withAlpha(c: string, a: number): string {
  const p = parseColor(c)
  if (!p) return c
  return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${+(p[3] * a).toFixed(3)})`
}

export function mix(c1: string, c2: string, t: number): string {
  const a = parseColor(c1)
  const b = parseColor(c2)
  if (!a || !b) return c1
  const r = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${r(0)}, ${r(1)}, ${r(2)})`
}

export function toHex(c: string): string {
  const p = parseColor(c)
  if (!p) return '#000000'
  return `#${[p[0], p[1], p[2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

export function alphaOf(c: string): number {
  return parseColor(c)?.[3] ?? 1
}

export function luminance(c: string): number {
  const p = parseColor(c)
  if (!p) return 0
  return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255
}

/* ------------------------------ HSL وإعادة التلوين ------------------------------ */

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return [h, s, l]
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function hslOf(c: string): [number, number, number] | null {
  const p = parseColor(c)
  return p ? rgbToHsl(p[0], p[1], p[2]) : null
}

/** نسبة التباين WCAG بين لونين */
export function contrastRatio(a: string, b: string): number {
  const lum = (c: string) => {
    const p = parseColor(c)
    if (!p) return 0
    const f = (v: number) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2])
  }
  const l1 = lum(a)
  const l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** لون مقروء (أسود/أبيض) فوق خلفية */
export function readableOn(bg: string): string {
  return contrastRatio(bg, '#111214') >= contrastRatio(bg, '#FFFFFF') ? '#111214' : '#FFFFFF'
}

const REF_RED = '#D11A24'

/**
 * إعادة صبغ ألوان الهوية الحمراء (وتدرجاتها الفاتحة والداكنة) إلى لون جديد
 * مع الحفاظ على العلاقات بين الدرجات. الألوان المحايدة والأخرى لا تُمس.
 */
export function makeRecolorer(target: string, from: string = REF_RED): ((c: string) => string) | null {
  const t = hslOf(target)
  const r = hslOf(from)
  if (!t || !r) return null
  let dh = t[0] - r[0]
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  const sk = Math.max(0.05, t[1] / r[1])
  const dl = t[2] - r[2]
  if (Math.abs(dh) < 2 && Math.abs(sk - 1) < 0.03 && Math.abs(dl) < 0.02) return null
  return (c: string) => {
    const p = parseColor(c)
    if (!p || p[3] === 0) return c
    const [h, s, l] = rgbToHsl(p[0], p[1], p[2])
    let dist = Math.abs(h - r[0])
    if (dist > 180) dist = 360 - dist
    if (dist > 30 || s < 0.22 || l < 0.06 || l > 0.98) return c
    const w = 1 - Math.min(1, Math.abs(l - r[2]) / 0.5)
    const nh = h + dh
    const ns = Math.max(0, Math.min(1, s * (sk > 1 ? 1 + (sk - 1) * 0.6 : sk)))
    const nl = Math.max(0.03, Math.min(0.985, l + dl * w))
    const [R, G, B] = hslToRgb(nh, ns, nl)
    return p[3] < 1 ? `rgba(${R}, ${G}, ${B}, ${+p[3].toFixed(3)})` : `#${[R, G, B].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
  }
}

/** تطبيق دالة على كل سلسلة لون داخل كائن (نمط) */
export function mapColors<T>(obj: T, fn: (c: string) => string): T {
  if (typeof obj === 'string') {
    return (/^(#[0-9a-f]{3,8}|rgba?\()/i.test(obj) ? fn(obj) : obj) as unknown as T
  }
  if (Array.isArray(obj)) return obj.map((v) => mapColors(v, fn)) as unknown as T
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = mapColors(v, fn)
    return out as T
  }
  return obj
}

export type ColorFam = 'red' | 'warm' | 'green' | 'blue' | 'purple' | 'neutral'

export const COLOR_FAMILIES: { id: ColorFam; label: string; dot: string }[] = [
  { id: 'red', label: 'أحمر', dot: '#D11A24' },
  { id: 'warm', label: 'دافئ / ذهبي', dot: '#F5B301' },
  { id: 'green', label: 'أخضر', dot: '#1FBF8F' },
  { id: 'blue', label: 'أزرق', dot: '#2A6BFF' },
  { id: 'purple', label: 'بنفسجي', dot: '#7C3AED' },
  { id: 'neutral', label: 'محايد', dot: '#8B8B93' },
]

/** عائلة اللون (للتصفية) */
export function familyOf(c: string): ColorFam | null {
  const h = hslOf(c)
  if (!h) return null
  const [hue, s, l] = h
  if (s < 0.28 || l < 0.1 || l > 0.93) return null
  if (hue >= 345 || hue < 14) return 'red'
  if (hue < 70) return 'warm'
  if (hue < 175) return 'green'
  if (hue < 262) return 'blue'
  return 'purple'
}

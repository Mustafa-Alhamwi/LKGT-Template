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

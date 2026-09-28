import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import type { QrSpec } from '../model/types'
import { withAlpha } from '../lib/color'

/* ------------------------------------------------------------------
 * رموز QR وباركود (EAN-13 / Code128) — SVG نظيف يُصدَّر بدقة
 * ------------------------------------------------------------------ */

// دعم العربية: نُرمّز النص UTF-8
qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s))

/** النص الفعلي داخل الرمز بحسب النوع */
export function qrPayload(q: QrSpec): string {
  const d = q.data.trim()
  switch (q.mode) {
    case 'url':
      return /^[a-z][a-z0-9+.-]*:/i.test(d) ? d : `https://${d}`
    case 'whatsapp': {
      const num = d.replace(/[^\d]/g, '')
      return `https://wa.me/${num}${q.extra?.trim() ? `?text=${encodeURIComponent(q.extra.trim())}` : ''}`
    }
    case 'phone':
      return `tel:${d.replace(/[^\d+]/g, '')}`
    case 'email':
      return `mailto:${d}${q.extra?.trim() ? `?subject=${encodeURIComponent(q.extra.trim())}` : ''}`
    default:
      return d
  }
}

export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, text.length > 60 ? 'M' : 'Q')
  qr.addData(text || ' ')
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

function inFinder(r: number, c: number, n: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
}

function QrSvg({ q }: { q: QrSpec }) {
  const text = qrPayload(q)
  const m = useMemo(() => qrMatrix(text), [text])
  const n = m.length
  const pad = Math.max(0, q.padding)
  const size = n + pad * 2
  let body: React.ReactNode

  if (q.style === 'square') {
    let d = ''
    for (let r = 0; r < n; r++) {
      let c = 0
      while (c < n) {
        if (!m[r][c]) {
          c++
          continue
        }
        let e = c
        while (e < n && m[r][e]) e++
        d += `M${c + pad} ${r + pad}h${e - c}v1h${-(e - c)}z`
        c = e
      }
    }
    body = <path d={d} fill={q.fg} />
  } else {
    const parts: string[] = []
    const rr = q.style === 'dots' ? 0.5 : 0.32
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!m[r][c] || inFinder(r, c, n)) continue
        const x = c + pad
        const y = r + pad
        const k = 1 - 0.0 // module size
        if (q.style === 'dots') {
          parts.push(`M${x + 0.5} ${y + 0.5 - 0.44}a0.44 0.44 0 1 0 0.001 0z`)
        } else {
          parts.push(
            `M${x + rr} ${y}h${k - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${k - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${-(k - 2 * rr)}a${rr} ${rr} 0 0 1 ${-rr} ${-rr}v${-(k - 2 * rr)}a${rr} ${rr} 0 0 1 ${rr} ${-rr}z`,
          )
        }
      }
    }
    const finder = (fx: number, fy: number) => {
      const x = fx + pad
      const y = fy + pad
      return (
        <g key={`${fx}-${fy}`}>
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx={q.style === 'dots' ? 2 : 1.6} fill="none" stroke={q.fg} strokeWidth="1" />
          <rect x={x + 2} y={y + 2} width="3" height="3" rx={q.style === 'dots' ? 1.5 : 0.9} fill={q.fg} />
        </g>
      )
    }
    body = (
      <>
        <path d={parts.join('')} fill={q.fg} />
        {finder(0, 0)}
        {finder(n - 7, 0)}
        {finder(0, n - 7)}
      </>
    )
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shapeRendering={q.style === 'square' ? 'crispEdges' : 'auto'} style={{ overflow: 'visible' }}>
      {q.bgOn && <rect x="0" y="0" width={size} height={size} rx={(q.radius / 100) * size * 0.5} fill={q.bg} />}
      {body}
    </svg>
  )
}

/* ------------------------------ باركود ------------------------------ */

const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

function widthsToBits(w: string): string {
  let out = ''
  let bar = true
  for (const ch of w) {
    out += (bar ? '1' : '0').repeat(+ch)
    bar = !bar
  }
  return out
}

export function code128Bits(text: string): string {
  const vals = [104]
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    vals.push(c >= 32 && c <= 126 ? c - 32 : 31) // غير المدعوم يصبح '?'
  }
  let sum = vals[0]
  for (let i = 1; i < vals.length; i++) sum += i * vals[i]
  vals.push(sum % 103, 106)
  return vals.map((v) => widthsToBits(C128[v])).join('')
}

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const EAN_PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export function ean13(digits: string): { bits: string; full: string } | null {
  const d = digits.replace(/\D/g, '')
  if (d.length !== 12 && d.length !== 13) return null
  const base = d.slice(0, 12)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += +base[i] * (i % 2 === 0 ? 1 : 3)
  const check = (10 - (sum % 10)) % 10
  const full = base + check
  const par = EAN_PAR[+full[0]]
  let bits = '101'
  for (let i = 0; i < 6; i++) bits += (par[i] === 'L' ? EAN_L : EAN_G)[+full[i + 1]]
  bits += '01010'
  for (let i = 0; i < 6; i++) bits += EAN_R[+full[i + 7]]
  bits += '101'
  return { bits, full }
}

function BarSvg({ q }: { q: QrSpec }) {
  const raw = q.data.trim() || '000000000000'
  const ean = ean13(raw)
  const bits = ean ? ean.bits : code128Bits(raw) + '11'
  const label = ean ? ean.full : raw
  const quiet = 10
  const W = bits.length + quiet * 2
  const barH = 62
  const H = barH + 22
  let d = ''
  let i = 0
  while (i < bits.length) {
    if (bits[i] === '1') {
      let e = i
      while (e < bits.length && bits[e] === '1') e++
      d += `M${i + quiet} 0h${e - i}v${barH}h${-(e - i)}z`
      i = e
    } else i++
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" style={{ overflow: 'visible' }}>
      {q.bgOn && <rect x="0" y="-8" width={W} height={H + 8} rx={(q.radius / 100) * 6} fill={q.bg} />}
      <path d={d} fill={q.fg} transform="translate(0 0)" />
      <text x={W / 2} y={barH + 15} textAnchor="middle" fontSize="13" fontFamily={`"LK Lat 400", "LK Ar", monospace`} letterSpacing="3.2" fill={q.fg} shapeRendering="auto">
        {label}
      </text>
    </svg>
  )
}

export function QrView({ spec }: { spec: QrSpec }) {
  return spec.mode === 'barcode' ? <BarSvg q={spec} /> : <QrSvg q={spec} />
}

export const DEFAULT_QR: QrSpec = {
  mode: 'url',
  data: 'www.lk-gt.com',
  extra: '',
  style: 'rounded',
  fg: '#111214',
  bg: '#FFFFFF',
  bgOn: true,
  radius: 22,
  padding: 2,
}

export function qrSoftShadow(c: string) {
  return `drop-shadow(0 12px 22px ${withAlpha(c, 0.28)})`
}

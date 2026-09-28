/* ------------------------------------------------------------------
 * كاتب PDF بسيط: صفحات كل منها صورة JPEG (DCTDecode) بأي مقاس ورقي
 * بدون مكتبات — كافٍ للطباعة الرقمية والمطابع.
 * ------------------------------------------------------------------ */

export interface PdfPage {
  jpeg: Uint8Array
  pxW: number
  pxH: number
  /** مقاس الصفحة بالنقاط (1pt = 1/72 inch) */
  pageW: number
  pageH: number
  /** موضع الصورة داخل الصفحة (نقاط، الأصل أسفل اليسار) */
  x: number
  y: number
  w: number
  h: number
  /** قص الصورة على حدود الصفحة (وضع الملء) */
  clip?: boolean
  /** لون خلفية الصفحة (0..1) */
  bg?: [number, number, number]
}

const enc = new TextEncoder()

function utf16Hex(s: string): string {
  let out = 'FEFF'
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${out}>`
}

const n2 = (v: number) => (Math.round(v * 100) / 100).toString()

export function buildPdf(pages: PdfPage[], meta: { title?: string; author?: string } = {}): Uint8Array {
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let pos = 0
  const push = (b: Uint8Array | string) => {
    const u = typeof b === 'string' ? enc.encode(b) : b
    chunks.push(u)
    pos += u.length
  }
  const obj = (id: number, body: string | (() => void)) => {
    offsets[id] = pos
    push(`${id} 0 obj\n`)
    if (typeof body === 'string') push(body)
    else body()
    push('\nendobj\n')
  }

  push('%PDF-1.4\n')
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  // المعرّفات: 1 كتالوج، 2 صفحات، 3 معلومات، ثم لكل صفحة: صفحة/محتوى/صورة
  const infoId = 3
  const base = 4
  const pageId = (i: number) => base + i * 3
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  const info = [`/Producer (LKGT Template Studio)`]
  if (meta.title) info.push(`/Title ${utf16Hex(meta.title)}`)
  if (meta.author) info.push(`/Author ${utf16Hex(meta.author)}`)
  obj(infoId, `<< ${info.join(' ')} >>`)

  pages.forEach((p, i) => {
    const pid = pageId(i)
    const cid = pid + 1
    const iid = pid + 2
    obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(p.pageW)} ${n2(p.pageH)}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`)
    const bg = p.bg ? `${n2(p.bg[0])} ${n2(p.bg[1])} ${n2(p.bg[2])} rg 0 0 ${n2(p.pageW)} ${n2(p.pageH)} re f\n` : ''
    const clip = p.clip ? `0 0 ${n2(p.pageW)} ${n2(p.pageH)} re W n\n` : ''
    const content = `q\n${bg}${clip}${n2(p.w)} 0 0 ${n2(p.h)} ${n2(p.x)} ${n2(p.y)} cm\n/Im0 Do\nQ\n`
    obj(cid, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`)
    obj(iid, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`)
      push(p.jpeg)
      push('\nendstream')
    })
  })

  const total = base + pages.length * 3
  const xref = pos
  push(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(pos)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

/** مقاسات الورق (نقاط) */
export const PAGE_SIZES: Record<string, { name: string; w: number; h: number }> = {
  a3: { name: 'A3', w: 841.89, h: 1190.55 },
  a4: { name: 'A4', w: 595.28, h: 841.89 },
  a5: { name: 'A5', w: 419.53, h: 595.28 },
  a6: { name: 'A6', w: 297.64, h: 419.53 },
  p13x18: { name: '13×18 سم', w: 368.5, h: 510.24 },
  p10x15: { name: '10×15 سم', w: 283.46, h: 425.2 },
  letter: { name: 'Letter', w: 612, h: 792 },
}

export const MM = 72 / 25.4

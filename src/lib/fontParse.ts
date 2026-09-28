/**
 * قراءة معلومات ملف الخط (TTF/OTF) مباشرة من جداول name و OS/2
 * لنعرف اسم العائلة والوزن الحقيقي بدون الاعتماد على اسم الملف.
 */

export interface FontInfo {
  family: string
  subfamily: string
  fullName: string
  postscriptName: string
  weightClass: number
  italic: boolean
}

function readName(view: DataView, offset: number, length: number, platformID: number): string {
  if (platformID === 0 || platformID === 3) {
    let s = ''
    for (let i = 0; i < length; i += 2) s += String.fromCharCode(view.getUint16(offset + i))
    return s
  }
  let s = ''
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i))
  return s
}

export function parseFont(buf: ArrayBuffer): FontInfo | null {
  try {
    const view = new DataView(buf)
    let base = 0
    const tag = view.getUint32(0)
    // ملفات woff: لا نفك الضغط هنا — نكتفي بإرجاع null ليعتمد البرنامج على اسم الملف
    if (tag === 0x774f4646 || tag === 0x774f4632) return null
    if (tag === 0x74746366) base = view.getUint32(12) // ttc → أول خط
    const numTables = view.getUint16(base + 4)
    const tables: Record<string, number> = {}
    for (let i = 0; i < numTables; i++) {
      const rec = base + 12 + i * 16
      const t = String.fromCharCode(view.getUint8(rec), view.getUint8(rec + 1), view.getUint8(rec + 2), view.getUint8(rec + 3))
      tables[t] = view.getUint32(rec + 8)
    }
    const names: Record<number, string> = {}
    if (tables['name'] !== undefined) {
      const n = tables['name']
      const count = view.getUint16(n + 2)
      const strOff = n + view.getUint16(n + 4)
      for (let i = 0; i < count; i++) {
        const r = n + 6 + i * 12
        const platformID = view.getUint16(r)
        const languageID = view.getUint16(r + 4)
        const nameID = view.getUint16(r + 6)
        const length = view.getUint16(r + 8)
        const off = view.getUint16(r + 10)
        const english = platformID === 1 ? languageID === 0 : platformID === 0 || languageID === 0x409
        if (!english) continue
        if (names[nameID] && platformID === 1) continue
        names[nameID] = readName(view, strOff + off, length, platformID)
      }
    }
    let weightClass = 400
    let italic = false
    if (tables['OS/2'] !== undefined) {
      weightClass = view.getUint16(tables['OS/2'] + 4)
      const fsSelection = view.getUint16(tables['OS/2'] + 62)
      italic = (fsSelection & 1) === 1
    }
    const family = names[16] || names[1] || ''
    const subfamily = names[17] || names[2] || ''
    return {
      family,
      subfamily,
      fullName: names[4] || `${family} ${subfamily}`.trim(),
      postscriptName: names[6] || '',
      weightClass,
      italic: italic || /italic|oblique/i.test(subfamily),
    }
  } catch {
    return null
  }
}

const WEIGHT_WORDS: [RegExp, number][] = [
  [/hairline|thin/i, 100],
  [/extra\s*light|ultra\s*light/i, 200],
  [/semi\s*bold|demi\s*bold/i, 600],
  [/extra\s*bold|ultra\s*bold/i, 800],
  [/black|heavy/i, 900],
  [/light/i, 300],
  [/medium/i, 500],
  [/bold/i, 700],
  [/normal|regular|book|roman/i, 400],
]

/** الوزن من الاسم أولاً (بعض ملفات Araboto تضع كل الأوزان 400) ثم من OS/2 */
export function weightFromName(name: string, fallback = 400): number {
  for (const [re, w] of WEIGHT_WORDS) if (re.test(name)) return w
  return fallback
}

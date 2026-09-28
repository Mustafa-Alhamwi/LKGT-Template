import type { LatWeight, TextStyle } from '../model/types'
import { fontStack } from './fonts'
import { offscreenRoot } from './offscreen'

/* ------------------------------------------------------------------
 * قياس النصوص وملاءمتها للعرض + المد العربي (الكشيدة)
 * ------------------------------------------------------------------ */

let el: HTMLSpanElement | null = null
const cache = new Map<string, number>()
let cacheVersion = -1

function measurer() {
  if (!el) {
    el = document.createElement('span')
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      whiteSpace: 'pre',
      visibility: 'hidden',
      fontKerning: 'normal',
      fontSynthesis: 'none',
      lineHeight: '1',
    } satisfies Partial<CSSStyleDeclaration>)
    offscreenRoot().appendChild(el)
  }
  return el
}

export interface MeasureFont {
  weightAr: number
  weightLat: LatWeight
  tracking: number
  uppercase: boolean
}

/** عرض السطر بحجم 100px (يتناسب خطياً مع الحجم) */
export function measure100(text: string, f: MeasureFont, version: number): number {
  if (version !== cacheVersion) {
    cache.clear()
    cacheVersion = version
  }
  const key = `${f.weightAr}|${f.weightLat}|${f.tracking}|${f.uppercase ? 1 : 0}|${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const m = measurer()
  m.style.fontFamily = fontStack(text, f.weightLat)
  m.style.fontWeight = String(f.weightAr)
  m.style.fontSize = '100px'
  m.style.letterSpacing = `${f.tracking}em`
  m.style.textTransform = f.uppercase ? 'uppercase' : 'none'
  m.textContent = text || ' '
  const w = m.getBoundingClientRect().width
  cache.set(key, w)
  return w
}

export function stripMarks(s: string): string {
  return s.replace(/\*/g, '')
}

export interface RichSeg {
  text: string
  accent: boolean
}

/** النص بين *نجمتين* يأخذ اللون المميز */
export function parseRich(line: string): RichSeg[] {
  const out: RichSeg[] = []
  const parts = line.split('*')
  parts.forEach((p, i) => {
    if (p) out.push({ text: p, accent: i % 2 === 1 })
  })
  return out
}

/* ------------------------------ الكشيدة ------------------------------ */

const DUAL_JOINING = new Set('بتثجحخسشصضطظعغفقكلمنهيئیکگپچـ'.split(''))
const ARABIC_LETTER = /[ؠ-يٮ-ۓۺ-ۼ]/
const ALEFS = new Set('اأإآٱ'.split(''))
const HARAKAT = /[ً-ٰٟ]/
export const TATWEEL = 'ـ'

/** مواضع يمكن إدخال الكشيدة بعدها (داخل الكلمات فقط) */
function candidates(s: string): { pos: number; word: number }[] {
  const out: { pos: number; word: number }[] = []
  let word = 0
  const chars = [...s]
  for (let i = 0; i < chars.length - 1; i++) {
    const c = chars[i]
    if (/\s/.test(c)) {
      word++
      continue
    }
    let j = i + 1
    while (j < chars.length && HARAKAT.test(chars[j])) j++
    const n = chars[j]
    if (!n || !DUAL_JOINING.has(c) || !ARABIC_LETTER.test(n)) continue
    if (c === 'ل' && ALEFS.has(n)) continue // لام ألف
    out.push({ pos: j - 1, word })
  }
  return out
}

function applyKashida(s: string, count: number): string {
  if (count <= 0) return s
  const cands = candidates(s)
  if (!cands.length) return s
  // موضع واحد مفضل لكل كلمة (الأخير — الأجمل بصرياً) ثم مواضع إضافية عند الحاجة
  const byWord = new Map<number, number[]>()
  cands.forEach((c) => byWord.set(c.word, [...(byWord.get(c.word) ?? []), c.pos]))
  const slots: number[] = []
  for (const list of byWord.values()) slots.push(list[list.length - 1])
  for (const list of byWord.values()) for (let k = list.length - 2; k >= 0; k--) slots.push(list[k])
  const perSlot = new Map<number, number>()
  const cap = 7
  let left = count
  const primary = byWord.size
  let round = 0
  while (left > 0 && round < 40) {
    const active = round < 3 ? slots.slice(0, primary) : slots
    let placed = false
    for (const p of active) {
      if (left <= 0) break
      const cur = perSlot.get(p) ?? 0
      if (cur >= cap) continue
      perSlot.set(p, cur + 1)
      left--
      placed = true
    }
    if (!placed) break
    round++
  }
  const chars = [...s]
  return chars.map((c, i) => c + TATWEEL.repeat(perSlot.get(i) ?? 0)).join('')
}

/** مد السطر العربي بالكشيدة حتى يملأ العرض المطلوب */
export function kashidaFit(line: string, targetPx: number, size: number, f: MeasureFont, version: number): string {
  const clean = stripMarks(line)
  const base = (measure100(clean, f, version) * size) / 100
  if (base >= targetPx * 0.985) return line
  const tw = (measure100(TATWEEL, f, version) * size) / 100
  if (tw <= 0.5) return line
  let n = Math.floor((targetPx - base) / tw)
  // نطبق على النص بالعلامات حتى تبقى الكلمات الملونة كما هي
  const apply = (k: number) => {
    const segs = line.split('*')
    const total = [...clean].length
    if (!total) return line
    // نوزع الكشيدة على المقاطع بحسب طولها
    let remaining = k
    return segs
      .map((seg, i) => {
        const share = i === segs.length - 1 ? remaining : Math.round((k * [...seg].length) / total)
        remaining -= share
        return applyKashida(seg, Math.max(0, share))
      })
      .join('*')
  }
  let out = apply(n)
  let guard = 0
  while (n > 0 && (measure100(stripMarks(out), f, version) * size) / 100 > targetPx && guard++ < 60) {
    n--
    out = apply(n)
  }
  return out
}

export interface FitResult {
  lines: string[]
  sizes: number[]
}

export function fitLines(raw: string, st: TextStyle, innerW: number, version: number): FitResult {
  const lines = raw.split('\n')
  const f: MeasureFont = { weightAr: st.weightAr, weightLat: st.weightLat, tracking: st.tracking, uppercase: st.uppercase }
  const widths = lines.map((l) => measure100(stripMarks(l) || ' ', f, version))
  const clamp = (s: number) => Math.max(8, Math.min(st.maxSize, s))
  switch (st.fit) {
    case 'block': {
      const max = Math.max(...widths, 1)
      const s = clamp((100 * innerW) / max)
      return { lines, sizes: lines.map(() => s) }
    }
    case 'lines':
      return { lines, sizes: widths.map((w) => clamp((100 * innerW) / Math.max(w, 1))) }
    case 'kashida': {
      const max = Math.max(...widths, 1)
      const s = Math.min(st.size, (100 * innerW) / max)
      return { lines: lines.map((l) => kashidaFit(l, innerW, s, f, version)), sizes: lines.map(() => s) }
    }
    default: {
      // حجم ثابت — مع تصغير تلقائي إذا تجاوز النص العرض المتاح
      const max = Math.max(...widths, 1)
      const s = Math.min(st.size, (100 * innerW) / max)
      return { lines, sizes: lines.map(() => s) }
    }
  }
}

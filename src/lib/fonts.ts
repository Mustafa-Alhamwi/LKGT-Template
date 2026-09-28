import { get, set } from 'idb-keyval'
import { parseFont, weightFromName } from './fontParse'
import type { ArWeight, LatWeight } from '../model/types'

/* ------------------------------------------------------------------
 * نظام الخطوط
 * -----------
 * العربي دائماً Araboto — الإنكليزي دائماً HP Simplified.
 * نبني عائلات مركّبة بـ unicode-range حتى يتبدل الخط تلقائياً حرفاً بحرف:
 *   "LK Ar"        ← Araboto (كل الأوزان) للحروف العربية وعلامات الترقيم
 *   "LK Lat 300"   ← HP Simplified Light للحروف والأرقام اللاتينية
 *   "LK Lat 400"   ← HP Simplified Regular
 *   "LK Lat 700"   ← HP Simplified Bold
 * فيصبح لكل نص وزن عربي ووزن إنكليزي مستقلان.
 * مصادر الخط (بالأولوية): ملفات مستوردة ← ملفات src/fonts ← الخطوط المثبتة على الجهاز local().
 * ------------------------------------------------------------------ */

export const AR_FAMILY = 'LK Ar'
export const latFamily = (w: LatWeight) => `LK Lat ${w}`
export const FALLBACK = '"Tajawal", "Segoe UI", system-ui, sans-serif'
/** خط واجهة البرنامج نفسها (وليس التصاميم) */
export const UI_FAMILY = 'LK UI'

export const UI_WEIGHTS: { w: number; label: string; ar: string }[] = [
  { w: 100, label: 'Thin', ar: 'رفيع جداً' },
  { w: 300, label: 'Light', ar: 'خفيف' },
  { w: 400, label: 'Regular', ar: 'عادي' },
  { w: 500, label: 'Medium', ar: 'متوسط' },
  { w: 700, label: 'Bold', ar: 'عريض' },
  { w: 900, label: 'Black', ar: 'أسود' },
]

function qomraNames(label: string): string[] {
  const alt = label === 'Regular' ? ['Normal', 'Book', 'Roman'] : label === 'Black' ? ['Heavy', 'ExtraBold', 'Extra Bold'] : label === 'Thin' ? ['Hairline', 'ExtraLight', 'Extra Light'] : label === 'Bold' ? ['SemiBold', 'Semi Bold'] : []
  const out: string[] = []
  for (const l of [label, ...alt]) out.push(`Qomra ${l}`, `Qomra-${l}`, `Qomra${l}`, `Qomra ${l} Regular`, `Qomra-${l}Regular`, `Qomra_${l}`)
  if (label === 'Regular') out.push('Qomra', 'Qomra Regular', 'Qomra-Regular', 'Qomra Normal')
  return out
}

export const AR_WEIGHTS: { w: ArWeight; label: string; ar: string }[] = [
  { w: 100, label: 'Thin', ar: 'رفيع جداً' },
  { w: 300, label: 'Light', ar: 'خفيف' },
  { w: 400, label: 'Normal', ar: 'عادي' },
  { w: 500, label: 'Medium', ar: 'متوسط' },
  { w: 700, label: 'Bold', ar: 'عريض' },
  { w: 900, label: 'Black', ar: 'أسود' },
]

export const LAT_WEIGHTS: { w: LatWeight; label: string; ar: string }[] = [
  { w: 300, label: 'Light', ar: 'خفيف' },
  { w: 400, label: 'Regular', ar: 'عادي' },
  { w: 700, label: 'Bold', ar: 'عريض' },
]

const AR_RANGE =
  'U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+0020-002F, U+003A-0040, U+005B-0060, U+007B-007E, U+00A0, U+00AB, U+00BB, U+200C-200F, U+2010-2027'
const LAT_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

function arabotoNames(label: string): string[] {
  const n = [
    `Araboto ${label}`,
    `Araboto-${label}`,
    `Araboto ${label} Regular`,
    `Araboto${label}-Regular`,
    `Araboto${label}`,
    `Araboto ${label} 400`,
    `Araboto-${label}400`,
    `Araboto ${label.toLowerCase()}`,
  ]
  if (label === 'Normal') n.push('Araboto', 'Araboto Regular', 'Araboto-Regular')
  return n
}

const HP_NAMES: Record<LatWeight, string[]> = {
  300: ['HP Simplified Light', 'HPSimplified-Light', 'HPSimplified_Lt', 'HP Simplified Lt', 'HPSimplifiedLight-Regular', 'HP Simplified Light Regular', 'HP Simplified Hans Light', 'HPSimplifiedHans-Light'],
  400: ['HP Simplified', 'HP Simplified Regular', 'HPSimplified-Regular', 'HPSimplified_Rg', 'HPSimplified', 'HP Simplified Rg', 'HP Simplified Hans', 'HPSimplifiedHans-Regular'],
  700: ['HP Simplified Bold', 'HPSimplified-Bold', 'HPSimplified_Bd', 'HP Simplified Bd', 'HPSimplified Bold', 'HP Simplified Hans Bold', 'HPSimplifiedHans-Bold'],
}

export type FaceOrigin = 'file' | 'local' | 'missing'

export interface FontStatus {
  ui: Record<number, FaceOrigin>
  ar: Record<number, FaceOrigin>
  lat: Record<number, FaceOrigin>
  ready: boolean
  /** أسماء محلية مكتشفة (للعرض) */
  detail: Record<string, string>
}

interface StoredFont {
  id: string
  script: 'ar' | 'lat' | 'ui'
  weight: number
  name: string
  buffer: ArrayBuffer
}

const IDB_KEY = 'lk-font-files'

/** ملفات الخطوط الموضوعة داخل src/fonts تُضمَّن تلقائياً */
const bundled = import.meta.glob('../fonts/*.{ttf,otf,TTF,OTF}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

type Source = { kind: 'buffer'; buffer: ArrayBuffer; name: string } | { kind: 'local'; names: string[]; matched: string }

let arSources: Record<number, Source> = {}
let latSources: Record<number, Source> = {}
let uiSources: Record<number, Source> = {}
let blobUrls: string[] = []
let exportCssCache: string | null = null

function classify(info: { family: string; fullName: string; subfamily: string; postscriptName: string; weightClass: number }, fileName = '') {
  const hay = `${info.family} ${info.fullName} ${info.postscriptName} ${fileName}`
  const script: 'ar' | 'lat' | 'ui' | null = /araboto/i.test(hay) ? 'ar' : /hp\s*_?simplified/i.test(hay) ? 'lat' : /qomra/i.test(hay) ? 'ui' : null
  const weight = weightFromName(`${info.fullName} ${info.subfamily} ${info.postscriptName} ${fileName}`, info.weightClass || 400)
  return { script, weight }
}

async function loadStored(): Promise<StoredFont[]> {
  try {
    return ((await get(IDB_KEY)) as StoredFont[] | undefined) ?? []
  } catch {
    return []
  }
}

async function loadBundled(): Promise<StoredFont[]> {
  const out: StoredFont[] = []
  for (const [path, url] of Object.entries(bundled)) {
    try {
      const buf = await (await fetch(url)).arrayBuffer()
      const info = parseFont(buf)
      const file = path.split('/').pop() ?? path
      const { script, weight } = classify(
        info ?? { family: file, fullName: file, subfamily: '', postscriptName: '', weightClass: 400 },
        file,
      )
      if (!script || info?.italic) continue
      out.push({ id: `bundled:${file}`, script, weight, name: info?.fullName || file, buffer: buf })
    } catch {
      /* تجاهل الملف التالف */
    }
  }
  return out
}

async function probeLocal(names: string[]): Promise<string | null> {
  // نجرب كل اسم على حدة لنعرف الاسم المطابق فعلاً
  for (const n of names) {
    try {
      const f = new FontFace(`lk-probe-${Math.random().toString(36).slice(2)}`, `local("${n}")`)
      await f.load()
      return n
    } catch {
      /* next */
    }
  }
  return null
}

function nearest<T extends number>(want: number, avail: T[]): T | null {
  if (!avail.length) return null
  return avail.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a))
}

function srcFor(s: Source, forExport: boolean): string {
  if (s.kind === 'local') {
    return s.names.map((n) => `local("${n}")`).join(', ')
  }
  if (forExport) {
    return `url(data:font/ttf;base64,${bufToBase64(s.buffer)})`
  }
  const url = URL.createObjectURL(new Blob([s.buffer]))
  blobUrls.push(url)
  return `url(${url})`
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(bin)
}

function buildCss(forExport: boolean): string {
  const rules: string[] = []
  for (const [w, s] of Object.entries(arSources)) {
    rules.push(
      `@font-face{font-family:"${AR_FAMILY}";src:${srcFor(s, forExport)};font-weight:${w};font-style:normal;font-display:block;unicode-range:${AR_RANGE};}`,
    )
  }
  for (const [w, src] of Object.entries(uiSources)) {
    rules.push(`@font-face{font-family:"${UI_FAMILY}";src:${srcFor(src, forExport)};font-weight:${w};font-style:normal;font-display:block;}`)
  }
  const latAvail = Object.keys(latSources).map(Number) as LatWeight[]
  for (const lw of LAT_WEIGHTS) {
    const pick = nearest(lw.w, latAvail)
    if (pick == null) continue
    rules.push(
      `@font-face{font-family:"${latFamily(lw.w)}";src:${srcFor(latSources[pick], forExport)};font-weight:1 1000;font-style:normal;font-display:block;unicode-range:${LAT_RANGE};}`,
    )
  }
  return rules.join('\n')
}

let initPromise: Promise<FontStatus> | null = null

export function initFonts(force = false): Promise<FontStatus> {
  if (initPromise && !force) return initPromise
  initPromise = (async () => {
    blobUrls.forEach((u) => URL.revokeObjectURL(u))
    blobUrls = []
    exportCssCache = null
    arSources = {}
    latSources = {}
    uiSources = {}
    const status: FontStatus = { ui: {}, ar: {}, lat: {}, ready: false, detail: {} }

    const files = [...(await loadBundled()), ...(await loadStored())]
    for (const f of files) {
      const target = f.script === 'ar' ? arSources : f.script === 'ui' ? uiSources : latSources
      target[f.weight] = { kind: 'buffer', buffer: f.buffer, name: f.name }
    }

    await Promise.all([
      ...UI_WEIGHTS.map(async ({ w, label }) => {
        if (uiSources[w]) {
          status.ui[w] = 'file'
          status.detail[`ui${w}`] = (uiSources[w] as { name: string }).name
          return
        }
        const names = qomraNames(label)
        const hit = await probeLocal(names)
        if (hit) {
          uiSources[w] = { kind: 'local', names: [hit, ...names.filter((n) => n !== hit)], matched: hit }
          status.ui[w] = 'local'
          status.detail[`ui${w}`] = hit
        } else status.ui[w] = 'missing'
      }),
      ...AR_WEIGHTS.map(async ({ w, label }) => {
        if (arSources[w]) {
          status.ar[w] = 'file'
          status.detail[`ar${w}`] = (arSources[w] as { name: string }).name
          return
        }
        const names = arabotoNames(label)
        const hit = await probeLocal(names)
        if (hit) {
          arSources[w] = { kind: 'local', names: [hit, ...names.filter((n) => n !== hit)], matched: hit }
          status.ar[w] = 'local'
          status.detail[`ar${w}`] = hit
        } else status.ar[w] = 'missing'
      }),
      ...LAT_WEIGHTS.map(async ({ w }) => {
        if (latSources[w]) {
          status.lat[w] = 'file'
          status.detail[`lat${w}`] = (latSources[w] as { name: string }).name
          return
        }
        const hit = await probeLocal(HP_NAMES[w])
        if (hit) {
          latSources[w] = { kind: 'local', names: [hit, ...HP_NAMES[w].filter((n) => n !== hit)], matched: hit }
          status.lat[w] = 'local'
          status.detail[`lat${w}`] = hit
        } else status.lat[w] = 'missing'
      }),
    ])

    let el = document.getElementById('lk-font-faces') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'lk-font-faces'
      document.head.appendChild(el)
    }
    el.textContent = buildCss(false)

    // تحميل مسبق لكل الأوجه حتى تكون القياسات دقيقة من أول رسم
    const loads: Promise<unknown>[] = []
    document.fonts.forEach((f) => {
      if (f.family.replace(/"/g, '').startsWith('LK ')) loads.push(f.load().catch(() => null))
    })
    await Promise.all(loads)
    await document.fonts.ready
    status.ready = true
    return status
  })()
  return initPromise
}

/** CSS الخطوط لتضمينه في ملف التصدير */
export function getExportFontCss(): string {
  if (exportCssCache == null) exportCssCache = buildCss(true)
  return exportCssCache
}

/* ------------------------------ استيراد ------------------------------ */

async function storeFonts(list: StoredFont[]) {
  const existing = await loadStored()
  const map = new Map(existing.map((f) => [`${f.script}${f.weight}`, f]))
  for (const f of list) map.set(`${f.script}${f.weight}`, f)
  await set(IDB_KEY, [...map.values()])
}

export async function importFontFiles(files: File[]): Promise<{ added: string[]; skipped: string[] }> {
  const added: string[] = []
  const skipped: string[] = []
  const list: StoredFont[] = []
  for (const file of files) {
    const buf = await file.arrayBuffer()
    const info = parseFont(buf)
    const { script, weight } = classify(
      info ?? { family: file.name, fullName: file.name, subfamily: '', postscriptName: '', weightClass: 400 },
      file.name,
    )
    if (!script || info?.italic) {
      skipped.push(file.name)
      continue
    }
    list.push({ id: file.name, script, weight, name: info?.fullName || file.name, buffer: buf })
    added.push(`${info?.fullName || file.name} (${weight})`)
  }
  if (list.length) await storeFonts(list)
  return { added, skipped }
}

interface LocalFontData {
  family: string
  fullName: string
  postscriptName: string
  style: string
  blob(): Promise<Blob>
}

export const canQueryLocalFonts = typeof window !== 'undefined' && 'queryLocalFonts' in window

/** Local Font Access API (Chrome/Edge): يقرأ الخطوط المثبتة فعلاً ويستوردها */
export async function importFromDevice(): Promise<{ added: string[] }> {
  const q = (window as unknown as { queryLocalFonts: () => Promise<LocalFontData[]> }).queryLocalFonts
  const all = await q()
  const list: StoredFont[] = []
  const added: string[] = []
  for (const f of all) {
    const { script, weight } = classify({
      family: f.family,
      fullName: f.fullName,
      subfamily: f.style,
      postscriptName: f.postscriptName,
      weightClass: 400,
    })
    if (!script || /italic|oblique/i.test(f.style)) continue
    const buffer = await (await f.blob()).arrayBuffer()
    list.push({ id: f.postscriptName, script, weight, name: f.fullName, buffer })
    added.push(`${f.fullName} (${weight})`)
  }
  if (list.length) await storeFonts(list)
  return { added }
}

export async function clearImportedFonts() {
  await set(IDB_KEY, [])
}

/* ------------------------------ أدوات ------------------------------ */

const AR_CHAR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g
const LAT_CHAR = /[A-Za-zÀ-ɏ]/g

export function isArabicText(s: string): boolean {
  const a = s.match(AR_CHAR)?.length ?? 0
  const l = s.match(LAT_CHAR)?.length ?? 0
  return a > 0 && a >= l
}

/** قائمة العائلات حسب اللغة الغالبة على النص */
export function fontStack(text: string, latW: LatWeight): string {
  return isArabicText(text)
    ? `"${AR_FAMILY}", "${latFamily(latW)}", ${FALLBACK}`
    : `"${latFamily(latW)}", "${AR_FAMILY}", ${FALLBACK}`
}

import { zipSync } from 'fflate'
import { allPartners, findTemplate, setTask, styleFor, useEditor } from '../store/editor'
import type { EditorState } from '../store/editor'
import { emptyContent } from '../model/demo'
import { canvasFromFormat } from '../model/formats'
import { categoryDef } from '../model/categories'
import { RED } from '../model/brand'
import { DEFAULT_CANVAS, canvasOf, type Design } from '../model/types'
import { normalizeImage, putAsset } from './assets'
import { removeBackgroundMask } from './bgRemoval'
import { newProduct } from './importer'
import { resizeDesign, resizeStyle } from './resize'
import { renderDesign } from './exporter'
import { buildName, titleOf, uniqueName } from './naming'
import { checkCancel, download, prepare, type Ctl, type OnProgress } from './exportJobs'
import { createProjectRecord } from '../store/projects'

/* ------------------------------------------------------------------
 * التوليد الجماعي: جدول (CSV / Excel) + صور منتجات → عشرات التصاميم دفعة واحدة
 * ------------------------------------------------------------------ */

export type FieldKey = 'title' | 'subtitle' | 'tagline' | 'note' | 'kicker' | 'price' | 'oldPrice' | 'discount' | 'cta' | 'features' | 'answer' | 'image' | 'skip'

export const FIELD_LABELS: Record<FieldKey, string> = {
  title: 'العنوان / اسم المنتج',
  subtitle: 'الوصف',
  tagline: 'الجملة التسويقية / الشرح',
  note: 'ملاحظة / مصدر',
  kicker: 'سطر تمهيدي',
  price: 'السعر / الرقم',
  oldPrice: 'السعر القديم',
  discount: 'الخصم',
  cta: 'زر الإجراء',
  features: 'المزايا',
  answer: 'الإجابة (صح/خطأ…)',
  image: 'اسم ملف الصورة',
  skip: '— تجاهل العمود —',
}

const SYN: Record<Exclude<FieldKey, 'skip'>, string[]> = {
  title: ['title', 'name', 'product', 'product name', 'اسم', 'اسم المنتج', 'العنوان', 'المنتج', 'العبارة', 'المعلومة', 'الاسم'],
  subtitle: ['subtitle', 'description', 'desc', 'وصف', 'الوصف', 'وصف المنتج'],
  tagline: ['tagline', 'slogan', 'sentence', 'explanation', 'جملة', 'الجملة', 'الجملة التسويقية', 'التوضيح', 'الشرح', 'التفسير'],
  note: ['note', 'notes', 'source', 'ملاحظة', 'ملاحظات', 'المصدر', 'مدة العرض', 'الشروط'],
  kicker: ['kicker', 'label', 'tag', 'badge', 'سطر تمهيدي', 'وسم', 'العنوان الصغير', 'الشارة'],
  price: ['price', 'new price', 'sale price', 'السعر', 'السعر الجديد', 'سعر', 'رقم'],
  oldPrice: ['old price', 'oldprice', 'was', 'original price', 'السعر القديم', 'السعر السابق', 'قبل'],
  discount: ['discount', 'off', 'الخصم', 'نسبة الخصم', 'خصم'],
  cta: ['cta', 'button', 'action', 'زر', 'دعوة', 'زر الإجراء', 'الإجراء'],
  features: ['features', 'benefits', 'المزايا', 'مزايا', 'ميزات', 'المميزات'],
  answer: ['answer', 'الإجابة', 'الاجابة', 'الجواب', 'صح/خطأ', 'صح خطأ', 'true/false'],
  image: ['image', 'photo', 'picture', 'file', 'filename', 'img', 'صورة', 'الصورة', 'اسم الصورة', 'ملف', 'اسم الملف'],
}

const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()

export function guessField(header: string): FieldKey {
  const h = norm(header)
  for (const [k, list] of Object.entries(SYN) as [Exclude<FieldKey, 'skip'>, string[]][]) if (list.some((x) => norm(x) === h)) return k
  for (const [k, list] of Object.entries(SYN) as [Exclude<FieldKey, 'skip'>, string[]][]) if (list.some((x) => h.includes(norm(x)) && norm(x).length > 3)) return k
  return 'skip'
}

export function parseAnswer(v: string): 'a' | 'b' | null {
  const x = norm(v)
  if (['a', 'true', 'yes', 'y', '1', 'صح', 'صحيح', 'حقيقه', 'حقيقة', 'نعم', 'اول', 'الاول'].includes(x)) return 'a'
  if (['b', 'false', 'no', 'n', '0', 'خطا', 'خطأ', 'غلط', 'خرافه', 'خرافة', 'لا', 'ثاني', 'الثاني'].includes(x)) return 'b'
  return null
}

export const splitFeatures = (v: string) =>
  v
    .split(/[|\n؛;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6)

export interface BatchRow {
  values: Partial<Record<FieldKey, string>>
  file?: File
}

export type ImageMode = 'cutout' | 'product' | 'scene'

export interface BatchJob {
  templateId: string
  /** أول مقاس هو مقاس التصميم؛ البقية تُصدَّر فقط */
  formats: string[]
  rows: BatchRow[]
  mapped: FieldKey[]
  blankUnmapped: boolean
  imageMode: ImageMode
  saveProjects: boolean
  exportImages: boolean
  imageFormat: 'png' | 'jpg'
  scale: number
  nameTemplate: string
}

export function baseDesign(s: EditorState, templateId: string, format: string): Design {
  const t = findTemplate(s, templateId)
  if (!t) throw new Error('القالب غير موجود')
  const cv = canvasFromFormat(format)
  let style = structuredClone(styleFor(s, t))
  if (cv.w !== DEFAULT_CANVAS.w || cv.h !== DEFAULT_CANVAS.h) style = resizeStyle(style, DEFAULT_CANVAS, cv, s.brand)
  return { templateId: t.id, style, content: emptyContent(null, t.category), touched: true, canvas: cv, category: t.category, primary: s.brand.recolor ? s.brand.primary : t.primary ?? RED }
}

const TEXT_KEYS = ['title', 'subtitle', 'tagline', 'note', 'kicker', 'price', 'oldPrice', 'discount', 'cta'] as const

/** يملأ نصوص التصميم من صف (بدون صور) — يُستخدم أيضاً للمعاينة */
export function fillTexts(d: Design, row: BatchRow, mapped: FieldKey[], blankUnmapped: boolean): Design {
  const t = d.content.texts
  for (const k of TEXT_KEYS) {
    const v = row.values[k]
    if (mapped.includes(k)) t[k] = v ?? ''
    else if (blankUnmapped && k !== 'kicker' && k !== 'cta') t[k] = ''
  }
  if (mapped.includes('features')) t.features = row.values.features ? splitFeatures(row.values.features) : []
  else if (blankUnmapped) t.features = []
  if (row.values.answer) d.content.answer = parseAnswer(row.values.answer)
  return d
}

async function attachImage(d: Design, file: File, mode: ImageMode, quality: 'small' | 'medium', label: (s: string, p?: number) => void) {
  const n = await normalizeImage(file)
  const asset = await putAsset(n.blob, file.name, { w: n.w, h: n.h })
  if (mode === 'product' || (mode === 'cutout' && n.hasAlpha)) {
    d.content.product = newProduct(asset.id, null, false)
    return
  }
  if (mode === 'scene') {
    d.content.scene = { assetId: asset.id, place: null }
    return
  }
  label('تفريغ المنتج بالذكاء الاصطناعي…')
  const png = await removeBackgroundMask(n.blob, quality, (p) => label(p.phase === 'download' ? 'تحميل نموذج التفريغ (أول مرة فقط)…' : 'تفريغ المنتج بالذكاء الاصطناعي…', p.ratio))
  const mask = await putAsset(png, 'mask')
  d.content.scene = { assetId: asset.id, place: null }
  d.content.product = newProduct(asset.id, mask.id, true)
}

export async function runBatch(job: BatchJob, ctl: Ctl, progress: OnProgress): Promise<{ count: number; files: number; projects: number; name?: string }> {
  const s = useEditor.getState()
  const total = job.rows.length
  const designs: Design[] = []
  const entries: [string, Uint8Array][] = []
  const used = new Set<string>()
  const formats = job.formats.length ? job.formats : ['post']
  let tpl = job.nameTemplate.trim() || 'LKGT - {title}'
  if (formats.length > 1 && !tpl.includes('{size}')) tpl += ' - {size}'
  if (total > 1 && !tpl.includes('{n}')) tpl += ' - {n}'
  let projects = 0
  for (let i = 0; i < total; i++) {
    checkCancel(ctl)
    const row = job.rows[i]
    const base = fillTexts(baseDesign(s, job.templateId, formats[0]), row, job.mapped, job.blankUnmapped)
    const step = (label: string, p?: number) => progress(i + (p ?? 0.3), total, `${i + 1} / ${total} — ${label}`)
    step('تجهيز التصميم…', 0.05)
    if (row.file) await attachImage(base, row.file, job.imageMode, s.removalQuality, step)
    designs.push(base)
    await prepare([base])
    if (job.saveProjects) {
      const name = (row.values.title || titleOf(base) || `تصميم ${i + 1}`).replace(/\*/g, '').slice(0, 40)
      await createProjectRecord(name, [base])
      projects++
    }
    if (job.exportImages) {
      for (const f of formats) {
        checkCancel(ctl)
        step(`رسم ${f}…`, 0.8)
        const d = f === formats[0] ? base : resizeDesign(base, canvasFromFormat(f), s.brand)
        const blob = await renderDesign(d, s.brand, allPartners(s), s.fontsVersion, { scale: job.scale, format: job.imageFormat, quality: 0.92 })
        const cv = canvasOf(d)
        const t = findTemplate(s, base.templateId)
        const name = uniqueName(
          buildName(tpl, { title: titleOf(base), template: t?.nameEn ?? 'Custom', size: cv.format && cv.format !== 'custom' ? cv.format : `${cv.w}x${cv.h}`, n: i + 1, project: s.projectName, category: categoryDef(base.category).name, ext: job.imageFormat }),
          used,
        )
        entries.push([name, new Uint8Array(await blob.arrayBuffer())])
      }
    }
  }
  let name: string | undefined
  if (entries.length) {
    progress(total, total, 'تجهيز ملف ZIP…')
    if (entries.length === 1) {
      download(entries[0][1], entries[0][0], job.imageFormat === 'png' ? 'image/png' : 'image/jpeg')
      name = entries[0][0]
    } else {
      const zip = zipSync(Object.fromEntries(entries.map(([k, v]) => [k, [v, { level: 0 }]])) as never)
      name = `LKGT - دفعة ${designs.length} تصميم.zip`
      download(zip, name, 'application/zip')
    }
  }
  setTask(null)
  return { count: designs.length, files: entries.length, projects, name }
}

/** مفاتيح مطابقة أسماء الملفات */
export const fileKey = (s: string) => norm(s.replace(/\.[a-z0-9]+$/i, ''))

/** يربط الصور بالصفوف: بالاسم أو بالترتيب */
export function matchImages(rows: BatchRow[], files: File[], hasImageColumn: boolean): BatchRow[] {
  const map = new Map(files.map((f) => [fileKey(f.name), f]))
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return rows.map((r, i) => {
    let file: File | undefined
    if (hasImageColumn && r.values.image) file = map.get(fileKey(r.values.image))
    else if (!hasImageColumn && files.length === rows.length) file = sorted[i]
    return { ...r, file }
  })
}


import { zipSync } from 'fflate'
import { allPartners, findTemplate, syncedSlides, useEditor } from '../store/editor'
import type { EditorState } from '../store/editor'
import { downloadBlob, renderCanvas, renderDesign } from './exporter'
import { resizeDesign } from './resize'
import { canvasFromFormat } from '../model/formats'
import { canvasOf, type Design } from '../model/types'
import { categoryDef } from '../model/categories'
import { getCutout } from './cutout'
import { buildName, safeName, titleOf, uniqueName } from './naming'
import { buildPdf, MM, PAGE_SIZES, type PdfPage } from './pdf'

/* ------------------------------------------------------------------
 * مهام التصدير المتقدم: صور متعددة المقاسات (ZIP) · PDF للطباعة · PSD بطبقات
 * ------------------------------------------------------------------ */

export interface Ctl {
  cancelled: boolean
}
export type OnProgress = (done: number, total: number, label: string) => void
export type Scope = 'current' | 'all'

export const CANCELLED = 'cancelled'

export function checkCancel(c: Ctl) {
  if (c.cancelled) throw new Error(CANCELLED)
}

export function gather(scope: Scope): { s: EditorState; list: { d: Design; n: number }[] } {
  const s = useEditor.getState()
  const all = syncedSlides(s)
  const list = scope === 'all' ? all.map((d, i) => ({ d, n: i + 1 })) : [{ d: s.design, n: s.slideIndex + 1 }]
  return { s, list }
}

/** تجهيز المنتجات المفرّغة قبل الرسم (لحساب المواضع بدقة) */
export async function prepare(designs: Design[]) {
  await Promise.all(designs.map((d) => (d.content.product ? getCutout(d.content.product) : null)))
}

const tplName = (s: EditorState, d: Design) => findTemplate(s, d.templateId)?.nameEn ?? 'Custom'
const sizeLabel = (d: Design) => {
  const cv = canvasOf(d)
  return cv.format && cv.format !== 'custom' ? cv.format : `${cv.w}x${cv.h}`
}

async function bytesOf(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer())
}

function zipName(s: EditorState, first: Design, ext = 'zip') {
  return buildName('LKGT - {project}', { title: titleOf(first), template: '', size: '', n: 1, project: s.projectName || safeName(titleOf(first)), category: categoryDef(first.category).name, ext })
}

export function download(bytes: Uint8Array | Blob, name: string, type = 'application/octet-stream') {
  downloadBlob(bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type }), name)
}

/* ------------------------------ صور ------------------------------ */

export interface ImageJob {
  scope: Scope
  /** معرّفات المقاسات أو 'current' */
  sizes: string[]
  format: 'png' | 'jpg'
  scale: number
  quality: number
  nameTemplate: string
}

export async function runImages(job: ImageJob, ctl: Ctl, progress: OnProgress): Promise<{ files: number; name: string }> {
  const { s, list } = gather(job.scope)
  await prepare(list.map((x) => x.d))
  const sizes = job.sizes.length ? job.sizes : ['current']
  const total = list.length * sizes.length
  let tpl = job.nameTemplate.trim() || '{title}'
  if (sizes.length > 1 && !tpl.includes('{size}')) tpl += ' - {size}'
  if (list.length > 1 && !tpl.includes('{n}')) tpl += ' - {n}'
  const entries: [string, Uint8Array][] = []
  const used = new Set<string>()
  let done = 0
  for (const { d, n } of list) {
    for (const sz of sizes) {
      checkCancel(ctl)
      progress(done, total, `جارِ رسم ${done + 1} من ${total}`)
      const design = sz === 'current' ? d : resizeDesign(d, canvasFromFormat(sz), s.brand)
      const blob = await renderDesign(design, s.brand, allPartners(s), s.fontsVersion, { scale: job.scale, format: job.format, quality: job.quality })
      const name = uniqueName(
        buildName(tpl, { title: titleOf(d), template: tplName(s, d), size: sizeLabel(design), n, project: s.projectName, category: categoryDef(d.category).name, ext: job.format }),
        used,
      )
      entries.push([name, await bytesOf(blob)])
      done++
    }
  }
  progress(total, total, 'تجهيز الملف…')
  if (entries.length === 1) {
    download(entries[0][1], entries[0][0], job.format === 'png' ? 'image/png' : 'image/jpeg')
    return { files: 1, name: entries[0][0] }
  }
  const zip = zipSync(Object.fromEntries(entries.map(([k, v]) => [k, [v, { level: 0 }]])) as never)
  const name = zipName(s, list[0].d)
  download(zip, name, 'application/zip')
  return { files: entries.length, name }
}

/* ------------------------------ PDF ------------------------------ */

export interface PdfJob {
  scope: Scope
  page: 'design' | keyof typeof PAGE_SIZES
  fit: 'fit' | 'fill'
  /** هامش بالملّيمتر (للورق المحدد فقط) */
  margin: number
  dpi: 150 | 300
  quality: number
}

export async function runPdf(job: PdfJob, ctl: Ctl, progress: OnProgress): Promise<{ pages: number; name: string; dpi: number }> {
  const { s, list } = gather(job.scope)
  await prepare(list.map((x) => x.d))
  const pages: PdfPage[] = []
  let minDpi = Infinity
  for (let i = 0; i < list.length; i++) {
    checkCancel(ctl)
    const { d } = list[i]
    progress(i, list.length, `جارِ رسم الصفحة ${i + 1} من ${list.length}`)
    const cv = canvasOf(d)
    const ar = cv.w / cv.h
    let pageW: number
    let pageH: number
    if (job.page === 'design') {
      pageW = cv.w * 0.75
      pageH = cv.h * 0.75
    } else {
      const ps = PAGE_SIZES[job.page]
      const land = cv.w > cv.h
      pageW = land ? ps.h : ps.w
      pageH = land ? ps.w : ps.h
    }
    const m = job.page === 'design' ? 0 : job.margin * MM
    const boxW = pageW - 2 * m
    const boxH = pageH - 2 * m
    let w: number
    let h: number
    if (job.fit === 'fit' || job.page === 'design') {
      w = Math.min(boxW, boxH * ar)
      h = w / ar
    } else {
      w = Math.max(pageW, pageH * ar)
      h = w / ar
    }
    const scale = Math.max(1, Math.min(4, ((w / 72) * (job.page === 'design' ? 192 : job.dpi)) / cv.w))
    const canvas = await renderCanvas(d, s.brand, allPartners(s), s.fontsVersion, { scale, format: 'jpg', quality: job.quality })
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', job.quality))
    if (!blob) throw new Error('encode failed')
    minDpi = Math.min(minDpi, canvas.width / (w / 72))
    pages.push({ jpeg: await bytesOf(blob), pxW: canvas.width, pxH: canvas.height, pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h, clip: job.fit === 'fill' && job.page !== 'design', bg: [1, 1, 1] })
  }
  progress(list.length, list.length, 'كتابة ملف PDF…')
  const pdf = buildPdf(pages, { title: s.projectName || titleOf(list[0].d), author: s.brand.name })
  const name = zipName(s, list[0].d, 'pdf')
  download(pdf, name, 'application/pdf')
  return { pages: pages.length, name, dpi: Math.round(minDpi) }
}

/* ------------------------------ PSD ------------------------------ */

export const PSD_LAYERS: { id: string; name: string }[] = [
  { id: 'backdrop', name: 'الخلفية' },
  { id: 'scene', name: 'صورة الخلفية' },
  { id: 'decor-back', name: 'زخارف خلفية' },
  { id: 'shape', name: 'الشكل تحت المنتج' },
  { id: 'product', name: 'المنتج' },
  { id: 'decor-front', name: 'زخارف أمامية' },
  { id: 'text', name: 'النصوص' },
  { id: 'decor-top', name: 'عناصر علوية' },
  { id: 'chrome', name: 'اللوغو والتواصل' },
]

function hasPixels(c: HTMLCanvasElement): boolean {
  const ctx = c.getContext('2d')!
  const step = 4
  const img = ctx.getImageData(0, 0, c.width, c.height).data
  for (let i = 3; i < img.length; i += 4 * step) if (img[i] > 4) return true
  return false
}

export interface PsdJob {
  scope: Scope
  scale: number
}

export async function runPsd(job: PsdJob, ctl: Ctl, progress: OnProgress): Promise<{ files: number; layers: number; name: string }> {
  const { s, list } = gather(job.scope)
  await prepare(list.map((x) => x.d))
  const { writePsd } = await import('ag-psd')
  const files: [string, Uint8Array][] = []
  const used = new Set<string>()
  let layerCount = 0
  const total = list.length * (PSD_LAYERS.length + 1)
  let done = 0
  for (const { d, n } of list) {
    const composite = await renderCanvas(d, s.brand, allPartners(s), s.fontsVersion, { scale: job.scale, format: 'png' })
    done++
    const children: { name: string; canvas: HTMLCanvasElement }[] = []
    for (const L of PSD_LAYERS) {
      checkCancel(ctl)
      progress(done, total, `الطبقة: ${L.name}`)
      const c = await renderCanvas(d, s.brand, allPartners(s), s.fontsVersion, { scale: job.scale, format: 'png', layers: { include: [L.id] } })
      done++
      if (L.id === 'backdrop' || hasPixels(c)) children.push({ name: L.name, canvas: c })
    }
    layerCount = children.length
    const buf = writePsd({ width: composite.width, height: composite.height, canvas: composite, children }, { generateThumbnail: true, trimImageData: true })
    const name = uniqueName(buildName('{title} - {n}', { title: titleOf(d), template: tplName(s, d), size: sizeLabel(d), n, project: s.projectName, category: categoryDef(d.category).name, ext: 'psd' }), used)
    files.push([name, new Uint8Array(buf)])
  }
  if (files.length === 1) {
    download(files[0][1], files[0][0], 'image/vnd.adobe.photoshop')
    return { files: 1, layers: layerCount, name: files[0][0] }
  }
  const zip = zipSync(Object.fromEntries(files.map(([k, v]) => [k, [v, { level: 0 }]])) as never)
  const name = zipName(s, list[0].d)
  download(zip, name, 'application/zip')
  return { files: files.length, layers: layerCount, name }
}

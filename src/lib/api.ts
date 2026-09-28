import { allTemplates, allPartners, changeContent, openTemplate, setFormat, useEditor } from '../store/editor'
import { importImage } from './importer'
import { downloadBlob, renderDesign } from './exporter'
import type { AdTexts, Design } from '../model/types'
import { buildName, titleOf } from './naming'
import { categoryDef } from '../model/categories'
import { canvasOf } from '../model/types'

/* ------------------------------------------------------------------
 * واجهة برمجية للأتمتة: window.lkgt
 * مثال (من كونسول المتصفح أو سكربت):
 *   lkgt.open('clean-white')
 *   lkgt.fill({ title: 'EB-L200F', tagline: 'صورة *أوضح*' })
 *   await lkgt.image('https://…/product.png', 'product')
 *   await lkgt.download({ scale: 2 })
 * ------------------------------------------------------------------ */

type Fill = Partial<AdTexts> & { answer?: 'a' | 'b' | null }

export interface LkgtApi {
  version: string
  templates(): { id: string; name: string; nameEn: string; category: string; tags: string[] }[]
  open(templateId: string, format?: string): void
  fill(texts: Fill): void
  image(src: string | Blob, as?: 'auto' | 'scene' | 'product'): Promise<void>
  format(id: string): Promise<void>
  render(opts?: { scale?: number; format?: 'png' | 'jpg'; quality?: number }): Promise<Blob>
  download(opts?: { scale?: number; format?: 'png' | 'jpg'; quality?: number; name?: string }): Promise<void>
  project(): { name: string; slides: Design[] }
}

export const lkgtApi: LkgtApi = {
  version: '3.0',
  templates() {
    return allTemplates(useEditor.getState()).map((t) => ({ id: t.id, name: t.name, nameEn: t.nameEn, category: t.category, tags: t.tags }))
  },
  open(id, format) {
    openTemplate(id, format)
  },
  fill(texts) {
    changeContent((c) => {
      const { answer, ...rest } = texts
      Object.assign(c.texts, rest)
      if (answer !== undefined) c.answer = answer
    })
  },
  async image(src, as = 'auto') {
    let blob: Blob
    if (typeof src === 'string') {
      const r = await fetch(src)
      if (!r.ok) throw new Error(`تعذّر تحميل الصورة (${r.status})`)
      blob = await r.blob()
    } else blob = src
    await importImage(blob instanceof File ? blob : new File([blob], 'image', { type: blob.type }), as)
  },
  format(id) {
    return setFormat(id)
  },
  async render(opts = {}) {
    const s = useEditor.getState()
    return renderDesign(s.design, s.brand, allPartners(s), s.fontsVersion, { scale: opts.scale ?? 1, format: opts.format ?? 'png', quality: opts.quality ?? 0.92 })
  },
  async download(opts = {}) {
    const s = useEditor.getState()
    const format = opts.format ?? 'png'
    const blob = await lkgtApi.render({ ...opts, format })
    const cv = canvasOf(s.design)
    downloadBlob(blob, opts.name ?? buildName(s.prefs.nameTemplate || '{title}', { title: titleOf(s.design), template: s.design.templateId, size: cv.format ?? `${cv.w}x${cv.h}`, n: s.slideIndex + 1, project: s.projectName, category: categoryDef(s.design.category).name, ext: format }))
  },
  project() {
    const s = useEditor.getState()
    return { name: s.projectName, slides: structuredClone(s.slides.map((d, i) => (i === s.slideIndex ? s.design : d))) }
  },
}

declare global {
  interface Window {
    lkgt: LkgtApi
  }
}

export function installApi() {
  window.lkgt = lkgtApi
}

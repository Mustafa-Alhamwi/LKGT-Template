import { zipSync } from 'fflate'
import { allPartners, allTemplates, findTemplate, setTask, styleFor, toast, useEditor } from '../store/editor'
import { downloadBlob, renderDesign } from './exporter'
import { buildName, safeName, titleOf, uniqueName } from './naming'
import { categoryDef } from '../model/categories'
import { canvasOf, DEFAULT_CANVAS } from '../model/types'
import { runCheck } from './check'
import { resizeStyle } from './resize'

/* أوامر عامة (تصدير...) */

/** بوابة الجودة: تحذّر قبل تصدير تصميم فيه أخطاء مهمة (نصوص نائبة، خط صغير جداً، تباين ضعيف…) */
async function qualityGate(): Promise<boolean> {
  const s = useEditor.getState()
  if (!s.prefs.checkBeforeExport || !s.design.touched) return true
  let errors
  try {
    errors = (await runCheck()).filter((i) => i.level === 'error')
  } catch {
    return true
  }
  if (!errors.length) return true
  const list = errors
    .slice(0, 4)
    .map((i) => `• ${i.title}`)
    .join('\n')
  const go = confirm(`وُجدت ${errors.length} مشكلة مهمة في التصميم:\n${list}${errors.length > 4 ? '\n…' : ''}\n\nموافق = تصدير رغم ذلك\nإلغاء = مراجعة المشكلات أولاً`)
  if (!go) useEditor.setState({ dialog: 'check' })
  return go
}

export async function exportCurrent() {
  const s = useEditor.getState()
  if (s.task) return
  if (!(await qualityGate())) return
  setTask({ label: 'جارِ تصدير التصميم…', progress: null })
  try {
    const blob = await renderDesign(s.design, s.brand, allPartners(s), s.fontsVersion, {
      scale: s.exportScale,
      format: s.exportFormat,
    })
    const t = findTemplate(s, s.design.templateId)
    const cv = canvasOf(s.design)
    const name = buildName(s.prefs.nameTemplate || '{title}', {
      title: titleOf(s.design),
      template: t?.nameEn ?? 'Custom',
      size: cv.format ?? `${cv.w}x${cv.h}`,
      n: s.slideIndex + 1,
      project: s.projectName,
      category: categoryDef(s.design.category).name,
      ext: s.exportFormat,
    })
    downloadBlob(blob, name)
    toast(`تم التصدير ✓ (${cv.w * s.exportScale}×${cv.h * s.exportScale})`, 'ok')
  } catch (e) {
    console.error(e)
    toast(`فشل التصدير: ${String(e)}`, 'error')
  } finally {
    setTask(null)
  }
}

/** تصدير المحتوى الحالي بكل قوالب الفئة في ملف ZIP واحد */
export async function exportAllTemplates() {
  const s = useEditor.getState()
  if (s.task) return
  const cat = s.design.category ?? 'ads'
  const list = allTemplates(s).filter((t) => t.category === cat)
  const cv = canvasOf(s.design)
  const entries: [string, Uint8Array][] = []
  const used = new Set<string>()
  try {
    for (let i = 0; i < list.length; i++) {
      const t = list[i]
      setTask({ label: `تصدير ${i + 1} من ${list.length}: ${t.name}`, progress: i / list.length })
      let style = structuredClone(styleFor(s, t))
      if (cv.w !== DEFAULT_CANVAS.w || cv.h !== DEFAULT_CANVAS.h) style = resizeStyle(style, DEFAULT_CANVAS, cv, s.brand)
      style.decor = [...style.decor, ...s.design.style.decor.filter((x) => x.carry)]
      const design = { ...s.design, templateId: t.id, style }
      const blob = await renderDesign(design, s.brand, allPartners(s), s.fontsVersion, { scale: s.exportScale, format: s.exportFormat })
      const name = uniqueName(
        buildName('{n} - {title} - {template}', { title: titleOf(s.design), template: t.nameEn, size: '', n: i + 1, project: s.projectName, category: categoryDef(cat).name, ext: s.exportFormat }),
        used,
      )
      entries.push([name, new Uint8Array(await blob.arrayBuffer())])
      await new Promise((r) => setTimeout(r, 0))
    }
    const zip = zipSync(Object.fromEntries(entries.map(([k, v]) => [k, [v, { level: 0 }]])) as never)
    downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `LKGT - ${safeName(s.projectName || titleOf(s.design))} - كل القوالب.zip`)
    toast(`تم تصدير ${list.length} تصميم داخل ملف ZIP ✓`, 'ok')
  } catch (e) {
    toast(`فشل التصدير: ${String(e)}`, 'error')
  } finally {
    setTask(null)
  }
}

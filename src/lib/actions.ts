import { allPartners, allTemplates, findTemplate, setTask, templateStyle, toast, useEditor } from '../store/editor'
import { downloadBlob, exportFileName, renderDesign } from './exporter'

/* أوامر عامة (تصدير...) */

export async function exportCurrent() {
  const s = useEditor.getState()
  if (s.task) return
  setTask({ label: 'جارِ تصدير التصميم…', progress: null })
  try {
    const blob = await renderDesign(s.design, s.brand, allPartners(s), s.fontsVersion, {
      scale: s.exportScale,
      format: s.exportFormat,
    })
    const t = findTemplate(s, s.design.templateId)
    downloadBlob(blob, exportFileName(s.design, t?.nameEn ?? 'Custom', s.exportFormat))
    toast(`تم التصدير ✓ (${1080 * s.exportScale}×${1440 * s.exportScale})`, 'ok')
  } catch (e) {
    console.error(e)
    toast(`فشل التصدير: ${String(e)}`, 'error')
  } finally {
    setTask(null)
  }
}

/** تصدير المحتوى الحالي بكل القوالب دفعة واحدة */
export async function exportAllTemplates() {
  const s = useEditor.getState()
  if (s.task) return
  const list = allTemplates(s)
  try {
    for (let i = 0; i < list.length; i++) {
      const t = list[i]
      setTask({ label: `تصدير ${i + 1} من ${list.length}: ${t.name}`, progress: i / list.length })
      const design = { ...s.design, templateId: t.id, style: templateStyle(s, t) }
      const blob = await renderDesign(design, s.brand, allPartners(s), s.fontsVersion, {
        scale: s.exportScale,
        format: s.exportFormat,
      })
      downloadBlob(blob, exportFileName(design, `${String(i + 1).padStart(2, '0')} ${t.nameEn}`, s.exportFormat))
      await new Promise((r) => setTimeout(r, 350))
    }
    toast(`تم تصدير ${list.length} تصميم ✓`, 'ok')
  } catch (e) {
    toast(`فشل التصدير: ${String(e)}`, 'error')
  } finally {
    setTask(null)
  }
}

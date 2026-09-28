import { initFonts } from './fonts'
import { toast, useEditor } from '../store/editor'

/** تهيئة الخطوط وتحديث الواجهة (يعاد قياس النصوص عند كل تغيير) */
export async function reloadFonts(force = true) {
  const status = await initFonts(force)
  useEditor.setState((s) => ({ fonts: status, fontsVersion: s.fontsVersion + 1 }))
  return status
}

export function bootFonts() {
  reloadFonts(false).then((st) => {
    const ui = Object.values(st.ui).some((v) => v !== 'missing')
    const ar = Object.values(st.ar).some((v) => v !== 'missing')
    const lat = Object.values(st.lat).some((v) => v !== 'missing')
    const missing = [!ui && 'Qomra', !ar && 'Araboto', !lat && 'HP Simplified'].filter(Boolean).join(' و ')
    if (missing) toast(`لم يُعثر على خط: ${missing} — افتح الإعدادات ← الخطوط لاستيراده من جهازك`, 'error', 9000)
  })
  let t: ReturnType<typeof setTimeout> | undefined
  document.fonts.addEventListener('loadingdone', () => {
    clearTimeout(t)
    t = setTimeout(() => useEditor.setState((s) => ({ fontsVersion: s.fontsVersion + 1 })), 80)
  })
}

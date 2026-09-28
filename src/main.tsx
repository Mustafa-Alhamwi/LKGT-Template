import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// خط احتياطي فقط (عند عدم توفر Araboto / HP Simplified)
import '@fontsource/tajawal/300.css'
import '@fontsource/tajawal/400.css'
import '@fontsource/tajawal/500.css'
import '@fontsource/tajawal/700.css'
import '@fontsource/tajawal/800.css'
import '@fontsource/tajawal/900.css'
import './styles/app.css'
import './styles/poster.css'
import App from './App'
import { bootFonts } from './lib/fontBoot'

bootFonts()
import('./store/projects').then((m) => m.startAutosave())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// أدوات تطوير (للاختبار الآلي فقط)
if (import.meta.env.DEV) {
  Promise.all([
    import('./store/editor'),
    import('./lib/exporter'),
    import('./model/registry'),
    import('./lib/importer'),
    import('./store/objects'),
    import('./model/formats'),
  ]).then(([store, exp, tpl, imp, obj, fmt]) => {
    ;(window as unknown as Record<string, unknown>).__lk = { ...store, ...exp, ...imp, ...obj, ...fmt, templates: tpl.BUILTIN_TEMPLATES }
  })
}

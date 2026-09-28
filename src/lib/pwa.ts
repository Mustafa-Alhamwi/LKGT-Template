import { toast } from '../store/editor'

/* تثبيت البرنامج كتطبيق + العمل بدون إنترنت (Service Worker في النسخة المبنية فقط) */

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()

export function canInstall() {
  return !!deferred
}

export function onInstallChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export async function installApp() {
  if (!deferred) return toast('التثبيت غير متاح الآن — استخدم قائمة المتصفح ⋮ ثم «تثبيت التطبيق»', 'info', 5000)
  await deferred.prompt()
  const r = await deferred.userChoice
  deferred = null
  listeners.forEach((f) => f())
  if (r.outcome === 'accepted') toast('تم تثبيت LKGT Studio كتطبيق ✓', 'ok')
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPrompt
    listeners.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((f) => f())
  })
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed') toast(navigator.serviceWorker.controller ? 'يوجد تحديث للبرنامج — سيُطبَّق عند إعادة التشغيل' : 'جاهز للعمل بدون إنترنت ✓', 'ok', 4500)
          })
        })
      })
      .catch(() => undefined)
  })
}

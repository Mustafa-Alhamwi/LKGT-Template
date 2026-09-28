/* LKGT Studio — Service Worker
 * - التنقل: الشبكة أولاً ثم آخر نسخة محفوظة (يعمل بدون إنترنت بعد أول زيارة)
 * - الملفات الثابتة (JS/CSS/خطوط/صور/نموذج التفريغ): من الذاكرة أولاً مع تحديث في الخلفية
 * - لا نخزّن أبداً طلبات واجهات الذكاء الاصطناعي (api.anthropic.com) */
const VERSION = 'v1'
const SHELL = `lkgt-shell-${VERSION}`
const RUNTIME = `lkgt-runtime-${VERSION}`
const MAX_RUNTIME = 220

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(['./', './favicon.svg', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lkgt-') && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length > MAX_RUNTIME) await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME).map((k) => cache.delete(k)))
}

const CACHEABLE_HOSTS = ['staticimgly.com', 'fonts.gstatic.com', 'fonts.googleapis.com']

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.hostname.endsWith('anthropic.com')) return
  const sameOrigin = url.origin === self.location.origin
  if (!sameOrigin && !CACHEABLE_HOSTS.some((h) => url.hostname.endsWith(h))) return

  // صفحات التنقل: شبكة أولاً
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./').then((r) => r || caches.match(req))),
    )
    return
  }

  // بقية الملفات: من الذاكرة أولاً + تحديث صامت
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque') && res.status !== 206) {
            const copy = res.clone()
            caches.open(RUNTIME).then((c) => c.put(req, copy).then(() => trim(c)))
          }
          return res
        })
        .catch(() => hit)
      return hit || net
    }),
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting()
})

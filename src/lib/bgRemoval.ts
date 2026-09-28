/* ------------------------------------------------------------------
 * التفريغ التلقائي بالذكاء الاصطناعي داخل المتصفح (@imgly/background-removal)
 * - يعمل محلياً بالكامل على جهازك (لا تُرفع الصور لأي خادم)
 * - أول مرة يحمّل النموذج (~40–80MB) ثم يُحفظ في ذاكرة المتصفح
 * - للعمل بدون إنترنت: npm run model:offline (ينسخ النموذج إلى public/imgly)
 * ------------------------------------------------------------------ */

const IMGLY_VERSION = '1.4.5'
const CDN = `https://staticimgly.com/@imgly/background-removal-data/${IMGLY_VERSION}/dist/`

let publicPathPromise: Promise<string> | null = null

async function resolvePublicPath(): Promise<string> {
  const local = new URL(`${import.meta.env.BASE_URL}imgly/`, window.location.href).href
  try {
    const r = await fetch(`${local}resources.json`, { cache: 'no-store' })
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return local
  } catch {
    /* CDN */
  }
  return CDN
}

export type RemovalQuality = 'small' | 'medium'

export interface RemovalProgress {
  phase: 'download' | 'compute'
  ratio: number
}

/** يعيد صورة PNG بنفس أبعاد الأصل، قناة الشفافية فيها = قناع المنتج */
export async function removeBackgroundMask(
  image: Blob,
  quality: RemovalQuality,
  onProgress?: (p: RemovalProgress) => void,
): Promise<Blob> {
  publicPathPromise ??= resolvePublicPath()
  const publicPath = await publicPathPromise
  const { removeBackground } = await import('@imgly/background-removal')
  return removeBackground(image, {
    publicPath,
    model: quality,
    proxyToWorker: true,
    output: { format: 'image/png', quality: 1 },
    progress: (key: string, current: number, total: number) => {
      onProgress?.({
        phase: key.startsWith('fetch') ? 'download' : 'compute',
        ratio: total ? current / total : 0,
      })
    },
  })
}

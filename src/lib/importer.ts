import { changeContent, setTask, toast, useEditor } from '../store/editor'
import { DEFAULT_CLEANUP } from '../model/demo'
import type { ProductContent } from '../model/types'
import { getAssetBlob, normalizeImage, putAsset } from './assets'
import { removeBackgroundMask } from './bgRemoval'

/* ------------------------------------------------------------------
 * استيراد الصور:
 *  - صورة عادية (مشهد) → تصبح الخلفية المتدرجة + تفريغ تلقائي للمنتج
 *    ونسخه فوق التدرج بنفس المكان تماماً
 *  - PNG شفاف (منتج مفرغ جاهز) → يوضع مباشرة كمنتج
 * ------------------------------------------------------------------ */

export function newProduct(sourceAssetId: string, maskAssetId: string | null, linked: boolean): ProductContent {
  return {
    sourceAssetId,
    maskAssetId,
    paintAssetId: null,
    cleanup: maskAssetId ? { ...DEFAULT_CLEANUP } : { ...DEFAULT_CLEANUP, islands: false, fillHoles: false, feather: 0 },
    linked,
    place: null,
    enhance: { brightness: 1.02, contrast: 1.04, saturate: 1.05 },
    visible: true,
  }
}

export async function importImage(file: Blob, as: 'auto' | 'scene' | 'product' = 'auto') {
  if (!file.type.startsWith('image/')) {
    toast('الملف ليس صورة', 'error')
    return
  }
  setTask({ label: 'جارِ تحضير الصورة…', progress: null })
  try {
    const n = await normalizeImage(file)
    const asset = await putAsset(n.blob, (file as File).name ?? 'image', { w: n.w, h: n.h })
    const asProduct = as === 'product' || (as === 'auto' && n.hasAlpha)
    if (asProduct) {
      changeContent((c) => {
        // المشهد التجريبي لا يناسب منتجاً جديداً — نبقي خلفية القالب فقط
        if (c.scene?.assetId.startsWith('demo:')) c.scene = null
        c.product = newProduct(asset.id, null, false)
      })
      setTask(null)
      toast('تمت إضافة المنتج المفرغ ✓', 'ok')
      return
    }
    changeContent((c) => {
      c.scene = { assetId: asset.id, place: null }
      c.product = null
    })
    setTask(null)
    await runAutoCutout(asset.id)
  } catch (e) {
    setTask(null)
    toast(`تعذّر استيراد الصورة: ${String(e)}`, 'error')
  }
}

export async function runAutoCutout(sceneAssetId: string) {
  const quality = useEditor.getState().removalQuality
  setTask({ label: 'جارِ تفريغ المنتج بالذكاء الاصطناعي…', progress: 0 })
  try {
    const blob = await getAssetBlob(sceneAssetId)
    if (!blob) throw new Error('missing image')
    const png = await removeBackgroundMask(blob, quality, (p) =>
      setTask({
        label: p.phase === 'download' ? 'تحميل نموذج التفريغ (أول مرة فقط)…' : 'جارِ تفريغ المنتج بالذكاء الاصطناعي…',
        progress: p.ratio,
      }),
    )
    const mask = await putAsset(png, 'mask')
    changeContent((c) => {
      if (c.scene?.assetId !== sceneAssetId) return
      c.product = newProduct(sceneAssetId, mask.id, true)
    })
    toast('تم تفريغ المنتج وإبرازه فوق التدرج ✓', 'ok')
  } catch (e) {
    console.error(e)
    toast('تعذّر التفريغ التلقائي — تحقق من الاتصال لتحميل النموذج أول مرة، أو ارفع صورة PNG مفرغة', 'error', 7000)
  } finally {
    setTask(null)
  }
}

export function pickFile(accept = 'image/*', multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}

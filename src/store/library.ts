import { changeContent, setTask, toast, useEditor, type LibraryItem } from './editor'
import type { ProductContent } from '../model/types'
import { getCutout } from '../lib/cutout'
import { DEFAULT_CLEANUP } from '../model/demo'
import { newProduct } from '../lib/importer'
import { addObject, updateDecor } from './objects'
import { DEFAULT_IMAGE } from '../poster/ImageObject'
import { canvasOf } from '../model/types'

/* مكتبة المنتجات: منتجات مفرّغة محفوظة لإعادة استخدامها بدون إعادة التفريغ */

async function makeThumb(url: string): Promise<{ thumb: string; w: number; h: number }> {
  const img = new Image()
  img.src = url
  await img.decode()
  const k = 220 / Math.max(img.naturalWidth, img.naturalHeight)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * k))
  c.height = Math.max(1, Math.round(img.naturalHeight * k))
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return { thumb: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight }
}

export async function saveProductToLibrary(p: ProductContent, name?: string) {
  setTask({ label: 'جارِ الحفظ في مكتبة المنتجات…', progress: null })
  try {
    const cut = await getCutout(p)
    if (!cut) throw new Error('no cutout')
    const t = await makeThumb(cut.url)
    const item: LibraryItem = {
      id: `lib_${Date.now().toString(36)}`,
      name: name ?? (useEditor.getState().design.content.texts.title || 'منتج').replace(/\*/g, '').slice(0, 40),
      assetId: p.sourceAssetId,
      maskAssetId: p.maskAssetId,
      thumb: t.thumb,
      w: t.w,
      h: t.h,
      at: Date.now(),
    }
    useEditor.setState({ library: [item, ...useEditor.getState().library] })
    toast('تم حفظ المنتج في المكتبة ✓', 'ok')
  } catch (e) {
    toast(`تعذّر الحفظ: ${String(e)}`, 'error')
  } finally {
    setTask(null)
  }
}

export function deleteLibraryItem(id: string) {
  useEditor.setState({ library: useEditor.getState().library.filter((x) => x.id !== id) })
}

/** إدراج منتج من المكتبة كمنتج رئيسي أو كعنصر إضافي */
export async function insertLibraryProduct(item: LibraryItem, as: 'main' | 'extra') {
  if (as === 'main') {
    changeContent((c) => {
      c.product = newProduct(item.assetId, item.maskAssetId, false)
    })
    toast('تم وضع المنتج في التصميم', 'ok')
    return
  }
  const cv = canvasOf(useEditor.getState().design)
  const w = Math.round(Math.min(420, cv.w * 0.4))
  const p: ProductContent = { sourceAssetId: item.assetId, maskAssetId: item.maskAssetId, paintAssetId: null, cleanup: { ...DEFAULT_CLEANUP }, linked: false, place: null, enhance: { brightness: 1, contrast: 1, saturate: 1 }, visible: true }
  const id = addObject({ kind: 'image', w, h: Math.round(w * (item.h / item.w)), layer: 'front', name: item.name, shadow: 'soft', image: { assetId: item.assetId, ...DEFAULT_IMAGE, maskAssetId: item.maskAssetId, mask: 'none', fit: 'contain' } })
  const cut = await getCutout(p)
  if (cut) {
    const hh = Math.round((w * cut.crop.h) / cut.crop.w)
    updateDecor(id, (x) => {
      x.h = hh
    })
  }
}

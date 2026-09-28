import { POSTER_H, POSTER_W } from '../model/types'
import type { Placement, ProductContent, SceneContent, TemplateStyle } from '../model/types'
import type { AssetInfo } from '../lib/assets'
import type { Cutout } from '../lib/cutout'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function coverPlacement(w: number, h: number): Placement {
  const s = Math.max(POSTER_W / w, POSTER_H / h)
  return { x: (POSTER_W - w * s) / 2, y: (POSTER_H - h * s) / 2, w: w * s }
}

export function fitWidthPlacement(w: number, h: number): Placement {
  const s = POSTER_W / w
  return { x: 0, y: POSTER_H - h * s, w: POSTER_W }
}

/** الوضع التلقائي: الصور الطولية تملأ البوستر، والعريضة/المربعة تأخذ العرض كاملاً وتلتصق بالأسفل (والتدرج يذيب حافتها العليا) */
export function autoPlacement(w: number, h: number): Placement {
  return w / h > 0.9 ? fitWidthPlacement(w, h) : coverPlacement(w, h)
}

export function sceneRect(scene: SceneContent | null, info: AssetInfo | undefined): Rect | null {
  if (!scene || !info) return null
  const p = scene.place ?? autoPlacement(info.w, info.h)
  return { x: p.x, y: p.y, w: p.w, h: (p.w * info.h) / info.w }
}

/** مستطيل الصورة المصدر كاملة للمنتج (بإحداثيات البوستر) */
export function productSourceRect(
  product: ProductContent,
  scene: Rect | null,
  cut: Cutout,
  style: TemplateStyle,
): Rect {
  const ratio = cut.srcH / cut.srcW
  if (product.linked && scene && product.sourceAssetId) {
    return { x: scene.x, y: scene.y, w: scene.w, h: scene.w * ratio }
  }
  if (product.place) {
    return { x: product.place.x, y: product.place.y, w: product.place.w, h: product.place.w * ratio }
  }
  // ملاءمة تلقائية داخل منطقة المنتج في القالب (توسيط، مع ميل بسيط للأسفل)
  const a = style.productArea
  const s = Math.min(a.w / cut.crop.w, a.h / cut.crop.h)
  const w = cut.srcW * s
  const free = a.h - cut.crop.h * s
  return {
    x: a.x + (a.w - cut.crop.w * s) / 2 - cut.crop.x * s,
    y: a.y + free * 0.62 - cut.crop.y * s,
    w,
    h: w * ratio,
  }
}

/** حدود المنتج المرئية (بعد القص) بإحداثيات البوستر */
export function productBBox(src: Rect, cut: Cutout): Rect {
  const s = src.w / cut.srcW
  return { x: src.x + cut.crop.x * s, y: src.y + cut.crop.y * s, w: cut.crop.w * s, h: cut.crop.h * s }
}

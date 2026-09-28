import { DEFAULT_CANVAS, canvasOf } from '../model/types'
import type { Canvas, Placement, ProductContent, SceneContent, TemplateStyle } from '../model/types'
import type { AssetInfo } from '../lib/assets'
import { assetInfoSync } from '../lib/assets'
import { cutoutSync } from '../lib/cutout'
import type { Design } from '../model/types'
import type { Cutout } from '../lib/cutout'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function coverPlacement(w: number, h: number, c: Canvas = DEFAULT_CANVAS): Placement {
  const s = Math.max(c.w / w, c.h / h)
  return { x: (c.w - w * s) / 2, y: (c.h - h * s) / 2, w: w * s }
}

export function fitWidthPlacement(w: number, h: number, c: Canvas = DEFAULT_CANVAS): Placement {
  const s = c.w / w
  return { x: 0, y: c.h - h * s, w: c.w }
}

/** الوضع التلقائي: الصور الطولية تملأ البوستر، والعريضة/المربعة تأخذ العرض كاملاً وتلتصق بالأسفل (والتدرج يذيب حافتها العليا) */
export function autoPlacement(w: number, h: number, c: Canvas = DEFAULT_CANVAS): Placement {
  if (c.w / c.h > 1.25) {
    // لوحة أفقية: الصورة بارتفاع اللوحة وتميل لجهة المنتج (يسار)
    const s = Math.max(c.h / h, (c.w * 0.5) / w)
    const iw = w * s
    return { x: Math.min(0, c.w * 0.02), y: c.h - h * s, w: iw }
  }
  return w / h > 0.9 ? fitWidthPlacement(w, h, c) : coverPlacement(w, h, c)
}

export function sceneRect(scene: SceneContent | null, info: AssetInfo | undefined, c: Canvas = DEFAULT_CANVAS): Rect | null {
  if (!scene || !info) return null
  const p = scene.place ?? autoPlacement(info.w, info.h, c)
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


/** مستطيل صورة المنتج المصدر في التصميم الحالي (null إن لم يجهز التفريغ) */
export function productRectOf(d: Design): Rect | null {
  const p = d.content.product
  if (!p) return null
  const cut = cutoutSync(p)
  if (!cut) return null
  const sc = sceneRect(d.content.scene, assetInfoSync(d.content.scene?.assetId), canvasOf(d))
  return productSourceRect(p, sc, cut, d.style)
}

/** حدود المنتج المرئية الآن */
export function productBoxOf(d: Design): Rect | null {
  const p = d.content.product
  const cut = p ? cutoutSync(p) : null
  const r = productRectOf(d)
  return r && cut ? productBBox(r, cut) : null
}

/** تحريك/تحجيم المنتج حسب حدوده المرئية: المركز الأفقي والحافة السفلية والعرض */
export function setProductBox(d: Design, box: { cx?: number; bottom?: number; w?: number }) {
  const p = d.content.product
  const cut = p ? cutoutSync(p) : null
  const r = productRectOf(d)
  if (!p || !cut || !r) return
  const cur = productBBox(r, cut)
  const w = box.w ?? cur.w
  const cx = box.cx ?? cur.x + cur.w / 2
  const bottom = box.bottom ?? cur.y + cur.h
  const s = w / cut.crop.w
  const srcW = cut.srcW * s
  p.linked = false
  p.place = {
    x: cx - (cut.crop.x + cut.crop.w / 2) * s,
    y: bottom - (cut.crop.y + cut.crop.h) * s,
    w: srcW,
  }
}

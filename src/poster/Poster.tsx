import { forwardRef } from 'react'
import type { BrandConfig, Design, PartnerLogo } from '../model/types'
import { POSTER_H, POSTER_W } from '../model/types'
import { useAsset } from '../lib/assets'
import { useCutout } from '../lib/cutout'
import { productBBox, productSourceRect, sceneRect } from './geometry'
import { Backdrop } from './Backdrop'
import { SceneLayer } from './SceneLayer'
import { ShapeLayer } from './ShapeLayer'
import { ProductLayer } from './ProductLayer'
import { DecorLayer } from './DecorLayer'
import { TextBlock } from './TextBlock'
import { Logos } from './Logos'
import { ContactBar } from './ContactBar'
import { useEdit } from './EditContext'

/** أيقونة منتج نائبة للمصغّرات — لا تظهر في التصدير */
function ProductPlaceholder({ area, dark }: { area: { x: number; y: number; w: number; h: number }; dark: boolean }) {
  const c = dark ? 'rgba(255,255,255,0.22)' : 'rgba(20,20,30,0.16)'
  const w = area.w * 0.62
  const h = w * 0.62
  const x = area.x + (area.w - w) / 2
  const y = area.y + area.h * 0.5 - h / 2
  return (
    <svg className="lk-ph" style={{ position: 'absolute', left: x, top: y, width: w, height: h }} viewBox="0 0 100 62" fill="none" stroke={c} strokeWidth="1.6" strokeLinejoin="round">
      <rect x="6" y="8" width="88" height="46" rx="7" strokeDasharray="4 3" />
      <path d="M22 44l16-16 12 12 9-9 19 19" />
      <circle cx="68" cy="22" r="5" />
    </svg>
  )
}

/* ------------------------------------------------------------------
 * البوستر 1080×1440 — ترتيب الطبقات من الأسفل للأعلى:
 * خلفية مولدة ← صورة المشهد متدرجة ← زخارف خلفية ← الشكل تحت المنتج
 * ← المنتج المفرغ (نسخة فوق التدرج) ← زخارف أمامية ← النصوص ← اللوغوهات ← التواصل
 * ------------------------------------------------------------------ */

interface Props {
  design: Design
  brand: BrandConfig
  partners: PartnerLogo[]
  fontsVersion: number
  className?: string
  /** none = تصدير نظيف، thumb = مصغّرات (أيقونة منتج)، edit = مساحة العمل (منطقة إسقاط) */
  placeholders?: 'none' | 'thumb' | 'edit'
}

export const Poster = forwardRef<HTMLDivElement, Props>(function Poster(
  { design, brand, partners, fontsVersion, className, placeholders = 'none' },
  ref,
) {
  const edit = useEdit()
  const { content, style } = design
  const sceneInfo = useAsset(content.scene?.assetId)
  const sRect = sceneRect(content.scene, sceneInfo)
  const product = content.product && content.product.visible ? content.product : null
  const { cutout, busy } = useCutout(product)
  const srcRect = product && cutout ? productSourceRect(product, sRect, cutout, style) : null
  const bbox = srcRect && cutout ? productBBox(srcRect, cutout) : null
  const area = style.productArea
  const shapeBox = bbox ?? (!content.product ? { x: area.x + area.w * 0.1, y: area.y + area.h * 0.25, w: area.w * 0.8, h: area.h * 0.75 } : null)
  const partner = partners.find((p) => p.id === content.partnerLogoId)
  const empty = !content.scene && !content.product
  const ghost = placeholders !== 'none'

  return (
    <div
      ref={ref}
      className={`lk-poster ${className ?? ''}`}
      data-theme={style.theme}
      style={{ width: POSTER_W, height: POSTER_H, position: 'relative', overflow: 'hidden' }}
    >
      <Backdrop style={style.backdrop} />
      {sRect && sceneInfo && <SceneLayer url={sceneInfo.url} rect={sRect} fade={style.fade} fx={style.sceneFx} />}
      <DecorLayer items={style.decor} layer="back" texts={content.texts} />
      <ShapeLayer shape={style.shape} box={shapeBox} />
      {product && cutout && bbox && <ProductLayer product={product} cutout={cutout} bbox={bbox} fx={style.productFx} busy={busy} />}
      {product && !cutout && busy && edit && (
        <div className="lk-product-loading" style={{ left: area.x, top: area.y, width: area.w, height: area.h }}>
          <span className="lk-spinner" />
        </div>
      )}
      <DecorLayer items={style.decor} layer="front" texts={content.texts} />
      {empty && placeholders === 'thumb' && <ProductPlaceholder area={area} dark={style.theme === 'dark'} />}
      {empty && edit && placeholders === 'edit' && (
        <button
          className="lk-dropzone"
          style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => edit.onDropZone()}
        >
          <span className="lk-dropzone-icon">＋</span>
          <span>اسحب صورة المنتج هنا</span>
          <small>أو انقر للاختيار — تفريغ تلقائي وتدرج للخلفية</small>
        </button>
      )}
      <TextBlock tb={style.text} texts={content.texts} extras={content.extras ?? []} fontsVersion={fontsVersion} />
      <Logos brand={brand} lkgt={style.logos.lkgt} partnerVariant={style.logos.partner} partner={partner} ghost={ghost} />
      <ContactBar brand={brand} theme={style.contact.theme} mode={style.theme} accent={style.contact.accent} />
    </div>
  )
})

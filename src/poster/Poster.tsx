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
}

export const Poster = forwardRef<HTMLDivElement, Props>(function Poster(
  { design, brand, partners, fontsVersion, className },
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
      {empty && edit && (
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
      <TextBlock tb={style.text} texts={content.texts} fontsVersion={fontsVersion} />
      <Logos brand={brand} lkgt={style.logos.lkgt} partnerVariant={style.logos.partner} partner={partner} />
      <ContactBar brand={brand} theme={style.contact.theme} mode={style.theme} accent={style.contact.accent} />
    </div>
  )
})

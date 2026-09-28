import type { ProductContent, ProductFx } from '../model/types'
import type { Rect } from './geometry'
import { isSel, useEdit } from './EditContext'
import { withAlpha } from '../lib/color'
import type { Cutout } from '../lib/cutout'

function productFilter(p: ProductContent, fx: ProductFx): string {
  const e = p.enhance
  const parts: string[] = []
  if (e.brightness !== 1) parts.push(`brightness(${e.brightness})`)
  if (e.contrast !== 1) parts.push(`contrast(${e.contrast})`)
  if (e.saturate !== 1) parts.push(`saturate(${e.saturate})`)
  const o = fx.shadowOpacity
  switch (fx.shadow) {
    case 'soft':
      parts.push(`drop-shadow(0 18px 26px rgba(0,0,0,${o}))`)
      break
    case 'float':
      parts.push(`drop-shadow(0 46px 38px rgba(0,0,0,${o * 0.75}))`, `drop-shadow(0 8px 10px rgba(0,0,0,${o * 0.35}))`)
      break
    case 'glow':
      parts.push(`drop-shadow(0 0 34px ${withAlpha(fx.shadowColor, o)})`, `drop-shadow(0 22px 26px rgba(0,0,0,0.45))`)
      break
    case 'contact':
      parts.push(`drop-shadow(0 6px 8px rgba(0,0,0,${o * 0.35}))`)
      break
    case 'outline': {
      const c = fx.shadowColor
      parts.push(`drop-shadow(3px 0 0 ${c})`, `drop-shadow(-3px 0 0 ${c})`, `drop-shadow(0 3px 0 ${c})`, `drop-shadow(0 -3px 0 ${c})`, `drop-shadow(0 16px 22px rgba(0,0,0,${o * 0.6}))`)
      break
    }
  }
  return parts.join(' ') || 'none'
}

/** ظل واقعي: ظل ملامسة داكن + ظل ممتد بحسب شكل المنتج يتلاشى بالبعد ويتشتت أكثر */
function CastShadow({ url, b, fx, flip }: { url: string; b: Rect; fx: ProductFx; flip: boolean }) {
  const ang = fx.shadowAngle ?? -34
  const o = fx.shadowOpacity
  const contactH = Math.max(22, b.w * 0.075)
  const layer = (blur: number, sy: number, alpha: number, fade: number, lift: number): React.CSSProperties => ({
    position: 'absolute',
    left: b.x,
    top: b.y,
    width: b.w,
    height: b.h,
    filter: `brightness(0) blur(${blur}px)`,
    opacity: alpha,
    transformOrigin: '50% 100%',
    transform: `translateY(${lift}px) ${flip ? 'scaleX(-1) ' : ''}scaleY(${sy}) skewX(${ang}deg)`,
    WebkitMaskImage: `linear-gradient(to top, #000 0%, rgba(0,0,0,0.55) ${fade * 0.45}%, transparent ${fade}%)`,
    maskImage: `linear-gradient(to top, #000 0%, rgba(0,0,0,0.55) ${fade * 0.45}%, transparent ${fade}%)`,
  })
  return (
    <>
      <img src={url} alt="" draggable={false} style={layer(b.w * 0.035, 0.26, o * 0.5, 96, b.h * 0.018)} />
      <img src={url} alt="" draggable={false} style={layer(b.w * 0.011, 0.14, o * 0.68, 60, b.h * 0.008)} />
      <div
        style={{
          position: 'absolute',
          left: b.x + b.w * 0.05,
          top: b.y + b.h - contactH * 0.5,
          width: b.w * 0.9,
          height: contactH,
          background: `radial-gradient(closest-side, rgba(0,0,0,${Math.min(0.85, o * 0.95)}) 0%, rgba(0,0,0,${o * 0.38}) 58%, transparent 100%)`,
        }}
      />
    </>
  )
}

interface Props {
  product: ProductContent
  cutout: Cutout
  bbox: Rect
  fx: ProductFx
  busy?: boolean
}

export function ProductLayer({ product, cutout, bbox, fx, busy }: Props) {
  const edit = useEdit()
  const selected = edit && isSel(edit.selection, { kind: 'product' })
  const b = bbox
  const contactH = Math.max(26, b.w * 0.1)

  return (
    <div className="lk-layer" data-layer="product" style={{ pointerEvents: 'none' }}>
      {fx.shadow === 'contact' && (
        <div
          style={{
            position: 'absolute',
            left: b.x + b.w * 0.02,
            top: b.y + b.h - contactH * 0.55,
            width: b.w * 0.96,
            height: contactH,
            background: `radial-gradient(closest-side, rgba(0,0,0,${fx.shadowOpacity}) 0%, rgba(0,0,0,${fx.shadowOpacity * 0.45}) 45%, transparent 100%)`,
          }}
        />
      )}
      {fx.shadow === 'cast' && <CastShadow url={cutout.url} b={b} fx={fx} flip={!!product.flip} />}
      {fx.shadow === 'long' && (
        <img
          src={cutout.url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.h,
            filter: 'brightness(0) blur(7px)',
            opacity: fx.shadowOpacity,
            transformOrigin: '50% 100%',
            transform: 'skewX(-48deg) scaleY(0.32)',
          }}
        />
      )}
      {fx.reflection && (
        <img
          src={cutout.url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: b.x,
            top: b.y + b.h,
            width: b.w,
            height: b.h,
            transform: 'scaleY(-1)',
            transformOrigin: '50% 50%',
            opacity: 0.32,
            filter: 'blur(0.8px)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 32%)',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 32%)',
          }}
        />
      )}
      <img
        src={cutout.url}
        alt=""
        draggable={false}
        data-eid="product"
        onPointerDown={edit ? (e) => edit.startDrag({ kind: 'product' }, e) : undefined}
        style={{
          position: 'absolute',
          left: b.x,
          top: b.y,
          width: b.w,
          height: b.h,
          filter: productFilter(product, fx),
          pointerEvents: edit ? 'auto' : 'none',
          cursor: edit ? 'move' : undefined,
          opacity: (busy ? 0.85 : 1) * (product.opacity ?? 1),
          transform: `${product.flip ? 'scaleX(-1) ' : ''}rotate(${product.rotate ?? 0}deg)`,
        }}
      />
      {selected && (
        <div className="lk-sel" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} data-label="المنتج" />
      )}
    </div>
  )
}

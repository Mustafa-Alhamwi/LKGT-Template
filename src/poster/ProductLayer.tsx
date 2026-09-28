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
  }
  return parts.join(' ') || 'none'
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
    <div className="lk-layer" style={{ pointerEvents: 'none' }}>
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
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 32%)',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 32%)',
          }}
        />
      )}
      <img
        src={cutout.url}
        alt=""
        draggable={false}
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
          opacity: busy ? 0.85 : 1,
        }}
      />
      {selected && (
        <div className="lk-sel" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} data-label="المنتج" />
      )}
    </div>
  )
}

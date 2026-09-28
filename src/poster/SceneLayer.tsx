import type { FadeStyle, SceneFx } from '../model/types'
import type { Rect } from './geometry'
import { useEdit } from './EditContext'
import { useCanvas } from './CanvasContext'

/** تدرج الشفافية: 100% في الأسفل ← قيمة الأعلى (0–30%) مع منحنى ناعم */
export function fadeMask(f: FadeStyle): string {
  const stops: string[] = []
  const from = Math.min(f.from, f.to - 0.01)
  stops.push(`#000 0%`, `#000 ${(from * 100).toFixed(2)}%`)
  const N = 8
  for (let i = 1; i <= N; i++) {
    const t = i / N
    const e = t * t * (3 - 2 * t) // smoothstep
    const a = 1 - (1 - f.top) * e
    const pos = from + (f.to - from) * t
    stops.push(`rgba(0,0,0,${a.toFixed(3)}) ${(pos * 100).toFixed(2)}%`)
  }
  stops.push(`rgba(0,0,0,${f.top}) 100%`)
  return `linear-gradient(to top, ${stops.join(', ')})`
}

export function sceneFilter(fx: SceneFx): string {
  const parts: string[] = []
  if (fx.blur > 0) parts.push(`blur(${fx.blur}px)`)
  if (fx.brightness !== 1) parts.push(`brightness(${fx.brightness})`)
  if (fx.contrast !== 1) parts.push(`contrast(${fx.contrast})`)
  if (fx.saturate !== 1) parts.push(`saturate(${fx.saturate})`)
  if (fx.grayscale > 0) parts.push(`grayscale(${fx.grayscale})`)
  return parts.join(' ') || 'none'
}

interface Props {
  url: string
  rect: Rect
  fade: FadeStyle
  fx: SceneFx
}

export function SceneLayer({ url, rect, fade, fx }: Props) {
  const edit = useEdit()
  const { w: POSTER_W, h: POSTER_H } = useCanvas()
  const mask = fade.enabled ? fadeMask(fade) : undefined
  const featherTop = rect.y > 1
  const featherSides = rect.x > 1 || rect.x + rect.w < POSTER_W - 1
  const featherBottom = rect.y + rect.h < POSTER_H - 1
  const vMask =
    featherTop || featherBottom
      ? `linear-gradient(to bottom, ${featherTop ? 'transparent 0, #000 110px' : '#000 0'}, ${featherBottom ? '#000 calc(100% - 90px), transparent 100%' : '#000 100%'})`
      : undefined
  const hMask = featherSides ? 'linear-gradient(to right, transparent 0, #000 90px, #000 calc(100% - 90px), transparent 100%)' : undefined
  const bleed = fx.blur > 0 ? fx.blur * 2.5 : 0

  return (
    <div
      className="lk-layer"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
      onPointerDown={edit ? (e) => edit.startDrag({ kind: 'scene' }, e) : undefined}
      data-hit={edit ? 'scene' : undefined}
    >
      <div
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          WebkitMaskImage: vMask,
          maskImage: vMask,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: hMask, maskImage: hMask }}>
          <img
            src={url}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: -bleed,
              top: -bleed,
              width: `calc(100% + ${bleed * 2}px)`,
              height: `calc(100% + ${bleed * 2}px)`,
              filter: sceneFilter(fx),
              maxWidth: 'none',
            }}
          />
        </div>
      </div>
      {fx.tintOpacity > 0 && <div className="lk-layer" style={{ background: fx.tint, opacity: fx.tintOpacity }} />}
    </div>
  )
}

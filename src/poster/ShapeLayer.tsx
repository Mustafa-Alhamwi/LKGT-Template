import { useId } from 'react'
import type { ShapeStyle } from '../model/types'
import { POSTER_H, POSTER_W } from '../model/types'
import type { Rect } from './geometry'
import { isSel, useEdit } from './EditContext'
import { mix } from '../lib/color'

/**
 * الشكل تحت المنتج — يُحسب تلقائياً من حدود المنتج المفرغ
 * (مستطيل مائل، دائرة، حلقات، منصة، قوس، هالة، شريط...)
 */
export function ShapeLayer({ shape, box }: { shape: ShapeStyle; box: Rect | null }) {
  const uid = useId().replace(/:/g, '')
  const edit = useEdit()
  if (shape.kind === 'none' || !box) return null
  const b = { ...box, x: box.x + shape.offsetX, y: box.y + shape.offsetY }
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const bottom = b.y + b.h
  const grad = `lkg-${uid}`
  const radial = `lkr-${uid}`
  const fill = shape.color2 && shape.color2 !== shape.color ? `url(#${grad})` : shape.color
  const selected = edit && isSel(edit.selection, { kind: 'shape' })
  const hit = edit
    ? {
        onPointerDown: (e: React.PointerEvent) => edit.startDrag({ kind: 'shape' }, e),
        style: { cursor: 'move', pointerEvents: 'visiblePainted' as const },
      }
    : { style: { pointerEvents: 'none' as const } }

  let body: React.ReactNode = null
  switch (shape.kind) {
    case 'slab': {
      const x0 = b.x - shape.spread * b.w
      const x1 = b.x + b.w + shape.spread * b.w
      const y0 = b.y + shape.top * b.h
      const y1 = bottom + shape.bottom
      const h = Math.max(10, y1 - y0)
      const tcx = (x0 + x1) / 2
      const tcy = (y0 + y1) / 2
      body = (
        <rect
          x={x0}
          y={y0}
          width={x1 - x0}
          height={h}
          rx={shape.radius}
          fill={fill}
          transform={`translate(${tcx} ${tcy}) skewX(${shape.skew}) translate(${-tcx} ${-tcy})`}
          {...hit}
        />
      )
      break
    }
    case 'circle': {
      const r = Math.max(b.w, b.h) * 0.52 * shape.scale
      body = <circle cx={cx} cy={cy + (shape.top - 0.5) * b.h * 0.3} r={r} fill={fill} {...hit} />
      break
    }
    case 'rings': {
      const r = Math.max(b.w, b.h) * 0.55 * shape.scale
      const gap = shape.stroke * 3.2
      body = (
        <g fill="none" stroke={shape.color} strokeWidth={shape.stroke} {...hit}>
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={cx} cy={cy} r={r - i * gap} opacity={1 - i * 0.18} />
          ))}
        </g>
      )
      break
    }
    case 'floor': {
      const rx = b.w * 0.5 * (1 + shape.spread) * shape.scale
      const ry = Math.max(18, rx * 0.16)
      body = <ellipse cx={cx} cy={bottom + ry * 0.15} rx={rx} ry={ry} fill={`url(#${radial})`} {...hit} />
      break
    }
    case 'podium': {
      const rx = b.w * 0.5 * (1 + shape.spread) * shape.scale
      const ry = rx * 0.16
      const top = bottom - ry * 0.35
      const base = Math.min(POSTER_H + 50, top + Math.max(80, shape.bottom + ry * 2))
      body = (
        <g {...hit}>
          <path d={`M${cx - rx} ${top} L${cx - rx} ${base} A${rx} ${ry} 0 0 0 ${cx + rx} ${base} L${cx + rx} ${top} Z`} fill={fill} />
          <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={mix(shape.color, '#ffffff', 0.25)} />
          <ellipse cx={cx} cy={top} rx={rx * 0.9} ry={ry * 0.78} fill={mix(shape.color, '#ffffff', 0.12)} />
        </g>
      )
      break
    }
    case 'arch': {
      const x0 = b.x - shape.spread * b.w
      const x1 = b.x + b.w + shape.spread * b.w
      const w = x1 - x0
      const y0 = b.y + shape.top * b.h
      const y1 = bottom + shape.bottom
      const r = w / 2
      const br = Math.min(shape.radius, w / 4)
      body = (
        <path
          d={`M${x0} ${y0 + r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} L${x1} ${y1 - br} Q${x1} ${y1} ${x1 - br} ${y1} L${x0 + br} ${y1} Q${x0} ${y1} ${x0} ${y1 - br} Z`}
          fill={fill}
          {...hit}
        />
      )
      break
    }
    case 'halo': {
      const r = Math.max(b.w, b.h) * 0.75 * shape.scale
      body = <circle cx={cx} cy={cy} r={r} fill={`url(#${radial})`} {...hit} />
      break
    }
    case 'band': {
      const t = b.h * 0.42 * shape.scale
      const yc = b.y + shape.top * b.h
      const len = POSTER_W * 1.8
      body = (
        <rect
          x={cx - len / 2}
          y={yc - t / 2}
          width={len}
          height={t}
          fill={fill}
          transform={`rotate(${shape.skew} ${cx} ${yc})`}
          {...hit}
        />
      )
      break
    }
    case 'frame': {
      const x0 = b.x - shape.spread * b.w
      const x1 = b.x + b.w + shape.spread * b.w
      const y0 = b.y + shape.top * b.h
      const y1 = bottom + shape.bottom
      body = (
        <rect
          x={x0}
          y={y0}
          width={x1 - x0}
          height={y1 - y0}
          rx={shape.radius}
          fill="none"
          stroke={shape.color}
          strokeWidth={shape.stroke}
          {...hit}
        />
      )
      break
    }
    case 'blob': {
      const s = (Math.max(b.w, b.h) / 200) * 1.25 * shape.scale
      body = (
        <path
          d="M52.6,-60.8C66.3,-49.9,74.6,-31.7,77.3,-12.8C80,6.2,77.1,25.9,66.6,40.6C56.1,55.3,38,65,18.6,71.4C-0.8,77.8,-21.5,80.9,-38.6,73.5C-55.7,66.1,-69.2,48.2,-75.4,28.4C-81.6,8.6,-80.5,-13.1,-71.3,-30.4C-62.1,-47.7,-44.8,-60.6,-26.7,-69.4C-8.6,-78.2,10.3,-82.9,27.2,-78.1C44.1,-73.3,39,-71.7,52.6,-60.8Z"
          fill={fill}
          transform={`translate(${cx} ${cy + b.h * 0.08}) scale(${s})`}
          {...hit}
        />
      )
      break
    }
  }

  return (
    <svg
      className="lk-layer"
      width={POSTER_W}
      height={POSTER_H}
      viewBox={`0 0 ${POSTER_W} ${POSTER_H}`}
      style={{ opacity: shape.opacity, pointerEvents: 'none', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shape.color} />
          <stop offset="1" stopColor={shape.color2 || shape.color} />
        </linearGradient>
        <radialGradient id={radial}>
          <stop offset="0" stopColor={shape.color} stopOpacity={1} />
          <stop offset="0.45" stopColor={shape.color} stopOpacity={0.55} />
          <stop offset="1" stopColor={shape.color} stopOpacity={0} />
        </radialGradient>
      </defs>
      {body}
      {selected && <rect x={b.x - 6} y={b.y - 6} width={b.w + 12} height={b.h + 12} className="lk-sel-svg" />}
    </svg>
  )
}

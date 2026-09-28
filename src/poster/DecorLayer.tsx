import type { AdTexts, DecorItem } from '../model/types'
import { isSel, useEdit } from './EditContext'
import { noiseUrl } from './Backdrop'
import { withAlpha } from '../lib/color'
import { fontStack } from '../lib/fonts'
import { measure100 } from '../lib/textFit'
import { useEditor } from '../store/editor'

function resolveText(t: string, texts: AdTexts): string {
  return t.replace('{title}', texts.title).replace('{badge}', texts.badge).replace('{kicker}', texts.kicker)
}

function DecorBody({ d, texts }: { d: DecorItem; texts: AdTexts }) {
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const c = d.color
  switch (d.kind) {
    case 'stripes':
      return (
        <div
          className="lk-fill"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, ${c} 0 ${d.size}px, transparent ${d.size}px ${d.size * 2}px)`,
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 55%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, #000 55%)',
          }}
        />
      )
    case 'rings': {
      const n = 5
      const r = d.w / 2
      const gap = Math.max(d.size * 4, r / (n + 1))
      return (
        <svg className="lk-fill" viewBox={`0 0 ${d.w} ${d.h}`} style={{ overflow: 'visible' }}>
          {Array.from({ length: n }).map((_, i) => (
            <circle key={i} cx={d.w / 2} cy={d.h / 2} r={Math.max(4, r - i * gap)} fill="none" stroke={c} strokeWidth={d.size} />
          ))}
        </svg>
      )
    }
    case 'arc': {
      const r = d.w / 2
      return (
        <svg className="lk-fill" viewBox={`0 0 ${d.w} ${d.h}`} style={{ overflow: 'visible' }}>
          <path d={`M ${d.w / 2 + r * 0.7} ${d.h / 2 - r * 0.7} A ${r} ${r} 0 1 0 ${d.w / 2 + r * 0.7} ${d.h / 2 + r * 0.7}`} fill="none" stroke={c} strokeWidth={d.size} />
          <path d={`M ${d.w / 2 + r * 0.55} ${d.h / 2 - r * 0.55} A ${r * 0.78} ${r * 0.78} 0 1 0 ${d.w / 2 + r * 0.6} ${d.h / 2 + r * 0.45}`} fill="none" stroke={c} strokeWidth={d.size} />
        </svg>
      )
    }
    case 'grid':
      return (
        <div
          className="lk-fill"
          style={{
            backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`,
            backgroundSize: `${d.size}px ${d.size}px`,
            backgroundPosition: 'center center',
            WebkitMaskImage: 'radial-gradient(80% 65% at 50% 55%, #000 30%, transparent 100%)',
            maskImage: 'radial-gradient(80% 65% at 50% 55%, #000 30%, transparent 100%)',
          }}
        />
      )
    case 'dots':
      return (
        <div
          className="lk-fill"
          style={{
            backgroundImage: `radial-gradient(${c} 2px, transparent 2.6px)`,
            backgroundSize: `${d.size * 6}px ${d.size * 6}px`,
          }}
        />
      )
    case 'corners': {
      const L = 70
      const s = d.size
      return (
        <svg className="lk-fill" viewBox={`0 0 ${d.w} ${d.h}`} style={{ overflow: 'visible' }}>
          <g fill="none" stroke={c} strokeWidth={s} strokeLinecap="square">
            <path d={`M0 ${L} V0 H${L}`} />
            <path d={`M${d.w - L} 0 H${d.w} V${L}`} />
            <path d={`M0 ${d.h - L} V${d.h} H${L}`} />
            <path d={`M${d.w - L} ${d.h} H${d.w} V${d.h - L}`} />
          </g>
        </svg>
      )
    }
    case 'line':
      return <div className="lk-fill" style={{ background: c, borderRadius: Math.min(d.w, d.h) / 2 }} />
    case 'glow':
      return <div className="lk-fill" style={{ background: `radial-gradient(closest-side, ${c} 0%, ${withAlpha(c, 0.4)} 45%, transparent 100%)` }} />
    case 'diagonal':
      return <div className="lk-fill" style={{ background: c, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
    case 'beam':
      return (
        <div
          className="lk-fill"
          style={{
            background: `linear-gradient(to bottom, ${c} 0%, ${withAlpha(c, 0.35)} 55%, transparent 100%)`,
            clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
            filter: 'blur(18px)',
          }}
        />
      )
    case 'frame':
      return <div className="lk-fill" style={{ border: `${d.size}px solid ${c}`, borderRadius: 28 }} />
    case 'noise':
      return <div className="lk-fill" style={{ backgroundImage: `url("${noiseUrl()}")`, backgroundSize: '160px 160px' }} />
    case 'watermark': {
      const text = resolveText(d.text, texts).toUpperCase()
      if (!text.trim()) return null
      const w100 = measure100(text, { weightAr: 700, weightLat: 700, tracking: -0.02, uppercase: true }, fontsVersion)
      const size = Math.min(d.h, (100 * d.w) / Math.max(w100, 1))
      return (
        <div
          className="lk-fill"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fontStack(text, 700),
            fontWeight: 700,
            fontSize: size,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            whiteSpace: 'pre',
            color: 'transparent',
            WebkitTextStroke: `${d.size}px ${c}`,
          }}
        >
          {text}
        </div>
      )
    }
    case 'badge': {
      const text = resolveText(d.text, texts)
      if (!text.trim()) return null
      const size = Math.min(d.w, d.h)
      return (
        <div
          className="lk-fill"
          style={{
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${withAlpha('#ffffff', 0.22)} 0%, transparent 45%), ${c}`,
            boxShadow: `0 18px 40px ${withAlpha(c, 0.45)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: d.color2,
            fontFamily: fontStack(text, 700),
            fontWeight: 900,
            fontSize: size * (text.length > 5 ? 0.2 : 0.3),
            lineHeight: 1,
            textAlign: 'center',
            whiteSpace: 'pre',
          }}
        >
          <div style={{ position: 'absolute', inset: size * 0.06, border: `2px dashed ${withAlpha(d.color2, 0.7)}`, borderRadius: '50%' }} />
          {text}
        </div>
      )
    }
  }
  return null
}

export function DecorLayer({ items, layer, texts }: { items: DecorItem[]; layer: 'back' | 'front'; texts: AdTexts }) {
  const edit = useEdit()
  const list = items.filter((d) => d.layer === layer && d.visible)
  if (!list.length) return null
  return (
    <div className="lk-layer" style={{ pointerEvents: 'none' }}>
      {list.map((d) => {
        const selected = edit && isSel(edit.selection, { kind: 'decor', id: d.id })
        const clickable = !!edit && (selected || d.kind === 'badge' || d.kind === 'watermark')
        return (
          <div
            key={d.id}
            style={{
              position: 'absolute',
              left: d.x,
              top: d.y,
              width: d.w,
              height: d.h,
              opacity: d.opacity,
              transform: d.rotate ? `rotate(${d.rotate}deg)` : undefined,
              pointerEvents: clickable ? 'auto' : 'none',
              cursor: clickable ? 'move' : undefined,
            }}
            onPointerDown={edit && clickable ? (e) => edit.startDrag({ kind: 'decor', id: d.id }, e) : undefined}
          >
            <DecorBody d={d} texts={texts} />
            {selected && <div className="lk-sel" style={{ inset: 0 }} data-label="زخرفة" />}
          </div>
        )
      })}
    </div>
  )
}

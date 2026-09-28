import type { AdTexts, DecorItem, ObjShadow } from '../model/types'
import { isSel, useEdit } from './EditContext'
import { StickerView, findSticker } from './stickers'
import { QrView } from './QrCode'
import { ImageBody } from './ImageObject'
import { showIfOk, showWhenOk } from '../model/showWhen'
import { noiseUrl } from './Backdrop'
import { withAlpha } from '../lib/color'
import { fontStack } from '../lib/fonts'
import { measure100 } from '../lib/textFit'
import { useEditor } from '../store/editor'

export function resolveText(t: string, texts: AdTexts): string {
  return t.replace(/\{(title|badge|kicker|subtitle|tagline|note|price|oldPrice|discount|cta)\}/g, (_m, k: keyof AdTexts) => String(texts[k] ?? ''))
}

function DecorBody({ d, texts, answer }: { d: DecorItem; texts: AdTexts; answer?: 'a' | 'b' | null }) {
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
    case 'wave':
      return (
        <svg className="lk-fill" viewBox={`0 0 ${d.w} ${d.h}`} preserveAspectRatio="none">
          <path d={`M0 ${d.h * 0.45} C ${d.w * 0.25} ${d.h * -0.1}, ${d.w * 0.4} ${d.h * 0.95}, ${d.w * 0.6} ${d.h * 0.45} S ${d.w * 0.9} ${d.h * 0.05}, ${d.w} ${d.h * 0.4} V ${d.h} H0 Z`} fill={c} />
        </svg>
      )
    case 'blobs':
      return (
        <div className="lk-fill" style={{ overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: d.w * 0.62, height: d.w * 0.62, left: d.w * 0.68, top: -d.w * 0.16, borderRadius: '50%', background: c, filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', width: d.w * 0.7, height: d.w * 0.7, left: -d.w * 0.28, top: d.h * 0.52, borderRadius: '50%', background: d.color2, filter: 'blur(110px)' }} />
        </div>
      )
    case 'plus': {
      const step = 46
      const cols = Math.max(1, Math.floor(d.w / step))
      const rows = Math.max(1, Math.floor(d.h / step))
      return (
        <svg className="lk-fill" viewBox={`0 0 ${d.w} ${d.h}`}>
          {Array.from({ length: rows * cols }).map((_, i) => {
            const x = (i % cols) * step + 12
            const y = Math.floor(i / cols) * step + 12
            return <path key={i} d={`M${x - 9} ${y} H${x + 9} M${x} ${y - 9} V${y + 9}`} stroke={c} strokeWidth={d.size} strokeLinecap="round" />
          })}
        </svg>
      )
    }
    case 'ribbon': {
      const text = resolveText(d.text, texts)
      return (
        <div
          className="lk-fill"
          style={{
            background: c,
            color: d.color2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fontStack(text, 700),
            fontWeight: 900,
            fontSize: d.h * 0.5,
            boxShadow: '0 12px 26px -10px rgba(0,0,0,0.45)',
            whiteSpace: 'pre',
          }}
        >
          {text}
        </div>
      )
    }
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
    case 'sticker':
      return d.sticker ? <StickerView spec={{ ...d.sticker, text: resolveText(d.sticker.text, texts), text2: d.sticker.text2 ? resolveText(d.sticker.text2, texts) : d.sticker.text2 }} color={d.color} color2={d.color2} answer={answer} role={d.sticker.answerRole} /> : null
    case 'qr':
      return d.qr ? <QrView spec={d.qr} /> : null
    case 'image':
      return <ImageBody d={d} />
  }
  return null
}

const OBJ_KINDS = new Set(['sticker', 'qr', 'image'])

export function isObjectKind(k: string): boolean {
  return OBJ_KINDS.has(k)
}

/** هل يمكن قلب العنصر أفقياً دون قلب نص مقروء */
export function canFlip(d: DecorItem): boolean {
  if (d.kind === 'image') return true
  if (d.kind === 'sticker') {
    const c = findSticker(d.sticker?.id ?? '')?.cat
    return c === 'shape' || c === 'arrow' || c === 'icon'
  }
  return false
}

function objShadow(s: ObjShadow | undefined, color: string): string | undefined {
  switch (s) {
    case 'soft':
      return 'drop-shadow(0 10px 18px rgba(0,0,0,0.28))'
    case 'float':
      return 'drop-shadow(0 34px 30px rgba(0,0,0,0.3)) drop-shadow(0 6px 8px rgba(0,0,0,0.18))'
    case 'hard':
      return 'drop-shadow(8px 10px 0 rgba(0,0,0,0.85))'
    case 'glow':
      return `drop-shadow(0 0 22px ${color})`
    default:
      return undefined
  }
}

/** مقابض التحجيم والتدوير للعنصر المحدد */
function Handles({ id, keepAspect }: { id: string; keepAspect: boolean }) {
  const edit = useEdit()!
  const k = 1 / edit.scale
  const sz = 22 * k
  const sel = { kind: 'decor', id } as const
  const corner = (h: 'nw' | 'ne' | 'sw' | 'se', pos: React.CSSProperties, cursor: string) => (
    <div
      key={h}
      className="lk-tf"
      style={{ width: sz, height: sz, borderWidth: 3 * k, ...pos, cursor }}
      onPointerDown={(e) => edit.startDrag(sel, e, { handle: h })}
    />
  )
  const o = -sz / 2
  return (
    <>
      {corner('nw', { left: o, top: o }, 'nwse-resize')}
      {corner('ne', { right: o, top: o }, 'nesw-resize')}
      {corner('sw', { left: o, bottom: o }, 'nesw-resize')}
      {corner('se', { right: o, bottom: o }, 'nwse-resize')}
      <div className="lk-tf-stem" style={{ height: 34 * k, top: -34 * k, width: 3 * k }} />
      <div
        className="lk-tf rot"
        style={{ width: sz * 1.05, height: sz * 1.05, borderWidth: 3 * k, top: -34 * k - sz * 0.55, cursor: 'grab' }}
        title="تدوير"
        onPointerDown={(e) => edit.startDrag(sel, e, { handle: 'rot' })}
      />
      {!keepAspect && <span hidden />}
    </>
  )
}

export function DecorLayer({ items, layer, texts, answer }: { items: DecorItem[]; layer: 'back' | 'front' | 'top'; texts: AdTexts; answer?: 'a' | 'b' | null }) {
  const edit = useEdit()
  const list = items.filter((d) => d.layer === layer && d.visible && showWhenOk(d.showWhen, answer) && showIfOk(d.showIf, texts))
  if (!list.length) return null
  return (
    <div className="lk-layer" data-layer={`decor-${layer}`} style={{ pointerEvents: 'none', zIndex: layer === 'top' ? 5 : undefined }}>
      {list.map((d) => (
        <DecorNode key={d.id} d={d} texts={texts} answer={answer} edit={edit} />
      ))}
    </div>
  )
}

function DecorNode({ d, texts, answer, edit }: { d: DecorItem; texts: AdTexts; answer?: 'a' | 'b' | null; edit: ReturnType<typeof useEdit> }) {
  const selected = !!edit && isSel(edit.selection, { kind: 'decor', id: d.id })
  const obj = isObjectKind(d.kind)
  const clickable = !!edit && !d.locked && (obj || selected || d.kind === 'badge' || d.kind === 'watermark')
  const flip = d.flip && canFlip(d)
  const transform = `${d.rotate ? `rotate(${d.rotate}deg)` : ''}${flip ? ' scaleX(-1)' : ''}`.trim()
  return (
    <div
      data-eid={`decor:${d.id}`}
      style={{
        position: 'absolute',
        left: d.x,
        top: d.y,
        width: d.w,
        height: d.h,
        opacity: d.opacity,
        transform: transform || undefined,
        mixBlendMode: d.blend && d.blend !== 'normal' ? d.blend : undefined,
        filter: objShadow(d.shadow, d.color),
        pointerEvents: clickable ? 'auto' : 'none',
        cursor: clickable ? 'move' : undefined,
      }}
      onPointerDown={edit && clickable ? (e) => edit.startDrag({ kind: 'decor', id: d.id }, e) : undefined}
    >
      <DecorBody d={d} texts={texts} answer={answer} />
      {selected && (
        <div className="lk-sel" style={{ inset: 0 }} data-label={d.name || (obj ? 'عنصر' : 'زخرفة')}>
          {!d.locked && edit && <Handles id={d.id} keepAspect={obj} />}
        </div>
      )}
    </div>
  )
}

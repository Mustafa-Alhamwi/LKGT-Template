import { useId, useLayoutEffect, useRef } from 'react'
import type { AdTexts, ExtraText, Selection, TextBlockStyle, TextKey, TextStyle } from '../model/types'
import { isSel, useEdit } from './EditContext'
import { fitLines, measure100, parseRich, stripMarks } from '../lib/textFit'
import { showWhenOk } from '../model/showWhen'
import { useAsset } from '../lib/assets'
import { fontStack, isArabicText } from '../lib/fonts'
import { withAlpha } from '../lib/color'

/* ------------------------------------------------------------------
 * كتلة النصوص: اسم المنتج (إنكليزي) + الوصف + الجملة العربية...
 * - كل عنصر يمكن ملاءمته لعرض الكتلة (نفس العرض للجميع)
 * - التبديل بين Araboto و HP Simplified تلقائي حرفاً بحرف
 * ------------------------------------------------------------------ */

const BOX_DECOS = new Set(['pill', 'box', 'outlineBox', 'glass', 'tab'])

function decoInset(st: TextStyle): number {
  const d = st.decoStyle
  switch (st.deco) {
    case 'pill':
    case 'box':
    case 'outlineBox':
    case 'glass':
    case 'tab':
      return 2 * d.padX + 2 * d.strokeWidth + (st.deco === 'pill' && d.radius > 100 ? 12 : 0)
    case 'rules':
      return 2 * (d.padX + 70)
    case 'bar':
      return d.strokeWidth + d.padX
    case 'bracket':
      return 2 * d.padX + 20
    default:
      return 0
  }
}

function textValue(texts: AdTexts, k: TextKey): string {
  if (k === 'features') return texts.features.filter((f) => f.trim()).join('\n')
  return texts[k] ?? ''
}

function effectStyle(st: TextStyle, fillUrl?: string): React.CSSProperties {
  const o: React.CSSProperties = {}
  if (fillUrl) {
    o.backgroundImage = `url("${fillUrl}")`
    o.backgroundSize = 'cover'
    o.backgroundPosition = 'center'
    o.WebkitBackgroundClip = 'text'
    o.backgroundClip = 'text'
    o.color = 'transparent'
    o.WebkitTextFillColor = 'transparent'
  } else if (st.gradient) {
    o.backgroundImage = `linear-gradient(${st.gradAngle ?? 90}deg, ${st.color}, ${st.color2 ?? st.color})`
    o.WebkitBackgroundClip = 'text'
    o.backgroundClip = 'text'
    o.color = 'transparent'
    o.WebkitTextFillColor = 'transparent'
  }
  if ((st.strokeW ?? 0) > 0) {
    o.WebkitTextStroke = `${st.strokeW}px ${st.strokeColor ?? '#fff'}`
    o.paintOrder = 'stroke fill'
  }
  const c = st.shadowColor ?? '#000'
  switch (st.textShadow) {
    case 'soft':
      o.filter = `drop-shadow(0 6px 10px ${withAlpha(c, 0.4)})`
      break
    case 'glow':
      o.filter = `drop-shadow(0 0 14px ${withAlpha(c, 0.9)})`
      break
    case 'hard':
      o.filter = `drop-shadow(4px 5px 0 ${c})`
      break
  }
  return o
}

function Lines({
  lines,
  sizes,
  st,
  align,
  fillUrl,
}: {
  lines: string[]
  sizes: number[]
  st: TextStyle
  align: 'center' | 'right' | 'left'
  fillUrl?: string
}) {
  return (
    <>
      {lines.map((line, i) => {
        const ar = isArabicText(line)
        return (
          <div
            key={i}
            dir={ar ? 'rtl' : 'ltr'}
            style={{
              fontFamily: fontStack(line, st.weightLat),
              fontWeight: st.weightAr,
              fontSize: sizes[i],
              lineHeight: st.lineHeight,
              letterSpacing: st.tracking ? `${st.tracking}em` : undefined,
              paddingInlineStart: st.tracking > 0 ? `${st.tracking}em` : undefined,
              textTransform: st.uppercase ? 'uppercase' : undefined,
              color: st.color,
              whiteSpace: 'pre',
              textAlign: align,
              textDecoration: st.strike ? 'line-through' : undefined,
              textDecorationThickness: st.strike ? `${Math.max(3, sizes[i] * 0.07)}px` : undefined,
              textDecorationColor: st.strike ? st.accent : undefined,
              ...effectStyle(st, fillUrl),
            }}
          >
            {line.trim() === '' ? ' ' : parseRich(line).map((s, j) => (s.accent ? <span key={j} style={{ color: st.accent }}>{s.text}</span> : <span key={j}>{s.text}</span>))}
          </div>
        )
      })}
    </>
  )
}

function Editable({
  value,
  st,
  size,
  align,
  onCommit,
}: {
  value: string
  st: TextStyle
  size: number
  align: 'center' | 'right' | 'left'
  onCommit: (v: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerText = value
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const commit = () => {
    if (done.current || !ref.current) return
    done.current = true
    onCommit(ref.current.innerText.replace(/\n$/, ''))
  }
  return (
    <div
      ref={ref}
      className="lk-editable"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      dir="auto"
      spellCheck={false}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault()
          commit()
        }
      }}
      style={{
        fontFamily: fontStack(value, st.weightLat),
        fontWeight: st.weightAr,
        fontSize: size,
        lineHeight: st.lineHeight,
        letterSpacing: st.tracking ? `${st.tracking}em` : undefined,
        textTransform: st.uppercase ? 'uppercase' : undefined,
        color: st.color,
        whiteSpace: 'pre-wrap',
        textAlign: align,
        minWidth: 60,
      }}
    />
  )
}

/** نص على منحنى (قوس) — SVG textPath */
function CurveText({ value, st, w, fontsVersion }: { value: string; st: TextStyle; w: number; fontsVersion: number }) {
  const uid = useId().replace(/:/g, '')
  const flat = value.replace(/\n+/g, ' ')
  const plain = stripMarks(flat) || ' '
  const sag = ((st.curve ?? 0) / 100) * w * 0.42
  const arc = Math.sqrt(w * w + (16 / 3) * sag * sag)
  const w100 = measure100(plain, { weightAr: st.weightAr, weightLat: st.weightLat, tracking: st.tracking, uppercase: st.uppercase }, fontsVersion)
  const size = Math.max(8, Math.min(st.size, (0.94 * arc * 100) / Math.max(w100, 1)))
  const yb = size * 1.15 + Math.max(0, sag)
  const h = yb + Math.max(0, -sag) + size * 0.55
  const path = `M0 ${yb} Q${w / 2} ${yb - 2 * sag} ${w} ${yb}`
  const ar = isArabicText(plain)
  const fill = st.gradient ? `url(#g${uid})` : st.color
  const segs = parseRich(st.uppercase ? flat.toUpperCase() : flat)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', ...effectStyle({ ...st, gradient: false, strokeW: 0 }) }}>
      <defs>
        <path id={`p${uid}`} d={path} />
        {st.gradient && (
          <linearGradient id={`g${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0" gradientTransform={`rotate(${(st.gradAngle ?? 90) - 90} ${w / 2} ${h / 2})`}>
            <stop offset="0" stopColor={st.color} />
            <stop offset="1" stopColor={st.color2 ?? st.color} />
          </linearGradient>
        )}
      </defs>
      <text
        fontFamily={fontStack(plain, st.weightLat)}
        fontWeight={st.weightAr}
        fontSize={size}
        fill={fill}
        stroke={(st.strokeW ?? 0) > 0 ? (st.strokeColor ?? '#fff') : undefined}
        strokeWidth={st.strokeW ?? 0}
        paintOrder="stroke fill"
        direction={ar ? 'rtl' : 'ltr'}
        letterSpacing={st.tracking ? `${st.tracking}em` : undefined}
        style={{ whiteSpace: 'pre' }}
      >
        <textPath href={`#p${uid}`} startOffset="50%" textAnchor="middle">
          {segs.map((sg, i) => (
            <tspan key={i} fill={sg.accent ? st.accent : fill}>
              {sg.text}
            </tspan>
          ))}
        </textPath>
      </text>
    </svg>
  )
}

function decoBox(st: TextStyle): React.CSSProperties {
  const d = st.decoStyle
  const sz = d.shadowSize ?? 1
  const sc = d.shadowColor ?? '#000000'
  const bg = d.fill2 ? `linear-gradient(${d.angle ?? 135}deg, ${d.fill}, ${d.fill2})` : d.fill
  const base: React.CSSProperties = {
    padding: `${d.padY}px ${d.padX + (st.deco === 'pill' && d.radius > 100 ? 6 : 0)}px`,
    borderRadius: d.radius,
    boxShadow: d.shadow ? `0 ${14 * sz}px ${30 * sz}px -${10 * sz}px ${withAlpha(sc, 0.5)}` : undefined,
  }
  switch (st.deco) {
    case 'pill':
    case 'box':
      return { ...base, background: bg }
    case 'outlineBox':
      return { ...base, background: bg, border: `${d.strokeWidth}px solid ${d.stroke}` }
    case 'glass': {
      const blur = d.blur ?? 14
      return {
        ...base,
        background: bg,
        border: `${Math.max(1, d.strokeWidth)}px solid ${d.stroke}`,
        backdropFilter: `blur(${blur}px) saturate(1.2)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(1.2)`,
      }
    }
    case 'tab':
      return {
        ...base,
        borderRadius: 0,
        background: bg,
        clipPath: 'polygon(6% 0, 100% 0, 94% 100%, 0 100%)',
        padding: `${d.padY}px ${d.padX + 10}px`,
      }
  }
  return base
}

interface ItemProps {
  id: string
  sel: Selection
  st: TextStyle
  value: string
  innerW: number
  align: 'center' | 'right' | 'left'
  first: boolean
  gap: number
  fontsVersion: number
  features?: boolean
  curved?: boolean
}

const resolveAlign = (st: TextStyle, block: 'center' | 'right' | 'left') => (st.align && st.align !== 'inherit' ? st.align : block)

function TextItem({ id, sel, st, value, innerW, align, first, gap, fontsVersion, features, curved }: ItemProps) {
  const edit = useEdit()
  const fillAsset = useAsset(st.fillImage)
  const fillUrl = st.fillImage ? fillAsset?.url : undefined
  const editing = edit?.editing === id
  const selected = edit && isSel(edit.selection, sel)
  const d = st.decoStyle
  const isBox = BOX_DECOS.has(st.deco)
  const full = isBox ? d.full : true
  const fitW = Math.max(40, innerW - decoInset(st))
  const { lines, sizes } = fitLines(value, st, fitW, fontsVersion)
  const flexAlign = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'

  const handlers = edit
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (editing) return
          edit.startDrag(sel, e)
        },
        onDoubleClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          edit.startEdit(id)
        },
      }
    : {}

  let content: React.ReactNode
  if (curved && !editing && !features) {
    content = <CurveText value={value} st={st} w={innerW} fontsVersion={fontsVersion} />
  } else if (editing) {
    content = <Editable value={value} st={st} size={sizes[0] ?? st.size} align={align} onCommit={(v) => edit!.commitText(id, v)} />
  } else if (features) {
    content = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: flexAlign, width: '100%' }} dir="rtl">
        {lines.map((line, i) => (
          <div key={i} style={{ ...decoBox(st), display: 'inline-block' }}>
            <Lines lines={[line]} sizes={[st.size]} st={st} align="center" fillUrl={fillUrl} />
          </div>
        ))}
      </div>
    )
  } else {
    const body = <Lines lines={lines} sizes={sizes} st={st} align={align} fillUrl={fillUrl} />
    switch (st.deco) {
      case 'rules':
        content = (
          <div style={{ display: 'flex', alignItems: 'center', gap: d.padX, width: '100%' }}>
            <div style={{ flex: 1, height: d.strokeWidth, background: d.accent, borderRadius: 4 }} />
            {body}
            <div style={{ flex: 1, height: d.strokeWidth, background: d.accent, borderRadius: 4 }} />
          </div>
        )
        break
      case 'underline':
        content = (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: flexAlign }}>
            {body}
            <div style={{ width: 130, height: d.strokeWidth, background: d.accent, borderRadius: 4, marginTop: d.padY }} />
          </div>
        )
        break
      case 'doubleUnderline':
        content = (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: flexAlign, width: '100%' }}>
            {body}
            <div style={{ width: '100%', height: d.strokeWidth, background: d.stroke, borderRadius: 4, marginTop: d.padY }} />
            <div style={{ width: '86%', height: d.strokeWidth, background: d.accent, borderRadius: 4, marginTop: 5 }} />
          </div>
        )
        break
      case 'bar': {
        const side = align === 'right' ? 'borderRight' : 'borderLeft'
        const pad = align === 'right' ? 'paddingRight' : 'paddingLeft'
        content = <div style={{ [side]: `${d.strokeWidth}px solid ${d.accent}`, [pad]: d.padX }}>{body}</div>
        break
      }
      case 'bracket': {
        const c = d.accent
        const t = Math.max(2, d.strokeWidth || 3)
        const L = 26
        const g = (pos: string, w: number, h: number) => `linear-gradient(${c}, ${c}) ${pos} / ${w}px ${h}px no-repeat`
        content = (
          <div
            style={{
              padding: `${d.padY}px ${d.padX + 10}px`,
              background: [g('left top', L, t), g('left top', t, L), g('right top', L, t), g('right top', t, L), g('left bottom', L, t), g('left bottom', t, L), g('right bottom', L, t), g('right bottom', t, L)].join(', '),
            }}
          >
            {body}
          </div>
        )
        break
      }
      default:
        content = isBox ? <div style={{ ...decoBox(st), width: full ? '100%' : undefined }}>{body}</div> : body
    }
  }

  return (
    <div
      className="lk-ti"
      data-key={id}
      data-eid={`text:${id}`}
      {...handlers}
      style={{
        position: 'relative',
        marginTop: (first ? 0 : gap) + st.marginTop,
        opacity: st.opacity,
        mixBlendMode: st.blend && st.blend !== 'normal' ? st.blend : undefined,
        alignSelf: full || editing ? 'stretch' : flexAlign,
        display: 'flex',
        flexDirection: 'column',
        alignItems: flexAlign,
        cursor: edit ? (editing ? 'text' : 'move') : undefined,
      }}
    >
      {content}
      {selected && !editing && <div className="lk-sel lk-sel-text" style={{ inset: -8 }} />}
    </div>
  )
}

/** عنصر نص حرّ (مفصول عن الكتلة أو نص إضافي): موضعه وعرضه ودورانه خاصة به */
function FreeText({ id, sel, st, value, fontsVersion, features }: { id: string; sel: Selection; st: TextStyle; value: string; fontsVersion: number; features?: boolean }) {
  const edit = useEdit()
  const selected = edit && isSel(edit.selection, sel)
  const align = resolveAlign(st, 'center')
  return (
    <div
      className="lk-free"
      data-layer="text"
      dir="ltr"
      style={{
        position: 'absolute',
        left: st.fx ?? 0,
        top: st.fy ?? 0,
        width: st.fw ?? 600,
        display: 'flex',
        flexDirection: 'column',
        transform: st.rotate ? `rotate(${st.rotate}deg)` : undefined,
        zIndex: 3,
      }}
    >
      <TextItem id={id} sel={sel} st={st} value={value} innerW={st.fw ?? 600} align={align} first gap={0} fontsVersion={fontsVersion} features={features} curved={!!st.curve} />
      {edit && selected && edit.editing !== id && !st.locked && (
        <>
          <div className="lk-handle lk-handle-l" onPointerDown={(e) => edit.startDrag(sel, e, { handle: 'left' })} />
          <div className="lk-handle lk-handle-r" onPointerDown={(e) => edit.startDrag(sel, e, { handle: 'right' })} />
          <div className="lk-tf-stem" style={{ height: 36 / edit.scale, top: -44 / edit.scale, width: 3 / edit.scale }} />
          <div
            className="lk-tf rot"
            style={{ width: 24 / edit.scale, height: 24 / edit.scale, borderWidth: 3 / edit.scale, top: -44 / edit.scale - 12 / edit.scale, cursor: 'grab' }}
            title="تدوير"
            onPointerDown={(e) => edit.startDrag(sel, e, { handle: 'rot' })}
          />
        </>
      )}
    </div>
  )
}

interface Props {
  tb: TextBlockStyle
  texts: AdTexts
  extras: ExtraText[]
  fontsVersion: number
  answer?: 'a' | 'b' | null
}

export function TextBlock({ tb, texts, extras, fontsVersion, answer }: Props) {
  const edit = useEdit()
  const p = tb.panel
  const pad = p.kind !== 'none' ? p.pad : 0
  const innerW = tb.w - pad * 2
  const shown = (k: TextKey) => {
    const st = tb.items[k]
    if (!st?.visible) return false
    if (edit?.editing === k) return true
    if (!showWhenOk(st.showWhen, answer)) return false
    return textValue(texts, k).trim() !== ''
  }
  const flow = tb.order.filter((k) => shown(k) && !tb.items[k].free)
  const free = tb.order.filter((k) => shown(k) && tb.items[k].free)
  const selected = edit && isSel(edit.selection, { kind: 'textBlock' })
  const selKey = edit?.selection?.kind === 'text' ? edit.selection.key : null
  const anyFlowSel = selKey != null && flow.includes(selKey)

  const panelStyle: React.CSSProperties =
    p.kind === 'none'
      ? {}
      : {
          padding: pad,
          borderRadius: p.radius,
          background: p.kind === 'outline' ? 'transparent' : p.fill,
          border: p.kind === 'solid' ? undefined : `2px solid ${p.stroke}`,
          backdropFilter: p.kind === 'glass' ? 'blur(18px) saturate(1.25)' : undefined,
          WebkitBackdropFilter: p.kind === 'glass' ? 'blur(18px) saturate(1.25)' : undefined,
          boxShadow: p.kind === 'glass' ? '0 30px 60px -20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)' : undefined,
        }

  return (
    <>
      {(flow.length > 0 || edit) && (
        <div
          className="lk-textblock"
          data-layer="text"
          data-eid="block"
          style={{
            position: 'absolute',
            left: tb.x,
            top: tb.y,
            width: tb.w,
            display: 'flex',
            flexDirection: 'column',
            alignItems: tb.align === 'center' ? 'center' : tb.align === 'right' ? 'flex-end' : 'flex-start',
            boxSizing: 'border-box',
            ...panelStyle,
          }}
          dir="ltr"
          onPointerDown={edit ? (e) => edit.startDrag({ kind: 'textBlock' }, e) : undefined}
        >
          {flow.map((k, i) => (
            <TextItem
              key={k}
              id={k}
              sel={{ kind: 'text', key: k }}
              st={tb.items[k]}
              value={textValue(texts, k)}
              innerW={innerW}
              align={resolveAlign(tb.items[k], tb.align)}
              first={i === 0}
              gap={tb.gap}
              fontsVersion={fontsVersion}
              features={k === 'features'}
            />
          ))}
          {edit && (selected || anyFlowSel) && flow.length > 0 && (
            <>
              <div className="lk-sel lk-sel-block" style={{ inset: -14 }} data-label="كتلة النصوص" />
              <div className="lk-handle lk-handle-l" onPointerDown={(e) => edit.startDrag({ kind: 'textBlock' }, e, { handle: 'left' })} />
              <div className="lk-handle lk-handle-r" onPointerDown={(e) => edit.startDrag({ kind: 'textBlock' }, e, { handle: 'right' })} />
            </>
          )}
        </div>
      )}
      {free.map((k) => (
        <FreeText key={k} id={k} sel={{ kind: 'text', key: k }} st={tb.items[k]} value={textValue(texts, k)} fontsVersion={fontsVersion} features={k === 'features'} />
      ))}
      {extras
        .filter((e) => e.style.visible !== false && showWhenOk(e.style.showWhen, answer))
        .map((e) => (
          <FreeText key={e.id} id={e.id} sel={{ kind: 'extra', id: e.id }} st={e.style} value={e.text} fontsVersion={fontsVersion} />
        ))}
    </>
  )
}

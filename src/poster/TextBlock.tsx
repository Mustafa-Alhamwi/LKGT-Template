import { useLayoutEffect, useRef } from 'react'
import type { AdTexts, TextBlockStyle, TextKey, TextStyle } from '../model/types'
import { isSel, useEdit } from './EditContext'
import { fitLines, parseRich } from '../lib/textFit'
import { fontStack, isArabicText } from '../lib/fonts'

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

function Lines({
  lines,
  sizes,
  st,
  align,
}: {
  lines: string[]
  sizes: number[]
  st: TextStyle
  align: 'center' | 'right' | 'left'
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

function decoBox(st: TextStyle): React.CSSProperties {
  const d = st.decoStyle
  const base: React.CSSProperties = {
    padding: `${d.padY}px ${d.padX + (st.deco === 'pill' && d.radius > 100 ? 6 : 0)}px`,
    borderRadius: d.radius,
    boxShadow: d.shadow ? '0 14px 30px -10px rgba(0,0,0,0.45)' : undefined,
  }
  switch (st.deco) {
    case 'pill':
    case 'box':
      return { ...base, background: d.fill }
    case 'outlineBox':
      return { ...base, background: d.fill, border: `${d.strokeWidth}px solid ${d.stroke}` }
    case 'glass':
      return {
        ...base,
        background: d.fill,
        border: `${Math.max(1, d.strokeWidth)}px solid ${d.stroke}`,
        backdropFilter: 'blur(14px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
      }
    case 'tab':
      return {
        ...base,
        borderRadius: 0,
        background: d.fill,
        clipPath: 'polygon(6% 0, 100% 0, 94% 100%, 0 100%)',
        padding: `${d.padY}px ${d.padX + 10}px`,
      }
  }
  return base
}

interface ItemProps {
  k: TextKey
  st: TextStyle
  value: string
  innerW: number
  align: 'center' | 'right' | 'left'
  first: boolean
  gap: number
  fontsVersion: number
}

function TextItem({ k, st, value, innerW, align, first, gap, fontsVersion }: ItemProps) {
  const edit = useEdit()
  const editing = edit?.editing === k
  const selected = edit && isSel(edit.selection, { kind: 'text', key: k })
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
          edit.startDrag({ kind: 'text', key: k }, e)
        },
        onDoubleClick: (e: React.MouseEvent) => {
          e.stopPropagation()
          edit.startEdit(k)
        },
      }
    : {}

  let content: React.ReactNode
  if (editing) {
    content = (
      <Editable
        value={value}
        st={st}
        size={sizes[0] ?? st.size}
        align={align}
        onCommit={(v) => edit!.commitText(k, v)}
      />
    )
  } else if (k === 'features') {
    content = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: flexAlign, width: '100%' }} dir="rtl">
        {lines.map((line, i) => (
          <div key={i} style={{ ...decoBox(st), display: 'inline-block' }}>
            <Lines lines={[line]} sizes={[st.size]} st={st} align="center" />
          </div>
        ))}
      </div>
    )
  } else {
    const body = <Lines lines={lines} sizes={sizes} st={st} align={align} />
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
        const g = (pos: string, w: number | string, h: number | string) => `linear-gradient(${c}, ${c}) ${pos} / ${w}${typeof w === 'number' ? 'px' : ''} ${h}${typeof h === 'number' ? 'px' : ''} no-repeat`
        content = (
          <div
            style={{
              padding: `${d.padY}px ${d.padX + 10}px`,
              background: [
                g('left top', L, t), g('left top', t, L), g('right top', L, t), g('right top', t, L),
                g('left bottom', L, t), g('left bottom', t, L), g('right bottom', L, t), g('right bottom', t, L),
              ].join(', '),
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
      data-key={k}
      {...handlers}
      style={{
        position: 'relative',
        marginTop: (first ? 0 : gap) + st.marginTop,
        opacity: st.opacity,
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

interface Props {
  tb: TextBlockStyle
  texts: AdTexts
  fontsVersion: number
}

export function TextBlock({ tb, texts, fontsVersion }: Props) {
  const edit = useEdit()
  const ref = useRef<HTMLDivElement>(null)
  const p = tb.panel
  const pad = p.kind !== 'none' ? p.pad : 0
  const innerW = tb.w - pad * 2
  const keys = tb.order.filter((k) => {
    const st = tb.items[k]
    if (!st?.visible) return false
    if (edit?.editing === k) return true
    return textValue(texts, k).trim() !== ''
  })
  const selected = edit && isSel(edit.selection, { kind: 'textBlock' })
  const anyTextSel = edit?.selection?.kind === 'text'

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
          boxShadow: p.kind === 'glass' ? '0 30px 60px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)' : undefined,
        }

  if (!keys.length && !edit) return null

  return (
    <div
      ref={ref}
      className="lk-textblock"
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
      {keys.map((k, i) => (
        <TextItem
          key={k}
          k={k}
          st={tb.items[k]}
          value={textValue(texts, k)}
          innerW={innerW}
          align={tb.align}
          first={i === 0}
          gap={tb.gap}
          fontsVersion={fontsVersion}
        />
      ))}
      {edit && (selected || anyTextSel) && (
        <>
          <div className="lk-sel lk-sel-block" style={{ inset: -14 }} data-label="كتلة النصوص" />
          <div className="lk-handle lk-handle-l" onPointerDown={(e) => edit.startDrag({ kind: 'textBlock' }, e, { handle: 'left' })} />
          <div className="lk-handle lk-handle-r" onPointerDown={(e) => edit.startDrag({ kind: 'textBlock' }, e, { handle: 'right' })} />
        </>
      )}
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { alphaOf, toHex, withAlpha } from '../lib/color'

/* ------------------------------------------------------------------
 * عناصر الواجهة — بسيطة ومتسقة: صف واحد لكل خيار، بدون صناديق متداخلة
 * ------------------------------------------------------------------ */

export function Group({ title, children, right, hint }: { title?: string; children: ReactNode; right?: ReactNode; hint?: string }) {
  return (
    <section className="grp">
      {(title || right) && (
        <header className="grp-head">
          <h4>{title}</h4>
          {right}
        </header>
      )}
      {hint && <p className="hint">{hint}</p>}
      <div className="grp-body">{children}</div>
    </section>
  )
}

export function Field({ label, children, stack }: { label: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`fld ${stack ? 'stack' : ''}`}>
      <span className="fld-label">{label}</span>
      <div className="fld-ctl">{children}</div>
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  unit?: string
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <div className="sld">
      <div className="sld-top">
        <span className="fld-label">{label}</span>
        <span className="sld-num">
          <input
            type="number"
            value={Number.isFinite(value) ? +value.toFixed(3) : 0}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!Number.isNaN(v)) onChange(v)
            }}
          />
          {unit && <em>{unit}</em>}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} style={{ ['--pct' as string]: `${pct}%` }} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="fld">
      <span className="fld-label">{label}</span>
      <button type="button" className={`sw ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
        <span />
      </button>
    </div>
  )
}

export function Chips<T extends string | number>({
  value,
  options,
  onChange,
  wrap,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  wrap?: boolean
}) {
  return (
    <div className={`chips ${wrap ? 'wrap' : ''}`}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} title={o.title} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select
      className="sel"
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value)
        if (o) onChange(o.value)
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Btn({
  children,
  icon,
  onClick,
  variant = 'default',
  small,
  block,
  title,
  disabled,
}: {
  children?: ReactNode
  icon?: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  small?: boolean
  block?: boolean
  title?: string
  disabled?: boolean
}) {
  return (
    <button type="button" className={`btn ${variant} ${small ? 'sm' : ''} ${block ? 'block' : ''}`} onClick={onClick} title={title} disabled={disabled}>
      {icon}
      {children != null && <span>{children}</span>}
    </button>
  )
}

export function IconBtn({ icon, onClick, title, active, disabled, danger }: { icon: ReactNode; onClick?: () => void; title?: string; active?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" className={`ibtn ${active ? 'on' : ''} ${danger ? 'danger' : ''}`} onClick={onClick} title={title} aria-label={title} disabled={disabled}>
      {icon}
    </button>
  )
}

export function TextArea({ value, onChange, rows = 2, dir = 'auto', placeholder }: { value: string; onChange: (v: string) => void; rows?: number; dir?: 'auto' | 'ltr' | 'rtl'; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(220, el.scrollHeight + 2)}px`
  }, [value])
  return <textarea ref={ref} className="txa" dir={dir} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function TextInput({ value, onChange, dir = 'auto', placeholder }: { value: string; onChange: (v: string) => void; dir?: 'auto' | 'ltr' | 'rtl'; placeholder?: string }) {
  return <input className="txi" dir={dir} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function Empty({ icon, title, text, children }: { icon?: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

/** بلاطات اختيار مرئية (أشكال، خلفيات، ثيمات) */
export function Tiles<T extends string>({
  value,
  items,
  onChange,
  cols = 4,
}: {
  value: T
  items: { value: T; label: string; preview: ReactNode }[]
  onChange: (v: T) => void
  cols?: number
}) {
  return (
    <div className="tiles" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {items.map((it) => (
        <button type="button" key={it.value} className={it.value === value ? 'on' : ''} onClick={() => onChange(it.value)} title={it.label}>
          <span className="tile-prev">{it.preview}</span>
          <small>{it.label}</small>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------ نافذة منبثقة + ألوان ------------------------------ */

function Popover({ anchor, onClose, children, width = 252 }: { anchor: HTMLElement; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 320
    let left = r.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    if (left < 8) left = 8
    let top = r.bottom + 8
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8)
    setPos({ left, top })
  }, [anchor, width])
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [anchor, onClose])
  return createPortal(
    <div ref={ref} className="pop" style={{ left: pos.left, top: pos.top, width }}>
      {children}
    </div>,
    document.body,
  )
}

const PALETTE = [
  '#D11A24', '#E8212C', '#A3111A', '#5E0A10', '#FF7C84', '#FFD3CB',
  '#111214', '#2B2B30', '#4B4B4E', '#8B8B93', '#C9C9CE', '#FFFFFF',
  '#F7F7F8', '#F2F2F2', '#FFF4F1', '#F3F5F8', '#0B0D12', '#2A6BFF',
  '#F0B429', '#1FBF8F', '#7C3AED', '#EC4899',
]

let recent: string[] = (() => {
  try {
    return JSON.parse(localStorage.getItem('lk-recent-colors') || '[]')
  } catch {
    return []
  }
})()

function pushRecent(c: string) {
  recent = [c, ...recent.filter((x) => x !== c)].slice(0, 10)
  try {
    localStorage.setItem('lk-recent-colors', JSON.stringify(recent))
  } catch {
    /* */
  }
}

export function ColorInput({ label, value, onChange, alpha = false }: { label: string; value: string; onChange: (v: string) => void; alpha?: boolean }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const a = alphaOf(value)
  const hex = toHex(value)
  const emit = (h: string, al: number) => onChange(al >= 0.999 ? h.toUpperCase() : withAlpha(h, al))
  return (
    <div className="fld">
      <span className="fld-label">{label}</span>
      <button ref={btn} type="button" className="clr" onClick={() => setOpen(!open)}>
        <i style={{ ['--c' as string]: value }} />
        <code>{hex.toUpperCase()}</code>
      </button>
      {open && btn.current && (
        <Popover
          anchor={btn.current}
          onClose={() => {
            setOpen(false)
            pushRecent(hex.toUpperCase())
          }}
        >
          <div className="pal">
            {PALETTE.map((c) => (
              <button key={c} type="button" style={{ background: c }} title={c} className={c.toLowerCase() === hex ? 'on' : ''} onClick={() => emit(c, a)} />
            ))}
          </div>
          {recent.length > 0 && (
            <>
              <small className="pal-title">آخر المستخدمة</small>
              <div className="pal">
                {recent.map((c) => (
                  <button key={c} type="button" style={{ background: c }} title={c} onClick={() => emit(c, a)} />
                ))}
              </div>
            </>
          )}
          <div className="pal-row">
            <label className="pal-native" title="لون مخصص">
              <input type="color" value={hex} onChange={(e) => emit(e.target.value, a)} />
              <span style={{ background: value }} />
            </label>
            <input
              className="txi ltr"
              dir="ltr"
              value={hex.toUpperCase()}
              onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && emit(e.target.value, a)}
            />
          </div>
          {alpha && <Slider label="الشفافية" value={Math.round(a * 100)} min={0} max={100} unit="%" onChange={(v) => emit(hex, v / 100)} />}
        </Popover>
      )}
    </div>
  )
}

/** شريط تبويب رئيسي (أيقونة + نص) */
export function TabBar<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string; icon: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} className={t.value === value ? 'on' : ''} onClick={() => onChange(t.value)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

/** قائمة منسدلة بسيطة (نقاط ثلاث) */
export function Menu({ trigger, children, align = 'start' }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const close = () => setOpen(false)
  return (
    <>
      <button ref={btn} type="button" className="menu-trigger" onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      {open && btn.current && (
        <Popover anchor={btn.current} onClose={close} width={244}>
          <div className={`menu-list ${align}`}>{children(close)}</div>
        </Popover>
      )}
    </>
  )
}

export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={`menu-item ${danger ? 'danger' : ''}`} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

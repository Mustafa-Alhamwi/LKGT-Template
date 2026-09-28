import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { alphaOf, toHex, withAlpha } from '../lib/color'

/* عناصر تحكم الواجهة */

export function Section({
  title,
  icon,
  children,
  defaultOpen = true,
  right,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  right?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`ui-section ${open ? 'open' : ''}`}>
      <header onClick={() => setOpen(!open)}>
        {icon && <span className="ui-section-icon">{icon}</span>}
        <span className="ui-section-title">{title}</span>
        {right && (
          <span className="ui-section-right" onClick={(e) => e.stopPropagation()}>
            {right}
          </span>
        )}
        <ChevronDown size={16} className="ui-chevron" />
      </header>
      {open && <div className="ui-section-body">{children}</div>}
    </section>
  )
}

export function Field({ label, children, hint, inline = true }: { label: string; children: ReactNode; hint?: string; inline?: boolean }) {
  return (
    <label className={`ui-field ${inline ? 'inline' : ''}`}>
      <span className="ui-label">
        {label}
        {hint && <em className="ui-hint">{hint}</em>}
      </span>
      <span className="ui-control">{children}</span>
    </label>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  hint?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="ui-slider">
      <div className="ui-slider-top">
        <span className="ui-label">
          {label}
          {hint && <em className="ui-hint">{hint}</em>}
        </span>
        <input
          className="ui-num"
          type="number"
          value={Number(value.toFixed(3))}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!Number.isNaN(v)) onChange(v)
          }}
        />
        {format && <span className="ui-slider-fmt">{format(value)}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="ui-toggle">
      <span className="ui-label">
        {label}
        {hint && <em className="ui-hint">{hint}</em>}
      </span>
      <button type="button" className={`ui-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
        <span />
      </button>
    </label>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  small,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div className={`ui-seg ${small ? 'small' : ''}`}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          title={o.title}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select
      className="ui-select"
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

const SWATCHES = ['#D11A24', '#E8212C', '#A3111A', '#5E0A10', '#111214', '#4B4B4E', '#9AA3B2', '#F2F2F2', '#FFFFFF']

export function ColorField({ label, value, onChange, alpha = true }: { label: string; value: string; onChange: (v: string) => void; alpha?: boolean }) {
  const a = alphaOf(value)
  const hex = toHex(value)
  const emit = (h: string, al: number) => onChange(al >= 0.999 ? h.toUpperCase() : withAlpha(h, al))
  return (
    <div className="ui-color">
      <span className="ui-label">{label}</span>
      <div className="ui-color-row">
        <label className="ui-color-swatch" style={{ ['--c' as string]: value }}>
          <input type="color" value={hex} onChange={(e) => emit(e.target.value, a)} />
        </label>
        <input className="ui-color-hex" value={hex.toUpperCase()} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && emit(e.target.value, a)} />
        {alpha && (
          <input
            className="ui-color-alpha"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={a}
            title="الشفافية"
            onChange={(e) => emit(hex, parseFloat(e.target.value))}
          />
        )}
      </div>
      <div className="ui-swatches">
        {SWATCHES.map((s) => (
          <button key={s} type="button" style={{ background: s }} title={s} onClick={() => emit(s, a)} />
        ))}
      </div>
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  icon,
  title,
  disabled,
  small,
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  icon?: ReactNode
  title?: string
  disabled?: boolean
  small?: boolean
}) {
  return (
    <button type="button" className={`ui-btn ${variant} ${small ? 'small' : ''} ${!children ? 'icon-only' : ''}`} onClick={onClick} title={title} disabled={disabled}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  )
}

export function Row({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="ui-row" style={{ gap }}>
      {children}
    </div>
  )
}

export function TextArea({ value, onChange, rows = 2, dir = 'auto', placeholder }: { value: string; onChange: (v: string) => void; rows?: number; dir?: string; placeholder?: string }) {
  return <textarea className="ui-textarea" dir={dir} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

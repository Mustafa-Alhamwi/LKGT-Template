import type { BrandConfig, ContactTheme } from '../model/types'
import { POSTER_W } from '../model/types'
import { GlobeIcon, InstagramIcon, PhoneIcon } from './icons'
import { isSel, useEdit } from './EditContext'
import { latFamily, AR_FAMILY, FALLBACK } from '../lib/fonts'
import { RED, RED_BRIGHT, INK } from '../model/brand'

/* ------------------------------------------------------------------
 * شريط التواصل — مكانه ثابت، وله عدة ثيمات (لون وشكل الشريط)
 * ------------------------------------------------------------------ */

interface ThemeDef {
  name: string
  bar: React.CSSProperties
  text: string
  icon: string
  /** كل عنصر في كبسولة مستقلة */
  chips?: React.CSSProperties
  /** أيقونة داخل دائرة */
  iconBadge?: string
  fullBleed?: boolean
  topLine?: string
  dots?: string
}

export function contactThemes(mode: 'light' | 'dark', accent: string = RED): Record<ContactTheme, ThemeDef> {
  const dark = mode === 'dark'
  return {
    red: { name: 'أحمر', bar: { background: accent }, text: '#fff', icon: '#fff' },
    'red-ring': {
      name: 'أحمر بإطار',
      bar: { background: accent, border: '3.5px solid #fff', boxShadow: '0 12px 28px -10px rgba(0,0,0,0.45)' },
      text: '#fff',
      icon: '#fff',
    },
    white: {
      name: 'أبيض',
      bar: { background: '#fff', boxShadow: '0 14px 34px -12px rgba(0,0,0,0.4)' },
      text: INK,
      icon: accent,
    },
    glass: {
      name: 'بلّوري',
      bar: {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.22))',
        border: '2px solid rgba(255,255,255,0.85)',
        backdropFilter: 'blur(14px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.3)',
        boxShadow: '0 10px 30px -12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.9)',
      },
      text: '#2B2B2E',
      icon: '#2B2B2E',
    },
    outline: {
      name: 'مفرّغ',
      bar: { border: '3px solid #4A4A4D', background: 'transparent' },
      text: '#3A3A3D',
      icon: '#3A3A3D',
    },
    'half-fade': {
      name: 'نصف متدرّج',
      bar: {
        border: '3px solid #4D4D50',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.86) 34%, rgba(255,255,255,0) 62%)',
      },
      text: '#3A3A3D',
      icon: '#3A3A3D',
    },
    'dark-glass': {
      name: 'زجاج داكن',
      bar: {
        background: 'linear-gradient(180deg, rgba(30,30,36,0.72), rgba(10,10,12,0.6))',
        border: '1.5px solid rgba(255,255,255,0.2)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        boxShadow: '0 16px 40px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)',
      },
      text: '#fff',
      icon: RED_BRIGHT,
    },
    ink: { name: 'أسود', bar: { background: '#111214', boxShadow: '0 14px 30px -12px rgba(0,0,0,0.5)' }, text: '#fff', icon: RED_BRIGHT },
    'red-gradient': {
      name: 'أحمر لامع',
      bar: {
        background: 'linear-gradient(180deg, #EC3841 0%, #C8141E 52%, #8E0D15 100%)',
        boxShadow: '0 14px 30px -10px rgba(160,15,25,0.55), inset 0 1.5px 0 rgba(255,255,255,0.4)',
      },
      text: '#fff',
      icon: '#fff',
    },
    chips: {
      name: 'كبسولات',
      bar: { background: 'transparent' },
      text: dark ? '#fff' : INK,
      icon: accent,
      chips: dark
        ? {
            background: 'rgba(22,22,26,0.62)',
            border: '1.5px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }
        : { background: '#fff', boxShadow: '0 10px 24px -10px rgba(0,0,0,0.35)' },
    },
    minimal: {
      name: 'خط بسيط',
      bar: { background: 'transparent', borderRadius: 0 },
      text: dark ? '#fff' : '#2A2A2D',
      icon: accent,
      topLine: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)',
      dots: accent,
    },
    ribbon: {
      name: 'شريط عريض',
      bar: { background: accent, borderRadius: 0, boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.18)' },
      text: '#fff',
      icon: '#fff',
      fullBleed: true,
    },
    'outline-light': {
      name: 'مفرّغ فاتح',
      bar: { border: '2.5px solid rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.04)' },
      text: '#fff',
      icon: '#fff',
    },
    split: {
      name: 'أيقونات دائرية',
      bar: { background: '#fff', boxShadow: '0 14px 32px -12px rgba(0,0,0,0.4)' },
      text: INK,
      icon: '#fff',
      iconBadge: accent,
    },
  }
}

export const CONTACT_THEME_ORDER: ContactTheme[] = [
  'red-ring',
  'red',
  'red-gradient',
  'white',
  'glass',
  'outline',
  'half-fade',
  'split',
  'ink',
  'dark-glass',
  'outline-light',
  'chips',
  'minimal',
  'ribbon',
]

interface Props {
  brand: BrandConfig
  theme: ContactTheme
  mode: 'light' | 'dark'
  accent: string
}

export function ContactBar({ brand, theme, mode, accent }: Props) {
  const edit = useEdit()
  const t = contactThemes(mode, accent)[theme] ?? contactThemes(mode)['red-ring']
  const { y, w, h, fontSize } = brand.contact
  const iconSize = Math.round(h * 0.5)
  const font: React.CSSProperties = {
    fontFamily: `"${latFamily(700)}", "${AR_FAMILY}", ${FALLBACK}`,
    fontWeight: 700,
    fontSize,
    color: t.text,
    whiteSpace: 'nowrap',
    lineHeight: 1,
  }
  const items = [
    { key: 'web', icon: <GlobeIcon size={iconSize} color={t.icon} />, text: brand.website },
    { key: 'ig', icon: <InstagramIcon size={iconSize} color={t.icon} />, text: brand.instagram },
    { key: 'ph', icon: <PhoneIcon size={iconSize} color={t.icon} />, text: brand.phone },
  ].filter((i) => i.text.trim())

  const renderIcon = (icon: React.ReactNode) =>
    t.iconBadge ? (
      <span
        style={{
          width: h - 14,
          height: h - 14,
          borderRadius: '50%',
          background: t.iconBadge,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ transform: 'scale(0.78)', display: 'inline-flex' }}>{icon}</span>
      </span>
    ) : (
      icon
    )

  const left = t.fullBleed ? 0 : (POSTER_W - w) / 2
  const width = t.fullBleed ? POSTER_W : w

  return (
    <div
      className="lk-contact"
      dir="ltr"
      style={{
        position: 'absolute',
        left,
        top: y,
        width,
        height: h,
        borderRadius: h / 2,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: t.chips ? 'center' : 'space-between',
        gap: t.chips ? 14 : undefined,
        padding: t.chips ? 0 : t.fullBleed ? `0 ${(POSTER_W - w) / 2 + 36}px` : t.iconBadge ? '0 30px 0 7px' : '0 38px',
        ...t.bar,
      }}
      onPointerDown={
        edit
          ? (e) => {
              e.stopPropagation()
              edit.select({ kind: 'contact' })
            }
          : undefined
      }
    >
      {t.topLine && <div style={{ position: 'absolute', left: 0, right: 0, top: -14, height: 2, background: t.topLine }} />}
      {items.map((it, i) => (
        <div key={it.key} style={{ display: 'contents' }}>
          {t.dots && i > 0 && <span style={{ width: 8, height: 8, borderRadius: 4, background: t.dots, flex: 'none' }} />}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              ...(t.chips
                ? { ...t.chips, height: h, padding: '0 24px', borderRadius: h / 2, boxSizing: 'border-box' }
                : {}),
            }}
          >
            {renderIcon(it.icon)}
            <span style={font}>{it.text}</span>
          </div>
        </div>
      ))}
      {edit && isSel(edit.selection, { kind: 'contact' }) && <div className="lk-sel" style={{ inset: -8 }} data-label="شريط التواصل (ثابت)" />}
    </div>
  )
}

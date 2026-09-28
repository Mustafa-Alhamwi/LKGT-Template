import type { LogoVariant } from '../model/types'

/**
 * شعار LKGT — نسخة متجهية مُعاد بناؤها من الشعار الأصلي
 * (L أسود + K أحمر + GT بخطوط دائرية مزدوجة) مع إطار "ستيكر" أبيض.
 * يمكن استبداله بملف رسمي من الإعدادات.
 */

export const LOGO_RED = '#DC142E'
export const LOGO_BLACK = '#050608'

// الإحداثيات بوحدات الشعار الأصلية (146 × 110)
const L_PATH = 'M0 0 H21.5 V91 H102 L120 109 H0 Z'
const K_PATH = 'M23 0 H31.3 V37 L68 0 H99.5 L57 43.5 L97.8 88.7 H67 L31.3 51.5 V88.7 H23 Z'
const G_OUTER = 'M126.53 24.66 A24.8 24.8 0 1 0 123.17 63.06'
const G_INNER = 'M120.86 31.72 A15.8 15.8 0 1 0 122.93 50.49'
const BAR_TOP = 'M105 40 H146 V45 H105 Z'
const BAR_G = 'M105 48.2 H124.3 V53.2 H105 Z'
const T_PATH = 'M127 48.2 H146 V53.2 H132 V110 L127 105 Z'

export const LOGO_VIEWBOX = { x: -5, y: -5, w: 156, h: 120 }
export const LOGO_ASPECT = LOGO_VIEWBOX.w / LOGO_VIEWBOX.h

interface Props {
  variant?: LogoVariant
  height?: number
  className?: string
  style?: React.CSSProperties
}

export function LkgtLogo({ variant = 'color', height = 115, className, style }: Props) {
  const vb = LOGO_VIEWBOX
  const width = height * LOGO_ASPECT
  const sticker = variant === 'color'
  const mono = variant === 'white' ? '#FFFFFF' : variant === 'black' ? '#0B0B0D' : null
  const red = mono ?? LOGO_RED
  const black = mono ?? LOGO_BLACK
  // فراغ الفصل بين الحروف: أبيض في النسخة الملونة، وشفاف (قناع) في النسخ أحادية اللون
  const gap = 3.4
  const maskId = `lkgt-knock-${variant}`

  return (
    <svg
      className={className}
      style={style}
      width={width}
      height={height}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LKGT"
    >
      {mono || variant === 'color-flat' ? (
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x={vb.x} y={vb.y} width={vb.w} height={vb.h}>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#fff" />
            <path d={K_PATH} fill="#000" stroke="#000" strokeWidth={gap} strokeLinejoin="miter" />
          </mask>
        </defs>
      ) : null}

      {sticker && (
        <g fill="#fff" stroke="#fff" strokeLinejoin="round" strokeLinecap="round">
          <path d={L_PATH} strokeWidth={7} />
          <path d={K_PATH} strokeWidth={7} />
          <path d={G_OUTER} fill="none" strokeWidth={10} />
          <path d={G_INNER} fill="none" strokeWidth={10} />
          <path d={BAR_TOP} strokeWidth={7} />
          <path d={BAR_G} strokeWidth={7} />
          <path d={T_PATH} strokeWidth={7} />
        </g>
      )}

      <path d={L_PATH} fill={black} mask={mono || variant === 'color-flat' ? `url(#${maskId})` : undefined} />
      {sticker ? (
        <path d={K_PATH} fill={red} stroke="#fff" strokeWidth={gap} paintOrder="stroke" strokeLinejoin="miter" />
      ) : (
        <path d={K_PATH} fill={red} />
      )}
      <g fill="none" stroke={red} strokeWidth={3} strokeLinecap="butt">
        <path d={G_OUTER} />
        <path d={G_INNER} />
      </g>
      <g fill={red}>
        <path d={BAR_TOP} />
        <path d={BAR_G} />
        <path d={T_PATH} />
      </g>
    </svg>
  )
}

/** علامة مصغّرة لواجهة البرنامج */
export function LkgtMark({ size = 28 }: { size?: number }) {
  return <LkgtLogo variant="color" height={size} />
}

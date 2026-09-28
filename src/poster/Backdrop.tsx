import type { BackdropStyle } from '../model/types'
import { mix, withAlpha } from '../lib/color'

/** نسيج حبيبات ناعم (PNG مولّد مرة واحدة — آمن للتصدير) */
let noiseCache: string | null = null
export function noiseUrl(): string {
  if (noiseCache) return noiseCache
  if (typeof document === 'undefined') return ''
  const c = document.createElement('canvas')
  c.width = c.height = 160
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(160, 160)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() > 0.5 ? 255 : 0
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = Math.round(rnd() * 18)
  }
  ctx.putImageData(img, 0, 0)
  noiseCache = c.toDataURL('image/png')
  return noiseCache
}

/** خلفيات مولّدة — تظهر تحت الصورة المتدرجة (وحدها عند عدم وجود مشهد) */
export function backdropCss(b: BackdropStyle): React.CSSProperties {
  const { color, color2 } = b
  switch (b.kind) {
    case 'studio':
      return {
        background: `radial-gradient(120% 75% at 50% 30%, ${mix(color, '#ffffff', 0.7)} 0%, ${color} 52%, ${color2} 100%)`,
      }
    case 'studio-dark':
      return {
        background: `radial-gradient(95% 70% at 50% 38%, ${color} 0%, ${mix(color, color2, 0.6)} 55%, ${color2} 100%)`,
      }
    case 'spot':
      return {
        background: `radial-gradient(55% 40% at 50% 62%, ${color2} 0%, ${mix(color2, color, 0.6)} 45%, ${color} 100%)`,
      }
    case 'red-sweep':
      return {
        background: `radial-gradient(125% 85% at 50% 18%, ${mix(color, '#ffffff', 0.18)} 0%, ${color} 42%, ${color2} 100%)`,
      }
    case 'mesh':
      return {
        background: [
          `radial-gradient(40% 30% at 18% 12%, ${withAlpha('#E8212C', 0.35)} 0%, transparent 70%)`,
          `radial-gradient(45% 35% at 85% 30%, ${withAlpha(color2, 0.9)} 0%, transparent 70%)`,
          `radial-gradient(60% 40% at 50% 90%, ${withAlpha(color2, 0.8)} 0%, transparent 70%)`,
          color,
        ].join(', '),
      }
    case 'split':
      return { background: `linear-gradient(168deg, ${color} 0 54%, ${color2} 54% 100%)` }
    case 'vsplit':
      return { background: `linear-gradient(90deg, ${color} 0 50%, ${color2} 50% 100%)` }
    case 'aurora':
      return {
        background: [
          `radial-gradient(46% 34% at 10% 6%, ${withAlpha(color2, 0.55)} 0%, transparent 70%)`,
          `radial-gradient(48% 38% at 96% 26%, ${withAlpha(mix(color2, '#FFC58A', 0.5), 0.5)} 0%, transparent 72%)`,
          `radial-gradient(70% 45% at 24% 100%, ${withAlpha(color2, 0.4)} 0%, transparent 72%)`,
          `radial-gradient(60% 40% at 90% 92%, ${withAlpha(mix(color2, '#FFFFFF', 0.4), 0.55)} 0%, transparent 70%)`,
          color,
        ].join(', '),
      }
    case 'peach':
    case 'linear':
      return { background: `linear-gradient(${b.angle ?? 170}deg, ${color} 0%, ${color2} 100%)` }
    case 'mist':
      return {
        background: `radial-gradient(95% 55% at 50% 26%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 72%), linear-gradient(${b.angle ?? 180}deg, ${color} 0%, ${color2} 100%)`,
      }
    case 'grid':
      return {
        backgroundColor: color,
        backgroundImage: `linear-gradient(${withAlpha(color2, 0.55)} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(color2, 0.55)} 1px, transparent 1px)`,
        backgroundSize: '54px 54px',
      }
    case 'dots':
      return {
        backgroundColor: color,
        backgroundImage: `radial-gradient(${color2} 2.4px, transparent 3px)`,
        backgroundSize: '34px 34px',
      }
    case 'paper':
      return {
        backgroundColor: color,
        backgroundImage: `radial-gradient(120% 90% at 50% 30%, transparent 55%, ${withAlpha(color2, 0.9)} 100%), url("${noiseUrl()}")`,
        backgroundSize: '100% 100%, 160px 160px',
      }
    default:
      return { background: color }
  }
}

export function Backdrop({ style }: { style: BackdropStyle }) {
  return <div className="lk-layer" data-layer="backdrop" style={backdropCss(style)} />
}

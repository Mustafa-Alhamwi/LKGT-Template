import type { TextStyle } from './types'
import { INK, RED } from './brand'

/* ------------------------------------------------------------------
 * أنماط نصوص جاهزة: تُطبَّق على النص المحدد أو تُضاف كنص جديد
 * ------------------------------------------------------------------ */

export interface PresetCtx {
  primary: string
  ink: string
  dark: boolean
}

export interface BuiltinPreset {
  id: string
  name: string
  sample: string
  /** الحجم/العرض عند الإضافة كنص جديد */
  size?: number
  fw?: number
  style: (c: PresetCtx) => Partial<TextStyle>
}

const pill = (fill: string, color: string, extra: Partial<NonNullable<TextStyle['decoStyle']>> = {}) => ({
  deco: 'pill' as const,
  color,
  decoStyle: { fill, radius: 999, padX: 34, padY: 12, full: false, shadow: true, shadowSize: 0.9, shadowColor: '#000000', ...extra } as TextStyle['decoStyle'],
})

export const BUILTIN_TEXT_PRESETS: BuiltinPreset[] = [
  { id: 'h1', name: 'عنوان جريء', sample: 'عنوان كبير', size: 110, fw: 820, style: (c) => ({ size: 110, weightAr: 900, weightLat: 700, color: c.ink, lineHeight: 1.05, fit: 'none', deco: 'none' }) },
  { id: 'h2', name: 'عنوان بلون العلامة', sample: 'عنوان رئيسي', size: 86, fw: 780, style: (c) => ({ size: 86, weightAr: 900, weightLat: 700, color: c.primary, lineHeight: 1.1, fit: 'none', deco: 'none' }) },
  { id: 'body', name: 'نص عادي', sample: 'نص تفصيلي عادي', size: 40, fw: 700, style: (c) => ({ size: 40, weightAr: 500, weightLat: 400, color: c.ink, lineHeight: 1.45, fit: 'none', deco: 'none' }) },
  { id: 'price', name: 'سعر كبير', sample: '299$', size: 150, fw: 560, style: (c) => ({ size: 150, weightAr: 900, weightLat: 700, color: c.primary, lineHeight: 1, fit: 'none', deco: 'none' }) },
  { id: 'old', name: 'سعر مشطوب', sample: '399$', size: 62, fw: 360, style: (c) => ({ size: 62, weightAr: 500, weightLat: 400, color: c.dark ? '#B8B8C2' : '#6B6B73', strike: true, accent: c.primary, lineHeight: 1, fit: 'none', deco: 'none' }) },
  { id: 'disc', name: 'نسبة خصم', sample: '-25%', size: 52, fw: 300, style: (c) => ({ size: 52, weightAr: 900, weightLat: 700, lineHeight: 1, fit: 'none', ...pill(c.primary, '#FFFFFF') }) },
  { id: 'new', name: 'شارة كبسولة', sample: 'وصل حديثاً', size: 38, fw: 380, style: (c) => ({ size: 38, weightAr: 700, lineHeight: 1.1, fit: 'none', ...pill(c.dark ? '#FFFFFF' : c.ink, c.dark ? c.ink : '#FFFFFF', { shadow: false }) }) },
  { id: 'cta', name: 'زر اطلب الآن', sample: 'اطلب الآن', size: 42, fw: 420, style: (c) => ({ size: 42, weightAr: 900, lineHeight: 1.1, fit: 'none', ...pill(c.primary, '#FFFFFF', { padX: 46, padY: 16 }) }) },
  { id: 'glass', name: 'بطاقة زجاجية', sample: 'نص داخل زجاج', size: 42, fw: 640, style: (c) => ({ size: 42, weightAr: 700, lineHeight: 1.3, color: c.dark ? '#FFFFFF' : c.ink, fit: 'none', deco: 'glass', decoStyle: { fill: c.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.6)', stroke: c.dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.9)', strokeWidth: 2, radius: 34, padX: 38, padY: 22, full: true, shadow: true, shadowSize: 1, blur: 16 } as TextStyle['decoStyle'] }) },
  { id: 'card', name: 'بطاقة بيضاء', sample: 'ميزة مميزة', size: 40, fw: 620, style: (c) => ({ size: 40, weightAr: 700, lineHeight: 1.3, color: c.ink, fit: 'none', deco: 'box', decoStyle: { fill: '#FFFFFF', radius: 30, padX: 34, padY: 20, full: true, shadow: true, shadowSize: 1.1, shadowColor: '#000000' } as TextStyle['decoStyle'] }) },
  { id: 'tab', name: 'شريط مائل', sample: 'عرض خاص', size: 40, fw: 400, style: (c) => ({ size: 40, weightAr: 900, lineHeight: 1.1, color: '#FFFFFF', fit: 'none', deco: 'tab', decoStyle: { fill: c.primary, padX: 28, padY: 10, full: false, radius: 0, shadow: false } as TextStyle['decoStyle'] }) },
  { id: 'grad', name: 'تدرج لوني', sample: 'نص متدرج', size: 100, fw: 760, style: (c) => ({ size: 100, weightAr: 900, weightLat: 700, gradient: true, color: c.primary, color2: c.dark ? '#FFB3A6' : '#5E0A10', gradAngle: 100, lineHeight: 1.05, fit: 'none', deco: 'none' }) },
  { id: 'outline', name: 'حروف مفرّغة', sample: 'OUTLINE', size: 120, fw: 780, style: (c) => ({ size: 120, weightAr: 900, weightLat: 700, color: 'rgba(0,0,0,0)', strokeW: 4, strokeColor: c.dark ? '#FFFFFF' : c.ink, lineHeight: 1, fit: 'none', deco: 'none', textShadow: 'none' }) },
  { id: 'neon', name: 'توهج نيون', sample: 'NEON', size: 110, fw: 700, style: (c) => ({ size: 110, weightAr: 900, weightLat: 700, color: '#FFFFFF', textShadow: 'glow', shadowColor: c.primary, lineHeight: 1, fit: 'none', deco: 'none' }) },
  { id: 'hard', name: 'ظل حاد', sample: 'ظل حاد', size: 100, fw: 700, style: (c) => ({ size: 100, weightAr: 900, weightLat: 700, color: '#FFFFFF', textShadow: 'hard', shadowColor: c.ink, strokeW: 0, lineHeight: 1.05, fit: 'none', deco: 'none' }) },
  { id: 'quote', name: 'اقتباس بخط جانبي', sample: 'اقتباس ملهم', size: 44, fw: 700, style: (c) => ({ size: 44, weightAr: 500, lineHeight: 1.5, color: c.ink, fit: 'none', deco: 'bar', decoStyle: { accent: c.primary, strokeWidth: 10, padX: 30, padY: 8 } as TextStyle['decoStyle'] }) },
  { id: 'rules', name: 'بين خطين', sample: 'عنوان أنيق', size: 48, fw: 800, style: (c) => ({ size: 48, weightAr: 700, weightLat: 400, tracking: 0.08, color: c.ink, lineHeight: 1.2, fit: 'none', deco: 'rules', decoStyle: { accent: c.primary, strokeWidth: 3, padX: 24 } as TextStyle['decoStyle'] }) },
  { id: 'note', name: 'ملاحظة صغيرة', sample: '* الأسعار شاملة الضريبة', size: 26, fw: 700, style: (c) => ({ size: 26, weightAr: 400, weightLat: 400, color: c.dark ? '#B8B8C2' : '#5B5B63', lineHeight: 1.4, fit: 'none', deco: 'none' }) },
]

export const DEFAULT_CTX: PresetCtx = { primary: RED, ink: INK, dark: false }

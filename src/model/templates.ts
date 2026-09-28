import { RED, RED_DEEP, INK, GRAY } from './brand'
import type {
  DecoStyle,
  DecorItem,
  Template,
  TemplateStyle,
  TextKey,
  TextStyle,
} from './types'

/* ------------------------------------------------------------------
 * مكتبة قوالب إعلانات المنتجات
 * كل قالب = نمط (Style) فقط، والمحتوى منفصل ليبقى عند التنقل بين القوالب
 * ------------------------------------------------------------------ */

export const DEFAULT_DECO: DecoStyle = {
  fill: RED,
  stroke: 'transparent',
  strokeWidth: 0,
  radius: 18,
  padX: 30,
  padY: 10,
  shadow: false,
  accent: RED,
  full: true,
  fill2: '',
  angle: 135,
  shadowSize: 1,
  shadowColor: '#000000',
  blur: 14,
}

export const DEFAULT_TEXT: TextStyle = {
  visible: true,
  size: 40,
  fit: 'none',
  maxSize: 150,
  weightAr: 700,
  weightLat: 700,
  color: INK,
  accent: RED,
  uppercase: false,
  tracking: 0,
  lineHeight: 1.15,
  deco: 'none',
  decoStyle: DEFAULT_DECO,
  marginTop: 0,
  opacity: 1,
  free: false,
  fx: 190,
  fy: 640,
  fw: 700,
  rotate: 0,
  align: 'inherit',
  gradient: false,
  color2: '#7A0B12',
  gradAngle: 90,
  strokeW: 0,
  strokeColor: '#ffffff',
  textShadow: 'none',
  shadowColor: '#000000',
}

type TextPatch = Partial<Omit<TextStyle, 'decoStyle'>> & { decoStyle?: Partial<DecoStyle> }

export function txt(p: TextPatch = {}, base: TextStyle = DEFAULT_TEXT): TextStyle {
  return { ...base, ...p, decoStyle: { ...base.decoStyle, ...(p.decoStyle ?? {}) } }
}

const hidden = (p: TextPatch = {}) => txt({ visible: false, ...p })

/** نمط نص جديد يضيفه المستخدم */
export function makeExtraStyle(): TextStyle {
  return txt({ size: 46, color: INK, weightAr: 700, free: true, fx: 190, fy: 690, fw: 700, align: 'center' })
}

export const DEFAULT_ORDER: TextKey[] = ['kicker', 'title', 'subtitle', 'tagline', 'features', 'note', 'price']

let decorSeq = 0
export function decor(p: Partial<DecorItem> & Pick<DecorItem, 'kind'>): DecorItem {
  decorSeq += 1
  return {
    id: `d${decorSeq}`,
    layer: 'back',
    x: 0,
    y: 0,
    w: 1080,
    h: 1440,
    rotate: 0,
    color: RED,
    color2: '#ffffff',
    opacity: 1,
    size: 4,
    text: '',
    visible: true,
    ...p,
  }
}

export function baseStyle(): TemplateStyle {
  return {
    theme: 'light',
    backdrop: { kind: 'solid', color: '#F2F2F2', color2: '#E4E4E4', angle: 170 },
    fade: { enabled: true, top: 0.1, from: 0.42, to: 0.8 },
    sceneFx: { blur: 0, brightness: 1, saturate: 1, contrast: 1, tint: '#ffffff', tintOpacity: 0, grayscale: 0 },
    shape: {
      kind: 'none',
      color: RED,
      color2: RED_DEEP,
      opacity: 1,
      spread: 0.12,
      top: 0.55,
      bottom: 60,
      radius: 26,
      skew: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      stroke: 6,
    },
    productFx: { shadow: 'soft', shadowOpacity: 0.28, shadowColor: '#000000', reflection: false },
    decor: [],
    text: {
      x: 195,
      y: 262,
      w: 690,
      align: 'center',
      gap: 14,
      order: [...DEFAULT_ORDER],
      panel: { kind: 'none', fill: 'rgba(255,255,255,0.1)', stroke: 'rgba(255,255,255,0.25)', radius: 32, pad: 40 },
      items: {
        kicker: hidden({ size: 30, color: RED, weightAr: 700 }),
        title: txt({ fit: 'block', maxSize: 130, color: RED, uppercase: true, lineHeight: 1, tracking: -0.005 }),
        subtitle: txt({ fit: 'block', maxSize: 46, color: GRAY, uppercase: true, lineHeight: 1.1 }),
        tagline: txt({
          size: 40,
          color: '#ffffff',
          weightAr: 700,
          lineHeight: 1.35,
          deco: 'pill',
          marginTop: 10,
          decoStyle: { fill: RED, radius: 20, padY: 12, padX: 30, full: true, shadow: true },
        }),
        features: hidden({
          size: 26,
          color: INK,
          weightAr: 500,
          weightLat: 700,
          deco: 'outlineBox',
          decoStyle: { fill: 'rgba(255,255,255,0.7)', stroke: 'rgba(0,0,0,0.12)', strokeWidth: 2, radius: 999, padX: 22, padY: 8, full: false },
        }),
        note: hidden({ size: 28, color: GRAY, weightAr: 400 }),
        price: hidden({ size: 150, color: RED, weightLat: 700, lineHeight: 1 }),
      },
    },
    contact: { theme: 'red-ring', accent: RED },
    logos: { lkgt: 'color', partner: 'original' },
    productArea: { x: 140, y: 600, w: 800, h: 640 },
  }
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] }

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const b = out[k]
    out[k] = isObj(v) && isObj(b) ? deepMerge(b, v as DeepPartial<typeof b>) : v
  }
  return out as T
}

function style(patch: DeepPartial<TemplateStyle>): TemplateStyle {
  return deepMerge(baseStyle(), patch)
}

const WHITE = '#FFFFFF'

const SOFT_SHADOW = { shadow: true, shadowSize: 1, shadowColor: '#000000' }

/** مساعد تعريف قالب */
function tpl(id: string, name: string, nameEn: string, tags: string[], st: DeepPartial<TemplateStyle>): Template {
  return { id, name, nameEn, category: 'ads', builtIn: true, tags, style: style(st) }
}

const pillRed = (extra: Partial<DecoStyle> = {}, color = WHITE): TextPatch => ({
  size: 40,
  color,
  deco: 'pill',
  marginTop: 10,
  decoStyle: { fill: RED, radius: 999, padY: 12, padX: 34, full: true, shadow: true, ...extra },
})

/* ================================================================== */

export const BUILTIN_TEMPLATES: Template[] = [
  /* ------------------------------ فاتحة عصرية ------------------------------ */
  tpl('clean-white', 'أبيض نقي', 'Clean White', ['فاتح', 'بسيط'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E6E6EA' },
    shape: { kind: 'floor', color: '#000000', opacity: 0.2, spread: 0.32 },
    productFx: { shadow: 'soft', shadowOpacity: 0.22 },
    decor: [decor({ kind: 'plus', x: 820, y: 640, w: 230, h: 230, color: RED, opacity: 0.45, size: 3 })],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 118, color: INK, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 40, color: RED, uppercase: true, weightLat: 400, tracking: 0.06 }),
        tagline: txt(pillRed({ radius: 999 })),
      },
    },
    contact: { theme: 'red-ring' },
  }),

  tpl('aurora', 'شفق', 'Aurora', ['فاتح', 'زجاجي', 'ألوان ناعمة'], {
    backdrop: { kind: 'aurora', color: '#FFF7F5', color2: '#FF8F96' },
    shape: { kind: 'halo', color: '#FFFFFF', opacity: 0.85, scale: 1.05 },
    productFx: { shadow: 'float', shadowOpacity: 0.28 },
    text: {
      y: 240,
      x: 170,
      w: 740,
      gap: 12,
      panel: { kind: 'glass', fill: 'rgba(255,255,255,0.55)', stroke: 'rgba(255,255,255,0.95)', radius: 44, pad: 38 },
      items: {
        title: txt({ fit: 'block', maxSize: 112, color: '#B3121C', uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 36, color: '#4A4A50', uppercase: true, weightLat: 400, tracking: 0.05 }),
        tagline: txt(pillRed({ fill: INK, shadow: false })),
      },
    },
    contact: { theme: 'glass' },
  }),

  tpl('peach-orb', 'كرة دافئة', 'Warm Orb', ['فاتح', 'دائرة', 'دافئ'], {
    backdrop: { kind: 'peach', color: '#FFF5F1', color2: '#FFD3CB', angle: 172 },
    shape: { kind: 'circle', color: '#FFFFFF', color2: '#FFEDE9', opacity: 0.92, scale: 0.98 },
    productFx: { shadow: 'float', shadowOpacity: 0.26 },
    decor: [decor({ kind: 'blobs', x: 0, y: 0, w: 1080, h: 1440, color: '#FF9A9F', color2: '#FFC9B8', opacity: 0.55 })],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 116, color: '#A3111A', uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 38, color: '#5B3B3B', uppercase: true, weightLat: 400, tracking: 0.06 }),
        tagline: txt(pillRed({ fill: INK, shadow: true })),
      },
    },
    contact: { theme: 'white' },
  }),

  tpl('bento', 'بينتو', 'Bento', ['فاتح', 'بطاقات', 'مميزات'], {
    backdrop: { kind: 'solid', color: '#ECECEF', color2: '#E0E0E4' },
    shape: { kind: 'card', color: '#FFFFFF', color2: '#FFFFFF', top: -0.1, spread: 0.14, bottom: 70, radius: 54, opacity: 1 },
    productFx: { shadow: 'contact', shadowOpacity: 0.35 },
    text: {
      x: 110,
      y: 236,
      w: 860,
      gap: 14,
      items: {
        title: txt({
          fit: 'block',
          maxSize: 100,
          color: INK,
          uppercase: true,
          lineHeight: 1,
          deco: 'outlineBox',
          decoStyle: { fill: '#FFFFFF', stroke: 'transparent', strokeWidth: 0, radius: 34, padX: 40, padY: 22, shadow: true, full: true },
        }),
        subtitle: txt({
          size: 30,
          color: RED,
          uppercase: true,
          weightLat: 700,
          tracking: 0.05,
          deco: 'pill',
          decoStyle: { fill: '#FFFFFF', radius: 999, padX: 30, padY: 10, shadow: true, full: false },
        }),
        tagline: txt(pillRed({ radius: 34, padY: 16 })),
        features: txt({
          visible: false,
          size: 26,
          color: INK,
          weightAr: 700,
          deco: 'pill',
          decoStyle: { fill: '#FFFFFF', radius: 999, padX: 24, padY: 10, shadow: true, full: false },
        }),
      },
    },
    contact: { theme: 'white' },
  }),

  tpl('split-red', 'نصفين', 'Split', ['فاتح', 'أحمر', 'جريء'], {
    backdrop: { kind: 'split', color: '#F7F7F8', color2: RED },
    productFx: { shadow: 'soft', shadowOpacity: 0.4 },
    decor: [decor({ kind: 'rings', x: 600, y: 860, w: 700, h: 700, color: '#ffffff', opacity: 0.16, size: 5 })],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 120, color: INK, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 40, color: RED, uppercase: true, weightLat: 700, tracking: 0.05 }),
        tagline: txt(pillRed({ fill: INK })),
      },
    },
    contact: { theme: 'white' },
  }),

  tpl('mist-glass', 'ضباب', 'Mist', ['فاتح', 'أنيق', 'أقواس'], {
    backdrop: { kind: 'mist', color: '#F3F5F8', color2: '#D9DEE7' },
    shape: { kind: 'arcs', color: RED, opacity: 0.85, stroke: 4, scale: 0.72 },
    productFx: { shadow: 'float', shadowOpacity: 0.24 },
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 116, color: INK, uppercase: true, weightLat: 300, tracking: 0.02, lineHeight: 1 }),
        subtitle: txt({ size: 28, color: RED, uppercase: true, weightLat: 700, tracking: 0.3 }),
        tagline: txt({
          size: 42,
          color: '#2A2A2E',
          weightAr: 500,
          deco: 'rules',
          marginTop: 6,
          decoStyle: { accent: RED, strokeWidth: 3, padX: 22 },
        }),
      },
    },
    contact: { theme: 'minimal' },
  }),

  tpl('frame-modern', 'إطار عصري', 'Modern Frame', ['فاتح', 'إطار'], {
    backdrop: { kind: 'solid', color: '#FFFFFF', color2: '#F0F0F2' },
    shape: { kind: 'slab', color: RED, color2: RED_DEEP, top: 0.9, bottom: 34, spread: 0.2, radius: 8, skew: 0, opacity: 1 },
    productFx: { shadow: 'contact', shadowOpacity: 0.35 },
    decor: [
      decor({ kind: 'frame', x: 34, y: 34, w: 1012, h: 1372, color: '#111214', opacity: 0.9, size: 2, layer: 'front' }),
      decor({ kind: 'corners', x: 58, y: 58, w: 964, h: 1324, color: RED, size: 5, layer: 'front' }),
    ],
    text: {
      y: 250,
      items: {
        kicker: txt({
          visible: false,
          size: 26,
          color: WHITE,
          deco: 'tab',
          decoStyle: { fill: RED, padX: 22, padY: 6, full: false },
        }),
        title: txt({ fit: 'block', maxSize: 108, color: INK, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ size: 28, color: '#6A6A70', uppercase: true, weightLat: 400, tracking: 0.28 }),
        tagline: txt({
          size: 40,
          color: INK,
          weightAr: 700,
          deco: 'bracket',
          marginTop: 12,
          decoStyle: { accent: RED, strokeWidth: 3, padX: 24, padY: 14 },
        }),
      },
    },
    contact: { theme: 'outline' },
  }),

  tpl('stripes-brand', 'خطوط LKGT', 'Brand Stripes', ['فاتح', 'هوية', 'خطوط'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E9E9EC' },
    shape: { kind: 'floor', color: '#000000', opacity: 0.22, spread: 0.35 },
    productFx: { shadow: 'soft', shadowOpacity: 0.3 },
    decor: [decor({ kind: 'stripes', x: 0, y: 1150, w: 1080, h: 290, color: RED, opacity: 0.95, size: 26 })],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 126, color: RED, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 44, color: '#404044', uppercase: true }),
        tagline: txt(pillRed({ radius: 22 })),
      },
    },
    contact: { theme: 'red-ring' },
  }),

  tpl('wave', 'موجة', 'Wave', ['فاتح', 'أحمر', 'ديناميكي'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#EDEDF0' },
    shape: { kind: 'wave', color: RED, color2: RED_DEEP, top: 0.55, opacity: 1 },
    productFx: { shadow: 'soft', shadowOpacity: 0.35 },
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 120, color: INK, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 40, color: RED, uppercase: true, weightLat: 700, tracking: 0.05 }),
        tagline: txt(pillRed({ fill: INK, radius: 999 })),
      },
    },
    contact: { theme: 'white' },
  }),

  tpl('orbit', 'مدار', 'Orbit', ['فاتح', 'تقني', 'دوائر'], {
    backdrop: { kind: 'linear', color: '#FFFFFF', color2: '#EFEFF3', angle: 180 },
    shape: { kind: 'orbit', color: RED, opacity: 1, stroke: 3, scale: 0.8 },
    productFx: { shadow: 'float', shadowOpacity: 0.26 },
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 116, color: INK, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 38, color: RED, uppercase: true, weightLat: 400, tracking: 0.1 }),
        tagline: txt({
          size: 38,
          color: INK,
          deco: 'outlineBox',
          decoStyle: { fill: '#FFFFFF', stroke: RED, strokeWidth: 2.5, radius: 999, padX: 34, padY: 12, full: true, shadow: true },
        }),
      },
    },
    contact: { theme: 'ink' },
  }),

  tpl('soft-gradient', 'تدرّج ناعم', 'Soft Gradient', ['فاتح', 'تدرج', 'حديث'], {
    backdrop: { kind: 'linear', color: '#FFFFFF', color2: '#FFE3E1', angle: 200 },
    shape: { kind: 'blob', color: '#FFFFFF', color2: '#FFFFFF', opacity: 0.8, scale: 1.05 },
    productFx: { shadow: 'float', shadowOpacity: 0.26 },
    decor: [decor({ kind: 'blobs', color: '#FF7C84', color2: '#FFB3A6', opacity: 0.4 })],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 118, color: RED, gradient: true, color2: '#6E0A11', gradAngle: 100, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 38, color: '#4E4E54', uppercase: true, weightLat: 400, tracking: 0.08 }),
        tagline: txt({ size: 42, fit: 'kashida', color: INK, accent: RED, weightAr: 900, marginTop: 6 }),
        features: txt({
          visible: false,
          size: 26,
          color: INK,
          weightAr: 700,
          deco: 'pill',
          decoStyle: { fill: 'rgba(255,255,255,0.85)', radius: 999, padX: 24, padY: 9, shadow: true, full: false },
        }),
      },
    },
    contact: { theme: 'red-gradient' },
  }),

  tpl('editorial', 'تحريري', 'Editorial', ['فاتح', 'مجلة', 'يمين'], {
    backdrop: { kind: 'paper', color: '#F3F1EE', color2: '#E7E3DE' },
    productFx: { shadow: 'soft', shadowOpacity: 0.25 },
    decor: [decor({ kind: 'watermark', x: 40, y: 600, w: 1000, h: 300, color: RED, opacity: 0.18, size: 3, text: '{title}' })],
    text: {
      x: 300,
      y: 250,
      w: 660,
      align: 'right',
      gap: 12,
      items: {
        kicker: txt({ visible: true, size: 30, color: RED, weightAr: 700, deco: 'bar', decoStyle: { accent: RED, strokeWidth: 6, padX: 16 } }),
        title: txt({ fit: 'block', maxSize: 104, color: INK, lineHeight: 1 }),
        subtitle: txt({ size: 28, color: '#6A6A6E', uppercase: true, weightLat: 400, tracking: 0.12 }),
        tagline: txt({ size: 46, color: INK, accent: RED, weightAr: 900, marginTop: 10, lineHeight: 1.3 }),
        note: txt({ visible: true, size: 28, color: '#57575B', weightAr: 400 }),
      },
    },
    contact: { theme: 'minimal' },
  }),

  tpl('arch', 'القوس', 'Arch', ['فاتح', 'شكل تحت المنتج'], {
    backdrop: { kind: 'solid', color: '#F6F3F1', color2: '#EAE5E1' },
    shape: { kind: 'arch', color: '#E3262F', color2: '#98101A', top: -0.08, spread: 0.14, bottom: 80, radius: 30 },
    productFx: { shadow: 'soft', shadowOpacity: 0.4 },
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 120, color: INK, lineHeight: 1, uppercase: true }),
        subtitle: txt({ fit: 'block', maxSize: 40, color: RED, uppercase: true, weightLat: 400, tracking: 0.08 }),
        tagline: txt({ size: 38, color: INK, accent: RED, deco: 'rules', decoStyle: { accent: RED, strokeWidth: 3, padX: 20 } }),
      },
    },
    contact: { theme: 'red-gradient' },
  }),

  tpl('brand-rings', 'حلقات العلامة', 'Brand Rings', ['فاتح', 'حلقات'], {
    backdrop: { kind: 'studio', color: '#FBFBFB', color2: '#E9E9EB' },
    shape: { kind: 'rings', color: RED, opacity: 0.95, stroke: 7, scale: 1.05 },
    productFx: { shadow: 'float', shadowOpacity: 0.3 },
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 120, color: INK, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 40, color: RED, uppercase: true, weightLat: 400, tracking: 0.08 }),
        tagline: txt(pillRed({ fill: INK, shadow: false })),
      },
    },
    contact: { theme: 'ink' },
  }),

  tpl('headline-frame', 'إطار العنوان', 'Headline Frame', ['فاتح', 'إطارات', 'عروض'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E6E6E8' },
    shape: { kind: 'floor', color: '#000000', opacity: 0.18, spread: 0.3 },
    text: {
      x: 150,
      y: 262,
      w: 780,
      gap: 30,
      items: {
        title: txt({
          fit: 'block',
          maxSize: 86,
          color: RED,
          uppercase: true,
          lineHeight: 1,
          deco: 'outlineBox',
          decoStyle: { fill: 'rgba(255,255,255,0.92)', stroke: '#7E1016', strokeWidth: 3, radius: 18, padX: 36, padY: 16, ...SOFT_SHADOW, full: true },
        }),
        subtitle: txt({ visible: false, size: 30, color: GRAY }),
        tagline: txt({
          size: 42,
          color: '#1B1B1D',
          accent: RED,
          weightAr: 700,
          lineHeight: 1.35,
          deco: 'outlineBox',
          decoStyle: { fill: 'rgba(255,255,255,0.94)', stroke: '#7E1016', strokeWidth: 3, radius: 18, padX: 34, padY: 14, full: false, ...SOFT_SHADOW },
        }),
      },
    },
    contact: { theme: 'red' },
  }),

  tpl('red-stage', 'منصّة حمراء', 'Red Stage', ['فاتح', 'شكل تحت المنتج', 'عروض'], {
    backdrop: { kind: 'paper', color: '#F4F4F4', color2: '#E9E9E9' },
    shape: { kind: 'slab', color: RED, color2: '#A50F18', top: 0.58, bottom: 62, spread: 0.12, radius: 28, skew: -8 },
    productFx: { shadow: 'contact', shadowOpacity: 0.35 },
    text: {
      x: 230,
      y: 290,
      w: 620,
      gap: 18,
      items: {
        kicker: txt({
          visible: true,
          size: 64,
          fit: 'block',
          maxSize: 72,
          color: WHITE,
          weightAr: 900,
          lineHeight: 1.2,
          deco: 'box',
          decoStyle: { fill: RED, radius: 0, padX: 22, padY: 4, full: false },
        }),
        title: txt({
          fit: 'block',
          maxSize: 84,
          color: '#5A0B11',
          lineHeight: 1.05,
          deco: 'doubleUnderline',
          decoStyle: { accent: RED, stroke: '#3A3A3C', strokeWidth: 5, padY: 8 },
        }),
        subtitle: txt({ visible: false, size: 30 }),
        tagline: txt({ size: 36, color: '#2A2A2C', weightAr: 500, deco: 'none', marginTop: 4 }),
      },
    },
    contact: { theme: 'outline' },
  }),

  tpl('diagonal-band', 'شريط مائل', 'Diagonal Band', ['فاتح', 'حيوي'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#EEEEF0' },
    shape: { kind: 'band', color: RED, color2: '#B0121B', opacity: 0.96, skew: -11, top: 0.62, scale: 1 },
    productFx: { shadow: 'soft', shadowOpacity: 0.35 },
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 120, color: INK, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 42, color: RED, uppercase: true, weightLat: 700 }),
        tagline: txt(pillRed({ fill: INK, radius: 14 })),
      },
    },
    contact: { theme: 'red' },
  }),

  tpl('new-arrival', 'وصل حديثاً', 'New Arrival', ['فاتح', 'شارة'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#EBEBEE' },
    shape: { kind: 'floor', color: '#000000', opacity: 0.18, spread: 0.3 },
    decor: [
      decor({ kind: 'badge', x: 800, y: 560, w: 190, h: 190, rotate: -12, color: RED, color2: WHITE, layer: 'front', text: '{badge}' }),
      decor({ kind: 'stripes', x: 0, y: 1230, w: 1080, h: 210, color: RED, opacity: 0.9, size: 26 }),
    ],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 130, color: RED, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 44, color: '#333336', uppercase: true }),
        tagline: txt(pillRed({ radius: 20 })),
      },
    },
    contact: { theme: 'red-ring' },
  }),

  /* ------------------------------ صورة متدرّجة (مثل إعلاناتكم) ------------------------------ */
  tpl('classic-red', 'كلاسيك — صورة متدرجة', 'Classic Photo Fade', ['فاتح', 'صورة', 'كلاسيك'], {
    fade: { top: 0.1, from: 0.42, to: 0.8 },
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 130, color: RED, uppercase: true, lineHeight: 1, tracking: -0.005 }),
        subtitle: txt({ fit: 'block', maxSize: 46, color: GRAY, uppercase: true, lineHeight: 1.1 }),
        tagline: txt(pillRed({ radius: 20 })),
      },
    },
    contact: { theme: 'red-ring' },
  }),

  tpl('soft-studio', 'استوديو ناعم — صورة متدرجة', 'Soft Photo Fade', ['فاتح', 'صورة', 'كشيدة'], {
    fade: { top: 0.12, from: 0.45, to: 0.78 },
    text: {
      y: 285,
      w: 650,
      x: 215,
      items: {
        title: txt({ fit: 'block', maxSize: 120, color: '#CB0E22', uppercase: false, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 44, color: '#3A3A3C', weightLat: 400, lineHeight: 1.1 }),
        tagline: txt({ ...pillRed({ radius: 18, fill: '#B8141C', padX: 34, padY: 10 }), size: 42, fit: 'kashida' }),
      },
    },
    contact: { theme: 'half-fade' },
  }),

  /* ------------------------------ داكنة ------------------------------ */
  tpl('crimson-night', 'ليل قرمزي', 'Crimson Night', ['داكن', 'هالة'], {
    theme: 'dark',
    backdrop: { kind: 'studio-dark', color: '#141418', color2: '#050506' },
    fade: { top: 0.08, from: 0.34, to: 0.78 },
    sceneFx: { brightness: 0.72, saturate: 0.9, contrast: 1.05 },
    shape: { kind: 'halo', color: RED, opacity: 0.7, scale: 1.15 },
    productFx: { shadow: 'glow', shadowOpacity: 0.45, shadowColor: '#E8212C' },
    decor: [
      decor({ kind: 'glow', x: -260, y: -300, w: 900, h: 900, color: RED, opacity: 0.28 }),
      decor({ kind: 'noise', opacity: 0.08, layer: 'front' }),
    ],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 130, color: WHITE, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 44, color: '#FF5A63', uppercase: true, weightLat: 400, tracking: 0.04 }),
        tagline: txt(pillRed()),
      },
    },
    contact: { theme: 'dark-glass' },
    logos: { partner: 'white' },
  }),

  tpl('spotlight', 'بقعة ضوء', 'Spotlight', ['داكن', 'إضاءة'], {
    theme: 'dark',
    backdrop: { kind: 'spot', color: '#0A0A0C', color2: '#2A2A30' },
    fade: { top: 0, from: 0.3, to: 0.64 },
    sceneFx: { brightness: 0.55, saturate: 0.8, blur: 2 },
    shape: { kind: 'floor', color: '#FFFFFF', opacity: 0.32, spread: 0.45 },
    productFx: { shadow: 'contact', shadowOpacity: 0.6 },
    decor: [decor({ kind: 'beam', x: 190, y: -40, w: 700, h: 1250, color: '#FFFFFF', opacity: 0.14 })],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 120, color: WHITE, uppercase: true, weightLat: 300, lineHeight: 1, tracking: 0.02 }),
        subtitle: txt({ fit: 'block', maxSize: 42, color: '#FF3B46', uppercase: true, weightLat: 700, tracking: 0.06 }),
        tagline: txt({ size: 40, color: WHITE, weightAr: 500, deco: 'underline', decoStyle: { accent: RED, strokeWidth: 4, padY: 10 } }),
      },
    },
    contact: { theme: 'outline-light' },
    logos: { partner: 'white' },
  }),

  tpl('tech-grid', 'تقني', 'Tech Grid', ['داكن', 'مواصفات'], {
    theme: 'dark',
    backdrop: { kind: 'solid', color: '#0B0D12', color2: '#151A25' },
    fade: { top: 0.04, from: 0.3, to: 0.62 },
    sceneFx: { brightness: 0.62, saturate: 0.8 },
    shape: { kind: 'frame', color: RED, opacity: 0.9, stroke: 3, spread: 0.1, offsetX: 0, offsetY: 30, top: 0.02, bottom: 20, radius: 6 },
    productFx: { shadow: 'soft', shadowOpacity: 0.5 },
    decor: [
      decor({ kind: 'grid', color: '#FFFFFF', opacity: 0.055, size: 60 }),
      decor({ kind: 'corners', x: 40, y: 40, w: 1000, h: 1250, color: RED, size: 4, layer: 'front' }),
      decor({ kind: 'glow', x: 190, y: 620, w: 700, h: 700, color: '#2A6BFF', opacity: 0.12 }),
    ],
    text: {
      y: 250,
      gap: 14,
      items: {
        kicker: txt({ visible: true, size: 26, color: WHITE, deco: 'tab', decoStyle: { fill: RED, padX: 22, padY: 6, full: false } }),
        title: txt({ fit: 'block', maxSize: 120, color: WHITE, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 36, color: '#9AA3B2', uppercase: true, weightLat: 400, tracking: 0.14 }),
        tagline: txt({
          size: 36,
          color: WHITE,
          deco: 'outlineBox',
          decoStyle: { fill: 'rgba(209,26,36,0.12)', stroke: RED, strokeWidth: 2, radius: 10, full: true },
        }),
        features: txt({
          visible: true,
          size: 26,
          color: WHITE,
          weightAr: 500,
          deco: 'outlineBox',
          decoStyle: { fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.22)', strokeWidth: 2, radius: 999, padX: 22, padY: 8, full: false },
        }),
      },
    },
    contact: { theme: 'dark-glass' },
    logos: { partner: 'white' },
  }),

  tpl('red-block', 'كتلة حمراء', 'Red Block', ['أحمر', 'جريء'], {
    theme: 'dark',
    backdrop: { kind: 'red-sweep', color: RED, color2: '#7E0B13' },
    fade: { top: 0, from: 0.36, to: 0.62 },
    productFx: { shadow: 'soft', shadowOpacity: 0.4 },
    decor: [
      decor({ kind: 'rings', x: 560, y: -260, w: 820, h: 820, color: WHITE, opacity: 0.12, size: 5 }),
      decor({ kind: 'rings', x: -380, y: 180, w: 620, h: 620, color: WHITE, opacity: 0.08, size: 4 }),
    ],
    text: {
      items: {
        title: txt({ fit: 'block', maxSize: 130, color: WHITE, uppercase: true, lineHeight: 1 }),
        subtitle: txt({ fit: 'block', maxSize: 42, color: 'rgba(255,255,255,0.82)', uppercase: true, weightLat: 400, tracking: 0.06 }),
        tagline: txt(pillRed({ fill: WHITE }, RED)),
      },
    },
    contact: { theme: 'white' },
    logos: { partner: 'white' },
  }),

  tpl('premium', 'فخامة', 'Premium', ['داكن', 'أحادي'], {
    theme: 'dark',
    backdrop: { kind: 'solid', color: '#08080A', color2: '#141417' },
    fade: { top: 0, from: 0.26, to: 0.56 },
    sceneFx: { brightness: 0.5, grayscale: 0.85, contrast: 1.1 },
    shape: { kind: 'floor', color: RED, opacity: 0.55, spread: 0.55 },
    productFx: { shadow: 'contact', shadowOpacity: 0.7 },
    decor: [
      decor({ kind: 'frame', x: 36, y: 36, w: 1008, h: 1368, color: WHITE, opacity: 0.14, size: 2, layer: 'front' }),
      decor({ kind: 'line', x: 505, y: 236, w: 70, h: 4, color: RED, opacity: 1 }),
    ],
    text: {
      y: 268,
      gap: 18,
      items: {
        title: txt({ fit: 'block', maxSize: 110, color: WHITE, uppercase: true, weightLat: 300, tracking: 0.05, lineHeight: 1 }),
        subtitle: txt({ size: 26, color: RED, uppercase: true, weightLat: 700, tracking: 0.32 }),
        tagline: txt({ size: 42, color: WHITE, weightAr: 300, marginTop: 6 }),
        note: txt({ visible: true, size: 26, color: '#8C8C93', weightAr: 400 }),
      },
    },
    contact: { theme: 'chips' },
    logos: { partner: 'white' },
  }),
]

/** قالب فارغ لبدء قالب جديد من الصفر */
export function blankTemplateStyle(): TemplateStyle {
  return style({
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E9E9EC' },
    contact: { theme: 'outline' },
  })
}

export const CATEGORIES: { id: Template['category']; name: string; ready: boolean }[] = [
  { id: 'ads', name: 'إعلانات المنتجات', ready: true },
  { id: 'truefalse', name: 'صح أم خطأ', ready: false },
  { id: 'factmyth', name: 'حقيقة أم خرافة', ready: false },
  { id: 'offers', name: 'عروض الأسعار', ready: false },
  { id: 'didyouknow', name: 'هل تعلم', ready: false },
]

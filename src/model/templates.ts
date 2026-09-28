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
}

type TextPatch = Partial<Omit<TextStyle, 'decoStyle'>> & { decoStyle?: Partial<DecoStyle> }

export function txt(p: TextPatch = {}, base: TextStyle = DEFAULT_TEXT): TextStyle {
  return { ...base, ...p, decoStyle: { ...base.decoStyle, ...(p.decoStyle ?? {}) } }
}

const hidden = (p: TextPatch = {}) => txt({ visible: false, ...p })

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
    backdrop: { kind: 'solid', color: '#F2F2F2', color2: '#E4E4E4' },
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

/* ================================================================== */

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'classic-red',
    name: 'كلاسيك أحمر',
    nameEn: 'Classic Red',
    category: 'ads',
    builtIn: true,
    demoId: 'am-c4000',
    tags: ['فاتح', 'كلاسيك'],
    style: style({ contact: { theme: 'red-ring' } }),
  },
  {
    id: 'soft-studio',
    name: 'استوديو ناعم',
    nameEn: 'Soft Studio',
    category: 'ads',
    builtIn: true,
    demoId: 'sc-f100',
    tags: ['فاتح', 'كشيدة'],
    style: style({
      fade: { top: 0.12, from: 0.45, to: 0.78 },
      text: {
        y: 285,
        w: 650,
        x: 215,
        items: {
          title: txt({ fit: 'block', maxSize: 120, color: '#CB0E22', uppercase: false, lineHeight: 1 }),
          subtitle: txt({ fit: 'block', maxSize: 44, color: '#3A3A3C', weightLat: 400, lineHeight: 1.1 }),
          tagline: txt({
            size: 42,
            fit: 'kashida',
            color: WHITE,
            weightAr: 700,
            deco: 'pill',
            marginTop: 8,
            decoStyle: { fill: '#B8141C', radius: 18, padY: 10, padX: 34, full: true, shadow: true },
          }),
        },
      },
      contact: { theme: 'half-fade' },
    }),
  },
  {
    id: 'crystal',
    name: 'بلّوري',
    nameEn: 'Crystal',
    category: 'ads',
    builtIn: true,
    demoId: 'sigma-dse',
    tags: ['فاتح', 'زجاجي'],
    style: style({
      fade: { top: 0.18, from: 0.5, to: 0.86 },
      productFx: { shadow: 'float', shadowOpacity: 0.3 },
      text: {
        y: 280,
        w: 680,
        x: 200,
        gap: 12,
        items: {
          title: txt({ fit: 'block', maxSize: 120, color: RED, uppercase: true, lineHeight: 1 }),
          subtitle: txt({
            size: 34,
            color: '#3F3F42',
            weightLat: 400,
            deco: 'rules',
            decoStyle: { accent: '#6B6B70', strokeWidth: 2, padX: 22 },
          }),
          tagline: txt({
            size: 38,
            color: WHITE,
            deco: 'pill',
            decoStyle: { fill: RED, radius: 14, padY: 10, full: true, shadow: true },
          }),
        },
      },
      contact: { theme: 'glass' },
    }),
  },
  {
    id: 'headline-frame',
    name: 'إطار العنوان',
    nameEn: 'Headline Frame',
    category: 'ads',
    builtIn: true,
    demoId: 'co-w01',
    tags: ['فاتح', 'إطارات'],
    style: style({
      backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E6E6E8' },
      fade: { top: 0.2, from: 0.35, to: 0.72 },
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
            decoStyle: { fill: 'rgba(255,255,255,0.92)', stroke: '#7E1016', strokeWidth: 3, radius: 18, padX: 36, padY: 16, shadow: true, full: true },
          }),
          subtitle: hidden({ size: 30, color: GRAY }),
          tagline: txt({
            size: 42,
            color: '#1B1B1D',
            accent: RED,
            weightAr: 700,
            lineHeight: 1.35,
            deco: 'outlineBox',
            decoStyle: { fill: 'rgba(255,255,255,0.94)', stroke: '#7E1016', strokeWidth: 3, radius: 18, padX: 34, padY: 14, full: false, shadow: true },
          }),
        },
      },
      contact: { theme: 'red' },
    }),
  },
  {
    id: 'red-stage',
    name: 'منصّة حمراء',
    nameEn: 'Red Stage',
    category: 'ads',
    builtIn: true,
    demoId: 'co-w01',
    tags: ['فاتح', 'شكل تحت المنتج'],
    style: style({
      backdrop: { kind: 'paper', color: '#F4F4F4', color2: '#E9E9E9' },
      fade: { top: 0.06, from: 0.25, to: 0.6 },
      shape: { kind: 'slab', color: RED, color2: '#A50F18', top: 0.58, bottom: 62, spread: 0.12, radius: 28, skew: -8 },
      productFx: { shadow: 'contact', shadowOpacity: 0.35 },
      text: {
        x: 230,
        y: 290,
        w: 620,
        gap: 18,
        items: {
          kicker: txt({
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
          subtitle: hidden({ size: 30 }),
          tagline: txt({ size: 36, color: '#2A2A2C', weightAr: 500, deco: 'none', marginTop: 4 }),
          price: txt({ visible: false, size: 170, color: RED, weightLat: 700 }),
        },
      },
      contact: { theme: 'outline' },
    }),
  },
  {
    id: 'crimson-night',
    name: 'ليل قرمزي',
    nameEn: 'Crimson Night',
    category: 'ads',
    builtIn: true,
    demoId: 'am-c4000',
    tags: ['داكن', 'هالة'],
    style: style({
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
          tagline: txt({
            size: 40,
            color: WHITE,
            deco: 'pill',
            decoStyle: { fill: RED, radius: 999, padY: 12, full: true, shadow: true },
          }),
        },
      },
      contact: { theme: 'dark-glass' },
      logos: { lkgt: 'color', partner: 'white' },
    }),
  },
  {
    id: 'brand-rings',
    name: 'حلقات العلامة',
    nameEn: 'Brand Rings',
    category: 'ads',
    builtIn: true,
    demoId: 'co-w01',
    tags: ['فاتح', 'حلقات'],
    style: style({
      backdrop: { kind: 'studio', color: '#FBFBFB', color2: '#E9E9EB' },
      fade: { top: 0.05, from: 0.3, to: 0.66 },
      shape: { kind: 'rings', color: RED, opacity: 0.95, stroke: 7, scale: 1.05 },
      productFx: { shadow: 'float', shadowOpacity: 0.3 },
      text: {
        items: {
          title: txt({ fit: 'block', maxSize: 120, color: INK, uppercase: true, lineHeight: 1 }),
          subtitle: txt({ fit: 'block', maxSize: 40, color: RED, uppercase: true, weightLat: 400, tracking: 0.08 }),
          tagline: txt({
            size: 38,
            color: WHITE,
            deco: 'pill',
            decoStyle: { fill: INK, radius: 999, padY: 12, full: true },
          }),
        },
      },
      contact: { theme: 'ink' },
    }),
  },
  {
    id: 'spotlight',
    name: 'بقعة ضوء',
    nameEn: 'Spotlight',
    category: 'ads',
    builtIn: true,
    demoId: 'sigma-dse',
    tags: ['داكن', 'إضاءة'],
    style: style({
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
          tagline: txt({
            size: 40,
            color: WHITE,
            weightAr: 500,
            deco: 'underline',
            decoStyle: { accent: RED, strokeWidth: 4, padY: 10 },
          }),
        },
      },
      contact: { theme: 'outline-light' },
      logos: { lkgt: 'color', partner: 'white' },
    }),
  },
  {
    id: 'diagonal-band',
    name: 'شريط مائل',
    nameEn: 'Diagonal Band',
    category: 'ads',
    builtIn: true,
    demoId: 'sc-f100',
    tags: ['فاتح', 'حيوي'],
    style: style({
      fade: { top: 0.08, from: 0.4, to: 0.76 },
      shape: { kind: 'band', color: RED, color2: '#B0121B', opacity: 0.96, skew: -11, top: 0.62, scale: 1 },
      productFx: { shadow: 'soft', shadowOpacity: 0.35 },
      text: {
        items: {
          title: txt({ fit: 'block', maxSize: 120, color: INK, uppercase: true, lineHeight: 1 }),
          subtitle: txt({ fit: 'block', maxSize: 42, color: RED, uppercase: true, weightLat: 700 }),
          tagline: txt({ size: 40, color: WHITE, deco: 'pill', decoStyle: { fill: INK, radius: 14, full: true, shadow: true } }),
        },
      },
      contact: { theme: 'red' },
    }),
  },
  {
    id: 'tech-grid',
    name: 'تقني',
    nameEn: 'Tech Grid',
    category: 'ads',
    builtIn: true,
    demoId: 'sigma-dse',
    tags: ['داكن', 'مواصفات'],
    style: style({
      theme: 'dark',
      backdrop: { kind: 'solid', color: '#0B0D12', color2: '#151A25' },
      fade: { top: 0.04, from: 0.3, to: 0.62 },
      sceneFx: { brightness: 0.62, saturate: 0.8 },
      shape: { kind: 'frame', color: RED, opacity: 0.9, stroke: 3, spread: 0.1, offsetX: 20, offsetY: 20, top: -0.08, bottom: 30, radius: 6 },
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
          kicker: txt({
            size: 26,
            color: WHITE,
            weightAr: 700,
            deco: 'tab',
            decoStyle: { fill: RED, padX: 22, padY: 6, full: false },
          }),
          title: txt({ fit: 'block', maxSize: 120, color: WHITE, uppercase: true, lineHeight: 1 }),
          subtitle: txt({ fit: 'block', maxSize: 36, color: '#9AA3B2', uppercase: true, weightLat: 400, tracking: 0.14 }),
          tagline: txt({
            size: 36,
            color: WHITE,
            deco: 'outlineBox',
            decoStyle: { fill: 'rgba(209,26,36,0.12)', stroke: RED, strokeWidth: 2, radius: 10, full: true },
          }),
          features: txt({
            size: 26,
            color: WHITE,
            weightAr: 500,
            deco: 'outlineBox',
            decoStyle: { fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(255,255,255,0.22)', strokeWidth: 2, radius: 999, padX: 22, padY: 8, full: false },
          }),
        },
      },
      contact: { theme: 'dark-glass' },
      logos: { lkgt: 'color', partner: 'white' },
    }),
  },
  {
    id: 'editorial',
    name: 'تحريري',
    nameEn: 'Editorial',
    category: 'ads',
    builtIn: true,
    demoId: 'am-c4000',
    tags: ['فاتح', 'مجلة'],
    style: style({
      backdrop: { kind: 'paper', color: '#F3F1EE', color2: '#E7E3DE' },
      fade: { top: 0, from: 0.34, to: 0.6 },
      productFx: { shadow: 'soft', shadowOpacity: 0.25 },
      decor: [
        decor({ kind: 'watermark', x: 40, y: 470, w: 1000, h: 300, color: RED, opacity: 0.16, size: 3, text: '{title}' }),
      ],
      text: {
        x: 330,
        y: 250,
        w: 670,
        align: 'right',
        gap: 12,
        items: {
          kicker: txt({ size: 30, color: RED, weightAr: 700, deco: 'bar', decoStyle: { accent: RED, strokeWidth: 6, padX: 16 } }),
          title: txt({ fit: 'block', maxSize: 104, color: INK, lineHeight: 1 }),
          subtitle: txt({ size: 28, color: '#6A6A6E', uppercase: true, weightLat: 400, tracking: 0.12 }),
          tagline: txt({ size: 46, color: INK, accent: RED, weightAr: 900, marginTop: 10, lineHeight: 1.3 }),
          note: txt({ size: 28, color: '#57575B', weightAr: 400 }),
        },
      },
      contact: { theme: 'minimal' },
    }),
  },
  {
    id: 'red-block',
    name: 'كتلة حمراء',
    nameEn: 'Red Block',
    category: 'ads',
    builtIn: true,
    demoId: 'sc-f100',
    tags: ['أحمر', 'جريء'],
    style: style({
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
          tagline: txt({
            size: 40,
            color: RED,
            deco: 'pill',
            decoStyle: { fill: WHITE, radius: 999, padY: 12, full: true, shadow: true },
          }),
        },
      },
      contact: { theme: 'white' },
      logos: { lkgt: 'color', partner: 'white' },
    }),
  },
  {
    id: 'glass-card',
    name: 'بطاقة زجاجية',
    nameEn: 'Glass Card',
    category: 'ads',
    builtIn: true,
    demoId: 'sc-f100',
    tags: ['داكن', 'عمق'],
    style: style({
      theme: 'dark',
      backdrop: { kind: 'studio-dark', color: '#1A1A1F', color2: '#070708' },
      fade: { top: 0.3, from: 0.5, to: 0.95 },
      sceneFx: { blur: 7, brightness: 0.62, saturate: 0.9 },
      productFx: { shadow: 'contact', shadowOpacity: 0.55, reflection: true },
      decor: [decor({ kind: 'glow', x: 140, y: 150, w: 800, h: 520, color: RED, opacity: 0.25 })],
      text: {
        x: 170,
        y: 250,
        w: 740,
        gap: 14,
        panel: { kind: 'glass', fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.22)', radius: 34, pad: 38 },
        items: {
          title: txt({ fit: 'block', maxSize: 110, color: WHITE, lineHeight: 1 }),
          subtitle: txt({ fit: 'block', maxSize: 38, color: 'rgba(255,255,255,0.72)', weightLat: 400 }),
          tagline: txt({ size: 38, color: WHITE, deco: 'pill', decoStyle: { fill: RED, radius: 999, padY: 10, full: true } }),
        },
      },
      contact: { theme: 'dark-glass' },
      logos: { lkgt: 'color', partner: 'white' },
    }),
  },
  {
    id: 'arch',
    name: 'القوس',
    nameEn: 'Arch',
    category: 'ads',
    builtIn: true,
    demoId: 'co-w01',
    tags: ['فاتح', 'شكل تحت المنتج'],
    style: style({
      backdrop: { kind: 'solid', color: '#F6F3F1', color2: '#EAE5E1' },
      fade: { top: 0, from: 0.3, to: 0.6 },
      shape: { kind: 'arch', color: '#E3262F', color2: '#98101A', top: -0.35, spread: 0.16, bottom: 90, radius: 30 },
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
  },
  {
    id: 'new-arrival',
    name: 'وصل حديثاً',
    nameEn: 'New Arrival',
    category: 'ads',
    builtIn: true,
    demoId: 'am-c4000',
    tags: ['فاتح', 'شارة'],
    style: style({
      fade: { top: 0.1, from: 0.4, to: 0.8 },
      decor: [
        decor({ kind: 'badge', x: 770, y: 540, w: 190, h: 190, rotate: -12, color: RED, color2: WHITE, layer: 'front', text: '{badge}' }),
        decor({ kind: 'stripes', x: 0, y: 1230, w: 1080, h: 210, color: RED, opacity: 0.9, size: 26, rotate: 0 }),
      ],
      text: {
        items: {
          title: txt({ fit: 'block', maxSize: 130, color: RED, uppercase: true, lineHeight: 1 }),
          subtitle: txt({ fit: 'block', maxSize: 44, color: '#333336', uppercase: true }),
          tagline: txt({ size: 40, color: WHITE, deco: 'pill', decoStyle: { fill: RED, radius: 20, full: true, shadow: true } }),
        },
      },
      contact: { theme: 'red-ring' },
    }),
  },
  {
    id: 'premium',
    name: 'فخامة',
    nameEn: 'Premium',
    category: 'ads',
    builtIn: true,
    demoId: 'sigma-dse',
    tags: ['داكن', 'أحادي'],
    style: style({
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
          note: txt({ size: 26, color: '#8C8C93', weightAr: 400 }),
        },
      },
      contact: { theme: 'chips' },
      logos: { lkgt: 'color', partner: 'white' },
    }),
  },
]

/** قالب فارغ لبدء قالب جديد من الصفر */
export function blankTemplateStyle(): TemplateStyle {
  return style({ contact: { theme: 'outline' } })
}

export const CATEGORIES: { id: Template['category']; name: string; ready: boolean }[] = [
  { id: 'ads', name: 'إعلانات المنتجات', ready: true },
  { id: 'truefalse', name: 'صح أم خطأ', ready: false },
  { id: 'factmyth', name: 'حقيقة أم خرافة', ready: false },
  { id: 'offers', name: 'عروض الأسعار', ready: false },
  { id: 'didyouknow', name: 'هل تعلم', ready: false },
]

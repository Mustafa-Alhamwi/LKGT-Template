import { GRAY, INK, RED, RED_DEEP } from './brand'
import { decor, hidden, style, txt, WHITE, type DeepPartial, type TextPatch } from './templates'
import type { CategoryId, DecorItem, Template, TemplateStyle } from './types'

/* ------------------------------------------------------------------
 * قوالب الفئات: صح أم خطأ · حقيقة أم خرافة · عروض الأسعار · هل تعلم
 * كل قالب يدعم وضعين: «سؤال» و«كشف الإجابة» (من تبويب العناصر)
 * ------------------------------------------------------------------ */

const GREEN = '#1FBF8F'
const CRIMSON = '#E4343E'
const GOLD = '#F5C542'
const YELLOW = '#FFD23F'
const NAVY = '#1B2A4A'
const SOFT = '#5C5C68'

function tplc(category: CategoryId, id: string, name: string, nameEn: string, tags: string[], st: DeepPartial<TemplateStyle>): Template {
  return { id, name, nameEn, category, builtIn: true, tags, style: style(st) }
}

/** ملصق جاهز داخل قالب */
function stk(id: string, x: number, y: number, w: number, h: number, color: string, color2: string, text = '', extra: Partial<DecorItem> = {}, text2?: string): DecorItem {
  const { sticker, ...rest } = extra
  return decor({ kind: 'sticker', layer: 'front', x, y, w, h, color, color2, sticker: { id, text, text2, ...(sticker ?? {}) }, ...rest })
}

/** خياران للإجابة: a (يمين) و b (يسار) */
function chips(o: { y?: number; w?: number; labels: [string, string]; fill?: string; ca?: string; cb?: string; layer?: DecorItem['layer'] }): DecorItem[] {
  const w = o.w ?? 420
  const h = Math.round((w * 110) / 300)
  const y = o.y ?? 1070
  const x0 = Math.round((1080 - 2 * w - 40) / 2)
  const fill = o.fill ?? WHITE
  return [
    stk('b:chip-a', x0 + w + 40, y, w, h, o.ca ?? GREEN, fill, o.labels[0], { sticker: { id: 'b:chip-a', text: o.labels[0], answerRole: 'a' }, shadow: 'soft', layer: o.layer ?? 'front' }),
    stk('b:chip-b', x0, y, w, h, o.cb ?? CRIMSON, fill, o.labels[1], { sticker: { id: 'b:chip-b', text: o.labels[1], answerRole: 'b' }, shadow: 'soft', layer: o.layer ?? 'front' }),
  ]
}

interface QA {
  y?: number
  kicker?: TextPatch
  title?: TextPatch
  tagline?: TextPatch
  note?: TextPatch
  cta?: TextPatch
  panel?: TemplateStyle['text']['panel']
}

/** كتلة نصوص الأسئلة: تمهيد + عبارة + شرح (يظهر عند الكشف) + مصدر + دعوة للتفاعل (في السؤال) */
function qaText(p: QA = {}) {
  return {
    x: 110,
    y: p.y ?? 320,
    w: 860,
    gap: 26,
    align: 'center' as const,
    panel: p.panel ?? { kind: 'none' as const, fill: 'rgba(255,255,255,0.1)', stroke: 'rgba(255,255,255,0.25)', radius: 32, pad: 40 },
    items: {
      kicker: txt({
        visible: true,
        size: 34,
        color: WHITE,
        weightAr: 900,
        deco: 'pill',
        decoStyle: { fill: RED, radius: 999, padX: 36, padY: 10, full: false, shadow: true },
        ...p.kicker,
      }),
      title: txt({ visible: true, fit: 'none', wrap: true, balance: true, size: 92, weightAr: 900, weightLat: 700, color: INK, lineHeight: 1.3, ...p.title }),
      subtitle: hidden(),
      tagline: txt({ visible: true, showWhen: 'reveal', fit: 'none', wrap: true, balance: true, size: 44, weightAr: 700, color: GRAY, lineHeight: 1.5, marginTop: 8, ...p.tagline }),
      features: hidden(),
      note: txt({ visible: true, showWhen: 'reveal', size: 28, weightAr: 500, color: SOFT, ...p.note }),
      price: hidden(),
      oldPrice: hidden(),
      discount: hidden(),
      cta: txt({ visible: true, showWhen: 'question', free: true, fx: 110, fy: 1250, fw: 860, align: 'center', size: 32, weightAr: 700, color: GRAY, ...p.cta }),
    },
  }
}

const TF: [string, string] = ['صح', 'خطأ']
const FM: [string, string] = ['حقيقة', 'خرافة']

/* ============================== صح أم خطأ ============================== */

const truefalse: Template[] = [
  tplc('truefalse', 'tf-clean', 'نظيف', 'Clean', ['فاتح', 'بسيط', 'سؤال'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E9E9EE' },
    decor: [decor({ kind: 'watermark', text: '؟', x: 150, y: 330, w: 780, h: 900, color: RED, opacity: 0.07, size: 3, layer: 'back' }), ...chips({ labels: TF })],
    text: qaText(),
    contact: { theme: 'red-ring' },
  }),
  tplc('truefalse', 'tf-red', 'أحمر جريء', 'Bold Red', ['داكن', 'أحمر', 'جريء'], {
    theme: 'dark',
    backdrop: { kind: 'red-sweep', color: '#D11A24', color2: '#7A0A12' },
    decor: [
      decor({ kind: 'rings', x: 520, y: -260, w: 900, h: 900, color: WHITE, opacity: 0.1, size: 5, layer: 'back' }),
      decor({ kind: 'watermark', text: '؟', x: 150, y: 330, w: 780, h: 900, color: WHITE, opacity: 0.1, size: 3, layer: 'back' }),
      ...chips({ labels: TF, fill: WHITE }),
    ],
    text: qaText({
      kicker: { color: RED, decoStyle: { fill: WHITE, radius: 999, padX: 36, padY: 10, full: false, shadow: true } },
      title: { color: WHITE },
      tagline: { color: '#FFE3E1' },
      note: { color: '#FFD9DC' },
      cta: { color: '#FFE3E1' },
    }),
    contact: { theme: 'white' },
    logos: { lkgt: 'white', partner: 'white' },
  }),
  tplc('truefalse', 'tf-card', 'بطاقة', 'Card', ['فاتح', 'بطاقة', 'هادئ'], {
    backdrop: { kind: 'solid', color: '#ECECEF', color2: '#E0E0E5' },
    decor: [...chips({ labels: TF, y: 1090 })],
    text: qaText({
      y: 270,
      panel: { kind: 'solid', fill: '#FFFFFF', stroke: 'transparent', radius: 54, pad: 52 },
      kicker: { deco: 'tab', decoStyle: { fill: RED, radius: 0, padX: 30, padY: 8, full: false, shadow: false } },
      title: { size: 78 },
    }),
    contact: { theme: 'white' },
  }),
  tplc('truefalse', 'tf-night', 'ليلي', 'Night', ['داكن', 'أنيق', 'توهج'], {
    theme: 'dark',
    backdrop: { kind: 'studio-dark', color: '#24242D', color2: '#050507' },
    decor: [decor({ kind: 'glow', x: 190, y: -260, w: 700, h: 700, color: RED, opacity: 0.5, layer: 'back' }), ...chips({ labels: TF, fill: '#20202A' })],
    text: qaText({ title: { color: WHITE }, tagline: { color: '#D5D5DE' }, note: { color: '#8B8B98' }, cta: { color: '#B5B5C0' } }),
    contact: { theme: 'dark-glass' },
    logos: { lkgt: 'white', partner: 'white' },
  }),
  tplc('truefalse', 'tf-neon', 'نيون', 'Neon', ['داكن', 'نيون', 'مستقبلي'], {
    theme: 'dark',
    backdrop: { kind: 'mesh', color: '#0A0A11', color2: '#5A0F26' },
    decor: [decor({ kind: 'grid', color: WHITE, opacity: 0.06, size: 70, layer: 'back' }), ...chips({ labels: TF, fill: '#14141C' })],
    text: qaText({
      kicker: { deco: 'outlineBox', decoStyle: { fill: 'rgba(0,0,0,0)', stroke: RED, strokeWidth: 3, radius: 999, padX: 36, padY: 10, full: false, shadow: false }, color: '#FF6B75', textShadow: 'glow', shadowColor: RED },
      title: { color: WHITE, textShadow: 'glow', shadowColor: RED },
      tagline: { color: '#E1E1EA' },
      note: { color: '#8B8B98' },
      cta: { color: '#C9C9D4' },
    }),
    contact: { theme: 'outline-light' },
    logos: { lkgt: 'white', partner: 'white' },
  }),
  tplc('truefalse', 'tf-vs', 'مواجهة', 'Versus', ['فاتح', 'ملوّن', 'اختيار'], {
    backdrop: { kind: 'aurora', color: '#FFF7F5', color2: '#FF8F96' },
    decor: [
      ...chips({ labels: TF, w: 440, y: 1000 }),
      stk('b:ring', 480, 1012, 120, 120, INK, WHITE, 'VS', { shadow: 'soft' }),
    ],
    text: qaText({ y: 330, title: { size: 80 } }),
    contact: { theme: 'glass' },
  }),
]

/* ============================== حقيقة أم خرافة ============================== */

const stampA = () => stk('b:stamp-r', 350, 850, 380, 154, GREEN, GREEN, 'حقيقة', { showWhen: 'a', rotate: -8, layer: 'top' })
const stampB = () => stk('b:stamp', 415, 805, 250, 250, CRIMSON, CRIMSON, 'خرافة', { showWhen: 'b', rotate: 8, layer: 'top' })

const factmyth: Template[] = [
  tplc('factmyth', 'fm-clean', 'نظيف', 'Clean', ['فاتح', 'ختم', 'بسيط'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E8ECEF' },
    decor: [decor({ kind: 'watermark', text: '؟', x: 150, y: 330, w: 780, h: 900, color: NAVY, opacity: 0.06, size: 3, layer: 'back' }), ...chips({ labels: FM }), stampA(), stampB()],
    text: qaText({ kicker: { decoStyle: { fill: NAVY, radius: 999, padX: 36, padY: 10, full: false, shadow: true } } }),
    contact: { theme: 'white' },
  }),
  tplc('factmyth', 'fm-duel', 'مواجهة', 'Duel', ['فاتح', 'ملوّن', 'نصفين'], {
    backdrop: { kind: 'vsplit', color: '#DDF7EE', color2: '#FFE3E1' },
    decor: [
      decor({ kind: 'line', x: 534, y: 0, w: 12, h: 1440, color: WHITE, opacity: 0.9, layer: 'back' }),
      ...chips({ labels: FM, w: 400, y: 1050, fill: WHITE }),
      stampA(),
      stampB(),
    ],
    text: qaText({ kicker: { decoStyle: { fill: INK, radius: 999, padX: 36, padY: 10, full: false, shadow: true } }, title: { size: 80 } }),
    contact: { theme: 'white' },
  }),
  tplc('factmyth', 'fm-lab', 'مختبر', 'Lab', ['فاتح', 'علمي', 'شبكة'], {
    backdrop: { kind: 'grid', color: '#F3F6FB', color2: '#C7D3E6' },
    decor: [
      decor({ kind: 'corners', x: 60, y: 230, w: 960, h: 1000, color: '#2A6BFF', size: 5, layer: 'front' }),
      stk('i:FlaskConical', 470, 220, 140, 140, WHITE, '#2A6BFF', '', { sticker: { id: 'i:FlaskConical', text: '', strokeW: 2, bg: 'circle' }, shadow: 'soft', layer: 'top' }),
      ...chips({ labels: FM }),
      stampA(),
      stampB(),
    ],
    text: qaText({ y: 400, kicker: { decoStyle: { fill: '#2A6BFF', radius: 999, padX: 36, padY: 10, full: false, shadow: true } }, title: { size: 76 } }),
    contact: { theme: 'ink' },
  }),
  tplc('factmyth', 'fm-dark', 'داكن', 'Dark', ['داكن', 'ختم', 'أنيق'], {
    theme: 'dark',
    backdrop: { kind: 'spot', color: '#0A0A0D', color2: '#3A3A46' },
    decor: [...chips({ labels: FM, fill: '#1E1E26' }), stampA(), stampB()],
    text: qaText({ title: { color: WHITE }, tagline: { color: '#D5D5DE' }, note: { color: '#8B8B98' }, cta: { color: '#B5B5C0' } }),
    contact: { theme: 'dark-glass' },
    logos: { lkgt: 'white', partner: 'white' },
  }),
  tplc('factmyth', 'fm-yellow', 'أصفر جريء', 'Bold Yellow', ['جريء', 'أصفر', 'أسود'], {
    backdrop: { kind: 'solid', color: YELLOW, color2: '#F2C500' },
    decor: [decor({ kind: 'frame', x: 34, y: 34, w: 1012, h: 1372, color: INK, opacity: 1, size: 10, layer: 'front' }), ...chips({ labels: FM, fill: WHITE }), stampA(), stampB()],
    text: qaText({
      kicker: { color: YELLOW, decoStyle: { fill: INK, radius: 999, padX: 36, padY: 10, full: false, shadow: false } },
      title: { color: INK, size: 88 },
      tagline: { color: '#2A2A2E' },
      note: { color: '#4A4A4E' },
      cta: { color: '#2A2A2E' },
    }),
    contact: { theme: 'ink' },
  }),
  tplc('factmyth', 'fm-paper', 'ورقة', 'Paper', ['فاتح', 'ورق', 'شريط لاصق'], {
    backdrop: { kind: 'paper', color: '#F5F0E6', color2: '#DCD1BE' },
    decor: [stk('b:tape', 250, 214, 580, 170, YELLOW, INK, 'حقيقة أم خرافة؟', { layer: 'top', rotate: -2 }), ...chips({ labels: FM }), stampA(), stampB()],
    text: qaText({ y: 400, kicker: { visible: false }, title: { color: '#2A2118', size: 80 }, tagline: { color: '#5A4C3A' } }),
    contact: { theme: 'minimal' },
  }),
]

/* ============================== هل تعلم ============================== */

interface DYK {
  y?: number
  kicker?: TextPatch
  title?: TextPatch
  tagline?: TextPatch
  note?: TextPatch
  price?: TextPatch
  panel?: TemplateStyle['text']['panel']
  gap?: number
}

function dykText(p: DYK = {}) {
  return {
    x: 110,
    y: p.y ?? 330,
    w: 860,
    gap: p.gap ?? 26,
    align: 'center' as const,
    panel: p.panel ?? { kind: 'none' as const, fill: 'rgba(255,255,255,0.1)', stroke: 'rgba(255,255,255,0.25)', radius: 32, pad: 40 },
    items: {
      kicker: txt({ visible: true, size: 70, color: RED, weightAr: 900, lineHeight: 1.1, ...p.kicker }),
      title: txt({ visible: true, fit: 'none', wrap: true, balance: true, size: 76, weightAr: 900, weightLat: 700, color: INK, lineHeight: 1.36, ...p.title }),
      subtitle: hidden(),
      tagline: txt({ visible: true, fit: 'none', wrap: true, balance: true, size: 42, weightAr: 500, color: GRAY, lineHeight: 1.55, ...p.tagline }),
      features: hidden(),
      note: txt({ visible: true, size: 27, weightAr: 500, color: SOFT, marginTop: 6, ...p.note }),
      price: hidden({ size: 260, weightAr: 900, weightLat: 700, color: RED, lineHeight: 1, ...p.price }),
      oldPrice: hidden(),
      discount: hidden(),
      cta: hidden({ size: 32, color: GRAY }),
    },
  }
}

const didyouknow: Template[] = [
  tplc('didyouknow', 'dyk-bulb', 'فكرة', 'Bulb', ['فاتح', 'أيقونة', 'بسيط'], {
    backdrop: { kind: 'mist', color: '#FFFFFF', color2: '#E9EDF3' },
    decor: [
      decor({ kind: 'glow', x: 290, y: 90, w: 500, h: 500, color: YELLOW, opacity: 0.5, layer: 'back' }),
      stk('i:Lightbulb', 425, 210, 230, 230, WHITE, RED, '', { sticker: { id: 'i:Lightbulb', text: '', strokeW: 1.8, bg: 'circle' }, shadow: 'float', layer: 'top' }),
    ],
    text: dykText({ y: 500, kicker: { size: 64 }, title: { size: 72 } }),
    contact: { theme: 'red-ring' },
  }),
  tplc('didyouknow', 'dyk-number', 'رقم كبير', 'Big Number', ['فاتح', 'أرقام', 'جريء'], {
    backdrop: { kind: 'peach', color: '#FFF6F2', color2: '#FFD9D2', angle: 175 },
    decor: [decor({ kind: 'blobs', color: '#FF9A9F', color2: '#FFC9B8', opacity: 0.5, layer: 'back' })],
    text: dykText({
      y: 250,
      kicker: { size: 46, color: WHITE, deco: 'pill', decoStyle: { fill: RED, radius: 999, padX: 36, padY: 10, full: false, shadow: true } },
      price: { visible: true, gradient: true, color: RED, color2: RED_DEEP, gradAngle: 100, size: 300 },
      title: { size: 66 },
      tagline: { size: 40 },
    }),
    contact: { theme: 'white' },
  }),
  tplc('didyouknow', 'dyk-dark', 'ليلي', 'Night', ['داكن', 'أنيق', 'حلقات'], {
    theme: 'dark',
    backdrop: { kind: 'studio-dark', color: '#23232C', color2: '#060608' },
    decor: [
      decor({ kind: 'rings', x: 180, y: 100, w: 720, h: 720, color: RED, opacity: 0.22, size: 4, layer: 'back' }),
      stk('i:Sparkles', 462, 225, 156, 156, WHITE, RED, '', { sticker: { id: 'i:Sparkles', text: '', strokeW: 2, bg: 'circle' }, shadow: 'glow', layer: 'top' }),
    ],
    text: dykText({ y: 470, kicker: { color: '#FF6B75', size: 60 }, title: { color: WHITE, size: 72 }, tagline: { color: '#C9C9D4' }, note: { color: '#8B8B98' } }),
    contact: { theme: 'dark-glass' },
    logos: { lkgt: 'white', partner: 'white' },
  }),
  tplc('didyouknow', 'dyk-note', 'ملاحظة', 'Note', ['فاتح', 'ورق', 'ودّي'], {
    backdrop: { kind: 'paper', color: '#F5F0E6', color2: '#DCD1BE' },
    decor: [stk('b:tape', 330, 250, 420, 130, YELLOW, INK, 'هل تعلم؟', { layer: 'top', rotate: -3 })],
    text: dykText({
      y: 330,
      kicker: { visible: false },
      panel: { kind: 'solid', fill: '#FFFFFF', stroke: 'transparent', radius: 14, pad: 64 },
      title: { size: 68, color: '#2A2118' },
      tagline: { color: '#5A4C3A' },
    }),
    contact: { theme: 'ink' },
  }),
  tplc('didyouknow', 'dyk-split', 'نصفين', 'Split', ['جريء', 'أحمر', 'عنوان كبير'], {
    backdrop: { kind: 'split', color: '#D11A24', color2: '#FFFFFF' },
    text: {
      ...dykText({ y: 850, kicker: { size: 34 }, title: { size: 68 }, tagline: { size: 38 } }),
      items: {
        ...dykText({ y: 850, title: { size: 68 }, tagline: { size: 38 } }).items,
        kicker: txt({ visible: true, free: true, fx: 90, fy: 300, fw: 900, align: 'center', size: 150, weightAr: 900, color: WHITE, lineHeight: 1 }),
      },
    },
    contact: { theme: 'white' },
    logos: { lkgt: 'white', partner: 'white' },
  }),
  tplc('didyouknow', 'dyk-photo', 'مع صورة', 'With Photo', ['فاتح', 'صورة', 'تدرج'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E6E9EE' },
    fade: { enabled: true, top: 0.06, from: 0.35, to: 0.75 },
    text: dykText({ y: 270, kicker: { size: 54 }, title: { size: 70 }, tagline: { size: 40 } }),
    productArea: { x: 140, y: 760, w: 800, h: 520 },
    contact: { theme: 'red-ring' },
  }),
]

/* ============================== عروض الأسعار ============================== */

interface OF {
  y?: number
  kicker?: TextPatch
  title?: TextPatch
  subtitle?: TextPatch
  tagline?: TextPatch
  price?: TextPatch
  oldPrice?: TextPatch
  discount?: TextPatch
  cta?: TextPatch
  note?: TextPatch
}

/** عرض: عنوان أعلى، وسعر/سعر قديم/خصم/زر حرّة في الأسفل */
function ofText(p: OF = {}) {
  return {
    x: 130,
    y: p.y ?? 260,
    w: 820,
    gap: 14,
    align: 'center' as const,
    items: {
      kicker: txt({ visible: true, size: 32, color: WHITE, weightAr: 900, deco: 'pill', decoStyle: { fill: RED, radius: 999, padX: 34, padY: 8, full: false, shadow: true }, ...p.kicker }),
      title: txt({ visible: true, fit: 'block', maxSize: 108, color: INK, uppercase: true, lineHeight: 1, ...p.title }),
      subtitle: txt({ visible: true, fit: 'block', maxSize: 38, color: RED, uppercase: true, weightLat: 400, tracking: 0.06, ...p.subtitle }),
      tagline: hidden({ size: 38, color: GRAY, ...p.tagline }),
      features: hidden(),
      note: txt({ visible: true, free: true, fx: 90, fy: 1268, fw: 900, align: 'center', size: 26, color: SOFT, weightAr: 500, ...p.note }),
      oldPrice: txt({ visible: true, free: true, fx: 540, fy: 1010, fw: 440, align: 'right', size: 58, color: SOFT, strike: true, weightAr: 500, weightLat: 400, lineHeight: 1, accent: RED, ...p.oldPrice }),
      price: txt({ visible: true, free: true, fx: 440, fy: 1076, fw: 540, align: 'right', size: 170, color: RED, weightAr: 900, weightLat: 700, lineHeight: 1, ...p.price }),
      discount: txt({ visible: false, ...p.discount }),
      cta: txt({
        visible: true,
        free: true,
        fx: 90,
        fy: 1128,
        fw: 380,
        align: 'center',
        size: 40,
        color: WHITE,
        weightAr: 900,
        deco: 'pill',
        decoStyle: { fill: INK, radius: 999, padX: 40, padY: 16, full: true, shadow: true },
        ...p.cta,
      }),
    },
  }
}

const OF_AREA = { x: 120, y: 540, w: 840, h: 520 }

const offers: Template[] = [
  tplc('offers', 'of-burst', 'انفجار الخصم', 'Discount Burst', ['فاتح', 'أحمر', 'خصم'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#E7E7EC' },
    shape: { kind: 'floor', color: '#000000', opacity: 0.2, spread: 0.32 },
    productFx: { shadow: 'soft', shadowOpacity: 0.25 },
    productArea: OF_AREA,
    decor: [stk('b:burst', 70, 470, 300, 300, RED, WHITE, '{discount}', { layer: 'top', rotate: -10, shadow: 'soft' })],
    text: ofText(),
    contact: { theme: 'red-ring' },
  }),
  tplc('offers', 'of-gold', 'ذهبي فاخر', 'Luxe Gold', ['داكن', 'ذهبي', 'فاخر'], {
    theme: 'dark',
    backdrop: { kind: 'studio-dark', color: '#26262E', color2: '#050507' },
    shape: { kind: 'podium', color: '#1B1B22', opacity: 1, spread: 0.1, scale: 0.9 },
    productFx: { shadow: 'glow', shadowOpacity: 0.5, shadowColor: GOLD },
    productArea: OF_AREA,
    decor: [
      decor({ kind: 'glow', x: 190, y: 380, w: 700, h: 700, color: GOLD, opacity: 0.18, layer: 'back' }),
      stk('b:seal', 70, 470, 290, 290, '#111214', GOLD, '{discount}', { layer: 'top', rotate: -8, shadow: 'soft' }),
    ],
    text: ofText({
      kicker: { color: '#1A1300', decoStyle: { fill: GOLD, radius: 999, padX: 34, padY: 8, full: false, shadow: true } },
      title: { color: WHITE, weightLat: 300, tracking: 0.04 },
      subtitle: { color: GOLD },
      oldPrice: { color: '#8B8B98' },
      price: { gradient: true, color: GOLD, color2: '#B8860B', gradAngle: 100 },
      cta: { color: '#1A1300', decoStyle: { fill: GOLD, radius: 999, padX: 40, padY: 16, full: true, shadow: true } },
      note: { color: '#8B8B98' },
    }),
    contact: { theme: 'ink' },
    logos: { lkgt: 'white', partner: 'white' },
  }),
  tplc('offers', 'of-flash', 'عرض خاطف', 'Flash Sale', ['فاتح', 'أصفر', 'خاطف'], {
    backdrop: { kind: 'studio', color: '#FFFFFF', color2: '#F0F0F4' },
    productFx: { shadow: 'soft', shadowOpacity: 0.28 },
    productArea: OF_AREA,
    shape: { kind: 'band', color: YELLOW, color2: YELLOW, top: 0.62, skew: -9, scale: 1.05, opacity: 1 },
    decor: [
      decor({ kind: 'watermark', text: 'SALE', x: 40, y: 400, w: 1000, h: 300, color: RED, opacity: 0.16, size: 4, layer: 'back' }),
      stk('b:tag', 70, 470, 340, 170, INK, WHITE, '{discount}', { layer: 'top', rotate: -6, shadow: 'soft' }),
    ],
    text: ofText({ kicker: { decoStyle: { fill: INK, radius: 999, padX: 34, padY: 8, full: false, shadow: true } }, cta: { decoStyle: { fill: RED, radius: 999, padX: 40, padY: 16, full: true, shadow: true } } }),
    contact: { theme: 'ink' },
  }),
  tplc('offers', 'of-tag', 'بطاقة سعر', 'Price Tag', ['فاتح', 'ناعم', 'بطاقة'], {
    backdrop: { kind: 'solid', color: '#ECECEF', color2: '#E0E0E4' },
    shape: { kind: 'card', color: '#FFFFFF', color2: '#FFFFFF', top: -0.05, spread: 0.12, bottom: 50, radius: 60, opacity: 1 },
    productFx: { shadow: 'contact', shadowOpacity: 0.35 },
    productArea: { x: 140, y: 560, w: 800, h: 470 },
    decor: [stk('b:ticket', 590, 600, 410, 180, RED, WHITE, '{discount}', { layer: 'top', rotate: 5, shadow: 'soft' }, 'كوبون\nخصم')],
    text: ofText({ oldPrice: { fx: 540, fy: 1052 }, price: { fy: 1114, size: 150 }, cta: { fy: 1150 } }),
    contact: { theme: 'white' },
  }),
  tplc('offers', 'of-peach', 'خوخي', 'Peach', ['فاتح', 'دافئ', 'ناعم'], {
    backdrop: { kind: 'peach', color: '#FFF5F1', color2: '#FFD3CB', angle: 172 },
    shape: { kind: 'circle', color: '#FFFFFF', color2: '#FFEDE9', opacity: 0.92, scale: 0.9 },
    productFx: { shadow: 'float', shadowOpacity: 0.26 },
    productArea: OF_AREA,
    decor: [decor({ kind: 'blobs', color: '#FF9A9F', color2: '#FFC9B8', opacity: 0.5, layer: 'back' }), stk('b:discount', 740, 470, 270, 270, RED, WHITE, '{discount}', { layer: 'top', rotate: 8, shadow: 'soft' }, 'خصم')],
    text: ofText({ kicker: { decoStyle: { fill: INK, radius: 999, padX: 34, padY: 8, full: false, shadow: true } }, title: { color: '#A3111A' } }),
    contact: { theme: 'white' },
  }),
  tplc('offers', 'of-split', 'أحمر وأبيض', 'Red Split', ['جريء', 'أحمر', 'مقسوم'], {
    theme: 'light',
    backdrop: { kind: 'split', color: '#F7F7F8', color2: RED },
    productFx: { shadow: 'soft', shadowOpacity: 0.4 },
    productArea: OF_AREA,
    decor: [decor({ kind: 'rings', x: 560, y: 760, w: 640, h: 640, color: WHITE, opacity: 0.16, size: 5, layer: 'back' }), stk('b:ring', 70, 470, 250, 250, RED, WHITE, '{discount}', { layer: 'top', rotate: -8, shadow: 'soft' })],
    text: ofText({
      oldPrice: { color: '#FFD9DC' },
      price: { color: WHITE },
      cta: { color: RED, decoStyle: { fill: WHITE, radius: 999, padX: 40, padY: 16, full: true, shadow: true } },
      note: { color: WHITE },
    }),
    contact: { theme: 'white' },
  }),
]

export const CATEGORY_TEMPLATES: Template[] = [...truefalse, ...factmyth, ...offers, ...didyouknow]

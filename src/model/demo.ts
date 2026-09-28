import type { AdContent, AdTexts, MaskCleanup, ProductContent } from './types'

/* ------------------------------------------------------------------
 * محتوى تجريبي يملأ القوالب (من منتجات LKGT الفعلية)
 * الأصول موجودة في public/demo — المعرفات تبدأ بـ demo:
 * ------------------------------------------------------------------ */

export const DEFAULT_CLEANUP: MaskCleanup = {
  low: 40,
  high: 190,
  islands: true,
  fillHoles: true,
  choke: 0,
  feather: 0.6,
}

export const EMPTY_TEXTS: AdTexts = {
  title: '',
  subtitle: '',
  tagline: '',
  note: '',
  badge: '',
  features: [],
  price: '',
  kicker: '',
}

/** نصوص العناصر النائبة عند تفريغ القالب */
export const PLACEHOLDER_TEXTS: AdTexts = {
  title: 'PRODUCT NAME',
  subtitle: 'SHORT PRODUCT DESCRIPTION',
  tagline: 'اكتب هنا جملة تسويقية عن المنتج',
  note: 'سطر إضافي للتفاصيل',
  badge: 'جديد',
  features: ['ميزة أولى', 'ميزة ثانية', 'ميزة ثالثة'],
  price: '000$',
  kicker: 'وصل حديثاً',
}

function sceneProduct(id: string, cleanup: Partial<MaskCleanup> = {}): ProductContent {
  return {
    sourceAssetId: `demo:${id}`,
    maskAssetId: `demo:${id}-mask`,
    paintAssetId: null,
    cleanup: { ...DEFAULT_CLEANUP, ...cleanup },
    linked: true,
    place: null,
    enhance: { brightness: 1.02, contrast: 1.04, saturate: 1.05 },
    visible: true,
  }
}

export const DEMOS: Record<string, AdContent & { label: string }> = {
  'am-c4000': {
    label: 'WorkForce AM-C4000',
    scene: { assetId: 'demo:am-c4000', place: null },
    product: sceneProduct('am-c4000', { low: 30, high: 150 }),
    partnerLogoId: 'epson',
    texts: {
      title: 'WORKFORCE AM-C4000',
      subtitle: 'A4 COLOUR MULTIFUNCTION INKJET PRINTER',
      tagline: 'محرك أعمالك الذي لا يعرف الانتظار',
      note: 'طباعة • نسخ • مسح ضوئي بكفاءة المؤسسات',
      badge: 'جديد',
      features: ['ملونة A4', 'متعددة الوظائف', 'للمؤسسات'],
      price: '',
      kicker: 'وصل حديثاً',
    },
  },
  'sc-f100': {
    label: 'SureColor SC-F100',
    scene: { assetId: 'demo:sc-f100', place: null },
    product: sceneProduct('sc-f100', { low: 70, high: 190 }),
    partnerLogoId: 'epson',
    texts: {
      title: 'SureColor SC-F100',
      subtitle: 'High-Quality A4 Dye Sublimation Printer',
      tagline: 'حوّل أفكارك إلى ألوان تدوم',
      note: 'اطبع على القمصان والقبعات والإكسسوارات',
      badge: 'جديد',
      features: ['طباعة تسامي', 'مقاس A4', 'ألوان زاهية'],
      price: '',
      kicker: 'للمبدعين',
    },
  },
  'sigma-dse': {
    label: 'Entrust Sigma DSE',
    scene: { assetId: 'demo:sigma-dse', place: null },
    product: sceneProduct('sigma-dse', { low: 60, high: 180 }),
    partnerLogoId: 'entrust',
    texts: {
      title: 'ENTRUST SIGMA DSE',
      subtitle: 'Direct-to-Card Printer',
      tagline: 'لطباعة بطاقات ID بدقة واحترافية عالية',
      note: 'حلول متكاملة لإصدار البطاقات',
      badge: 'جديد',
      features: ['طباعة مباشرة', 'بطاقات ID', 'أداء موثوق'],
      price: '',
      kicker: 'حلول البطاقات',
    },
  },
  'co-w01': {
    label: 'Epson CO-W01',
    scene: null,
    product: {
      sourceAssetId: 'demo:co-w01',
      maskAssetId: null,
      paintAssetId: null,
      cleanup: { ...DEFAULT_CLEANUP, islands: false, fillHoles: false, feather: 0 },
      linked: false,
      place: null,
      enhance: { brightness: 1, contrast: 1.03, saturate: 1 },
      visible: true,
    },
    partnerLogoId: 'epson',
    texts: {
      title: 'CO-W01 Projector',
      subtitle: '3LCD PORTABLE PROJECTOR',
      tagline: 'حوّل أي جدار إلى *شاشة سينما*',
      note: 'للمزيد من التفاصيل تواصل معنا',
      badge: 'عرض',
      features: ['3LCD', 'WXGA', 'سهل الحمل'],
      price: '2??$',
      kicker: 'عرض لفترة محدودة',
    },
  },
}

/** أبعاد الأصول التجريبية (لتجنب انتظار تحميلها قبل الحساب) */
export const DEMO_ASSETS: Record<string, { url: string; w: number; h: number }> = {
  'demo:am-c4000': { url: 'demo/am-c4000.jpg', w: 1080, h: 1440 },
  'demo:am-c4000-mask': { url: 'demo/am-c4000-mask.png', w: 1080, h: 1440 },
  'demo:sc-f100': { url: 'demo/sc-f100.jpg', w: 1080, h: 1440 },
  'demo:sc-f100-mask': { url: 'demo/sc-f100-mask.png', w: 1080, h: 1440 },
  'demo:sigma-dse': { url: 'demo/sigma-dse.jpg', w: 1080, h: 1443 },
  'demo:sigma-dse-mask': { url: 'demo/sigma-dse-mask.png', w: 1080, h: 1443 },
  'demo:co-w01': { url: 'demo/co-w01.png', w: 680, h: 300 },
}

export function cloneContent(c: AdContent): AdContent {
  return JSON.parse(JSON.stringify(c))
}

export function demoContent(id: string): AdContent {
  const d = DEMOS[id] ?? DEMOS['am-c4000']
  const { label: _label, ...content } = d
  return cloneContent(content)
}

export function placeholderContent(keepPartner: string | null): AdContent {
  return {
    scene: null,
    product: null,
    texts: { ...PLACEHOLDER_TEXTS, features: [...PLACEHOLDER_TEXTS.features] },
    partnerLogoId: keepPartner,
  }
}

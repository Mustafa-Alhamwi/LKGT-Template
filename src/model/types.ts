/* ------------------------------------------------------------------
 * LKGT Template Studio — نموذج البيانات
 * كل القوالب بمقاس إنستغرام 1080 × 1440
 * ------------------------------------------------------------------ */

export const POSTER_W = 1080
export const POSTER_H = 1440

export type ArWeight = 100 | 300 | 400 | 500 | 700 | 900
export type LatWeight = 300 | 400 | 700

/** مستطيل بإحداثيات البوستر (px) — الارتفاع يُحسب من نسبة الصورة */
export interface Placement {
  x: number
  y: number
  w: number
}

export interface SceneContent {
  assetId: string
  /** null = ملء تلقائي (cover) */
  place: Placement | null
}

export interface MaskCleanup {
  /** عتبة الشفافية الدنيا (0..255) — تحت هذه القيمة يصبح البكسل شفافاً */
  low: number
  /** العتبة العليا (0..255) — فوقها يصبح معتماً تماماً */
  high: number
  /** إبقاء الجسم الرئيسي فقط وحذف الشوائب */
  islands: boolean
  /** ملء الفراغات الداخلية (مفيد للطابعات البيضاء على خلفية بيضاء) */
  fillHoles: boolean
  /** تقليص الحواف (px) */
  choke: number
  /** تنعيم الحواف (px) */
  feather: number
}

export interface ProductContent {
  /** مصدر البكسلات: صورة المشهد نفسها أو صورة PNG مفرغة مرفوعة */
  sourceAssetId: string
  /** قناع التفريغ الخام (رمادي). null = المصدر يحمل شفافيته الخاصة */
  maskAssetId: string | null
  /** تعديلات الفرشاة اليدوية (R = إضافة ، G = مسح) */
  paintAssetId: string | null
  cleanup: MaskCleanup
  /** مرتبط بالمشهد = يطابق مكان المنتج في الصورة الأصلية تماماً */
  linked: boolean
  /** المكان عندما يكون غير مرتبط (أو منتج مستقل بلا مشهد) */
  place: Placement | null
  enhance: { brightness: number; contrast: number; saturate: number }
  visible: boolean
}

export interface AdTexts {
  title: string
  subtitle: string
  tagline: string
  note: string
  badge: string
  features: string[]
  price: string
  kicker: string
}

export interface AdContent {
  scene: SceneContent | null
  product: ProductContent | null
  texts: AdTexts
  partnerLogoId: string | null
}

/* ------------------------------ Style ------------------------------ */

export type TextKey = 'kicker' | 'title' | 'subtitle' | 'tagline' | 'note' | 'features' | 'price'

export type FitMode = 'none' | 'block' | 'lines' | 'kashida'

export type Decoration =
  | 'none'
  | 'pill'
  | 'box'
  | 'outlineBox'
  | 'rules'
  | 'underline'
  | 'doubleUnderline'
  | 'bar'
  | 'tab'
  | 'bracket'
  | 'glass'

export interface DecoStyle {
  fill: string
  stroke: string
  strokeWidth: number
  radius: number
  padX: number
  padY: number
  shadow: boolean
  /** اللون الثانوي (للخطوط الجانبية / التسطير) */
  accent: string
  /** يمتد الإطار بكامل عرض الكتلة */
  full: boolean
}

export interface TextStyle {
  visible: boolean
  size: number
  fit: FitMode
  /** حد أعلى لحجم الخط عند الملاءمة */
  maxSize: number
  weightAr: ArWeight
  weightLat: LatWeight
  color: string
  /** لون الكلمات المحاطة بـ *نجمتين* */
  accent: string
  uppercase: boolean
  tracking: number
  lineHeight: number
  deco: Decoration
  decoStyle: DecoStyle
  /** إزاحة عمودية إضافية قبل العنصر */
  marginTop: number
  opacity: number
}

export interface TextPanel {
  kind: 'none' | 'glass' | 'solid' | 'outline'
  fill: string
  stroke: string
  radius: number
  pad: number
}

export interface TextBlockStyle {
  x: number
  y: number
  w: number
  align: 'center' | 'right' | 'left'
  gap: number
  order: TextKey[]
  items: Record<TextKey, TextStyle>
  /** خلفية خلف كتلة النصوص كاملة (بطاقة زجاجية مثلاً) */
  panel: TextPanel
}

export type ShapeKind =
  | 'none'
  | 'slab'
  | 'circle'
  | 'rings'
  | 'floor'
  | 'podium'
  | 'arch'
  | 'halo'
  | 'band'
  | 'frame'
  | 'blob'

export interface ShapeStyle {
  kind: ShapeKind
  color: string
  color2: string
  opacity: number
  /** توسعة أفقية كنسبة من عرض المنتج */
  spread: number
  /** بداية الشكل كنسبة من ارتفاع المنتج (0 = أعلى المنتج، 1 = أسفله) */
  top: number
  /** امتداد أسفل المنتج (px) */
  bottom: number
  radius: number
  /** ميلان (درجة) */
  skew: number
  /** حجم نسبي (للدوائر/الحلقات/الهالة) */
  scale: number
  offsetX: number
  offsetY: number
  stroke: number
}

export type ContactTheme =
  | 'red'
  | 'red-ring'
  | 'white'
  | 'glass'
  | 'outline'
  | 'half-fade'
  | 'dark-glass'
  | 'ink'
  | 'red-gradient'
  | 'chips'
  | 'minimal'
  | 'ribbon'
  | 'outline-light'
  | 'split'

export type BackdropKind = 'solid' | 'studio' | 'studio-dark' | 'spot' | 'red-sweep' | 'mesh' | 'split' | 'paper'

export interface BackdropStyle {
  kind: BackdropKind
  color: string
  color2: string
}

export interface FadeStyle {
  enabled: boolean
  /** شفافية الصورة في الأعلى (0 .. 0.3 عادةً) */
  top: number
  /** نقطة انتهاء الوضوح الكامل (نسبة من الأسفل 0..1) */
  from: number
  /** نقطة الوصول لشفافية الأعلى (نسبة من الأسفل 0..1) */
  to: number
}

export interface SceneFx {
  blur: number
  brightness: number
  saturate: number
  contrast: number
  tint: string
  tintOpacity: number
  grayscale: number
}

export type ShadowKind = 'none' | 'soft' | 'contact' | 'float' | 'glow' | 'long'

export interface ProductFx {
  shadow: ShadowKind
  shadowOpacity: number
  shadowColor: string
  reflection: boolean
}

export type DecorKind =
  | 'stripes'
  | 'rings'
  | 'grid'
  | 'dots'
  | 'corners'
  | 'line'
  | 'glow'
  | 'diagonal'
  | 'watermark'
  | 'beam'
  | 'frame'
  | 'badge'
  | 'arc'
  | 'noise'

export interface DecorItem {
  id: string
  kind: DecorKind
  layer: 'back' | 'front'
  x: number
  y: number
  w: number
  h: number
  rotate: number
  color: string
  color2: string
  opacity: number
  /** قيمة عامة (سماكة / تباعد / عدد) */
  size: number
  /** نص (للعلامة المائية/الشارة). {title} = اسم المنتج */
  text: string
  visible: boolean
}

export type LogoVariant = 'color' | 'color-flat' | 'white' | 'black'
export type PartnerVariant = 'original' | 'white' | 'black'

export interface TemplateStyle {
  theme: 'light' | 'dark'
  backdrop: BackdropStyle
  fade: FadeStyle
  sceneFx: SceneFx
  shape: ShapeStyle
  productFx: ProductFx
  decor: DecorItem[]
  text: TextBlockStyle
  contact: { theme: ContactTheme; accent: string }
  logos: { lkgt: LogoVariant; partner: PartnerVariant }
  /** مكان المنتج الافتراضي عندما لا يوجد مشهد (منتج مفرغ فقط) */
  productArea: { x: number; y: number; w: number; h: number }
}

export interface Template {
  id: string
  name: string
  nameEn: string
  category: CategoryId
  builtIn: boolean
  style: TemplateStyle
  demoId: string
  /** وسوم للبحث */
  tags: string[]
  /** محتوى تجريبي مخصص (لقوالب المستخدم) */
  demo?: AdContent
}

export type CategoryId = 'ads' | 'truefalse' | 'factmyth' | 'offers' | 'didyouknow'

export interface Design {
  templateId: string
  content: AdContent
  style: TemplateStyle
  /** المحتوى الحالي هو المحتوى التجريبي للقالب */
  isDemo: boolean
}

/* ------------------------------ Brand ------------------------------ */

export interface BrandConfig {
  /** جهة لوغو LKGT (الشركة الأخرى في الجهة المقابلة) */
  logoSide: 'right' | 'left'
  logo: { top: number; side: number; h: number }
  partner: { top: number; side: number; maxW: number; maxH: number }
  contact: { y: number; w: number; h: number; fontSize: number }
  website: string
  instagram: string
  phone: string
  /** لوغو LKGT مرفوع يدوياً (يحل مكان النسخة المتجهية) */
  customLogoAssetId: string | null
}

export interface PartnerLogo {
  id: string
  name: string
  src: string
  builtIn: boolean
}

export type Selection =
  | { kind: 'scene' }
  | { kind: 'product' }
  | { kind: 'shape' }
  | { kind: 'textBlock' }
  | { kind: 'text'; key: TextKey }
  | { kind: 'contact' }
  | { kind: 'partner' }
  | { kind: 'logo' }
  | { kind: 'decor'; id: string }

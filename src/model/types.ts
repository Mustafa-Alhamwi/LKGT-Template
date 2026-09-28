/* ------------------------------------------------------------------
 * LKGT Template Studio — نموذج البيانات
 * كل القوالب بمقاس إنستغرام 1080 × 1440
 * ------------------------------------------------------------------ */

export const POSTER_W = 1080
export const POSTER_H = 1440

/** مقاس اللوحة: كل القوالب تُبنى على 1080×1440 وتُحوَّل ذكياً لبقية المقاسات */
export interface Canvas {
  w: number
  h: number
  /** معرّف المقاس الجاهز (post, story, square…) أو custom */
  format?: string
  /** هوامش آمنة لعناصر الهوية (اللوغو والتواصل) — مثلاً واجهة الستوري */
  safeTop?: number
  safeBottom?: number
}

export const DEFAULT_CANVAS: Canvas = { w: POSTER_W, h: POSTER_H, format: 'post' }

export function canvasOf(d: { canvas?: Canvas } | null | undefined): Canvas {
  return d?.canvas ?? DEFAULT_CANVAS
}

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
  /** تنعيم الشكل العام للحواف (0..6) */
  smooth?: number
  /** إزالة هالة لون الخلفية من الحواف */
  decontaminate?: boolean
}

/** تحسين جودة الصورة (يُطبَّق على البكسلات عند التفريغ) */
export interface PhotoFix {
  /** مستويات + توازن إضاءة + تشبع تلقائي */
  auto: boolean
  /** حرارة اللون −100 (بارد) … +100 (دافئ) */
  temp: number
  /** حدّة 0 … 1.5 */
  sharpen: number
  /** إزالة ضجيج 0 … 1 */
  denoise: number
  /** تكبير الدقة (تنعيم + شحذ — لا يُضيف تفاصيل جديدة) */
  upscale: 1 | 2
}

export const NO_FIX: PhotoFix = { auto: false, temp: 0, sharpen: 0, denoise: 0, upscale: 1 }

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
  flip?: boolean
  rotate?: number
  opacity?: number
  /** ابدأ من قناع فارغ (للتحديد اليدوي بالكامل) */
  emptyBase?: boolean
  photo?: PhotoFix
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
  /** السعر القديم (يُشطب) — لعروض الأسعار */
  oldPrice: string
  /** نسبة الخصم أو قيمته */
  discount: string
  /** زر الدعوة لاتخاذ إجراء */
  cta: string
}

export interface ExtraText {
  id: string
  text: string
  style: TextStyle
}

export interface AdContent {
  scene: SceneContent | null
  product: ProductContent | null
  texts: AdTexts
  partnerLogoId: string | null
  /** نصوص إضافية حرّة أضافها المستخدم */
  extras?: ExtraText[]
  /** الجواب الصحيح في قوالب (صح/خطأ) و(حقيقة/خرافة): a = الأول ، b = الثاني */
  answer?: 'a' | 'b' | null
}

/* ------------------------------ Style ------------------------------ */

export type TextKey = 'kicker' | 'title' | 'subtitle' | 'tagline' | 'note' | 'features' | 'price' | 'oldPrice' | 'discount' | 'cta'

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
  /** لون ثانٍ = تدرج داخل البطاقة ('' = بدون) */
  fill2?: string
  angle?: number
  shadowSize?: number
  shadowColor?: string
  blur?: number
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
  /** عنصر حرّ: مفصول عن الكتلة وله موضعه الخاص */
  free?: boolean
  fx?: number
  fy?: number
  fw?: number
  rotate?: number
  align?: 'inherit' | 'center' | 'right' | 'left'
  gradient?: boolean
  color2?: string
  gradAngle?: number
  strokeW?: number
  strokeColor?: string
  textShadow?: 'none' | 'soft' | 'glow' | 'hard'
  shadowColor?: string
  /** انحناء النص على قوس (−100 … 100) — للنصوص الحرّة */
  curve?: number
  /** تعبئة الحروف بصورة (معرّف أصل) */
  fillImage?: string
  /** التفاف تلقائي للكلمات عند تجاوز العرض */
  wrap?: boolean
  /** توزيع متوازن للأسطر */
  balance?: boolean
  /** شطب النص (السعر القديم) */
  strike?: boolean
  blend?: BlendMode
  locked?: boolean
  showWhen?: ShowWhen
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
  | 'card'
  | 'wave'
  | 'arcs'
  | 'orbit'

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

export type BackdropKind =
  | 'solid'
  | 'studio'
  | 'studio-dark'
  | 'spot'
  | 'red-sweep'
  | 'mesh'
  | 'split'
  | 'vsplit'
  | 'paper'
  | 'aurora'
  | 'peach'
  | 'mist'
  | 'linear'
  | 'grid'
  | 'dots'
  | 'sunburst'
  | 'marble'
  | 'concrete'
  | 'wood'
  | 'terrazzo'
  | 'bokeh'
  | 'room'
  | 'silk'

export interface BackdropStyle {
  kind: BackdropKind
  color: string
  color2: string
  angle?: number
  /** بذرة الخامات المولّدة (تنويع الشكل) */
  seed?: number
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

export type ShadowKind = 'none' | 'soft' | 'contact' | 'float' | 'glow' | 'long' | 'outline' | 'cast'

export interface ProductFx {
  shadow: ShadowKind
  shadowOpacity: number
  shadowColor: string
  reflection: boolean
  /** اتجاه الظل الواقعي (ميلان بالدرجات) */
  shadowAngle?: number
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
  | 'wave'
  | 'blobs'
  | 'plus'
  | 'ribbon'
  | 'sticker'
  | 'qr'
  | 'image'

/** متى يظهر العنصر بالنسبة لإجابة التصميم (صح/خطأ…): دائماً، في السؤال فقط، عند كشف أي إجابة، أو عند إجابة محددة */
export type ShowWhen = 'always' | 'question' | 'reveal' | 'a' | 'b'

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'color-dodge'
  | 'color-burn'
  | 'darken'
  | 'lighten'
  | 'difference'
  | 'luminosity'

export type ObjShadow = 'none' | 'soft' | 'float' | 'hard' | 'glow'

/** ملصق / شارة / أيقونة من المكتبة */
export interface StickerSpec {
  /** b: شارات ، s: أشكال ، i: أيقونات ، a: أسهم */
  id: string
  text: string
  text2?: string
  /** للأيقونات: سماكة الخط */
  strokeW?: number
  /** للأيقونات: خلفية */
  bg?: 'none' | 'circle' | 'rounded' | 'squircle'
  /** دور الاختيار في قوالب صح/خطأ */
  answerRole?: 'a' | 'b'
}

export interface QrSpec {
  mode: 'url' | 'whatsapp' | 'phone' | 'email' | 'text' | 'barcode'
  data: string
  /** رسالة واتساب جاهزة */
  extra?: string
  style: 'square' | 'dots' | 'rounded'
  fg: string
  bg: string
  bgOn: boolean
  radius: number
  padding: number
}

export type ImageMask = 'none' | 'circle' | 'rounded' | 'squircle' | 'arch' | 'blob' | 'hex' | 'diamond'
export type ImageFrame = 'none' | 'phone' | 'laptop' | 'browser' | 'tablet' | 'polaroid' | 'card'

export interface ImageSpec {
  assetId: string
  /** قناع تفريغ (منتج إضافي) — null = الصورة كاملة */
  maskAssetId: string | null
  fit: 'cover' | 'contain'
  mask: ImageMask
  radius: number
  borderW: number
  borderColor: string
  frame: ImageFrame
  brightness: number
  contrast: number
  saturate: number
  /** تحريك/تكبير الصورة داخل القناع */
  zoom: number
  panX: number
  panY: number
}

export interface DecorItem {
  id: string
  kind: DecorKind
  layer: 'back' | 'front' | 'top'
  name?: string
  locked?: boolean
  blend?: BlendMode
  flip?: boolean
  shadow?: ObjShadow
  /** عنصر أضافه المستخدم ويبقى عند تبديل القالب */
  carry?: boolean
  showWhen?: ShowWhen
  sticker?: StickerSpec
  qr?: QrSpec
  image?: ImageSpec
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
  /** عناصر مخفية */
  hide?: Partial<Record<FixedLayer, boolean>>
  /** عناصر مقفلة (لا تُحدَّد ولا تتحرك بالنقر على التصميم) */
  lock?: Partial<Record<FixedLayer, boolean>>
}

export type FixedLayer = 'scene' | 'product' | 'shape' | 'textBlock' | 'logo' | 'partner' | 'contact'

export interface Template {
  id: string
  name: string
  nameEn: string
  category: CategoryId
  builtIn: boolean
  style: TemplateStyle
  demoId?: string
  /** وسوم للبحث */
  tags: string[]
  /** محتوى تجريبي مخصص (لقوالب المستخدم) */
  demo?: AdContent
  /** اللون الرئيسي الذي بُني به القالب (الافتراضي أحمر LKGT) */
  primary?: string
}

export type CategoryId = 'ads' | 'truefalse' | 'factmyth' | 'offers' | 'didyouknow'

export interface Design {
  templateId: string
  content: AdContent
  style: TemplateStyle
  /** المستخدم بدأ العمل (لا يزال المحتوى نصوصاً نائبة إن كانت false) */
  touched: boolean
  /** مقاس اللوحة (الافتراضي 1080×1440) */
  canvas?: Canvas
  /** فئة التصميم (تحدد أسماء الحقول والنصوص النائبة) */
  category?: CategoryId
  /** اللون الرئيسي المصبوغ داخل النمط حالياً (لإعادة التلوين بين مجموعات الهوية) */
  primary?: string
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
  whatsapp?: string
  email?: string
  address?: string
  /** عناصر شريط التواصل المعروضة بالترتيب */
  contactItems?: ContactItemKey[]
  /** لوغو LKGT مرفوع يدوياً (يحل مكان النسخة المتجهية) */
  customLogoAssetId: string | null
}

export type ContactItemKey = 'web' | 'ig' | 'ph' | 'wa' | 'mail' | 'addr'

/** مجموعة هوية: معلومات + ألوان + إعدادات (يمكن حفظ أكثر من واحدة) */
export interface BrandKit extends BrandConfig {
  id: string
  name: string
  /** اللون الرئيسي: تُعاد صبغة القوالب الحمراء إليه تلقائياً */
  primary: string
  secondary: string
  palette: string[]
  /** إعادة تلوين القوالب بألوان المجموعة */
  recolor: boolean
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
  | { kind: 'extra'; id: string }
  | { kind: 'contact' }
  | { kind: 'partner' }
  | { kind: 'logo' }
  | { kind: 'decor'; id: string }

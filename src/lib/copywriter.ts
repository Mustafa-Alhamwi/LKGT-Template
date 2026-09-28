import type { AdTexts, CategoryId } from '../model/types'

/* ------------------------------------------------------------------
 * مساعد الكتابة المحلي: يولّد نصوص التصميم (عنوان تمهيدي، جملة تسويقية،
 * زر إجراء…) ونص المنشور والوسوم بقوالب لغوية مدروسة حسب الفئة والنبرة —
 * يعمل بدون إنترنت. (الوضع الأذكى عبر Claude في lib/claude.ts)
 * ------------------------------------------------------------------ */

export type ToneId = 'friendly' | 'formal' | 'excited' | 'luxury' | 'urgent' | 'curious'

export const TONES: { id: ToneId; label: string; hint: string }[] = [
  { id: 'friendly', label: 'ودّي', hint: 'قريب من الناس وبسيط' },
  { id: 'formal', label: 'رسمي', hint: 'مهني وموثوق' },
  { id: 'excited', label: 'حماسي', hint: 'طاقة عالية' },
  { id: 'luxury', label: 'فاخر', hint: 'راقٍ وهادئ' },
  { id: 'urgent', label: 'عاجل', hint: 'فرصة لا تتكرر' },
  { id: 'curious', label: 'فضولي', hint: 'يثير الأسئلة' },
]

export interface CopyBrief {
  category: CategoryId
  /** اسم المنتج أو العبارة أو المعلومة */
  subject: string
  keywords: string[]
  tone: ToneId
  price: string
  oldPrice: string
  discount: string
  /** سطر تواصل يُلحق بنص المنشور */
  contact: string
  /** وسم العلامة (بدون #) */
  brandTag: string
  /** تعليمات إضافية حرّة (لوضع Claude) */
  extra: string
}

export type CopyTexts = Partial<Pick<AdTexts, 'kicker' | 'title' | 'subtitle' | 'tagline' | 'note' | 'cta' | 'price'>> & { features?: string[] }

export interface CopyOption {
  id: string
  texts: CopyTexts
  caption: string
  hashtags: string[]
  source: 'local' | 'claude'
}

export const EMPTY_BRIEF: CopyBrief = {
  category: 'ads',
  subject: '',
  keywords: [],
  tone: 'friendly',
  price: '',
  oldPrice: '',
  discount: '',
  contact: '',
  brandTag: '',
  extra: '',
}

/* ------------------------------ أدوات ------------------------------ */

function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** يسحب عناصر القائمة بترتيب عشوائي بلا تكرار حتى تنفد ثم يعيد الخلط */
function deck<T>(items: T[], rand: () => number): () => T | undefined {
  let bag: T[] = []
  return () => {
    if (!items.length) return undefined
    if (!bag.length) {
      bag = [...items]
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
    }
    return bag.pop()
  }
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

interface Ctx {
  s: string
  claim: string
  k1: string
  k2: string
  k3: string
  d: string
  p: string
  o: string
}

function ctxOf(b: CopyBrief): Ctx {
  const s = clean(b.subject)
  return {
    s,
    claim: s.replace(/[؟?]+$/, '').replace(/^(أنَّ|أنّ|أن|إنَّ|إنّ|إن|ان)\s+/, ''),
    k1: b.keywords[0] ?? '',
    k2: b.keywords[1] ?? '',
    k3: b.keywords[2] ?? '',
    d: clean(b.discount).replace(/^[-−–—+\s]+/, ''),
    p: clean(b.price),
    o: clean(b.oldPrice),
  }
}

/** يملأ القالب — يعيد null إن كان فيه حقل ناقص */
function fill(tpl: string, c: Ctx): string | null {
  let ok = true
  const out = tpl.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = (c as unknown as Record<string, string>)[k]
    if (!v) ok = false
    return v ?? ''
  })
  return ok ? out : null
}

type Pool = Record<ToneId, string[]>

function drawer(pool: Pool, tone: ToneId, c: Ctx, rand: () => number) {
  const usable = pool[tone].map((t) => fill(t, c)).filter((x): x is string => !!x)
  return deck(usable, rand)
}

/* ------------------------------ مجموعات الصياغات ------------------------------ */

const AD_TAGLINE: Pool = {
  friendly: ['اجعل *{s}* رفيقك كل يوم', 'جرّب *{s}* وستلاحظ الفرق بنفسك', 'لأنك تستحق الأفضل… *{s}*', 'بساطة تحبها، وجودة تثق بها', 'تعرّف على *{k1}* و{k2}'],
  formal: ['*{s}* — جودة موثوقة تلبّي احتياجاتكم', 'حلول متكاملة مع *{s}* لكل ما تحتاجونه', 'أداء يُعتمد عليه، وتصميم يليق بكم', 'نلتزم بالجودة… ونفخر بالنتيجة', 'شريككم الموثوق مع *{s}*'],
  excited: ['جديدنا: *{s}* — كن أول من يجرّب!', 'جاهز للانطلاق؟ *{s}* بين يديك الآن', 'طاقة جديدة مع *{s}*!', 'الانتظار انتهى… *{s}* هنا!', 'اكتشف *قوة* {k1} الحقيقية'],
  luxury: ['*{s}* — أناقة تتحدث عن نفسها', 'تفاصيل راقية تصنع *الفرق*', 'فخامة هادئة… وحضور لا يُنسى', 'لمن يعرف قيمة *التفاصيل*', 'إتقان في كل تفصيل — *{s}*'],
  urgent: ['الكمية محدودة — اطلب *{s}* الآن', 'بادر قبل *نفاد* الكمية', 'آخر القطع من *{s}* — احجز قطعتك', 'اليوم أفضل وقت لاقتناء *{s}*', 'لا تنتظر… الفرصة لا تدوم'],
  curious: ['هل جرّبت *{s}* من قبل؟', 'ما سرّ تميّز *{s}*؟ اكتشف بنفسك', 'كيف ستبدو حياتك مع *{s}*؟', 'سؤال واحد: لماذا تنتظر *أكثر*؟', 'اكتشف سرّ *{k1}*'],
}

const OFFER_TAGLINE: Pool = {
  friendly: ['فرصتك لتوفّر {d} على *{s}*', 'وفّر أكثر مع *{s}*', 'عرض خاص على *{s}* من أجلك', 'سعر ألطف… وجودة كما عهدتها'],
  formal: ['يسرّنا تقديم خصم {d} على *{s}*', 'عرض خاص على *{s}* لعملائنا الكرام', 'خصومات حصرية على *{s}* لفترة محدودة', 'عروض الموسم من *{s}*'],
  excited: ['خصم {d} على *{s}*! فرصة لا تُفوَّت', 'تخفيضات نارية على *{s}*!', 'وفّر *{d}* الآن — العرض بدأ!', 'العرض الأقوى على *{s}* وصل!'],
  luxury: ['امتلك *{s}* بسعر استثنائي', 'عرض حصري على *{s}* لمحبي الأناقة', 'قيمة أعلى… بسعر *أذكى*', 'لأنك تختار *الأفضل*'],
  urgent: ['خصم {d} على *{s}* — ينتهي قريباً', 'آخر أيام العرض — اطلب *{s}* الآن', 'العرض لفترة محدودة، لا تدعه *يفوتك*', 'بادر قبل *نفاد* الكمية'],
  curious: ['كم توفّر مع *{s}*؟ اكتشف الآن', 'هل رأيت سعر *{s}* الجديد؟', 'عرض واحد… وتوفير *حقيقي*', 'ما رأيك بخصم {d}؟'],
}

const OFFER_KICKER: Pool = {
  friendly: ['عرض خاص', 'عرض لك', 'فرصة حلوة'],
  formal: ['عرض حصري', 'عروض الموسم', 'عرض خاص'],
  excited: ['تخفيضات كبرى', 'عرض ناري', 'الأقوى هذا الأسبوع'],
  luxury: ['عرض مميز', 'مجموعة مختارة', 'حصرياً لكم'],
  urgent: ['ينتهي قريباً', 'لفترة محدودة', 'آخر الأيام'],
  curious: ['هل فاتك العرض؟', 'شاهد العرض', 'اكتشف الخصم'],
}

const OFFER_NOTE: Pool = {
  friendly: ['العرض ساري لفترة محدودة', 'العرض متاح حتى نفاد الكمية'],
  formal: ['العرض ساري حتى نفاد الكمية', 'تُطبَّق الشروط والأحكام'],
  excited: ['العرض ينتهي قريباً — لا تفوّته!', 'لفترة محدودة فقط!'],
  luxury: ['عرض حصري لعملائنا', 'الكميات محدودة'],
  urgent: ['ينتهي العرض قريباً', 'الكمية محدودة'],
  curious: ['اسأل عن شروط العرض', 'التفاصيل عند التواصل'],
}

const AD_KICKER: Pool = {
  friendly: ['جديدنا', 'وصل حديثاً', 'من أجلك'],
  formal: ['منتج جديد', 'إطلاق رسمي', 'حلول جديدة'],
  excited: ['وصل أخيراً!', 'الإطلاق الكبير', 'الحدث الأبرز'],
  luxury: ['الإصدار الجديد', 'مجموعة مميزة', 'حصرياً'],
  urgent: ['لفترة محدودة', 'كمية محدودة', 'آخر فرصة'],
  curious: ['اكتشف', 'تعرّف على', 'ما الجديد؟'],
}

const CTA: Pool = {
  friendly: ['اطلب الآن', 'جرّب اليوم', 'تواصل معنا', 'راسلنا الآن'],
  formal: ['للاستفسار تواصل معنا', 'اطلب عرض سعر', 'احجز موعدك', 'تواصل مع فريقنا'],
  excited: ['اطلب الآن!', 'لا تنتظر — اطلب!', 'سارع بالطلب!', 'اطلب قبل الجميع!'],
  luxury: ['اكتشف المجموعة', 'احجز قطعتك', 'تواصل معنا للطلب', 'اكتشف المزيد'],
  urgent: ['اطلب قبل النفاد', 'احجز الآن', 'اغتنم الفرصة', 'سارع بالحجز'],
  curious: ['اكتشف المزيد', 'تعرّف علينا', 'شاهد التفاصيل', 'اسألنا الآن'],
}

const QUIZ_KICKER: Record<'truefalse' | 'factmyth', Pool> = {
  truefalse: {
    friendly: ['صح أم خطأ؟', 'جاوب معنا'],
    formal: ['صح أم خطأ؟', 'اختبر معلوماتك'],
    excited: ['تحدّي اليوم!', 'هل تستطيع الإجابة؟'],
    luxury: ['صح أم خطأ؟', 'سؤال اليوم'],
    urgent: ['خمّن بسرعة!', 'ثوانٍ للإجابة'],
    curious: ['اختبر معلوماتك', 'هل تعرف الإجابة؟'],
  },
  factmyth: {
    friendly: ['حقيقة أم خرافة؟', 'صدّق أو لا تصدّق'],
    formal: ['حقيقة أم خرافة؟', 'تحقّق من المعلومة'],
    excited: ['هل هذا حقيقي؟!', 'تحدّي اليوم!'],
    luxury: ['حقيقة أم خرافة؟', 'ما وراء الشائع'],
    urgent: ['خمّن بسرعة!', 'ثوانٍ للحكم'],
    curious: ['هل تصدّق؟', 'ما رأيك؟'],
  },
}

const QUIZ_TITLE: Record<'truefalse' | 'factmyth', string[]> = {
  truefalse: ['{s}', 'هل صحيح أن {claim}؟', 'برأيك: {claim}؟', 'يقول البعض إن {claim} — صح أم خطأ؟'],
  factmyth: ['{s}', 'يعتقد كثيرون أن {claim}', 'هل صحيح أن {claim}؟', 'شاع بين الناس أن {claim}'],
}

const QUIZ_CTA: Pool = {
  friendly: ['شاركنا رأيك في التعليقات', 'اكتب إجابتك في التعليقات', 'خمّنت؟ أخبرنا'],
  formal: ['شاركونا إجابتكم في التعليقات', 'ننتظر إجاباتكم'],
  excited: ['اكتب إجابتك الآن!', 'من يعرف الإجابة؟ علّق!'],
  luxury: ['شاركنا إجابتك', 'ما إجابتك؟'],
  urgent: ['أجب قبل أن تقلب الشريحة!', 'خمّن الآن'],
  curious: ['هل تعرف الإجابة؟ اكتبها', 'ما رأيك؟ اكتب إجابتك'],
}

const DYK_KICKER: Pool = {
  friendly: ['هل تعلم؟', 'معلومة اليوم'],
  formal: ['معلومة سريعة', 'هل تعلم؟'],
  excited: ['معلومة مدهشة!', 'لن تصدّق!'],
  luxury: ['لمحة معرفية', 'هل تعلم؟'],
  urgent: ['لا تفوّت هذه المعلومة', 'اقرأ هذا الآن'],
  curious: ['ألم تسأل نفسك؟', 'هل تعلم؟'],
}

const DYK_TITLE: Pool = {
  friendly: ['{s}'],
  formal: ['{s}', 'من المعلومات اللافتة: {claim}'],
  excited: ['{s}', 'أتصدّق؟ {claim}'],
  luxury: ['{s}', 'معلومة قد تغيّر نظرتك: {claim}'],
  urgent: ['{s}', 'الحقيقة المدهشة: {claim}'],
  curious: ['{s}', 'هل خطر ببالك أن {claim}؟'],
}

const DYK_CTA: Pool = {
  friendly: ['احفظ المنشور وشاركه', 'شارك المعلومة مع صديق', 'هل كنت تعرف هذا؟ أخبرنا'],
  formal: ['شاركوا المعلومة مع من يهمه الأمر', 'احفظوا المنشور للرجوع إليه'],
  excited: ['شاركها الآن مع أصدقائك!', 'من كان يعلم؟ علّق!'],
  luxury: ['احفظ المنشور', 'شاركها مع من يقدّر المعرفة'],
  urgent: ['شاركها قبل أن تنسى!', 'احفظ المنشور الآن'],
  curious: ['هل تعرف معلومة مثلها؟ علّق', 'ما المعلومة التي فاجأتك؟ اكتبها'],
}

/* ------------------------------ نص المنشور ------------------------------ */

const HOOK: Record<'ads' | 'offers', Pool> = {
  ads: {
    friendly: ['✨ جديدنا وصل: {s}!', '💛 من أجلك… {s}', '✨ خبر سعيد لكم!'],
    formal: ['يسرّنا أن نقدّم لكم {s}.', 'نعلن عن {s}.', 'جديدنا لكم.'],
    excited: ['🔥 {s} وصل! هل أنت جاهز؟', '🚀 اللحظة التي انتظرتموها: {s}', '🔥 الانتظار انتهى!'],
    luxury: ['{s} — تفاصيل راقية لذوقٍ رفيع.', 'حين يكتمل الإتقان: {s}.', 'أناقة تتحدث عن نفسها.'],
    urgent: ['⏳ الكمية محدودة! {s} متوفر الآن.', '⚡ لا تفوّت {s} قبل نفاد الكمية.', '⏳ الفرصة لا تدوم طويلاً!'],
    curious: ['🤔 هل جرّبت {s} من قبل؟', 'ما الذي يميّز {s}؟ 👀', '👀 هل لاحظت الفرق؟'],
  },
  offers: {
    friendly: ['💛 عرض خاص من أجلك: {s}!', '✨ فرصتك لتوفّر على {s}!', '💛 عرض جديد بانتظارك!'],
    formal: ['يسرّنا تقديم عرض خاص على {s}.', 'عرض حصري لعملائنا الكرام.', 'عروض الموسم من {s}.'],
    excited: ['🔥 عرض ناري على {s}!', '🚀 التخفيضات بدأت! {s} بسعر مميز', '🔥 العرض الأقوى وصل!'],
    luxury: ['{s} — بسعر استثنائي.', 'عرض حصري لمحبي الأناقة.', 'قيمة أعلى… بسعر أذكى.'],
    urgent: ['⏳ آخر فرصة! عرض {s} ينتهي قريباً.', '⚡ لا تفوّت العرض قبل نفاد الكمية!', '⏳ العرض لفترة محدودة!'],
    curious: ['🤔 هل رأيت سعر {s} الجديد؟', 'كم يمكن أن توفّر؟ 👀', '👀 عرض يستحق الانتباه!'],
  },
}

const CLOSING: Pool = {
  friendly: ['للطلب أو الاستفسار راسلنا على الخاص 📩', 'اطلب الآن وأخبرنا برأيك 💬'],
  formal: ['للاستفسار والطلب يُرجى التواصل معنا.', 'يسعدنا خدمتكم.'],
  excited: ['اطلب الآن ولا تنتظر! 🛒', 'شاركها مع من يحتاجها! 🔥'],
  luxury: ['للطلب والاستفسار، تواصلوا معنا.', 'نحن في خدمتكم.'],
  urgent: ['اطلب الآن قبل نفاد الكمية! 📦', 'تواصل معنا الآن لتحجز قطعتك ⏰'],
  curious: ['ما رأيك؟ أخبرنا في التعليقات 👇', 'اسألنا عن أي تفصيل تريده 👇'],
}

const QUIZ_BODY: Pool = {
  friendly: ['اكتب إجابتك في التعليقات، وسنكشف الإجابة الصحيحة قريباً 👇', 'خمّن أولاً ثم اقلب الشريحة 👉'],
  formal: ['شاركونا إجابتكم في التعليقات وسنوافيكم بالإجابة الصحيحة.', 'ننتظر إجاباتكم.'],
  excited: ['🔥 خمّن! الإجابة في الشريحة التالية', 'من سيجيب أولاً؟ علّق الآن! 👇'],
  luxury: ['ما إجابتك؟ شاركونا رأيكم.', 'الإجابة الصحيحة تأتيكم قريباً.'],
  urgent: ['⏳ أجب الآن قبل أن تعرف الإجابة!', '⚡ لديك ثوانٍ فقط — خمّن!'],
  curious: ['🤔 ما رأيك؟ اكتب إجابتك في التعليقات 👇', 'هل أنت متأكد؟ فكّر مرة أخرى 👀'],
}

const DYK_BODY: Pool = {
  friendly: ['شارك المعلومة مع صديق يحب المعرفة 🤝', 'احفظ المنشور لتعود إليه 🔖'],
  formal: ['نأمل أن تكون المعلومة مفيدة لكم.', 'شاركوا المعلومة مع من يهمه الأمر.'],
  excited: ['شاركها الآن — سيتفاجأ الجميع! 🔥', 'من كان يعلم؟! 😮'],
  luxury: ['معرفة تستحق المشاركة.', 'شاركها مع من يقدّر المعرفة.'],
  urgent: ['احفظ المنشور قبل أن تنساه! 🔖', 'شاركها الآن ⏰'],
  curious: ['هل تعرف معلومة مثلها؟ شاركنا في التعليقات 👇', 'ما المعلومة التي فاجأتك مؤخراً؟ 💭'],
}

const DEFAULT_TAGS: Record<CategoryId, string[]> = {
  ads: ['منتجات_جديدة', 'تسوق'],
  offers: ['عروض', 'تخفيضات', 'خصومات'],
  truefalse: ['صح_أم_خطأ', 'اختبر_معلوماتك'],
  factmyth: ['حقيقة_أم_خرافة', 'معلومة'],
  didyouknow: ['هل_تعلم', 'معلومة_اليوم', 'ثقافة'],
}

export function toHashtag(word: string): string {
  const w = word
    .trim()
    .replace(/[^\p{L}\p{N}\s_]/gu, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
  return w ? `#${w}` : ''
}

function hashtagsFor(b: CopyBrief): string[] {
  const out: string[] = []
  const add = (t: string) => {
    if (t && !out.includes(t) && out.length < 9) out.push(t)
  }
  if (b.brandTag) add(toHashtag(b.brandTag))
  for (const k of b.keywords.slice(0, 4)) add(toHashtag(k))
  const words = clean(b.subject).split(' ').filter(Boolean)
  if ((b.category === 'ads' || b.category === 'offers') && words.length > 0 && words.length <= 3) add(toHashtag(b.subject))
  for (const t of DEFAULT_TAGS[b.category]) add(`#${t}`)
  return out
}

/* ------------------------------ التوليد ------------------------------ */

/** يولّد عدة خيارات (seed مختلف = خيارات مختلفة) */
export function generateLocal(brief: CopyBrief, seed = 1, count = 6): CopyOption[] {
  const rand = rng(seed * 7919 + 17)
  const c = ctxOf(brief)
  const tone = brief.tone
  const cat = brief.category
  const isQuiz = cat === 'truefalse' || cat === 'factmyth'
  const keywords = brief.keywords.filter(Boolean)

  const d = {
    kicker: drawer(cat === 'offers' ? OFFER_KICKER : cat === 'ads' ? AD_KICKER : cat === 'didyouknow' ? DYK_KICKER : QUIZ_KICKER[cat as 'truefalse' | 'factmyth'], tone, c, rand),
    tagline: cat === 'offers' ? drawer(OFFER_TAGLINE, tone, c, rand) : cat === 'ads' ? drawer(AD_TAGLINE, tone, c, rand) : null,
    cta: drawer(isQuiz ? QUIZ_CTA : cat === 'didyouknow' ? DYK_CTA : CTA, tone, c, rand),
    note: cat === 'offers' ? drawer(OFFER_NOTE, tone, c, rand) : null,
    title: isQuiz
      ? deck(QUIZ_TITLE[cat as 'truefalse' | 'factmyth'].map((t) => fill(t, c)).filter((x): x is string => !!x), rand)
      : cat === 'didyouknow'
        ? drawer(DYK_TITLE, tone, c, rand)
        : null,
    hook: cat === 'ads' || cat === 'offers' ? drawer(HOOK[cat], tone, c, rand) : null,
    closing: drawer(CLOSING, tone, c, rand),
    body: isQuiz ? drawer(QUIZ_BODY, tone, c, rand) : cat === 'didyouknow' ? drawer(DYK_BODY, tone, c, rand) : null,
  }

  const tags = hashtagsFor(brief)
  const bullet = tone === 'formal' || tone === 'luxury' ? '•' : '✔️'
  const list = keywords.length ? keywords.slice(0, 4).map((k) => `${bullet} ${k}`).join('\n') : ''
  const bigNumber = keywords.find((k) => /\d/.test(k)) ?? ''

  const priceLine = () => {
    const bits: string[] = []
    if (c.d) bits.push(`خصم ${c.d}`)
    if (c.p && c.o) bits.push(`بسعر ${c.p} بدلاً من ${c.o}`)
    else if (c.p) bits.push(`السعر: ${c.p}`)
    return bits.join(' — ')
  }

  const options: CopyOption[] = []
  for (let i = 0; i < count; i++) {
    const t: CopyTexts = {}
    const kicker = d.kicker?.()
    if (kicker) t.kicker = kicker
    const tagline = d.tagline?.()
    if (tagline) t.tagline = tagline
    const title = d.title?.()
    if (title && (isQuiz || cat === 'didyouknow')) t.title = title
    const note = d.note?.()
    if (note) t.note = note
    const cta = d.cta()
    if (cta) t.cta = cta
    if ((cat === 'ads' || cat === 'offers') && keywords.length) {
      t.subtitle = keywords.slice(0, 3).join(' • ')
      t.features = keywords.slice(0, 4)
    }
    if (cat === 'didyouknow' && bigNumber) t.price = bigNumber

    // نص المنشور
    const parts: string[] = []
    if (cat === 'ads' || cat === 'offers') {
      parts.push(d.hook?.() ?? '')
      if (cat === 'offers' && priceLine()) parts.push(priceLine())
      if (list) parts.push(list)
      parts.push(d.closing() ?? '')
    } else if (isQuiz) {
      parts.push(`${cat === 'truefalse' ? '❓ صح أم خطأ؟' : '🧐 حقيقة أم خرافة؟'}${c.s ? `\n${c.s}` : ''}`)
      parts.push(d.body?.() ?? '')
    } else {
      parts.push(`💡 هل تعلم؟${c.s ? `\n${c.s}` : ''}`)
      if (list && !bigNumber) parts.push(list)
      parts.push(d.body?.() ?? '')
    }
    if (brief.contact) parts.push(brief.contact)
    const caption = parts.filter(Boolean).join('\n\n')

    options.push({ id: `l${seed}-${i}`, texts: t, caption, hashtags: tags, source: 'local' })
  }
  return dedupe(options)
}

function dedupe(list: CopyOption[]): CopyOption[] {
  const seen = new Set<string>()
  return list.filter((o) => {
    const k = JSON.stringify(o.texts) + o.caption
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** يحوّل «كلمة، كلمة، كلمة» إلى مصفوفة */
export function splitKeywords(s: string): string[] {
  return s
    .split(/[,،\n;؛|]+/)
    .map((x) => clean(x))
    .filter(Boolean)
    .slice(0, 8)
}

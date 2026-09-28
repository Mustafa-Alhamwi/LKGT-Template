import type { AdTexts, CategoryId, Design, TextKey } from './types'

/* ------------------------------------------------------------------
 * فئات التصاميم: لكل فئة أسماء حقولها ونصوصها النائبة ونوع محتواها
 * ------------------------------------------------------------------ */

export interface CategoryDef {
  id: CategoryId
  name: string
  blurb: string
  /** هل تحتاج صورة منتج */
  hasProduct: boolean
  labels: Record<TextKey, string>
  hints: Partial<Record<TextKey, string>>
  placeholders: AdTexts
  /** خياران للإجابة (صح/خطأ ...) */
  answers?: { a: string; b: string }
}

const HINT_RICH = 'ضع *كلمة* بين نجمتين لتلوينها'

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'ads',
    name: 'إعلانات المنتجات',
    blurb: 'صورة المنتج مع اسمه وجملة تسويقية',
    hasProduct: true,
    labels: {
      kicker: 'سطر تمهيدي',
      title: 'اسم المنتج',
      subtitle: 'وصف المنتج',
      tagline: 'الجملة التسويقية',
      features: 'المزايا',
      note: 'سطر إضافي',
      price: 'السعر',
      oldPrice: 'السعر القديم',
      discount: 'الخصم',
      cta: 'زر الإجراء',
    },
    hints: { tagline: HINT_RICH, features: 'ميزة في كل سطر' },
    placeholders: {
      title: 'PRODUCT NAME',
      subtitle: 'SHORT PRODUCT DESCRIPTION',
      tagline: 'اكتب هنا جملة تسويقية عن المنتج',
      note: 'سطر إضافي للتفاصيل',
      badge: 'جديد',
      features: ['ميزة أولى', 'ميزة ثانية', 'ميزة ثالثة'],
      price: '000$',
      kicker: 'وصل حديثاً',
      oldPrice: '000$',
      discount: '-30%',
      cta: 'اطلب الآن',
    },
  },
  {
    id: 'truefalse',
    name: 'صح أم خطأ',
    blurb: 'عبارة يحكم عليها المتابع، ثم كشف الإجابة',
    hasProduct: false,
    labels: {
      kicker: 'العنوان الصغير',
      title: 'العبارة',
      subtitle: 'سطر مساعد',
      tagline: 'التوضيح / الشرح',
      features: 'نقاط',
      note: 'المصدر أو ملاحظة',
      price: 'رقم',
      oldPrice: 'نص إضافي',
      discount: 'وسم',
      cta: 'دعوة للتفاعل',
    },
    hints: { title: HINT_RICH, tagline: HINT_RICH },
    answers: { a: 'صح', b: 'خطأ' },
    placeholders: {
      title: 'اكتب هنا العبارة التي تريد من المتابعين الحكم عليها',
      subtitle: '',
      tagline: 'اكتب هنا التوضيح أو الشرح بعد كشف الإجابة',
      note: 'المصدر: …',
      badge: 'صح أم خطأ؟',
      features: [],
      price: '',
      kicker: 'صح أم خطأ؟',
      oldPrice: '',
      discount: '',
      cta: 'شاركنا رأيك في التعليقات',
    },
  },
  {
    id: 'factmyth',
    name: 'حقيقة أم خرافة',
    blurb: 'معلومة شائعة: هل هي حقيقة أم خرافة؟',
    hasProduct: false,
    labels: {
      kicker: 'العنوان الصغير',
      title: 'المعلومة الشائعة',
      subtitle: 'سطر مساعد',
      tagline: 'التوضيح العلمي',
      features: 'نقاط',
      note: 'المصدر أو ملاحظة',
      price: 'رقم',
      oldPrice: 'نص إضافي',
      discount: 'وسم',
      cta: 'دعوة للتفاعل',
    },
    hints: { title: HINT_RICH, tagline: HINT_RICH },
    answers: { a: 'حقيقة', b: 'خرافة' },
    placeholders: {
      title: 'اكتب هنا المعلومة الشائعة التي تريد التحقق منها',
      subtitle: '',
      tagline: 'اكتب هنا التوضيح الصحيح بعد كشف الإجابة',
      note: 'المصدر: …',
      badge: 'حقيقة أم خرافة؟',
      features: [],
      price: '',
      kicker: 'حقيقة أم خرافة؟',
      oldPrice: '',
      discount: '',
      cta: 'ما رأيك؟ اكتب إجابتك',
    },
  },
  {
    id: 'offers',
    name: 'عروض الأسعار',
    blurb: 'سعر جديد وقديم مع نسبة خصم ومدة العرض',
    hasProduct: true,
    labels: {
      kicker: 'وسم العرض',
      title: 'اسم المنتج',
      subtitle: 'وصف المنتج',
      tagline: 'جملة العرض',
      features: 'مزايا العرض',
      note: 'مدة العرض / شروط',
      price: 'السعر الجديد',
      oldPrice: 'السعر القديم',
      discount: 'نسبة الخصم',
      cta: 'زر الإجراء',
    },
    hints: { tagline: HINT_RICH, features: 'ميزة في كل سطر' },
    placeholders: {
      title: 'PRODUCT NAME',
      subtitle: 'SHORT PRODUCT DESCRIPTION',
      tagline: 'خصم حصري لفترة محدودة على *كل* المنتجات',
      note: 'العرض ساري حتى نفاد الكمية',
      badge: 'عرض',
      features: ['شحن مجاني', 'ضمان سنة كاملة'],
      price: '299$',
      kicker: 'عرض خاص',
      oldPrice: '399$',
      discount: '-25%',
      cta: 'اطلب الآن',
    },
  },
  {
    id: 'didyouknow',
    name: 'هل تعلم',
    blurb: 'معلومة مفاجئة بتصميم جذاب',
    hasProduct: false,
    labels: {
      kicker: 'العنوان الصغير',
      title: 'المعلومة',
      subtitle: 'سطر مساعد',
      tagline: 'تفاصيل إضافية',
      features: 'نقاط',
      note: 'المصدر',
      price: 'رقم كبير',
      oldPrice: 'نص إضافي',
      discount: 'وسم',
      cta: 'دعوة للتفاعل',
    },
    hints: { title: HINT_RICH, tagline: HINT_RICH, price: 'مثلاً: 85% أو 3×' },
    placeholders: {
      title: 'اكتب هنا المعلومة المفاجئة التي تريد مشاركتها مع المتابعين',
      subtitle: '',
      tagline: 'اكتب هنا تفاصيل أو سياقاً إضافياً عن المعلومة',
      note: 'المصدر: …',
      badge: 'هل تعلم؟',
      features: [],
      price: '85%',
      kicker: 'هل تعلم؟',
      oldPrice: '',
      discount: '',
      cta: 'احفظ المنشور وشاركه',
    },
  },
]

export function categoryDef(id: CategoryId | undefined | null): CategoryDef {
  return CATEGORY_DEFS.find((c) => c.id === id) ?? CATEGORY_DEFS[0]
}

export function categoryOf(d: Pick<Design, 'category'> | null | undefined): CategoryDef {
  return categoryDef(d?.category)
}

export function labelOf(cat: CategoryId | undefined, k: TextKey): string {
  return categoryDef(cat).labels[k]
}

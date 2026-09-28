import { change, changeContent } from '../../store/editor'
import type { AdContent, TemplateStyle, TextKey } from '../../model/types'

export function setStyle(fn: (s: TemplateStyle) => void, key = '') {
  change((d) => fn(d.style), key)
}

export function setContent(fn: (c: AdContent) => void, key = '') {
  changeContent(fn, key)
}

export const TEXT_LABELS: Record<TextKey, string> = {
  kicker: 'سطر تمهيدي',
  title: 'اسم المنتج (EN)',
  subtitle: 'الوصف (EN)',
  tagline: 'الجملة التسويقية (AR)',
  features: 'المزايا (كبسولات)',
  note: 'سطر إضافي',
  price: 'السعر',
}

export const TEXT_HINTS: Partial<Record<TextKey, string>> = {
  tagline: 'ضع *كلمة* بين نجمتين لتلوينها',
  features: 'ميزة في كل سطر',
}

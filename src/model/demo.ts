import type { AdContent, AdTexts, MaskCleanup } from './types'

/* القوالب تبدأ فارغة: نصوص نائبة فقط بدون صور */

export const DEFAULT_CLEANUP: MaskCleanup = {
  low: 40,
  high: 190,
  islands: true,
  fillHoles: true,
  choke: 0,
  feather: 0.6,
  smooth: 0,
  decontaminate: true,
}

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

export function cloneContent(c: AdContent): AdContent {
  return JSON.parse(JSON.stringify(c))
}

export function emptyContent(partnerLogoId: string | null = null): AdContent {
  return {
    scene: null,
    product: null,
    texts: { ...PLACEHOLDER_TEXTS, features: [...PLACEHOLDER_TEXTS.features] },
    partnerLogoId,
    extras: [],
  }
}

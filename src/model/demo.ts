import type { AdContent, AdTexts, CategoryId, MaskCleanup } from './types'
import { categoryDef } from './categories'

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

export const PLACEHOLDER_TEXTS: AdTexts = categoryDef('ads').placeholders

export function cloneContent(c: AdContent): AdContent {
  return JSON.parse(JSON.stringify(c))
}

export function emptyContent(partnerLogoId: string | null = null, category: CategoryId = 'ads'): AdContent {
  const ph = categoryDef(category).placeholders
  return {
    scene: null,
    product: null,
    texts: { ...ph, features: [...ph.features] },
    partnerLogoId,
    extras: [],
    answer: null,
  }
}

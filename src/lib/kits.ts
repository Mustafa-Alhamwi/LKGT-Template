import type { BrandKit, TemplateStyle } from '../model/types'
import { DEFAULT_BRAND, RED } from '../model/brand'
import { makeRecolorer, mapColors } from './color'

/* مجموعات الهوية: ألوان + معلومات + لوغو. القوالب تُصبغ تلقائياً بلون المجموعة الرئيسي */

export const LKGT_KIT: BrandKit = {
  ...DEFAULT_BRAND,
  id: 'lkgt',
  name: 'LKGT',
  primary: RED,
  secondary: '#111214',
  palette: ['#D11A24', '#111214', '#FFFFFF', '#A3111A', '#F2F2F2', '#4B4B4E'],
  recolor: true,
}

export function newKit(name: string, base: BrandKit = LKGT_KIT): BrandKit {
  return { ...structuredClone(base), id: `kit_${Date.now().toString(36)}`, name, customLogoAssetId: base.customLogoAssetId }
}

/** نمط القالب بعد تطبيق لون المجموعة (from = اللون الذي بُني به القالب) */
export function themedStyle(style: TemplateStyle, kit: BrandKit, from: string = RED): TemplateStyle {
  if (!kit.recolor) return style
  const fn = makeRecolorer(kit.primary, from)
  return fn ? mapColors(style, fn) : style
}

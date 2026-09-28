import type { BrandConfig, PartnerLogo } from './types'

/* ألوان الهوية — مأخوذة من الشعار والإعلانات المنشورة */
export const RED = '#D11A24'
export const RED_BRIGHT = '#E8212C'
export const RED_DEEP = '#A3111A'
export const RED_DARK = '#5E0A10'
export const LOGO_RED = '#DC142E'
export const INK = '#111214'
export const GRAY = '#4B4B4E'
export const SILVER = '#F2F2F2'

/**
 * مواضع ثابتة لكل القوالب (مقاسة من الإعلانات الأصلية):
 * - لوغو LKGT بحجم موحد في الزاوية العليا
 * - لوغو الشركة الشريكة في الزاوية المقابلة
 * - شريط التواصل في الأسفل
 */
export const DEFAULT_BRAND: BrandConfig = {
  logoSide: 'right',
  logo: { top: 62, side: 76, h: 124 },
  partner: { top: 84, side: 80, maxW: 250, maxH: 86 },
  contact: { y: 1326, w: 806, h: 58, fontSize: 27 },
  website: 'www.lk-gt.com',
  instagram: 'LKGT Co',
  phone: '+963 11 2120 476',
  customLogoAssetId: null,
}

export const BUILTIN_PARTNERS: PartnerLogo[] = [
  { id: 'epson', name: 'Epson', src: 'partners/epson.png', builtIn: true },
  { id: 'entrust', name: 'Entrust', src: 'partners/entrust.png', builtIn: true },
]

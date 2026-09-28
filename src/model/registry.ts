import type { Template } from './types'
import { ADS_TEMPLATES } from './templates'
import { CATEGORY_TEMPLATES } from './templates2'

/** كل القوالب المدمجة: إعلانات المنتجات + الفئات الأخرى */
export const BUILTIN_TEMPLATES: Template[] = [...ADS_TEMPLATES, ...CATEGORY_TEMPLATES]

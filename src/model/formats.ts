import type { Canvas } from './types'
import { DEFAULT_CANVAS } from './types'

/* ------------------------------------------------------------------
 * المقاسات الجاهزة — التصميم الأساسي 1080×1440 ويُعاد ترتيبه ذكياً
 * ------------------------------------------------------------------ */

export interface FormatDef {
  id: string
  name: string
  sub: string
  w: number
  h: number
  safeTop?: number
  safeBottom?: number
}

export const FORMATS: FormatDef[] = [
  { id: 'post', name: 'منشور عمودي 3:4', sub: 'إنستغرام · 1080×1440', w: 1080, h: 1440 },
  { id: 'post45', name: 'منشور 4:5', sub: 'إنستغرام · 1080×1350', w: 1080, h: 1350 },
  { id: 'square', name: 'مربع 1:1', sub: 'منشور · 1080×1080', w: 1080, h: 1080 },
  { id: 'story', name: 'ستوري / ريلز 9:16', sub: 'إنستغرام · تيك توك · 1080×1920', w: 1080, h: 1920, safeTop: 170, safeBottom: 190 },
  { id: 'wide', name: 'أفقي 16:9', sub: 'يوتيوب · عرض · 1920×1080', w: 1920, h: 1080 },
  { id: 'x', name: 'منشور X (تويتر) 16:9', sub: '1600×900', w: 1600, h: 900 },
  { id: 'fb', name: 'فيسبوك / لينكدإن', sub: 'رابط مشارك · 1200×630', w: 1200, h: 630 },
]

export function canvasFromFormat(id: string): Canvas {
  const f = FORMATS.find((x) => x.id === id)
  if (!f) return DEFAULT_CANVAS
  return { w: f.w, h: f.h, format: f.id, safeTop: f.safeTop, safeBottom: f.safeBottom }
}

export function customCanvas(w: number, h: number): Canvas {
  return { w: Math.round(Math.max(200, Math.min(4000, w))), h: Math.round(Math.max(200, Math.min(4000, h))), format: 'custom' }
}

export function formatLabel(c: Canvas): string {
  const f = FORMATS.find((x) => x.id === c.format)
  return f ? f.name : `مخصص ${c.w}×${c.h}`
}

export type Shape = 'tall' | 'square' | 'wide'
export function shapeOf(c: Canvas): Shape {
  const r = c.w / c.h
  if (r > 1.25) return 'wide'
  if (r > 0.9) return 'square'
  return 'tall'
}

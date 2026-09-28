import type { Design } from '../model/types'
import { categoryDef } from '../model/categories'

/* تسمية الملفات المصدَّرة بقالب قابل للتخصيص */

export const NAME_TOKENS: { token: string; label: string }[] = [
  { token: '{title}', label: 'العنوان' },
  { token: '{template}', label: 'القالب' },
  { token: '{size}', label: 'المقاس' },
  { token: '{n}', label: 'رقم الشريحة' },
  { token: '{category}', label: 'الفئة' },
  { token: '{project}', label: 'المشروع' },
  { token: '{date}', label: 'التاريخ' },
]

export interface NameCtx {
  title: string
  template: string
  size: string
  n: number
  project: string
  category: string
  ext: string
}

export function safeName(s: string, max = 80): string {
  return s
    .replace(/\*/g, '')
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

/** عنوان التصميم لاستخدامه في الاسم */
export function titleOf(d: Design): string {
  const cat = categoryDef(d.category)
  const t = d.content.texts.title?.trim()
  if (!d.touched || !t || t === cat.placeholders.title) return 'design'
  return t
}

export function buildName(tpl: string, c: NameCtx): string {
  const date = new Date().toISOString().slice(0, 10)
  const vals: Record<string, string> = {
    title: safeName(c.title, 50),
    template: safeName(c.template, 40),
    size: c.size,
    n: String(c.n).padStart(2, '0'),
    date,
    project: safeName(c.project, 40),
    category: safeName(c.category, 30),
  }
  const base = tpl.replace(/\{(\w+)\}/g, (_m, k: string) => vals[k] ?? '')
  return `${safeName(base || 'LKGT', 120) || 'LKGT'}.${c.ext}`
}

/** يضمن عدم تكرار اسم داخل الحزمة */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let i = 2
  while (used.has(`${stem} (${i})${ext}`)) i++
  const n = `${stem} (${i})${ext}`
  used.add(n)
  return n
}

import { create } from 'zustand'
import { DEFAULT_BRAND, BUILTIN_PARTNERS } from '../model/brand'
import { BUILTIN_TEMPLATES, blankTemplateStyle, deepMerge, baseStyle } from '../model/templates'
import { cloneContent, demoContent, placeholderContent, DEFAULT_CLEANUP } from '../model/demo'
import type {
  AdContent,
  BrandConfig,
  Design,
  PartnerLogo,
  Selection,
  Template,
  TemplateStyle,
  TextKey,
} from '../model/types'
import type { FontStatus } from '../lib/fonts'
import type { RemovalQuality } from '../lib/bgRemoval'

/* ------------------------------------------------------------------
 * حالة المحرر + سجل التراجع/الإعادة + الحفظ التلقائي
 * ------------------------------------------------------------------ */

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'ok' | 'error'
}

export interface Task {
  label: string
  progress: number | null
}

interface Persisted {
  design: Design
  brand: BrandConfig
  userTemplates: Template[]
  userPartners: PartnerLogo[]
  uiTheme: 'dark' | 'light'
  previewMine: boolean
  removalQuality: RemovalQuality
  exportScale: 1 | 2
  exportFormat: 'png' | 'jpg'
}

export interface EditorState extends Persisted {
  selection: Selection | null
  editing: TextKey | null
  past: Design[]
  future: Design[]
  fonts: FontStatus | null
  fontsVersion: number
  task: Task | null
  toasts: Toast[]
  dialog: null | 'settings' | 'refine' | 'saveTemplate' | 'shortcuts'
  libraryOpen: boolean
}

const LS_KEY = 'lkgt-studio:v1'

function load(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : {}
  } catch {
    return {}
  }
}

export function allTemplates(s: Pick<EditorState, 'userTemplates'>): Template[] {
  return [...BUILTIN_TEMPLATES, ...s.userTemplates]
}

export function findTemplate(s: Pick<EditorState, 'userTemplates'>, id: string): Template | undefined {
  return allTemplates(s).find((t) => t.id === id)
}

export function templateDemo(t: Template): AdContent {
  return t.demo ? cloneContent(t.demo) : demoContent(t.demoId)
}

/** ترميم الأنماط القديمة المحفوظة بإضافة أي خصائص جديدة ناقصة */
function normalizeStyle(s: TemplateStyle): TemplateStyle {
  return deepMerge(baseStyle(), s as never)
}

function initialDesign(): Design {
  const t = BUILTIN_TEMPLATES[0]
  return { templateId: t.id, style: structuredClone(t.style), content: demoContent(t.demoId), isDemo: true }
}

const saved = load()

const initial: Persisted = {
  design: saved.design ? { ...saved.design, style: normalizeStyle(saved.design.style) } : initialDesign(),
  brand: { ...DEFAULT_BRAND, ...(saved.brand ?? {}) },
  userTemplates: (saved.userTemplates ?? []).map((t) => ({ ...t, style: normalizeStyle(t.style) })),
  userPartners: saved.userPartners ?? [],
  uiTheme: saved.uiTheme ?? 'dark',
  previewMine: saved.previewMine ?? false,
  removalQuality: saved.removalQuality ?? 'medium',
  exportScale: saved.exportScale ?? 1,
  exportFormat: saved.exportFormat ?? 'png',
}

export const useEditor = create<EditorState>(() => ({
  ...initial,
  selection: null,
  editing: null,
  past: [],
  future: [],
  fonts: null,
  fontsVersion: 0,
  task: null,
  toasts: [],
  dialog: null,
  libraryOpen: true,
}))

const get = useEditor.getState
const set = useEditor.setState

/* ------------------------------ الحفظ ------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | undefined
useEditor.subscribe((s, prev) => {
  if (
    s.design === prev.design &&
    s.brand === prev.brand &&
    s.userTemplates === prev.userTemplates &&
    s.userPartners === prev.userPartners &&
    s.uiTheme === prev.uiTheme &&
    s.previewMine === prev.previewMine &&
    s.removalQuality === prev.removalQuality &&
    s.exportScale === prev.exportScale &&
    s.exportFormat === prev.exportFormat
  )
    return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const p: Persisted = {
      design: s.design,
      brand: s.brand,
      userTemplates: s.userTemplates,
      userPartners: s.userPartners,
      uiTheme: s.uiTheme,
      previewMine: s.previewMine,
      removalQuality: s.removalQuality,
      exportScale: s.exportScale,
      exportFormat: s.exportFormat,
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p))
    } catch {
      /* ممتلئ */
    }
  }, 400)
})

/* ------------------------------ السجل ------------------------------ */

let lastCommit = { key: '', at: 0 }

/** تعديل التصميم مع حفظ نقطة تراجع (التعديلات المتتالية بنفس المفتاح تُدمج) */
export function change(fn: (d: Design) => void, key = '') {
  const s = get()
  const next = structuredClone(s.design)
  fn(next)
  const now = Date.now()
  const merge = key !== '' && key === lastCommit.key && now - lastCommit.at < 700
  lastCommit = { key, at: now }
  set({
    design: next,
    past: merge ? s.past : [...s.past.slice(-120), s.design],
    future: [],
  })
}

/** تعديل المحتوى (نصوص/صور) — يحوّل المحتوى التجريبي لمحتوى المستخدم فيبقى عند تبديل القالب */
export function changeContent(fn: (c: AdContent) => void, key = '') {
  change((d) => {
    fn(d.content)
    d.isDemo = false
  }, key)
}

/** تعديل حي بدون سجل (أثناء السحب) — استدعِ beginLive قبلها */
export function live(fn: (d: Design) => void) {
  const next = structuredClone(get().design)
  fn(next)
  set({ design: next })
}

export function beginLive() {
  const s = get()
  lastCommit = { key: '', at: 0 }
  set({ past: [...s.past.slice(-120), s.design], future: [] })
}

export function undo() {
  const s = get()
  const prev = s.past[s.past.length - 1]
  if (!prev) return
  set({ design: prev, past: s.past.slice(0, -1), future: [s.design, ...s.future], editing: null })
}

export function redo() {
  const s = get()
  const next = s.future[0]
  if (!next) return
  set({ design: next, future: s.future.slice(1), past: [...s.past, s.design], editing: null })
}

/* ------------------------------ القوالب ------------------------------ */

export function applyTemplate(id: string) {
  const s = get()
  const t = findTemplate(s, id)
  if (!t) return
  change((d) => {
    d.templateId = t.id
    d.style = structuredClone(t.style)
    if (d.isDemo) d.content = templateDemo(t)
  })
  set({ editing: null })
}

export function stepTemplate(dir: 1 | -1) {
  const s = get()
  const list = allTemplates(s)
  const i = list.findIndex((t) => t.id === s.design.templateId)
  const n = list[(i + dir + list.length) % list.length]
  applyTemplate(n.id)
}

/** «تفريغ القالب»: إزالة المحتوى التجريبي والبدء بالتعديل داخله */
export function emptyTemplate() {
  change((d) => {
    d.content = placeholderContent(d.content.partnerLogoId)
    d.isDemo = false
  })
  set({ selection: null, editing: null })
}

/** إعادة المحتوى التجريبي للقالب الحالي */
export function restoreDemo() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t) return
  change((d) => {
    d.content = templateDemo(t)
    d.isDemo = true
  })
}

/** إعادة نمط القالب لأصله (تجاهل التعديلات على التصميم) */
export function resetStyle() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t) return
  change((d) => {
    d.style = structuredClone(t.style)
  })
}

export function saveAsTemplate(name: string, withContent: boolean): Template {
  const s = get()
  const id = `user-${Date.now().toString(36)}`
  const base = findTemplate(s, s.design.templateId)
  const t: Template = {
    id,
    name,
    nameEn: name,
    category: 'ads',
    builtIn: false,
    style: structuredClone(s.design.style),
    demoId: base?.demoId ?? 'am-c4000',
    demo: withContent ? cloneContent(s.design.content) : undefined,
    tags: ['قالبي'],
  }
  set({ userTemplates: [...s.userTemplates, t] })
  change((d) => {
    d.templateId = id
  })
  return t
}

export function updateUserTemplate(id: string) {
  const s = get()
  set({
    userTemplates: s.userTemplates.map((t) => (t.id === id ? { ...t, style: structuredClone(s.design.style) } : t)),
  })
}

export function deleteUserTemplate(id: string) {
  const s = get()
  set({ userTemplates: s.userTemplates.filter((t) => t.id !== id) })
}

export function renameUserTemplate(id: string, name: string) {
  const s = get()
  set({ userTemplates: s.userTemplates.map((t) => (t.id === id ? { ...t, name, nameEn: name } : t)) })
}

export function newBlankTemplate() {
  change((d) => {
    d.templateId = 'blank'
    d.style = blankTemplateStyle()
  })
}

/* ------------------------------ عام ------------------------------ */

export function select(sel: Selection | null) {
  set({ selection: sel, editing: sel?.kind === 'text' && get().editing === sel.key ? get().editing : null })
}

export function setEditing(key: TextKey | null) {
  set({ editing: key, selection: key ? { kind: 'text', key } : get().selection })
}

let toastSeq = 0
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3600) {
  const id = ++toastSeq
  set({ toasts: [...get().toasts, { id, text, kind }] })
  setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), ms)
}

export function setTask(task: Task | null) {
  set({ task })
}

export function setBrand(patch: Partial<BrandConfig>) {
  set({ brand: { ...get().brand, ...patch } })
}

export function allPartners(s: Pick<EditorState, 'userPartners'>): PartnerLogo[] {
  return [...BUILTIN_PARTNERS, ...s.userPartners]
}

export function markEdited() {
  if (get().design.isDemo) change((d) => void (d.isDemo = false))
}

export { DEFAULT_CLEANUP }

import { create } from 'zustand'
import { DEFAULT_BRAND, BUILTIN_PARTNERS } from '../model/brand'
import { BUILTIN_TEMPLATES, blankTemplateStyle, deepMerge, baseStyle, makeExtraStyle } from '../model/templates'
import { cloneContent, emptyContent } from '../model/demo'
import type {
  AdContent,
  BrandConfig,
  Design,
  ExtraText,
  PartnerLogo,
  Selection,
  Template,
  TemplateStyle,
  TextKey,
  TextStyle,
} from '../model/types'
import type { FontStatus } from '../lib/fonts'
import type { RemovalQuality } from '../lib/bgRemoval'
import { bridge } from '../lib/bridge'

/* ------------------------------------------------------------------
 * حالة البرنامج: الصفحة الرئيسية / المحرر + سجل التراجع + الحفظ التلقائي
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

export type View = 'home' | 'editor'
export type InspectorTab = 'elements' | 'design' | 'props'
export type Dialog = null | 'settings' | 'saveTemplate' | 'shortcuts' | 'cutout'

interface Persisted {
  design: Design
  brand: BrandConfig
  userTemplates: Template[]
  userPartners: PartnerLogo[]
  /** تعديلات المستخدم على الشكل الافتراضي للقوالب المدمجة */
  overrides: Record<string, TemplateStyle>
  uiTheme: 'dark' | 'light'
  removalQuality: RemovalQuality
  exportScale: 1 | 2
  exportFormat: 'png' | 'jpg'
}

export interface EditorState extends Persisted {
  view: View
  selection: Selection | null
  editing: string | null
  past: Design[]
  future: Design[]
  fonts: FontStatus | null
  fontsVersion: number
  task: Task | null
  toasts: Toast[]
  dialog: Dialog
  gallery: boolean
  tab: InspectorTab
}

const LS_KEY = 'lkgt-studio:v2'

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

/** النمط الفعلي للقالب = تعديلات المستخدم إن وُجدت وإلا الأصلي */
export function templateStyle(s: Pick<EditorState, 'overrides'>, t: Template): TemplateStyle {
  return s.overrides[t.id] ?? t.style
}

function normalizeStyle(s: TemplateStyle): TemplateStyle {
  return deepMerge(baseStyle(), s as never)
}

function normalizeContent(c: AdContent): AdContent {
  return { ...c, extras: (c.extras ?? []).map((e) => ({ ...e, style: deepMerge(makeExtraStyle(), e.style as never) })) }
}

function initialDesign(): Design {
  const t = BUILTIN_TEMPLATES[0]
  return { templateId: t.id, style: structuredClone(t.style), content: emptyContent(), touched: false }
}

const saved = load()

const initial: Persisted = {
  design: saved.design
    ? { ...saved.design, touched: !!saved.design.touched, style: normalizeStyle(saved.design.style), content: normalizeContent(saved.design.content) }
    : initialDesign(),
  brand: { ...DEFAULT_BRAND, ...(saved.brand ?? {}) },
  userTemplates: (saved.userTemplates ?? []).map((t) => ({ ...t, style: normalizeStyle(t.style) })),
  userPartners: saved.userPartners ?? [],
  overrides: Object.fromEntries(Object.entries(saved.overrides ?? {}).map(([k, v]) => [k, normalizeStyle(v)])),
  uiTheme: saved.uiTheme ?? 'dark',
  removalQuality: saved.removalQuality ?? 'medium',
  exportScale: saved.exportScale ?? 1,
  exportFormat: saved.exportFormat ?? 'png',
}

export const useEditor = create<EditorState>(() => ({
  ...initial,
  view: 'home',
  selection: null,
  editing: null,
  past: [],
  future: [],
  fonts: null,
  fontsVersion: 0,
  task: null,
  toasts: [],
  dialog: null,
  gallery: false,
  tab: 'elements',
}))

const get = useEditor.getState
const set = useEditor.setState

/* ------------------------------ الحفظ ------------------------------ */

const PERSIST_KEYS: (keyof Persisted)[] = [
  'design',
  'brand',
  'userTemplates',
  'userPartners',
  'overrides',
  'uiTheme',
  'removalQuality',
  'exportScale',
  'exportFormat',
]

let saveTimer: ReturnType<typeof setTimeout> | undefined
useEditor.subscribe((s, prev) => {
  if (PERSIST_KEYS.every((k) => s[k] === prev[k])) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const p = Object.fromEntries(PERSIST_KEYS.map((k) => [k, s[k]]))
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
  const merge = key !== '' && key === lastCommit.key && now - lastCommit.at < 900
  lastCommit = { key, at: now }
  set({
    design: next,
    past: merge ? s.past : [...s.past.slice(-150), s.design],
    future: [],
  })
}

/** تعديل المحتوى (نصوص/صور) — يعني أن المستخدم بدأ العمل */
export function changeContent(fn: (c: AdContent) => void, key = '') {
  change((d) => {
    fn(d.content)
    d.touched = true
  }, key)
}

export function changeStyle(fn: (s: TemplateStyle) => void, key = '') {
  change((d) => fn(d.style), key)
}

export function live(fn: (d: Design) => void) {
  const next = structuredClone(get().design)
  fn(next)
  next.touched = true
  set({ design: next })
}

export function beginLive() {
  const s = get()
  lastCommit = { key: '', at: 0 }
  set({ past: [...s.past.slice(-150), s.design], future: [] })
}

function fixSelection(d: Design, sel: Selection | null): Selection | null {
  if (!sel) return null
  if (sel.kind === 'extra' && !d.content.extras?.some((e) => e.id === sel.id)) return null
  if (sel.kind === 'decor' && !d.style.decor.some((x) => x.id === sel.id)) return null
  if (sel.kind === 'product' && !d.content.product) return null
  return sel
}

export function undo() {
  const s = get()
  const prev = s.past[s.past.length - 1]
  if (!prev) return
  lastCommit = { key: '', at: 0 }
  set({ design: prev, past: s.past.slice(0, -1), future: [s.design, ...s.future], editing: null, selection: fixSelection(prev, s.selection) })
}

export function redo() {
  const s = get()
  const next = s.future[0]
  if (!next) return
  lastCommit = { key: '', at: 0 }
  set({ design: next, future: s.future.slice(1), past: [...s.past, s.design], editing: null, selection: fixSelection(next, s.selection) })
}

/* ------------------------------ التنقل ------------------------------ */

export function goHome() {
  set({ view: 'home', selection: null, editing: null, gallery: false })
}

export function continueDesign() {
  set({ view: 'editor', selection: null, editing: null, tab: 'elements' })
}

/** فتح قالب من الصفحة الرئيسية: تصميم جديد فارغ */
export function openTemplate(id: string) {
  const s = get()
  const t = findTemplate(s, id)
  if (!t) return
  set({
    design: { templateId: t.id, style: structuredClone(templateStyle(s, t)), content: emptyContent(), touched: false },
    past: [],
    future: [],
    view: 'editor',
    selection: null,
    editing: null,
    tab: 'elements',
    gallery: false,
  })
}

/** تبديل القالب داخل المحرر — يبقى المحتوى كما هو */
export function applyTemplate(id: string) {
  const s = get()
  const t = findTemplate(s, id)
  if (!t) return
  change((d) => {
    d.templateId = t.id
    d.style = structuredClone(templateStyle(s, t))
  })
  set({ editing: null, selection: null })
}

export function stepTemplate(dir: 1 | -1) {
  const s = get()
  const list = allTemplates(s)
  const i = list.findIndex((t) => t.id === s.design.templateId)
  applyTemplate(list[(i + dir + list.length) % list.length].id)
}

/** مسح المحتوى والعودة للنصوص النائبة */
export function clearContent() {
  change((d) => {
    d.content = emptyContent(null)
    d.touched = false
  })
  set({ selection: null, editing: null })
}

/** إعادة النمط لآخر حفظ افتراضي للقالب */
export function resetStyle() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t) return
  change((d) => {
    d.style = structuredClone(templateStyle(s, t))
  })
}

/** جعل التصميم الحالي هو الشكل الافتراضي للقالب (المدمج أو قوالبك) */
export function saveTemplateDefault() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t) return false
  if (t.builtIn) set({ overrides: { ...s.overrides, [t.id]: structuredClone(s.design.style) } })
  else set({ userTemplates: s.userTemplates.map((x) => (x.id === t.id ? { ...x, style: structuredClone(s.design.style) } : x)) })
  return true
}

/** حذف تعديلاتك والعودة لتصميم القالب الأصلي */
export function restoreTemplateOriginal() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t || !t.builtIn) return
  const { [t.id]: _drop, ...rest } = s.overrides
  set({ overrides: rest })
  change((d) => {
    d.style = structuredClone(t.style)
  })
}

export function saveAsTemplate(name: string): Template {
  const s = get()
  const id = `user-${Date.now().toString(36)}`
  const t: Template = {
    id,
    name,
    nameEn: name,
    category: 'ads',
    builtIn: false,
    style: structuredClone(s.design.style),
    tags: ['قالبي'],
  }
  set({ userTemplates: [...s.userTemplates, t] })
  change((d) => {
    d.templateId = id
  })
  return t
}

export function deleteUserTemplate(id: string) {
  const s = get()
  set({ userTemplates: s.userTemplates.filter((t) => t.id !== id) })
}

export function renameUserTemplate(id: string, name: string) {
  const s = get()
  set({ userTemplates: s.userTemplates.map((t) => (t.id === id ? { ...t, name, nameEn: name } : t)) })
}

export function duplicateTemplate(id: string) {
  const s = get()
  const t = findTemplate(s, id)
  if (!t) return
  const copy: Template = {
    ...t,
    id: `user-${Date.now().toString(36)}`,
    name: `${t.name} (نسخة)`,
    nameEn: `${t.nameEn} copy`,
    builtIn: false,
    style: structuredClone(templateStyle(s, t)),
    tags: ['قالبي'],
  }
  set({ userTemplates: [...s.userTemplates, copy] })
}

/** قالب جديد فارغ يُفتح مباشرة في المحرر */
export function newBlankTemplate() {
  set({
    design: { templateId: 'blank', style: blankTemplateStyle(), content: emptyContent(), touched: false },
    past: [],
    future: [],
    view: 'editor',
    selection: null,
    editing: null,
    tab: 'design',
    gallery: false,
  })
}

/* ------------------------------ النصوص ------------------------------ */

export function getTextStyle(d: Design, sel: Selection | null): TextStyle | null {
  if (!sel) return null
  if (sel.kind === 'text') return d.style.text.items[sel.key]
  if (sel.kind === 'extra') return d.content.extras?.find((e) => e.id === sel.id)?.style ?? null
  return null
}

export function changeTextStyle(sel: Selection, fn: (st: TextStyle) => void, key = '') {
  change((d) => {
    const st = getTextStyle(d, sel)
    if (st) fn(st)
  }, `ts-${sel.kind}-${sel.kind === 'text' ? sel.key : sel.kind === 'extra' ? sel.id : ''}-${key}`)
}

export function addExtraText() {
  const id = `x_${Date.now().toString(36)}`
  const ex: ExtraText = { id, text: 'نص جديد', style: makeExtraStyle() }
  change((d) => {
    d.content.extras = [...(d.content.extras ?? []), ex]
    d.touched = true
  })
  set({ selection: { kind: 'extra', id }, tab: 'props' })
  return id
}

export function removeExtraText(id: string) {
  change((d) => {
    d.content.extras = (d.content.extras ?? []).filter((e) => e.id !== id)
  })
  if (get().selection?.kind === 'extra') set({ selection: null })
}

export function duplicateExtraText(id: string) {
  const nid = `x_${Date.now().toString(36)}`
  change((d) => {
    const src = d.content.extras?.find((e) => e.id === id)
    if (!src) return
    const c: ExtraText = JSON.parse(JSON.stringify(src))
    c.id = nid
    c.style.fx = (c.style.fx ?? 200) + 30
    c.style.fy = (c.style.fy ?? 600) + 30
    d.content.extras!.push(c)
  })
  set({ selection: { kind: 'extra', id: nid } })
}

/** كسر البطاقات: فصل العناصر عن الكتلة مع بقائها في مكانها الحالي */
export function detachTexts(keys: TextKey[]) {
  const pos: Partial<Record<TextKey, { x: number; y: number; w: number }>> = {}
  for (const k of keys) {
    const m = bridge.measure(k)
    if (m) pos[k] = m
  }
  change((d) => {
    for (const k of keys) {
      const p = pos[k]
      const st = d.style.text.items[k]
      if (!p || !st.visible) continue
      st.free = true
      st.fx = Math.round(p.x)
      st.fy = Math.round(p.y)
      st.fw = Math.round(p.w)
      st.align = st.align && st.align !== 'inherit' ? st.align : 'center'
      st.marginTop = 0
      // العناصر ذات العرض التلقائي تُثبَّت بعرضها الحالي
      st.decoStyle.full = true
    }
  })
}

export function attachTexts(keys: TextKey[]) {
  change((d) => {
    for (const k of keys) d.style.text.items[k].free = false
  })
}

/* ------------------------------ عام ------------------------------ */

export function select(sel: Selection | null, goProps = true) {
  const cur = get()
  const keepEditing = cur.editing && sel && ((sel.kind === 'text' && sel.key === cur.editing) || (sel.kind === 'extra' && sel.id === cur.editing))
  set({ selection: sel, editing: keepEditing ? cur.editing : null, ...(sel && goProps ? { tab: 'props' as InspectorTab } : {}) })
}

export function setEditing(id: string | null) {
  if (!id) return set({ editing: null })
  const sel: Selection = id.startsWith('x_') ? { kind: 'extra', id } : { kind: 'text', key: id as TextKey }
  set({ editing: id, selection: sel, tab: 'props' })
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

export { cloneContent }

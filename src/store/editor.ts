import { create } from 'zustand'
import { DEFAULT_BRAND, BUILTIN_PARTNERS, RED } from '../model/brand'
import { DEFAULT_ORDER, blankTemplateStyle, deepMerge, baseStyle, makeExtraStyle } from '../model/templates'
import { BUILTIN_TEMPLATES } from '../model/registry'
import { categoryDef } from '../model/categories'
import { cloneContent, emptyContent } from '../model/demo'
import type {
  AdContent,
  BrandKit,
  Canvas,
  CategoryId,
  DecorItem,
  Design,
  ExtraText,
  PartnerLogo,
  Selection,
  Template,
  TemplateStyle,
  TextKey,
  TextStyle,
} from '../model/types'
import { DEFAULT_CANVAS, canvasOf } from '../model/types'
import { canvasFromFormat } from '../model/formats'
import type { FontStatus } from '../lib/fonts'
import type { RemovalQuality } from '../lib/bgRemoval'
import { bridge } from '../lib/bridge'
import { LKGT_KIT, themedStyle } from '../lib/kits'
import { makeRecolorer, mapColors } from '../lib/color'
import { resizeDesign, resizeStyle } from '../lib/resize'
import { getCutout } from '../lib/cutout'

/* ------------------------------------------------------------------
 * حالة البرنامج: مشروع = عدة شرائح (تصاميم) + سجل تراجع + حفظ تلقائي
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
export type Dialog =
  | null
  | 'settings'
  | 'saveTemplate'
  | 'shortcuts'
  | 'cutout'
  | 'batch'
  | 'export'
  | 'versions'
  | 'kits'
  | 'check'
  | 'suggest'
  | 'copy'
  | 'reference'
  | 'retouch'
  | 'calendar'
  | 'review'
  | 'sizes'
  | 'commands'
  | 'carousel'
  | 'palette'
  | 'guide'
export type LibraryPanel = null | 'text' | 'stickers' | 'qr' | 'images' | 'products'

export interface TextPreset {
  id: string
  name: string
  style: Partial<TextStyle>
}

export interface LibraryItem {
  id: string
  name: string
  /** أصل الصورة المصدر */
  assetId: string
  maskAssetId: string | null
  thumb: string
  w: number
  h: number
  at: number
}

export interface CalendarEntry {
  id: string
  date: string
  title: string
  caption: string
  status: 'idea' | 'design' | 'ready' | 'published'
  projectId?: string
  projectName?: string
  thumb?: string
}

export interface Prefs {
  aiKey: string
  aiModel: string
  nameTemplate: string
  sizesToExport: string[]
  shortcuts: Record<string, string>
  brandLock: { on: boolean; pin: string }
  homeFormat: string
  guides: boolean
  showSafe: boolean
  showGrid: boolean
  /** فحص جودة تلقائي قبل التصدير */
  checkBeforeExport: boolean
}

const DEFAULT_PREFS: Prefs = {
  aiKey: '',
  aiModel: 'claude-haiku-4-5',
  nameTemplate: 'LKGT - {title} - {template}',
  sizesToExport: ['post', 'story', 'square'],
  shortcuts: {},
  brandLock: { on: false, pin: '' },
  homeFormat: 'post',
  guides: true,
  showSafe: false,
  showGrid: false,
  checkBeforeExport: true,
}

export interface Snap {
  design: Design
  slides: Design[]
  slideIndex: number
}

export type Clip = { kind: 'style'; style: Partial<TextStyle> } | { kind: 'object'; item: DecorItem } | { kind: 'extra'; item: ExtraText }

interface Persisted {
  design: Design
  /** كل الشرائح (نسخة الشريحة الحالية فيها قد تكون قديمة — انظر syncedSlides) */
  slides: Design[]
  slideIndex: number
  projectId: string
  projectName: string
  projectCreated: number
  brand: BrandKit
  kits: BrandKit[]
  userTemplates: Template[]
  userPartners: PartnerLogo[]
  /** تعديلات المستخدم على الشكل الافتراضي للقوالب المدمجة */
  overrides: Record<string, TemplateStyle>
  uiTheme: 'dark' | 'light'
  removalQuality: RemovalQuality
  exportScale: 1 | 2
  exportFormat: 'png' | 'jpg'
  favorites: string[]
  textPresets: TextPreset[]
  library: LibraryItem[]
  calendar: CalendarEntry[]
  prefs: Prefs
}

export interface EditorState extends Persisted {
  view: View
  selection: Selection | null
  /** التحديد المتعدد (يشمل التحديد الأساسي عند وجود أكثر من عنصر) */
  multi: Selection[]
  editing: string | null
  past: Snap[]
  future: Snap[]
  fonts: FontStatus | null
  fontsVersion: number
  task: Task | null
  toasts: Toast[]
  dialog: Dialog
  gallery: boolean
  library_: LibraryPanel
  tab: InspectorTab
  clip: Clip | null
  homeCat: CategoryId
  /** لوحة الخصائص ظاهرة (تُستخدم فقط في الشاشات الضيقة) */
  inspOpen: boolean
  /** آخر مرة حُفظ فيها المشروع تلقائياً */
  savedAt: number
}

const LS_KEY = 'lkgt-studio:v3'
const LS_OLD = 'lkgt-studio:v2'

function load(): Partial<Persisted> & { kitId_?: string } {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? localStorage.getItem(LS_OLD)
    return raw ? JSON.parse(raw) : {}
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

/** نمط القالب بعد تطبيق ألوان مجموعة الهوية الفعّالة */
export function styleFor(s: Pick<EditorState, 'overrides' | 'brand'>, t: Template): TemplateStyle {
  return themedStyle(templateStyle(s, t), s.brand, t.primary ?? RED)
}

export function stripCarry(style: TemplateStyle): TemplateStyle {
  return { ...style, decor: style.decor.map((d) => (d.carry ? { ...d, carry: false } : d)) }
}

function normalizeStyle(s: TemplateStyle): TemplateStyle {
  const out = deepMerge(baseStyle(), s as never)
  // مفاتيح نصوص جديدة (سعر قديم، خصم، زر) تُضاف لنمط محفوظ سابقاً
  for (const k of DEFAULT_ORDER) if (!out.text.order.includes(k)) out.text.order = [...out.text.order, k]
  out.decor = (out.decor ?? []).map((d) => ({ ...d, layer: d.layer ?? 'back' }))
  return out
}

function normalizeContent(c: AdContent): AdContent {
  const ph = categoryDef('ads').placeholders
  return {
    ...c,
    texts: { ...c.texts, oldPrice: c.texts.oldPrice ?? '', discount: c.texts.discount ?? '', cta: c.texts.cta ?? '', features: c.texts.features ?? [...ph.features] },
    answer: c.answer ?? null,
    extras: (c.extras ?? []).map((e) => ({ ...e, style: deepMerge(makeExtraStyle(), e.style as never) })),
  }
}

export function normalizeDesign(d: Design): Design {
  return { ...d, touched: !!d.touched, category: d.category ?? 'ads', style: normalizeStyle(d.style), content: normalizeContent(d.content) }
}

function normalizeKit(k: Partial<BrandKit>): BrandKit {
  return {
    ...structuredClone(LKGT_KIT),
    ...k,
    logo: { ...DEFAULT_BRAND.logo, ...(k.logo ?? {}) },
    partner: { ...DEFAULT_BRAND.partner, ...(k.partner ?? {}) },
    contact: { ...DEFAULT_BRAND.contact, ...(k.contact ?? {}) },
  }
}

const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

function initialDesign(): Design {
  const t = BUILTIN_TEMPLATES[0]
  return { templateId: t.id, style: structuredClone(t.style), content: emptyContent(), touched: false, category: 'ads', canvas: DEFAULT_CANVAS }
}

const saved = load()

const initialKits: BrandKit[] = saved.kits?.length ? saved.kits.map(normalizeKit) : [normalizeKit({ ...(saved.brand ?? {}), id: 'lkgt', name: 'LKGT' })]
const initialKitId = saved.kitId_ && initialKits.some((k) => k.id === saved.kitId_) ? saved.kitId_ : initialKits[0].id
const initialDesignState = saved.design ? normalizeDesign(saved.design) : initialDesign()
const initialSlides = saved.slides?.length ? saved.slides.map(normalizeDesign) : [initialDesignState]

const initial: Persisted = {
  design: initialDesignState,
  slides: initialSlides,
  slideIndex: Math.min(saved.slideIndex ?? 0, initialSlides.length - 1),
  projectId: saved.projectId ?? newId('p'),
  projectName: saved.projectName ?? '',
  projectCreated: saved.projectCreated ?? Date.now(),
  brand: initialKits.find((k) => k.id === initialKitId) ?? initialKits[0],
  kits: initialKits,
  userTemplates: (saved.userTemplates ?? []).map((t) => ({ ...t, style: normalizeStyle(t.style) })),
  userPartners: saved.userPartners ?? [],
  overrides: Object.fromEntries(Object.entries(saved.overrides ?? {}).map(([k, v]) => [k, normalizeStyle(v)])),
  uiTheme: saved.uiTheme ?? 'dark',
  removalQuality: saved.removalQuality ?? 'medium',
  exportScale: saved.exportScale ?? 1,
  exportFormat: saved.exportFormat ?? 'png',
  favorites: saved.favorites ?? [],
  textPresets: saved.textPresets ?? [],
  library: saved.library ?? [],
  calendar: saved.calendar ?? [],
  prefs: { ...DEFAULT_PREFS, ...(saved.prefs ?? {}) },
}

export const useEditor = create<EditorState>(() => ({
  ...initial,
  view: 'home',
  selection: null,
  multi: [],
  editing: null,
  past: [],
  future: [],
  fonts: null,
  fontsVersion: 0,
  task: null,
  toasts: [],
  dialog: null,
  gallery: false,
  library_: null,
  tab: 'elements',
  clip: null,
  homeCat: 'ads',
  inspOpen: typeof window === 'undefined' ? true : window.innerWidth > 1000,
  savedAt: 0,
}))

const get = useEditor.getState
const set = useEditor.setState

/** خطافات تسجّلها وحدة المشاريع لحفظ العمل عند الانتقال */
export const hooks: { beforeReplace?: () => void } = {}

/* ------------------------------ الحفظ ------------------------------ */

export function syncedSlides(s: Pick<EditorState, 'slides' | 'slideIndex' | 'design'> = get()): Design[] {
  return s.slides.map((x, i) => (i === s.slideIndex ? s.design : x))
}

const PERSIST_KEYS: (keyof Persisted)[] = [
  'design',
  'slides',
  'slideIndex',
  'projectId',
  'projectName',
  'projectCreated',
  'brand',
  'kits',
  'userTemplates',
  'userPartners',
  'overrides',
  'uiTheme',
  'removalQuality',
  'exportScale',
  'exportFormat',
  'favorites',
  'textPresets',
  'library',
  'calendar',
  'prefs',
]

let saveTimer: ReturnType<typeof setTimeout> | undefined
useEditor.subscribe((s, prev) => {
  if (PERSIST_KEYS.every((k) => s[k] === prev[k])) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const p: Record<string, unknown> = Object.fromEntries(PERSIST_KEYS.map((k) => [k, s[k]]))
    p.slides = syncedSlides(s)
    p.kitId_ = s.brand.id
    // نحفظ نسخة الهوية الحالية داخل قائمة المجموعات
    p.kits = s.kits.map((k) => (k.id === s.brand.id ? s.brand : k))
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p))
    } catch {
      /* ممتلئ */
    }
  }, 400)
})

/* ------------------------------ السجل ------------------------------ */

let lastCommit = { key: '', at: 0 }

function snapOf(s: EditorState): Snap {
  return { design: s.design, slides: s.slides, slideIndex: s.slideIndex }
}

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
    past: merge ? s.past : [...s.past.slice(-150), snapOf(s)],
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
  set({ past: [...s.past.slice(-150), snapOf(s)], future: [] })
}

function fixSelection(d: Design, sel: Selection | null): Selection | null {
  if (!sel) return null
  if (sel.kind === 'extra' && !d.content.extras?.some((e) => e.id === sel.id)) return null
  if (sel.kind === 'decor' && !d.style.decor.some((x) => x.id === sel.id)) return null
  if (sel.kind === 'product' && !d.content.product) return null
  return sel
}

function restore(snap: Snap, s: EditorState, past: Snap[], future: Snap[]) {
  lastCommit = { key: '', at: 0 }
  set({
    design: snap.design,
    slides: snap.slides,
    slideIndex: snap.slideIndex,
    past,
    future,
    editing: null,
    selection: fixSelection(snap.design, s.selection),
    multi: [],
  })
}

export function undo() {
  const s = get()
  const prev = s.past[s.past.length - 1]
  if (!prev) return
  restore(prev, s, s.past.slice(0, -1), [snapOf(s), ...s.future])
}

export function redo() {
  const s = get()
  const next = s.future[0]
  if (!next) return
  restore(next, s, [...s.past, snapOf(s)], s.future.slice(1))
}

/* ------------------------------ الشرائح ------------------------------ */

export function switchSlide(i: number) {
  const s = get()
  if (i < 0 || i >= s.slides.length || i === s.slideIndex) return
  const all = syncedSlides(s)
  lastCommit = { key: '', at: 0 }
  set({ slides: all, slideIndex: i, design: all[i], selection: null, multi: [], editing: null })
}

function commitSlides(all: Design[], index: number) {
  const s = get()
  lastCommit = { key: '', at: 0 }
  set({
    slides: all,
    slideIndex: index,
    design: all[index],
    past: [...s.past.slice(-150), snapOf(s)],
    future: [],
    selection: null,
    multi: [],
    editing: null,
  })
}

/** إضافة شريحة جديدة بعد الحالية: فارغة بنفس التصميم أو نسخة منها */
export function addSlide(mode: 'blank' | 'duplicate' = 'blank') {
  const s = get()
  const all = syncedSlides(s)
  const cur = all[s.slideIndex]
  let next: Design
  if (mode === 'duplicate') {
    next = structuredClone(cur)
  } else {
    next = { ...structuredClone(cur), content: { ...emptyContent(cur.content.partnerLogoId, cur.category ?? 'ads') }, touched: false }
    next.style.decor = next.style.decor.filter((d) => !d.carry)
  }
  all.splice(s.slideIndex + 1, 0, next)
  commitSlides(all, s.slideIndex + 1)
}

export function duplicateSlide(i: number) {
  const s = get()
  const all = syncedSlides(s)
  if (!all[i]) return
  all.splice(i + 1, 0, structuredClone(all[i]))
  commitSlides(all, i + 1)
}

export function deleteSlide(i: number) {
  const s = get()
  const all = syncedSlides(s)
  if (all.length <= 1 || !all[i]) return
  all.splice(i, 1)
  const cur = s.slideIndex > i ? s.slideIndex - 1 : s.slideIndex
  commitSlides(all, Math.max(0, Math.min(cur, all.length - 1)))
}

export function moveSlide(from: number, to: number) {
  const s = get()
  const all = syncedSlides(s)
  if (from === to || !all[from] || to < 0 || to >= all.length) return
  const [x] = all.splice(from, 1)
  all.splice(to, 0, x)
  let cur = s.slideIndex
  if (cur === from) cur = to
  else if (from < cur && to >= cur) cur -= 1
  else if (from > cur && to <= cur) cur += 1
  commitSlides(all, cur)
}

/** استبدال كل الشرائح (نص → شرائح، استعادة نسخة…) */
export function replaceSlides(all: Design[], index = 0) {
  commitSlides(all.map(normalizeDesign), Math.max(0, Math.min(index, all.length - 1)))
}

/** نسخ نمط الشريحة الحالية إلى بقية الشرائح مع بقاء محتواها */
export function applyStyleToAllSlides() {
  const s = get()
  const all = syncedSlides(s)
  const cur = all[s.slideIndex]
  const next = all.map((d, i) => (i === s.slideIndex ? d : { ...d, templateId: cur.templateId, style: structuredClone(cur.style), canvas: cur.canvas, primary: cur.primary }))
  commitSlides(next, s.slideIndex)
}

/* ------------------------------ المقاس ------------------------------ */

/** تغيير مقاس اللوحة لكل الشرائح مع إعادة الترتيب الذكية */
export async function setCanvas(to: Canvas) {
  const s = get()
  const all = syncedSlides(s)
  // نجهّز المنتجات ليُحسب موضعها بدقة
  await Promise.all(all.map((d) => (d.content.product ? getCutout(d.content.product) : null)))
  const next = all.map((d) => resizeDesign(d, to, get().brand))
  commitSlides(next, get().slideIndex)
}

export function setFormat(id: string) {
  return setCanvas(canvasFromFormat(id))
}

/* ------------------------------ التنقل ------------------------------ */

export function goHome() {
  hooks.beforeReplace?.()
  set({ view: 'home', selection: null, multi: [], editing: null, gallery: false, library_: null })
}

export function continueDesign() {
  set({ view: 'editor', selection: null, multi: [], editing: null, tab: 'elements' })
}

function freshProject(d: Design, name = ''): Partial<EditorState> {
  return {
    design: d,
    slides: [d],
    slideIndex: 0,
    projectId: newId('p'),
    projectName: name,
    projectCreated: Date.now(),
    past: [],
    future: [],
    view: 'editor',
    selection: null,
    multi: [],
    editing: null,
    tab: 'elements',
    gallery: false,
    library_: null,
  }
}

/** فتح قالب من الصفحة الرئيسية: مشروع جديد فارغ (بمقاس مختار) */
export function openTemplate(id: string, format?: string) {
  hooks.beforeReplace?.()
  const s = get()
  const t = findTemplate(s, id)
  if (!t) return
  const cv = canvasFromFormat(format ?? s.prefs.homeFormat)
  let style = structuredClone(styleFor(s, t))
  if (cv.w !== DEFAULT_CANVAS.w || cv.h !== DEFAULT_CANVAS.h) style = resizeStyle(style, DEFAULT_CANVAS, cv, s.brand)
  const d: Design = {
    templateId: t.id,
    style,
    content: emptyContent(null, t.category),
    touched: false,
    canvas: cv,
    category: t.category,
    primary: s.brand.recolor ? s.brand.primary : t.primary ?? RED,
  }
  set(freshProject(d))
}

/** نمط القالب مُطبَّقاً على تصميم قائم (مقاس اللوحة + هوية + عناصرك المضافة) — بدون تعديل الحالة */
export function templateStyleFor(s: EditorState, t: Template, d: Design): { style: TemplateStyle; primary: string } {
  const cv = canvasOf(d)
  let st = structuredClone(styleFor(s, t))
  if (cv.w !== DEFAULT_CANVAS.w || cv.h !== DEFAULT_CANVAS.h) st = resizeStyle(st, DEFAULT_CANVAS, cv, s.brand)
  st.decor = [...st.decor, ...d.style.decor.filter((x) => x.carry)]
  return { style: st, primary: s.brand.recolor ? s.brand.primary : t.primary ?? RED }
}

/** تبديل القالب داخل المحرر — يبقى المحتوى كما هو (وكذلك العناصر التي أضفتها) */
export function applyTemplate(id: string) {
  const s = get()
  const t = findTemplate(s, id)
  if (!t) return
  change((d) => {
    const r = templateStyleFor(s, t, d)
    d.templateId = t.id
    d.style = r.style
    d.primary = r.primary
    if (t.category !== (d.category ?? 'ads')) {
      if (!d.touched) {
        const keep = d.content.partnerLogoId
        d.content = { ...emptyContent(keep, t.category), extras: d.content.extras }
      }
      d.category = t.category
    }
  })
  set({ editing: null, selection: null, multi: [] })
}

export function stepTemplate(dir: 1 | -1) {
  const s = get()
  const cat = s.design.category ?? 'ads'
  const list = allTemplates(s).filter((t) => t.category === cat)
  if (!list.length) return
  const i = list.findIndex((t) => t.id === s.design.templateId)
  applyTemplate(list[(i + dir + list.length) % list.length].id)
}

/** مسح المحتوى والعودة للنصوص النائبة */
export function clearContent() {
  change((d) => {
    d.content = emptyContent(null, d.category ?? 'ads')
    d.touched = false
  })
  set({ selection: null, multi: [], editing: null })
}

/** إعادة النمط لآخر حفظ افتراضي للقالب (تبقى عناصرك المضافة) */
export function resetStyle() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t) return
  change((d) => {
    const cv = canvasOf(d)
    let st = structuredClone(styleFor(s, t))
    if (cv.w !== DEFAULT_CANVAS.w || cv.h !== DEFAULT_CANVAS.h) st = resizeStyle(st, DEFAULT_CANVAS, cv, s.brand)
    st.decor = [...st.decor, ...d.style.decor.filter((x) => x.carry)]
    d.style = st
  })
}

/** الحالة الحالية بمقاس القالب الأصلي (1080×1440) لحفظها كقالب */
function styleAtBase(d: Design, brand: BrandKit): TemplateStyle {
  const cv = canvasOf(d)
  const st = stripCarry(structuredClone(d.style))
  return cv.w === DEFAULT_CANVAS.w && cv.h === DEFAULT_CANVAS.h ? st : resizeStyle(st, cv, DEFAULT_CANVAS, brand)
}

/** جعل التصميم الحالي هو الشكل الافتراضي للقالب (المدمج أو قوالبك) */
export function saveTemplateDefault() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t) return false
  const st = styleAtBase(s.design, s.brand)
  if (t.builtIn) set({ overrides: { ...s.overrides, [t.id]: st } })
  else set({ userTemplates: s.userTemplates.map((x) => (x.id === t.id ? { ...x, style: st, primary: s.design.primary ?? RED } : x)) })
  return true
}

/** حذف تعديلاتك والعودة لتصميم القالب الأصلي */
export function restoreTemplateOriginal() {
  const s = get()
  const t = findTemplate(s, s.design.templateId)
  if (!t || !t.builtIn) return
  const { [t.id]: _drop, ...rest } = s.overrides
  set({ overrides: rest })
  resetStyle()
}

export function saveAsTemplate(name: string): Template {
  const s = get()
  const id = `user-${Date.now().toString(36)}`
  const t: Template = {
    id,
    name,
    nameEn: name,
    category: s.design.category ?? 'ads',
    builtIn: false,
    style: styleAtBase(s.design, s.brand),
    tags: ['قالبي'],
    primary: s.design.primary ?? RED,
  }
  set({ userTemplates: [...s.userTemplates, t] })
  change((d) => {
    d.templateId = id
    d.style = { ...d.style, decor: d.style.decor.map((x) => (x.carry ? { ...x, carry: false } : x)) }
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

export function toggleFavorite(id: string) {
  const s = get()
  set({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })
}

/** قالب جديد فارغ يُفتح مباشرة في المحرر */
export function newBlankTemplate(category: CategoryId = 'ads') {
  hooks.beforeReplace?.()
  const s = get()
  const cv = canvasFromFormat(s.prefs.homeFormat)
  let style = blankTemplateStyle()
  if (cv.w !== DEFAULT_CANVAS.w || cv.h !== DEFAULT_CANVAS.h) style = resizeStyle(style, DEFAULT_CANVAS, cv, s.brand)
  set({ ...freshProject({ templateId: 'blank', style, content: emptyContent(null, category), touched: false, canvas: cv, category, primary: RED }), tab: 'design' })
}

/** مشروع فارغ جديد بنفس القالب والمقاس */
export function newProjectLike() {
  hooks.beforeReplace?.()
  const s = get()
  const cur = s.design
  const d: Design = { ...structuredClone(cur), content: emptyContent(cur.content.partnerLogoId, cur.category ?? 'ads'), touched: false }
  d.style.decor = d.style.decor.filter((x) => !x.carry)
  set(freshProject(d))
}

/* ------------------------------ المشاريع ------------------------------ */

export function loadProject(p: { id: string; name: string; created: number; slides: Design[]; slideIndex?: number }) {
  hooks.beforeReplace?.()
  const all = p.slides.map(normalizeDesign)
  const i = Math.max(0, Math.min(p.slideIndex ?? 0, all.length - 1))
  set({
    design: all[i],
    slides: all,
    slideIndex: i,
    projectId: p.id,
    projectName: p.name,
    projectCreated: p.created,
    past: [],
    future: [],
    view: 'editor',
    selection: null,
    multi: [],
    editing: null,
    tab: 'elements',
    gallery: false,
    library_: null,
  })
}

export function renameProject(name: string) {
  set({ projectName: name })
}

/* ------------------------------ الهوية ------------------------------ */

export function setBrand(patch: Partial<BrandKit>) {
  const s = get()
  const brand = { ...s.brand, ...patch }
  set({ brand, kits: s.kits.map((k) => (k.id === brand.id ? brand : k)) })
}

export function switchKit(id: string) {
  const s = get()
  const k = s.kits.find((x) => x.id === id)
  if (!k) return
  set({ brand: k, kits: s.kits.map((x) => (x.id === s.brand.id ? s.brand : x)) })
}

export function addKitToStore(kit: BrandKit) {
  const s = get()
  set({ kits: [...s.kits.map((x) => (x.id === s.brand.id ? s.brand : x)), kit], brand: kit })
}

export function deleteKit(id: string) {
  const s = get()
  if (s.kits.length <= 1) return
  const kits = s.kits.filter((k) => k.id !== id)
  set({ kits, brand: s.brand.id === id ? kits[0] : s.brand })
}

/** إعادة صبغ التصميم الحالي (كل الشرائح) بلون رئيسي جديد */
export function recolorAll(primary: string) {
  const s = get()
  const all = syncedSlides(s).map((d) => {
    const fn = makeRecolorer(primary, d.primary ?? RED)
    if (!fn) return { ...d, primary }
    return { ...d, style: mapColors(d.style, fn), content: { ...d.content, extras: mapColors(d.content.extras ?? [], fn) }, primary }
  })
  commitSlides(all, s.slideIndex)
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

/** نص إضافي: يقبل تخصيص النص والنمط (للعناصر السريعة: سعر، خصم…) */
export function addExtraText(text = 'نص جديد', patch: Partial<TextStyle> = {}) {
  const id = `x_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`
  const cv = canvasOf(get().design)
  const base = makeExtraStyle()
  const fw = patch.fw ?? Math.min(700, cv.w - 160)
  const ex: ExtraText = {
    id,
    text,
    style: {
      ...base,
      fx: Math.round((cv.w - fw) / 2),
      fy: Math.round(cv.h * 0.48),
      fw,
      ...patch,
      decoStyle: { ...base.decoStyle, ...(patch.decoStyle ?? {}) },
    },
  }
  change((d) => {
    d.content.extras = [...(d.content.extras ?? []), ex]
    d.touched = true
  })
  set({ selection: { kind: 'extra', id }, multi: [], tab: 'props' })
  return id
}

export function removeExtraText(id: string) {
  change((d) => {
    d.content.extras = (d.content.extras ?? []).filter((e) => e.id !== id)
  })
  if (get().selection?.kind === 'extra') set({ selection: null, multi: [] })
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
  set({ selection: { kind: 'extra', id: nid }, multi: [] })
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

/* ------------------------------ الأنماط والحافظة ------------------------------ */

const STYLE_KEYS: (keyof TextStyle)[] = [
  'size', 'fit', 'maxSize', 'weightAr', 'weightLat', 'color', 'accent', 'uppercase', 'tracking', 'lineHeight', 'deco', 'decoStyle', 'opacity',
  'gradient', 'color2', 'gradAngle', 'strokeW', 'strokeColor', 'textShadow', 'shadowColor', 'curve', 'balance', 'strike', 'blend',
]

export function pickStyle(st: TextStyle): Partial<TextStyle> {
  const o: Partial<TextStyle> = {}
  for (const k of STYLE_KEYS) if (st[k] !== undefined) (o as Record<string, unknown>)[k] = structuredClone(st[k])
  return o
}

export function copyTextStyle() {
  const s = get()
  const st = getTextStyle(s.design, s.selection)
  if (!st) return false
  set({ clip: { kind: 'style', style: pickStyle(st) } })
  return true
}

export function pasteTextStyle(targets?: Selection[]) {
  const s = get()
  if (s.clip?.kind !== 'style') return false
  const clip = s.clip
  const list = (targets ?? (s.multi.length ? s.multi : s.selection ? [s.selection] : [])).filter((x) => x.kind === 'text' || x.kind === 'extra')
  if (!list.length) return false
  change((d) => {
    for (const sel of list) {
      const st = getTextStyle(d, sel)
      if (st) Object.assign(st, structuredClone(clip.style))
    }
  })
  return true
}

export function applyTextPresetTo(style: Partial<TextStyle>, targets?: Selection[]) {
  const s = get()
  const list = (targets ?? (s.multi.length ? s.multi : s.selection ? [s.selection] : [])).filter((x) => x.kind === 'text' || x.kind === 'extra')
  change((d) => {
    for (const sel of list) {
      const st = getTextStyle(d, sel)
      if (st) {
        const patch = structuredClone(style)
        if (patch.decoStyle) patch.decoStyle = { ...st.decoStyle, ...patch.decoStyle }
        Object.assign(st, patch)
      }
    }
  })
}

export function saveTextPreset(name: string) {
  const s = get()
  const st = getTextStyle(s.design, s.selection)
  if (!st) return
  set({ textPresets: [...s.textPresets, { id: newId('tp'), name, style: pickStyle(st) }] })
}

export function deleteTextPreset(id: string) {
  set({ textPresets: get().textPresets.filter((p) => p.id !== id) })
}

/* ------------------------------ عام ------------------------------ */

function sameSel(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'text' && b.kind === 'text') return a.key === b.key
  if ((a.kind === 'extra' && b.kind === 'extra') || (a.kind === 'decor' && b.kind === 'decor')) return a.id === b.id
  return true
}

/** تحديد عنصر. additive = إضافة/إزالة من التحديد المتعدد (Shift/Ctrl) */
export function select(sel: Selection | null, goProps = true, additive = false) {
  const cur = get()
  if (additive && sel) {
    const base = cur.multi.length ? cur.multi : cur.selection ? [cur.selection] : []
    const exists = base.some((x) => sameSel(x, sel))
    const next = exists ? base.filter((x) => !sameSel(x, sel)) : [...base, sel]
    set({ multi: next.length > 1 ? next : [], selection: next.length ? next[next.length - 1] : null, editing: null })
    return
  }
  const keepEditing = cur.editing && sel && ((sel.kind === 'text' && sel.key === cur.editing) || (sel.kind === 'extra' && sel.id === cur.editing))
  // النقر على عنصر ضمن تحديد متعدد يبقي التحديد (للسحب الجماعي)
  const inMulti = !!sel && cur.multi.some((x) => sameSel(x, sel))
  set({
    selection: sel,
    multi: inMulti ? cur.multi : [],
    editing: keepEditing ? cur.editing : null,
    ...(sel && goProps && !inMulti ? { tab: 'props' as InspectorTab } : {}),
  })
}

export function selectMany(list: Selection[]) {
  set({ multi: list.length > 1 ? list : [], selection: list.length ? list[list.length - 1] : null, editing: null, tab: 'props' })
}

export function setEditing(id: string | null) {
  if (!id) return set({ editing: null })
  const sel: Selection = id.startsWith('x_') ? { kind: 'extra', id } : { kind: 'text', key: id as TextKey }
  set({ editing: id, selection: sel, multi: [], tab: 'props' })
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

export function setPrefs(patch: Partial<Prefs>) {
  set({ prefs: { ...get().prefs, ...patch } })
}

export function allPartners(s: Pick<EditorState, 'userPartners'>): PartnerLogo[] {
  return [...BUILTIN_PARTNERS, ...s.userPartners]
}

export { cloneContent }

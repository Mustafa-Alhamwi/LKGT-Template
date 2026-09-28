import { addSlide, allTemplates, applyTemplate, deleteSlide, goHome, redo, setFormat, setPrefs, stepTemplate, switchSlide, toast, undo, useEditor } from '../store/editor'
import { FORMATS } from '../model/formats'
import { copySelection, deleteSelection, duplicateSelection, nextSlide, orderSelection, pasteClip, selectAll, toggleLockSelection } from '../store/actions'
import { copyTextStyle, pasteTextStyle } from '../store/editor'
import { exportCurrent } from './actions'

/* ------------------------------------------------------------------
 * سجل الأوامر: يغذي الاختصارات (قابلة للتخصيص) ولوحة الأوامر Ctrl+K
 * الاختصار يُكتب مثل: Ctrl+Shift+Z — والحرف يُقارن بموضع المفتاح (يعمل بأي لغة)
 * ------------------------------------------------------------------ */

export interface Command {
  id: string
  label: string
  group: string
  /** الاختصار الافتراضي */
  keys?: string
  keywords?: string
  run: () => void
  enabled?: () => boolean
}

const NAMED: Record<string, string> = {
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '/': 'Slash',
  ',': 'Comma',
  '.': 'Period',
  '=': 'Equal',
  '-': 'Minus',
  ';': 'Semicolon',
  "'": 'Quote',
  '\\': 'Backslash',
  '`': 'Backquote',
  Del: 'Delete',
  Esc: 'Escape',
  Space: 'Space',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
}

function codeOf(key: string): string {
  if (NAMED[key]) return NAMED[key]
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`
  if (/^[0-9]$/.test(key)) return `Digit${key}`
  return key
}

export function parseKeys(spec: string) {
  const parts = spec.split('+').map((p) => p.trim())
  const key = parts.pop() ?? ''
  const mods = new Set(parts.map((p) => p.toLowerCase()))
  return { ctrl: mods.has('ctrl') || mods.has('cmd'), shift: mods.has('shift'), alt: mods.has('alt'), code: codeOf(key) }
}

export function matchKey(e: KeyboardEvent, spec: string): boolean {
  const p = parseKeys(spec)
  return p.code === e.code && p.ctrl === (e.ctrlKey || e.metaKey) && p.shift === e.shiftKey && p.alt === e.altKey
}

export function formatKeys(spec: string): string {
  return spec.replace('Ctrl', 'Ctrl').replace(/Del\b/, 'Delete')
}

export function keysFor(c: Command): string | undefined {
  const o = useEditor.getState().prefs.shortcuts[c.id]
  return o === '' ? undefined : (o ?? c.keys)
}

const inEditor = () => useEditor.getState().view === 'editor'
const hasSel = () => !!useEditor.getState().selection || useEditor.getState().multi.length > 0

/** أوامر تسجّلها وحدات أخرى (أدوات ذكية، تصدير…) */
export const extraCommands: Command[] = []

/** كل الأوامر المتاحة (تُبنى عند الحاجة لتقرأ الحالة الحالية) */
export function buildCommands(): Command[] {
  const s = useEditor.getState()
  const list: Command[] = [
    { id: 'undo', label: 'تراجع', group: 'تحرير', keys: 'Ctrl+Z', run: undo, enabled: inEditor },
    { id: 'redo', label: 'إعادة', group: 'تحرير', keys: 'Ctrl+Y', run: redo, enabled: inEditor },
    { id: 'delete', label: 'حذف المحدد', group: 'تحرير', keys: 'Delete', run: deleteSelection, enabled: hasSel },
    { id: 'duplicate', label: 'تكرار المحدد', group: 'تحرير', keys: 'Ctrl+D', run: duplicateSelection, enabled: hasSel },
    { id: 'copy', label: 'نسخ العنصر', group: 'تحرير', keys: 'Ctrl+C', run: () => void copySelection(), enabled: hasSel },
    { id: 'paste', label: 'لصق العنصر', group: 'تحرير', keys: 'Ctrl+V', run: () => void pasteClip(), enabled: inEditor },
    { id: 'copyStyle', label: 'نسخ تنسيق النص', group: 'تحرير', keys: 'Ctrl+Alt+C', run: () => void (copyTextStyle() && toast('تم نسخ التنسيق', 'ok', 1400)), enabled: hasSel },
    { id: 'pasteStyle', label: 'لصق تنسيق النص', group: 'تحرير', keys: 'Ctrl+Alt+V', run: () => void pasteTextStyle(), enabled: hasSel },
    { id: 'selectAll', label: 'تحديد كل العناصر الحرّة', group: 'تحرير', keys: 'Ctrl+A', run: selectAll, enabled: inEditor },
    { id: 'lock', label: 'قفل / فتح العنصر', group: 'تحرير', keys: 'Ctrl+L', run: toggleLockSelection, enabled: hasSel },
    { id: 'forward', label: 'خطوة للأمام (طبقة)', group: 'تحرير', keys: ']', run: () => orderSelection('up'), enabled: hasSel },
    { id: 'backward', label: 'خطوة للخلف (طبقة)', group: 'تحرير', keys: '[', run: () => orderSelection('down'), enabled: hasSel },
    { id: 'toFront', label: 'إلى الأمام تماماً', group: 'تحرير', keys: 'Ctrl+]', run: () => orderSelection('front'), enabled: hasSel },
    { id: 'toBack', label: 'إلى الخلف تماماً', group: 'تحرير', keys: 'Ctrl+[', run: () => orderSelection('back'), enabled: hasSel },
    { id: 'export', label: 'تصدير التصميم', group: 'ملف', keys: 'Ctrl+E', run: () => void exportCurrent(), enabled: inEditor },
    { id: 'exportMenu', label: 'خيارات التصدير المتقدم…', group: 'ملف', keys: 'Ctrl+Shift+E', run: () => useEditor.setState({ dialog: 'export' }), enabled: inEditor },
    { id: 'home', label: 'العودة للرئيسية', group: 'تنقل', run: goHome, enabled: inEditor },
    { id: 'nextTpl', label: 'القالب التالي', group: 'تنقل', run: () => stepTemplate(1), enabled: inEditor },
    { id: 'prevTpl', label: 'القالب السابق', group: 'تنقل', run: () => stepTemplate(-1), enabled: inEditor },
    { id: 'tplDrawer', label: 'تغيير القالب…', group: 'تنقل', keys: 'Ctrl+T', run: () => useEditor.setState({ gallery: true }), enabled: inEditor },
    { id: 'nextSlide', label: 'الشريحة التالية', group: 'شرائح', keys: 'PageDown', run: () => nextSlide(1), enabled: inEditor },
    { id: 'prevSlide', label: 'الشريحة السابقة', group: 'شرائح', keys: 'PageUp', run: () => nextSlide(-1), enabled: inEditor },
    { id: 'newSlide', label: 'شريحة جديدة بنفس التصميم', group: 'شرائح', keys: 'Ctrl+M', run: () => addSlide('blank'), enabled: inEditor },
    { id: 'dupSlide', label: 'نسخ الشريحة الحالية', group: 'شرائح', run: () => addSlide('duplicate'), enabled: inEditor },
    { id: 'delSlide', label: 'حذف الشريحة الحالية', group: 'شرائح', run: () => deleteSlide(useEditor.getState().slideIndex), enabled: () => inEditor() && useEditor.getState().slides.length > 1 },
    { id: 'guides', label: 'تبديل الالتصاق الذكي', group: 'عرض', run: () => setPrefs({ guides: !useEditor.getState().prefs.guides }), enabled: inEditor },
    { id: 'grid', label: 'إظهار / إخفاء الشبكة', group: 'عرض', run: () => setPrefs({ showGrid: !useEditor.getState().prefs.showGrid }), enabled: inEditor },
    { id: 'safe', label: 'إظهار / إخفاء المناطق الآمنة', group: 'عرض', run: () => setPrefs({ showSafe: !useEditor.getState().prefs.showSafe }), enabled: inEditor },
    { id: 'theme', label: 'تبديل مظهر البرنامج (فاتح/داكن)', group: 'عرض', run: () => useEditor.setState({ uiTheme: useEditor.getState().uiTheme === 'dark' ? 'light' : 'dark' }) },
    { id: 'settings', label: 'الإعدادات', group: 'أدوات', keys: 'Ctrl+,', run: () => useEditor.setState({ dialog: 'settings' }) },
    { id: 'shortcuts', label: 'الاختصارات', group: 'أدوات', keys: 'Ctrl+/', run: () => useEditor.setState({ dialog: 'shortcuts' }) },
    { id: 'addText', label: 'إضافة نص', group: 'إضافة', run: () => useEditor.setState({ library_: 'text' }), enabled: inEditor },
    { id: 'addSticker', label: 'إضافة ملصق أو أيقونة', group: 'إضافة', run: () => useEditor.setState({ library_: 'stickers' }), enabled: inEditor },
    { id: 'addQr', label: 'إضافة QR أو باركود', group: 'إضافة', run: () => useEditor.setState({ library_: 'qr' }), enabled: inEditor },
    { id: 'addImage', label: 'إضافة صورة أو منتج إضافي', group: 'إضافة', run: () => useEditor.setState({ library_: 'images' }), enabled: inEditor },
    { id: 'addProduct', label: 'مكتبة المنتجات', group: 'إضافة', run: () => useEditor.setState({ library_: 'products' }), enabled: inEditor },
  ]
  for (const f of FORMATS) list.push({ id: `fmt-${f.id}`, label: `تحويل المقاس إلى ${f.name} (${f.sub})`, group: 'المقاس', keywords: 'حجم ستوري مربع size', run: () => void setFormat(f.id), enabled: inEditor })
  for (const t of allTemplates(s)) list.push({ id: `tpl-${t.id}`, label: `قالب: ${t.name}`, group: 'القوالب', keywords: `${t.nameEn} ${t.tags.join(' ')}`, run: () => applyTemplate(t.id), enabled: inEditor })
  void switchSlide
  return [...list, ...extraCommands]
}

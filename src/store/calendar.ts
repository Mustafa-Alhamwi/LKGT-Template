import { useEditor, type CalendarEntry } from './editor'

/* تقويم المحتوى: إدخالات (فكرة ← تصميم ← جاهز ← منشور) محفوظة مع الإعدادات */

export const STATUS: { id: CalendarEntry['status']; label: string; color: string }[] = [
  { id: 'idea', label: 'فكرة', color: '#8B8B98' },
  { id: 'design', label: 'قيد التصميم', color: '#4C9BFF' },
  { id: 'ready', label: 'جاهز للنشر', color: '#1FBF8F' },
  { id: 'published', label: 'منشور', color: '#B07CFF' },
]

const uid = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function addEntry(e: Partial<CalendarEntry> = {}): CalendarEntry {
  const entry: CalendarEntry = { id: uid(), date: isoDate(new Date()), title: '', caption: '', status: 'idea', ...e }
  useEditor.setState({ calendar: [...useEditor.getState().calendar, entry] })
  return entry
}

export function updateEntry(id: string, patch: Partial<CalendarEntry>) {
  useEditor.setState({ calendar: useEditor.getState().calendar.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
}

export function removeEntry(id: string) {
  useEditor.setState({ calendar: useEditor.getState().calendar.filter((e) => e.id !== id) })
}

/** نيّة فتح النافذة: إدخال جديد من التصميم الحالي أو تحديد إدخال */
export const calendarIntent: { addCurrent: boolean; select?: string } = { addCurrent: false }

export function openCalendar(opts: { addCurrent?: boolean; select?: string } = {}) {
  calendarIntent.addCurrent = !!opts.addCurrent
  calendarIntent.select = opts.select
  useEditor.setState({ dialog: 'calendar' })
}

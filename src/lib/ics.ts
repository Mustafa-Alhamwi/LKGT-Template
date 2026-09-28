import type { CalendarEntry } from '../store/editor'

/* تصدير التقويم بصيغة iCalendar (.ics) ليُفتح في Google/Apple/Outlook */

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 74) return line
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 73 : 74)) {
      out.push(cur)
      cur = ch
    } else cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

const STATUS_AR: Record<CalendarEntry['status'], string> = { idea: 'فكرة', design: 'قيد التصميم', ready: 'جاهز للنشر', published: 'منشور' }

export function buildIcs(entries: CalendarEntry[], name = 'LKGT Content Calendar'): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LKGT Studio//Content Calendar//AR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`]
  for (const e of entries) {
    const d = e.date.replace(/-/g, '')
    const next = new Date(e.date + 'T00:00:00')
    next.setDate(next.getDate() + 1)
    const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@lkgt-studio`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${esc(`${e.title || 'منشور'} [${STATUS_AR[e.status]}]`)}`,
      `DESCRIPTION:${esc(e.caption || '')}`,
      `STATUS:${e.status === 'published' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

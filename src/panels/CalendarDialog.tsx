import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, ExternalLink, FolderOpen, Plus, Share2, Trash2 } from 'lucide-react'
import { zipSync } from 'fflate'
import { Btn, Select } from '../ui/kit'
import { Modal } from './Dialogs'
import { allPartners, setTask, toast, useEditor, type CalendarEntry } from '../store/editor'
import { STATUS, addEntry, calendarIntent, isoDate, removeEntry, updateEntry } from '../store/calendar'
import { getProjectSlides, listProjects, makeThumb, openProjectById, saveProjectNow, type ProjectMeta } from '../store/projects'
import { buildIcs } from '../lib/ics'
import { copyText } from '../lib/clipboard'
import { downloadBlob, renderDesign } from '../lib/exporter'
import { titleOf } from '../lib/naming'

const close = () => useEditor.setState({ dialog: null })

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
const monthName = (d: Date) => new Intl.DateTimeFormat('ar-SY-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' }).format(d)
const longDate = (iso: string) => new Intl.DateTimeFormat('ar-SY-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T00:00:00'))
const statusOf = (s: CalendarEntry['status']) => STATUS.find((x) => x.id === s)!

function monthCells(first: Date): (Date | null)[] {
  // الأسبوع يبدأ يوم السبت
  const offset = (first.getDay() + 1) % 7
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= days; d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d))
  while (cells.length % 7) cells.push(null)
  return cells
}

/** مشاركة/تنزيل تصميم إدخال (صورة لكل شريحة) مع النص */
async function shareEntry(e: CalendarEntry) {
  if (!e.projectId) return toast('اربط الإدخال بمشروع أولاً لمشاركة تصميمه', 'info')
  const slides = await getProjectSlides(e.projectId)
  if (!slides) return toast('تعذّر العثور على المشروع المرتبط', 'error')
  const s = useEditor.getState()
  setTask({ label: 'جارِ تجهيز الصور…', progress: null })
  try {
    const files: File[] = []
    for (let i = 0; i < slides.length; i++) {
      const blob = await renderDesign(slides[i], s.brand, allPartners(s), s.fontsVersion, { scale: 1, format: 'png' })
      files.push(new File([blob], `${(e.title || titleOf(slides[i])).replace(/[\\/:*?"<>|]+/g, ' ')}${slides.length > 1 ? ` - ${i + 1}` : ''}.png`, { type: 'image/png' }))
    }
    setTask(null)
    const data = { files, text: e.caption, title: e.title }
    if (navigator.canShare?.(data)) {
      try {
        await navigator.share(data)
        return
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return
      }
    }
    // بديل: تنزيل + نسخ النص
    if (files.length === 1) downloadBlob(files[0], files[0].name)
    else {
      const zip = zipSync(Object.fromEntries(await Promise.all(files.map(async (f) => [f.name, [new Uint8Array(await f.arrayBuffer()), { level: 0 }]]))) as never)
      downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${e.title || 'post'}.zip`)
    }
    if (e.caption) await copyText(e.caption)
    toast('نُزِّلت الصور ونُسخ النص — افتح إنستغرام وانشر', 'ok', 5000)
  } finally {
    setTask(null)
  }
}

function EntryCard({ e, projects }: { e: CalendarEntry; projects: ProjectMeta[] }) {
  const st = statusOf(e.status)
  return (
    <article className="cal-card" style={{ ['--st' as string]: st.color }}>
      <div className="cal-card-top">
        <div className="cal-thumb">{e.thumb ? <img src={e.thumb} alt="" /> : <span>{e.title?.[0] ?? '·'}</span>}</div>
        <div className="cal-card-main">
          <input className="txi big" dir="auto" placeholder="عنوان المنشور" value={e.title} onChange={(ev) => updateEntry(e.id, { title: ev.target.value })} />
          <div className="cal-row">
            <Select<CalendarEntry['status']> value={e.status} options={STATUS.map((x) => ({ value: x.id, label: x.label }))} onChange={(v) => updateEntry(e.id, { status: v })} />
            <input className="txi ltr" type="date" value={e.date} onChange={(ev) => ev.target.value && updateEntry(e.id, { date: ev.target.value })} />
          </div>
        </div>
      </div>
      <textarea className="txa" dir="auto" rows={4} placeholder="نص المنشور (Caption) والوسوم…" value={e.caption} onChange={(ev) => updateEntry(e.id, { caption: ev.target.value })} />
      <div className="cal-row">
        <Select<string>
          value={e.projectId ?? ''}
          options={[{ value: '', label: 'بدون مشروع مرتبط' }, ...projects.map((p) => ({ value: p.id, label: p.name || 'مشروع' }))]}
          onChange={(v) => {
            const p = projects.find((x) => x.id === v)
            updateEntry(e.id, { projectId: v || undefined, projectName: p?.name, thumb: p?.thumb ?? e.thumb })
          }}
        />
      </div>
      <div className="cal-actions">
        {e.projectId && (
          <Btn small icon={<FolderOpen size={14} />} onClick={async () => (await openProjectById(e.projectId!), close())}>
            فتح المشروع
          </Btn>
        )}
        <Btn
          small
          icon={<Copy size={14} />}
          disabled={!e.caption}
          onClick={async () => toast((await copyText(e.caption)) ? 'تم نسخ النص' : 'تعذّر النسخ', 'ok', 1800)}
        >
          نسخ النص
        </Btn>
        <Btn small variant="primary" icon={<Share2 size={14} />} onClick={() => void shareEntry(e)} title="مشاركة الصور والنص عبر مشاركة الجهاز، أو تنزيلها للنشر اليدوي">
          مشاركة / تجهيز للنشر
        </Btn>
        <span style={{ flex: 1 }} />
        <Btn small variant="ghost" icon={<Trash2 size={14} />} onClick={() => confirm('حذف هذا الإدخال من التقويم؟') && removeEntry(e.id)}>
          حذف
        </Btn>
      </div>
    </article>
  )
}

export default function CalendarDialog() {
  const entries = useEditor((s) => s.calendar)
  const view = useEditor((s) => s.view)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [sel, setSel] = useState(isoDate(new Date()))
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const today = isoDate(new Date())

  useEffect(() => {
    void listProjects().then(setProjects)
    if (calendarIntent.select) {
      const e = useEditor.getState().calendar.find((x) => x.id === calendarIntent.select)
      if (e) {
        setSel(e.date)
        const d = new Date(e.date + 'T00:00:00')
        setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
      }
    }
    if (calendarIntent.addCurrent) {
      calendarIntent.addCurrent = false
      void (async () => {
        await saveProjectNow(true)
        const s = useEditor.getState()
        const d = s.design
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const iso = isoDate(tomorrow)
        addEntry({ date: iso, title: s.projectName || (d.touched ? titleOf(d) : 'منشور جديد'), status: 'design', projectId: s.projectId, projectName: s.projectName, thumb: await makeThumb(d) })
        setSel(iso)
        setMonth(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1))
        void listProjects().then(setProjects)
        toast('أُضيف التصميم الحالي إلى التقويم', 'ok')
      })()
    }
  }, [])

  const cells = useMemo(() => monthCells(month), [month])
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>()
    for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e])
    return m
  }, [entries])
  const dayEntries = byDate.get(sel) ?? []
  const counts = STATUS.map((s) => ({ ...s, n: entries.filter((e) => e.status === s.id).length }))

  const exportIcs = () => {
    if (!entries.length) return toast('لا توجد إدخالات لتصديرها', 'info')
    downloadBlob(new Blob([buildIcs(entries)], { type: 'text/calendar;charset=utf-8' }), 'LKGT - تقويم المحتوى.ics')
    toast('تم تصدير التقويم — افتح الملف لإضافته إلى تقويم هاتفك أو Google Calendar', 'ok', 5000)
  }

  return (
    <Modal title="تقويم المحتوى" onClose={close} wide="xl">
      <div className="cal">
        <div className="cal-main">
          <div className="cal-bar">
            <button className="ibtn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} title="الشهر التالي">
              <ChevronLeft size={18} />
            </button>
            <strong>{monthName(month)}</strong>
            <button className="ibtn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} title="الشهر السابق">
              <ChevronRight size={18} />
            </button>
            <Btn small variant="ghost" onClick={() => (setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), setSel(today))}>
              اليوم
            </Btn>
            <span style={{ flex: 1 }} />
            <div className="cal-legend">
              {counts.map((c) => (
                <span key={c.id} style={{ ['--st' as string]: c.color }}>
                  <i />
                  {c.label} <b>{c.n}</b>
                </span>
              ))}
            </div>
          </div>
          <div className="cal-grid">
            {DAYS.map((d, i) => (
              <div key={d} className={`cal-dow ${i === 6 ? 'off' : ''}`}>
                {d}
              </div>
            ))}
            {cells.map((c, i) => {
              if (!c) return <div key={i} className="cal-cell empty" />
              const iso = isoDate(c)
              const list = byDate.get(iso) ?? []
              return (
                <button key={i} className={`cal-cell ${iso === sel ? 'sel' : ''} ${iso === today ? 'today' : ''} ${(i % 7) === 6 ? 'off' : ''}`} onClick={() => setSel(iso)} onDoubleClick={() => (setSel(iso), addEntry({ date: iso }))}>
                  <span className="cal-num">{c.getDate()}</span>
                  <span className="cal-chips">
                    {list.slice(0, 3).map((e) => (
                      <em key={e.id} style={{ ['--st' as string]: statusOf(e.status).color }} title={e.title}>
                        {e.title || 'منشور'}
                      </em>
                    ))}
                    {list.length > 3 && <small>+{list.length - 3}</small>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="cal-foot">
            <Btn small icon={<CalendarPlus size={14} />} onClick={exportIcs}>
              تصدير إلى تقويم الهاتف (.ics)
            </Btn>
            <a className="btn ghost sm" href="https://business.facebook.com/latest/composer" target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              <span>جدولة النشر الفعلي — Meta Business Suite</span>
            </a>
          </div>
          <p className="hint">النشر التلقائي المباشر على إنستغرام يحتاج حساباً تجارياً وخادماً رسمياً (Meta) ولا يمكن من متصفح مستقل — لذلك يجهّز لك البرنامج الصور والنص بضغطة (مشاركة الجهاز أو تنزيل + نسخ) لتنشرها بنفسك أو تجدولها عبر Meta Business Suite.</p>
        </div>

        <aside className="cal-side">
          <div className="cal-side-head">
            <b>{longDate(sel)}</b>
            <Btn small variant="primary" icon={<Plus size={14} />} onClick={() => addEntry({ date: sel })}>
              إدخال جديد
            </Btn>
          </div>
          {view === 'editor' && (
            <Btn
              small
              icon={<CalendarPlus size={14} />}
              onClick={async () => {
                await saveProjectNow(true)
                const s = useEditor.getState()
                const d = s.design
                addEntry({ date: sel, title: s.projectName || (d.touched ? titleOf(d) : 'منشور جديد'), status: 'design', projectId: s.projectId, projectName: s.projectName, thumb: await makeThumb(d) })
                void listProjects().then(setProjects)
              }}
            >
              إضافة التصميم الحالي لهذا اليوم
            </Btn>
          )}
          <div className="cal-list">
            {dayEntries.map((e) => (
              <EntryCard key={e.id} e={e} projects={projects} />
            ))}
            {!dayEntries.length && (
              <div className="cal-empty">
                <CalendarPlus size={34} />
                <span>لا منشورات في هذا اليوم</span>
                <small>انقر مرتين على أي يوم لإضافة فكرة سريعة</small>
              </div>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  )
}

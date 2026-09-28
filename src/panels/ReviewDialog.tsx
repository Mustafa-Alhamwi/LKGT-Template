import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Copy, FileDown, Loader2, MessageSquare, Send, Upload } from 'lucide-react'
import { Btn, Chips } from '../ui/kit'
import { Modal } from './Dialogs'
import { allPartners, switchSlide, toast, useEditor } from '../store/editor'
import { updateEntry } from '../store/calendar'
import { renderCanvas, downloadBlob } from '../lib/exporter'
import { gather, prepare, type Scope } from '../lib/exportJobs'
import { buildReviewHtml, parseReviewResult, type ReviewPack, type ReviewResult } from '../lib/review'
import { canvasOf } from '../model/types'
import { copyText } from '../lib/clipboard'
import { pickFile } from '../lib/importer'
import { titleOf } from '../lib/naming'

const close = () => useEditor.setState({ dialog: null })
const LS_KEY = 'lkgt-reviews'

function loadHistory(): ReviewResult[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}
function saveHistory(list: ReviewResult[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    /* ممتلئ */
  }
}

const fmt = (t: number) => new Intl.DateTimeFormat('ar-SY-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t))

function ResultCard({ r }: { r: ReviewResult }) {
  const projectId = useEditor((s) => s.projectId)
  const calendar = useEditor((s) => s.calendar)
  const ok = r.decision === 'approved'
  const entry = calendar.find((e) => e.projectId === r.projectId)
  return (
    <div className={`rv-res ${ok ? 'ok' : 'chg'}`}>
      <div className="rv-res-top">
        {ok ? <CheckCircle2 size={22} /> : <MessageSquare size={22} />}
        <div>
          <b>{ok ? 'تم اعتماد التصميم' : 'طلب المراجع تعديلات'}</b>
          <small>
            {r.reviewer} · {fmt(r.at)}
          </small>
        </div>
      </div>
      {r.projectId !== projectId && <p className="hint">⚠ هذا الرد يخص مشروعاً آخر («{r.title}») غير المفتوح حالياً.</p>}
      {r.general && <p className="rv-general">{r.general}</p>}
      {r.comments.length > 0 && (
        <ul className="rv-list">
          {r.comments.map((c, i) => (
            <li key={i}>
              <button className="rv-slide" onClick={() => (switchSlide(c.slide - 1), close())} title="الانتقال إلى الشريحة">
                {c.slide}
              </button>
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
      {!r.general && !r.comments.length && <p className="hint">لا توجد ملاحظات نصية.</p>}
      {entry && (
        <Btn
          small
          variant="primary"
          onClick={() => {
            updateEntry(entry.id, { status: ok ? 'ready' : 'design' })
            toast(ok ? 'أصبحت حالة المنشور في التقويم «جاهز للنشر»' : 'أُعيدت حالة المنشور إلى «قيد التصميم»', 'ok')
          }}
        >
          {ok ? 'تعليم المنشور «جاهز للنشر» في التقويم' : 'إعادته إلى «قيد التصميم» في التقويم'}
        </Btn>
      )}
    </div>
  )
}

export default function ReviewDialog() {
  const s0 = useEditor.getState()
  const linked = s0.calendar.find((e) => e.projectId === s0.projectId)
  const [tab, setTab] = useState<'send' | 'import'>('send')
  const [title, setTitle] = useState(s0.projectName || (s0.design.touched ? titleOf(s0.design) : 'تصميم للمراجعة'))
  const [note, setNote] = useState('')
  const [caption, setCaption] = useState(linked?.caption ?? '')
  const [scope, setScope] = useState<Scope>(s0.slides.length > 1 ? 'all' : 'current')
  const [width, setWidth] = useState(720)
  const [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState('')
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [history, setHistory] = useState<ReviewResult[]>(loadHistory)
  const multi = s0.slides.length > 1

  useEffect(() => saveHistory(history), [history])

  const importText = (text: string) => {
    try {
      const r = parseReviewResult(text)
      setResult(r)
      setHistory((h) => [r, ...h.filter((x) => !(x.id === r.id && x.at === r.at))])
      setPaste('')
      toast('تم استيراد رد المراجع', 'ok')
    } catch (e) {
      toast((e as Error).message || 'تعذّر قراءة الرد', 'error', 5000)
    }
  }

  const create = async () => {
    setBusy(true)
    try {
      const { s, list } = gather(scope)
      await prepare(list.map((x) => x.d))
      const pack: ReviewPack = { id: `r${Date.now().toString(36)}`, title: title.trim() || 'تصميم', note: note.trim(), caption: caption.trim(), projectId: s.projectId, brand: s.brand.name, created: Date.now(), slides: [] }
      for (const { d } of list) {
        const cv = canvasOf(d)
        const c = await renderCanvas(d, s.brand, allPartners(s), s.fontsVersion, { scale: width / cv.w, format: 'jpg', quality: 0.86 })
        pack.slides.push({ img: c.toDataURL('image/jpeg', 0.86), w: c.width, h: c.height })
      }
      const html = buildReviewHtml(pack)
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `مراجعة - ${pack.title.replace(/[\\/:*?"<>|]+/g, ' ')}.html`)
      toast(`تم إنشاء ملف المراجعة (${(html.length / 1024 / 1024).toFixed(1)} MB) — أرسله للمراجع`, 'ok', 6000)
    } catch (e) {
      toast(`تعذّر إنشاء الملف: ${(e as Error).message}`, 'error', 6000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="المراجعة والاعتماد" onClose={close} wide>
      <Chips
        value={tab}
        options={[
          { value: 'send', label: 'إرسال للمراجعة' },
          { value: 'import', label: `استيراد رد المراجع${history.length ? ` (${history.length})` : ''}` },
        ]}
        onChange={setTab}
      />
      {tab === 'send' && (
        <div className="rv">
          <p className="hint">
            يُنشئ ملف <b>HTML واحداً</b> فيه تصميمك (بعلامة «للمراجعة فقط»)، يرسله لأي شخص (واتساب/بريد) فيفتحه في المتصفح بدون حساب أو إنترنت، يكتب ملاحظاته لكل شريحة ثم يضغط «اعتماد» أو «طلب تعديلات» ويعيد إليك الرد لتستورده هنا.
          </p>
          <label className="cw-f">
            <span>عنوان المراجعة</span>
            <input className="txi" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="cw-f">
            <span>رسالة للمراجع (اختياري)</span>
            <textarea className="txa" dir="auto" rows={2} value={note} placeholder="مثال: نرجو مراجعة الأسعار والنص قبل نشر الغد" onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="cw-f">
            <span>نص المنشور المقترح (اختياري)</span>
            <textarea className="txa" dir="auto" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          {multi && (
            <div className="xp-f">
              <span>الشرائح</span>
              <Chips value={scope} options={[{ value: 'all', label: `كل الشرائح (${s0.slides.length})` }, { value: 'current', label: 'الحالية فقط' }]} onChange={setScope} />
            </div>
          )}
          <div className="xp-f">
            <span>حجم الصور داخل الملف</span>
            <Chips value={width} options={[{ value: 540, label: 'صغير — ملف خفيف' }, { value: 720, label: 'متوسط' }, { value: 1080, label: 'كامل — للتدقيق بالتفاصيل' }]} onChange={setWidth} />
          </div>
          <div className="row-btns">
            <Btn variant="primary" icon={busy ? <Loader2 size={15} className="spin" /> : <FileDown size={15} />} disabled={busy} onClick={create}>
              {busy ? 'جارِ الإنشاء…' : 'إنشاء ملف المراجعة'}
            </Btn>
            <Btn
              icon={<Copy size={15} />}
              onClick={async () => toast((await copyText(`مرحباً 👋\nأرفقت لك ملف مراجعة التصميم «${title}».\nافتحه بالمتصفح، اكتب ملاحظاتك، ثم اضغط «اعتماد» أو «طلب تعديلات» وأرسل لي الرد. شكراً!`)) ? 'نُسخت الرسالة — الصقها في واتساب' : 'تعذّر النسخ', 'ok', 3000)}
            >
              نسخ رسالة جاهزة للمراجع
            </Btn>
          </div>
        </div>
      )}
      {tab === 'import' && (
        <div className="rv">
          <div className="row-btns">
            <Btn
              icon={<Upload size={15} />}
              onClick={async () => {
                const [f] = await pickFile('.json,.txt,application/json,text/plain')
                if (f) importText(await f.text())
              }}
            >
              رفع ملف الرد (.json)
            </Btn>
          </div>
          <label className="cw-f">
            <span>أو الصق رمز الرد هنا</span>
            <textarea className="txa" dir="ltr" rows={3} value={paste} placeholder="LKR1:…" onChange={(e) => setPaste(e.target.value)} />
          </label>
          <Btn variant="primary" icon={<Send size={15} />} disabled={!paste.trim()} onClick={() => importText(paste)}>
            استيراد الرد
          </Btn>
          {result && <ResultCard r={result} />}
          {history.length > 0 && (
            <>
              <h4 className="lib-h">الردود السابقة</h4>
              <div className="rv-hist">
                {history.map((h, i) => (
                  <button key={i} onClick={() => setResult(h)} className={h === result ? 'on' : ''}>
                    <ClipboardCheck size={15} className={h.decision === 'approved' ? 'ok' : 'chg'} />
                    <span>
                      <b>{h.title}</b>
                      <small>
                        {h.reviewer} · {fmt(h.at)}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

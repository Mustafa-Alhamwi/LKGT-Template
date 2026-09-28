import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Clock, Columns2, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Btn } from '../ui/kit'
import { Modal } from './Dialogs'
import { deleteVersion, listVersions, restoreVersion, saveVersion, type VersionRec } from '../store/projects'
import { allPartners, findTemplate, toast, useEditor } from '../store/editor'
import { canvasOf, type Design } from '../model/types'
import { categoryDef } from '../model/categories'
import { renderCanvas } from '../lib/exporter'

/* سجل النسخ: نسخ تلقائية كل 5 دقائق + نسخ يدوية، مع معاينة واستعادة */

const fmtDate = (t: number) =>
  new Date(t).toLocaleString('ar', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

async function shot(d: Design): Promise<string> {
  const s = useEditor.getState()
  const c = await renderCanvas(d, s.brand, allPartners(s), s.fontsVersion, { scale: Math.min(0.6, 560 / canvasOf(d).w), format: 'jpg', quality: 0.9 })
  return c.toDataURL('image/jpeg', 0.9)
}

/** ما الذي تغيّر بين النسخة والتصميم الحالي؟ */
function diffOf(a: Design, b: Design): string[] {
  const out: string[] = []
  const cat = categoryDef(b.category)
  if (a.templateId !== b.templateId) {
    const s = useEditor.getState()
    out.push(`القالب: ${findTemplate(s, a.templateId)?.name ?? '—'} ← ${findTemplate(s, b.templateId)?.name ?? '—'}`)
  }
  const keys = Object.keys(b.content.texts) as (keyof Design['content']['texts'])[]
  for (const k of keys) if (JSON.stringify(a.content.texts[k]) !== JSON.stringify(b.content.texts[k])) out.push(String(cat.labels[k as keyof typeof cat.labels] ?? k))
  if (JSON.stringify(a.content.scene) !== JSON.stringify(b.content.scene)) out.push('صورة الخلفية')
  if (JSON.stringify(a.content.product) !== JSON.stringify(b.content.product)) out.push('المنتج')
  if (JSON.stringify(a.style.decor) !== JSON.stringify(b.style.decor)) out.push('العناصر والملصقات')
  if (JSON.stringify(a.style.backdrop) !== JSON.stringify(b.style.backdrop) || a.style.theme !== b.style.theme) out.push('الخلفية والألوان')
  if (a.canvas?.w !== b.canvas?.w || a.canvas?.h !== b.canvas?.h) out.push('المقاس')
  return out
}

/** مقارنة قبل/بعد بمنزلق */
function CompareView({ v, onBack, onRestore }: { v: VersionRec; onBack: () => void; onRestore: () => void }) {
  const [imgs, setImgs] = useState<{ before: string; after: string } | null>(null)
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const cur = useEditor.getState().design
  const old = v.slides[v.slideIndex] ?? v.slides[0]
  const changes = diffOf(old, cur)
  useEffect(() => {
    let alive = true
    void Promise.all([shot(old), shot(cur)]).then(([before, after]) => alive && setImgs({ before, after }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const move = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)))
  }
  const cv = canvasOf(old)
  return (
    <div className="cmp">
      <div className="cmp-top">
        <Btn small variant="ghost" icon={<ArrowRight size={14} />} onClick={onBack}>
          رجوع للقائمة
        </Btn>
        <b>
          {v.label} <small>{fmtDate(v.at)}</small>
        </b>
        <span style={{ flex: 1 }} />
        <Btn small variant="primary" icon={<RotateCcw size={14} />} onClick={onRestore}>
          استعادة هذه النسخة
        </Btn>
      </div>
      <div className="cmp-body">
        <div
          ref={box}
          className="cmp-stage"
          dir="ltr"
          style={{ aspectRatio: `${cv.w} / ${cv.h}` }}
          onPointerDown={(e) => {
            drag.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            move(e)
          }}
          onPointerMove={(e) => drag.current && move(e)}
          onPointerUp={() => (drag.current = false)}
        >
          {imgs ? (
            <>
              <img src={imgs.after} alt="" draggable={false} />
              <img src={imgs.before} alt="" draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
              <i className="cmp-line" style={{ left: `${pos}%` }}>
                <b>
                  <Columns2 size={16} />
                </b>
              </i>
              <span className="cmp-tag l">النسخة</span>
              <span className="cmp-tag r">الحالي</span>
            </>
          ) : (
            <span className="cmp-load">
              <Loader2 className="spin" /> جارِ تجهيز المقارنة…
            </span>
          )}
        </div>
        <div className="cmp-side">
          <h4 className="lib-h">ما الذي تغيّر؟</h4>
          {changes.length ? (
            <div className="cmp-chips">
              {changes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          ) : (
            <p className="hint">لا فرق بين هذه النسخة وتصميمك الحالي.</p>
          )}
          <p className="hint">اسحب الخط الفاصل على الصورة لمقارنة النسخة القديمة بالتصميم الحالي (الشريحة المفتوحة).</p>
        </div>
      </div>
    </div>
  )
}

export function VersionsDialog() {
  const projectId = useEditor((s) => s.projectId)
  const [list, setList] = useState<VersionRec[] | null>(null)
  const [label, setLabel] = useState('')
  const [cmp, setCmp] = useState<VersionRec | null>(null)
  const close = () => useEditor.setState({ dialog: null })
  const load = () => listVersions(projectId).then(setList)
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])
  return (
    <Modal title="سجل النسخ" onClose={close} wide>
      {cmp ? (
        <CompareView
          v={cmp}
          onBack={() => setCmp(null)}
          onRestore={async () => {
            await restoreVersion(cmp)
            close()
          }}
        />
      ) : (
        <>
      <p className="hint">يحفظ البرنامج نسخة تلقائياً كل 5 دقائق أثناء التعديل. احفظ نسخة مسماة قبل أي تغيير كبير.</p>
      <div className="ver-new">
        <input className="txi" placeholder="اسم النسخة (اختياري)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Btn
          variant="primary"
          icon={<Save size={15} />}
          onClick={async () => {
            await saveVersion(label.trim() || 'نسخة يدوية')
            setLabel('')
            toast('تم حفظ النسخة', 'ok')
            void load()
          }}
        >
          حفظ نسخة الآن
        </Btn>
      </div>
      {list === null && <p className="hint">جارِ التحميل…</p>}
      {list && !list.length && <p className="hint">لا توجد نسخ محفوظة بعد لهذا المشروع.</p>}
      <div className="ver-grid">
        {list?.map((v) => (
          <div key={v.id} className="ver-card">
            <div className="ver-thumb" style={{ aspectRatio: `${canvasOf(v.slides[v.slideIndex]).w} / ${canvasOf(v.slides[v.slideIndex]).h}` }}>
              {v.thumb ? <img src={v.thumb} alt="" /> : <Clock size={22} />}
            </div>
            <strong>{v.label}</strong>
            <span>
              {fmtDate(v.at)} · {v.slides.length} شريحة
              {v.auto ? ' · تلقائي' : ''}
            </span>
            <div className="ver-btns">
              <Btn small icon={<Columns2 size={14} />} onClick={() => setCmp(v)}>
                مقارنة
              </Btn>
              <Btn
                small
                icon={<RotateCcw size={14} />}
                onClick={async () => {
                  await restoreVersion(v)
                  close()
                }}
              >
                استعادة
              </Btn>
              <button
                className="ibtn danger"
                title="حذف"
                onClick={async () => {
                  await deleteVersion(v.id)
                  void load()
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
        </>
      )}
    </Modal>
  )
}

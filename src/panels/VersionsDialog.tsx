import { useEffect, useState } from 'react'
import { Clock, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Btn } from '../ui/kit'
import { Modal } from './Dialogs'
import { deleteVersion, listVersions, restoreVersion, saveVersion, type VersionRec } from '../store/projects'
import { toast, useEditor } from '../store/editor'
import { canvasOf } from '../model/types'

/* سجل النسخ: نسخ تلقائية كل 5 دقائق + نسخ يدوية، مع معاينة واستعادة */

const fmtDate = (t: number) =>
  new Date(t).toLocaleString('ar', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function VersionsDialog() {
  const projectId = useEditor((s) => s.projectId)
  const [list, setList] = useState<VersionRec[] | null>(null)
  const [label, setLabel] = useState('')
  const close = () => useEditor.setState({ dialog: null })
  const load = () => listVersions(projectId).then(setList)
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])
  return (
    <Modal title="سجل النسخ" onClose={close} wide>
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
    </Modal>
  )
}

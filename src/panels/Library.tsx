import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, LayoutTemplate, Pencil, Plus, Save, Trash2, Upload, Download } from 'lucide-react'
import { Poster } from '../poster/Poster'
import {
  allPartners,
  allTemplates,
  applyTemplate,
  deleteUserTemplate,
  newBlankTemplate,
  renameUserTemplate,
  templateDemo,
  toast,
  updateUserTemplate,
  useEditor,
} from '../store/editor'
import type { AdContent, BrandConfig, PartnerLogo, Template } from '../model/types'
import { POSTER_W } from '../model/types'
import { exportTemplatesFile, importTemplatesFile } from '../lib/templateIO'
import { pickFile } from '../lib/importer'

/* ------------------------------------------------------------------
 * مكتبة القوالب: معاينات حية — بمحتوى القالب التجريبي أو بمحتواك أنت
 * ------------------------------------------------------------------ */

const THUMB_W = 132

/** لا نرسم المعاينة إلا عند ظهورها على الشاشة */
function useVisible<T extends Element>() {
  const ref = useRef<T>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVis(true), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, vis] as const
}

const Thumb = memo(function Thumb({
  t,
  content,
  brand,
  partners,
  fontsVersion,
  active,
}: {
  t: Template
  content: AdContent
  brand: BrandConfig
  partners: PartnerLogo[]
  fontsVersion: number
  active: boolean
}) {
  const [ref, vis] = useVisible<HTMLButtonElement>()
  const design = useMemo(() => ({ templateId: t.id, style: t.style, content, isDemo: true }), [t, content])
  const s = THUMB_W / POSTER_W
  return (
    <button ref={ref} className={`thumb ${active ? 'active' : ''}`} onClick={() => applyTemplate(t.id)} title={`${t.name} — ${t.nameEn}`}>
      <div className="thumb-frame" style={{ width: THUMB_W, height: THUMB_W * (4 / 3) }}>
        {vis && (
          <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${s})`, transformOrigin: '0 0', width: POSTER_W }}>
            <Poster design={design} brand={brand} partners={partners} fontsVersion={fontsVersion} />
          </div>
        )}
      </div>
      <div className="thumb-meta">
        <span className="thumb-name">{t.name}</span>
        <span className={`thumb-dot ${t.style.theme}`} title={t.style.theme === 'dark' ? 'داكن' : 'فاتح'} />
      </div>
    </button>
  )
})

type Filter = 'all' | 'light' | 'dark' | 'mine'

export function Library({ onSaveTemplate }: { onSaveTemplate: () => void }) {
  const userTemplates = useEditor((s) => s.userTemplates)
  const templateId = useEditor((s) => s.design.templateId)
  const content = useEditor((s) => s.design.content)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const previewMine = useEditor((s) => s.previewMine)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const deferredContent = useDeferredValue(content)
  const [filter, setFilter] = useState<Filter>('all')
  const list = allTemplates({ userTemplates }).filter((t) =>
    filter === 'all' ? true : filter === 'mine' ? !t.builtIn : t.style.theme === filter,
  )
  const demoCache = useMemo(() => new Map<string, AdContent>(), [])
  const demoFor = (t: Template) => {
    let c = demoCache.get(t.id)
    if (!c) {
      c = templateDemo(t)
      demoCache.set(t.id, c)
    }
    return c
  }
  const current = allTemplates({ userTemplates }).find((t) => t.id === templateId)

  return (
    <aside className="panel library">
      <div className="panel-head">
        <LayoutTemplate size={18} />
        <h2>مكتبة القوالب</h2>
        <span className="count">{list.length}</span>
      </div>

      <div className="lib-tools">
        <div className="ui-seg small">
          {(
            [
              ['all', 'الكل'],
              ['light', 'فاتح'],
              ['dark', 'داكن'],
              ['mine', 'قوالبي'],
            ] as [Filter, string][]
          ).map(([v, l]) => (
            <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        <label className="lib-mine">
          <input type="checkbox" checked={previewMine} onChange={(e) => useEditor.setState({ previewMine: e.target.checked })} />
          <span>معاينة بمحتواي</span>
        </label>
      </div>

      <div className="thumbs">
        {list.map((t) => (
          <div key={t.id} className="thumb-wrap">
            <Thumb
              t={t}
              content={previewMine ? deferredContent : demoFor(t)}
              brand={brand}
              partners={partners}
              fontsVersion={fontsVersion}
              active={t.id === templateId}
            />
            {!t.builtIn && (
              <div className="thumb-actions">
                <button
                  title="تحديث القالب من التصميم الحالي"
                  onClick={() => {
                    updateUserTemplate(t.id)
                    toast('تم تحديث القالب ✓', 'ok')
                  }}
                >
                  <Save size={13} />
                </button>
                <button
                  title="إعادة تسمية"
                  onClick={() => {
                    const n = prompt('اسم القالب', t.name)
                    if (n) renameUserTemplate(t.id, n)
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  title="حذف"
                  onClick={() => {
                    if (confirm(`حذف القالب «${t.name}»؟`)) deleteUserTemplate(t.id)
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
        {filter === 'mine' && !list.length && <p className="empty-note">لم تحفظ أي قالب بعد. عدّل أي تصميم ثم اضغط «حفظ كقالب».</p>}
      </div>

      <div className="lib-foot">
        <button className="ui-btn primary" onClick={onSaveTemplate}>
          <Copy size={15} /> <span>حفظ كقالب جديد</span>
        </button>
        <div className="ui-row" style={{ gap: 6 }}>
          <button className="ui-btn small" onClick={() => newBlankTemplate()} title="بدء قالب جديد من الصفر">
            <Plus size={14} /> <span>قالب فارغ</span>
          </button>
          <button
            className="ui-btn small"
            title="تصدير قوالبي لملف (للنسخ الاحتياطي أو لجهاز آخر)"
            onClick={() => exportTemplatesFile(userTemplates).catch((e) => toast(String(e), 'error'))}
            disabled={!userTemplates.length}
          >
            <Download size={14} />
          </button>
          <button
            className="ui-btn small"
            title="استيراد قوالب من ملف"
            onClick={async () => {
              const [f] = await pickFile('.json,application/json')
              if (f) importTemplatesFile(f).catch((e) => toast(String(e), 'error'))
            }}
          >
            <Upload size={14} />
          </button>
        </div>
        {current && !current.builtIn && <small className="muted">القالب الحالي من قوالبك — التعديلات تُحفظ بزر ⟳ على المعاينة.</small>}
      </div>
    </aside>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Loader2, Palette, PlusCircle, RefreshCw, ShieldCheck, Sparkles, Upload, Wand2, XCircle } from 'lucide-react'
import { Btn } from '../ui/kit'
import { Modal } from './Dialogs'
import { allPartners, allTemplates, applyTemplate, recolorAll, select, setBrand, toast, useEditor } from '../store/editor'
import { runCheck, type Issue } from '../lib/check'
import { extractPalette, accentOf, harmonies, type PaletteColor } from '../lib/palette'
import { buildVariants, designPalette, rankTemplates, type Variant } from '../lib/suggest'
import { PosterThumb } from '../poster/PosterThumb'
import { pickFile } from '../lib/importer'
import { emptyContent } from '../model/demo'
import { hslOf } from '../lib/color'
import type { Design, Template } from '../model/types'
import { DEFAULT_CANVAS } from '../model/types'

const close = () => useEditor.setState({ dialog: null })

/* ------------------------------ فحص الجودة ------------------------------ */

const LV = {
  error: { icon: <XCircle size={18} />, cls: 'err', label: 'يجب إصلاحه' },
  warn: { icon: <AlertTriangle size={18} />, cls: 'warn', label: 'تحذير' },
  info: { icon: <Info size={18} />, cls: 'info', label: 'ملاحظة' },
}

export function CheckDialog() {
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const run = async () => {
    setIssues(null)
    await new Promise((r) => setTimeout(r, 60))
    setIssues(await runCheck())
  }
  useEffect(() => {
    void run()
  }, [])
  const fixable = issues?.filter((i) => i.fix) ?? []
  const count = (l: Issue['level']) => issues?.filter((i) => i.level === l).length ?? 0
  return (
    <Modal title="فحص جودة التصميم" onClose={close} wide>
      <div className="chk-top">
        {issues === null ? (
          <span className="chk-pill busy">
            <Loader2 size={16} className="spin" /> جارِ الفحص…
          </span>
        ) : issues.length === 0 ? (
          <span className="chk-pill ok">
            <CheckCircle2 size={16} /> ممتاز — التصميم جاهز للنشر
          </span>
        ) : (
          <>
            {count('error') > 0 && <span className="chk-pill err">{count('error')} أخطاء</span>}
            {count('warn') > 0 && <span className="chk-pill warn">{count('warn')} تحذيرات</span>}
            {count('info') > 0 && <span className="chk-pill info">{count('info')} ملاحظات</span>}
          </>
        )}
        <span style={{ flex: 1 }} />
        <Btn small icon={<RefreshCw size={14} />} onClick={run}>
          إعادة الفحص
        </Btn>
        {fixable.length > 1 && (
          <Btn
            small
            variant="primary"
            icon={<Wand2 size={14} />}
            onClick={async () => {
              for (const i of fixable) i.fix?.()
              toast(`تم تطبيق ${fixable.length} إصلاحاً`, 'ok')
              await run()
            }}
          >
            إصلاح الكل تلقائياً ({fixable.length})
          </Btn>
        )}
      </div>
      <p className="hint">يفحص المحتوى النائب، حجم الخط، التباين، الهوامش، تداخل عناصر الهوية، دقة الصور، والإملاء العربي.</p>
      <div className="chk-list">
        {issues?.map((i) => (
          <div key={i.id} className={`chk-item ${LV[i.level].cls}`}>
            <span className="chk-ic">{LV[i.level].icon}</span>
            <div className="chk-body">
              <strong>{i.title}</strong>
              <p>{i.detail}</p>
              <div className="chk-btns">
                <span className="chk-g">{i.group}</span>
                {i.sel && (
                  <Btn
                    small
                    onClick={() => {
                      close()
                      select(i.sel!)
                    }}
                  >
                    تحديد العنصر
                  </Btn>
                )}
                {i.fix && (
                  <Btn
                    small
                    variant="primary"
                    onClick={async () => {
                      i.fix!()
                      await run()
                    }}
                  >
                    {i.fixLabel ?? 'إصلاح'}
                  </Btn>
                )}
              </div>
            </div>
          </div>
        ))}
        {issues?.length === 0 && (
          <div className="chk-empty">
            <ShieldCheck size={44} />
            <strong>لا توجد ملاحظات</strong>
            <span>المحتوى مكتمل، النصوص واضحة، والهوية غير مغطاة.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------ ألوان من المنتج ------------------------------ */

export function PaletteDialog() {
  const design = useEditor((s) => s.design)
  const brand = useEditor((s) => s.brand)
  const [pal, setPal] = useState<PaletteColor[] | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  useEffect(() => {
    designPalette(design).then((p) => {
      setPal(p)
      setPick(accentOf(p)?.hex ?? brand.primary)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const har = pick ? harmonies(pick) : []
  const neutral = !!pal && pal.length > 0 && !accentOf(pal)
  const brandColors = Array.from(new Set([brand.primary, brand.secondary, ...brand.palette].filter(Boolean)))
  return (
    <Modal title="ألوان من صورة المنتج" onClose={close}>
      {pal === null && (
        <p className="hint">
          <Loader2 size={14} className="spin" /> جارِ تحليل الألوان…
        </p>
      )}
      {pal && !pal.length && <p className="hint">أضف صورة منتج أو خلفية أولاً ليستخرج البرنامج ألوانها.</p>}
      {pal && pal.length > 0 && (
        <>
          {neutral ? (
            <div className="alert info">
              <Info size={16} />
              <span>منتجك محايد اللون (أبيض / رمادي / أسود) فلا يوجد لون مميّز يُستخرج منه — الأفضل إبقاء لون هويتك. يمكنك اختيار لون من هويتك أو من التدرجات أدناه.</span>
            </div>
          ) : (
            <p className="hint">الألوان الغالبة في صورتك. اختر لوناً لتُصبَغ به عناصر القالب (بدل الأحمر) أو أضِفه إلى لوحة الهوية.</p>
          )}
          <div className="pal-big">
            {pal.map((c) => (
              <button key={c.hex} className={pick === c.hex ? 'on' : ''} onClick={() => setPick(c.hex)} title={c.hex}>
                <i style={{ background: c.hex }} />
                <span>{c.hex}</span>
                <small>{Math.round(c.weight * 100)}%</small>
              </button>
            ))}
          </div>
          {neutral && (
            <>
              <h4 className="lib-h">من ألوان هويتك</h4>
              <div className="pal-big compact">
                {brandColors.map((c) => (
                  <button key={c} className={pick === c ? 'on' : ''} onClick={() => setPick(c)} title={c}>
                    <i style={{ background: c }} />
                  </button>
                ))}
              </div>
            </>
          )}
          {pick && (
            <>
              <h4 className="lib-h">تدرّجات متناسقة</h4>
              <div className="pal-har">
                {har.map((h) => (
                  <button key={h.name} className={pick === h.color ? 'on' : ''} onClick={() => setPick(h.color)} title={h.name}>
                    <i style={{ background: h.color }} />
                    <small>{h.name}</small>
                  </button>
                ))}
              </div>
              <div className="row-btns">
                <Btn
                  variant="primary"
                  icon={<Palette size={15} />}
                  onClick={() => {
                    recolorAll(pick)
                    toast('تم تلوين التصميم بهذا اللون', 'ok')
                    close()
                  }}
                >
                  تلوين التصميم به
                </Btn>
                <Btn
                  icon={<PlusCircle size={15} />}
                  onClick={() => {
                    if (!brand.palette.includes(pick)) setBrand({ palette: [...brand.palette, pick] })
                    toast('أضيف إلى لوحة الهوية', 'ok')
                  }}
                >
                  إضافة للوحة الهوية
                </Btn>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

/* ------------------------------ اقتراحات ذكية ------------------------------ */

export function SuggestDialog() {
  const [list, setList] = useState<Variant[] | null>(null)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  useEffect(() => {
    buildVariants().then(setList)
  }, [])
  return (
    <Modal title="اقتراحات تصميم ذكية" onClose={close} wide>
      <p className="hint">
        <Sparkles size={14} /> نُنشئ بدائل لتصميمك الحالي بنفس المحتوى: قوالب مختلفة مصبوغة بألوان منتجك، وألوان بديلة للقالب الحالي. انقر أي بديل لتطبيقه (يمكن التراجع).
      </p>
      {list === null && (
        <p className="hint">
          <Loader2 size={14} className="spin" /> جارِ تجهيز البدائل…
        </p>
      )}
      <div className="sug-grid">
        {list?.map((v) => (
          <button
            key={v.id}
            className="sug-card"
            onClick={() => {
              v.apply()
              close()
            }}
          >
            <PosterThumb design={v.design} brand={brand} partners={partners} fontsVersion={fontsVersion} placeholders="thumb" />
            <strong>{v.label}</strong>
            <span>{v.sub}</span>
          </button>
        ))}
      </div>
      {list && !list.length && <p className="hint">لا توجد بدائل متاحة لهذه الفئة.</p>}
    </Modal>
  )
}

/* ------------------------------ تصميم من صورة مرجعية ------------------------------ */

export function ReferenceDialog() {
  const brand = useEditor((s) => s.brand)
  const userTemplates = useEditor((s) => s.userTemplates)
  const category = useEditor((s) => s.design.category ?? 'ads')
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const userPartners = useEditor((s) => s.userPartners)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const [url, setUrl] = useState<string | null>(null)
  const [pal, setPal] = useState<PaletteColor[]>([])
  const [ranked, setRanked] = useState<{ t: Template; cost: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [allCats, setAllCats] = useState(false)
  const blobRef = useRef<Blob | null>(null)

  const analyze = async (f: Blob) => {
    setBusy(true)
    blobRef.current = f
    const u = URL.createObjectURL(f)
    setUrl(u)
    const p = await extractPalette(f, 7)
    setPal(p)
    setBusy(false)
  }
  useEffect(() => {
    if (!pal.length) return
    const avgL = pal.reduce((s, c) => s + c.l * c.weight, 0)
    const pool = allTemplates({ userTemplates }).filter((t) => allCats || t.category === category)
    setRanked(rankTemplates(pal, pool, avgL).slice(0, 8))
  }, [pal, allCats, category, userTemplates])

  const accent = accentOf(pal)
  const apply = (t: Template) => {
    applyTemplate(t.id)
    if (accent) setTimeout(() => recolorAll(accent.hex), 30)
    toast('طُبِّق القالب الأقرب لأجواء المرجع', 'ok')
    close()
  }
  return (
    <Modal title="تصميم من صورة مرجعية" onClose={close} wide>
      <p className="hint">ارفع إعلاناً أعجبك (أو صورة بأجواء ألوان تريدها). يحلل البرنامج ألوانه وسطوعه ويقترح أقرب القوالب مع صبغها بلونه المميز. (المطابقة للألوان والأجواء، وليس نسخ التخطيط.)</p>
      <div className="ref-top">
        <button
          className="drop-tile"
          onClick={async () => {
            const [f] = await pickFile('image/*')
            if (f) void analyze(f)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) void analyze(f)
          }}
        >
          {url ? <img src={url} alt="" className="ref-img" /> : <Upload size={26} />}
          <strong>{url ? 'تغيير الصورة المرجعية' : 'اختر أو أفلت صورة مرجعية'}</strong>
        </button>
        {pal.length > 0 && (
          <div className="ref-pal">
            <h4 className="lib-h">ألوان المرجع</h4>
            <div className="pal-big compact">
              {pal.slice(0, 6).map((c) => (
                <span key={c.hex} title={`${c.hex} · ${Math.round(c.weight * 100)}%`}>
                  <i style={{ background: c.hex }} />
                  <small>{Math.round(c.weight * 100)}%</small>
                </span>
              ))}
            </div>
            <p className="hint">
              الأجواء: {(hslOf(pal[0].hex)?.[2] ?? 0.5) < 0.42 || pal.reduce((s, c) => s + c.l * c.weight, 0) < 0.42 ? 'داكنة' : 'فاتحة'}
              {accent ? ` · اللون المميز ${accent.hex}` : ''}
            </p>
            <label className="drawer-all">
              <input type="checkbox" checked={allCats} onChange={(e) => setAllCats(e.target.checked)} /> من كل الفئات
            </label>
          </div>
        )}
      </div>
      {busy && (
        <p className="hint">
          <Loader2 size={14} className="spin" /> جارِ التحليل…
        </p>
      )}
      {ranked.length > 0 && (
        <>
          <h4 className="lib-h">
            <Lightbulb size={14} /> أقرب القوالب لأجواء المرجع
          </h4>
          <div className="sug-grid">
            {ranked.map(({ t }) => {
              const d: Design = { templateId: t.id, style: t.style, content: emptyContent(null, t.category), touched: false, category: t.category, canvas: DEFAULT_CANVAS }
              return (
                <button key={t.id} className="sug-card" onClick={() => apply(t)}>
                  <PosterThumb design={d} brand={brand} partners={partners} fontsVersion={fontsVersion} />
                  <strong>{t.name}</strong>
                  <span>{accent ? 'يُصبغ بلون المرجع' : t.nameEn}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}

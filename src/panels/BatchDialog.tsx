import { useEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, ImagePlus, Loader2, Play, Table2, Trash2, Upload, X } from 'lucide-react'
import { Btn, Chips, Select, Switch } from '../ui/kit'
import { Modal } from './Dialogs'
import { allPartners, allTemplates, toast, useEditor } from '../store/editor'
import { categoryDef } from '../model/categories'
import { FORMATS } from '../model/formats'
import { parseTable, toCsv } from '../lib/csv'
import { FIELD_LABELS, baseDesign, fillTexts, guessField, matchImages, runBatch, type BatchRow, type FieldKey, type ImageMode } from '../lib/batch'
import { CANCELLED, download, type Ctl } from '../lib/exportJobs'
import { pickFile } from '../lib/importer'
import { PosterThumb } from '../poster/PosterThumb'
import { NAME_TOKENS } from '../lib/naming'

const close = () => useEditor.setState({ dialog: null })

const SAMPLE: Record<string, string[][]> = {
  ads: [
    ['اسم المنتج', 'الوصف', 'الجملة التسويقية', 'المزايا', 'الصورة'],
    ['EB-L200F', 'جهاز عرض محمول', 'صورة *أوضح* بلا حدود', 'إضاءة 3600 لومن|حجم صغير', 'epson.png'],
    ['SF-100', 'طابعة تحويل حراري', 'اطبع *إبداعك* بسهولة', 'حبر أصلي|سرعة عالية', 'printer.png'],
  ],
  offers: [
    ['اسم المنتج', 'السعر الجديد', 'السعر القديم', 'الخصم', 'مدة العرض', 'الصورة'],
    ['EB-L200F', '299$', '399$', '-25%', 'حتى نهاية الشهر', 'epson.png'],
    ['SF-100', '149$', '199$', '-25%', 'لفترة محدودة', 'printer.png'],
  ],
  truefalse: [
    ['العبارة', 'الشرح', 'المصدر', 'الإجابة'],
    ['القهوة تسبب الجفاف في الجسم', 'الاستهلاك المعتدل لا يسبب جفافاً', 'المصدر: دراسة 2014', 'خطأ'],
    ['الماء يشكّل نحو 60% من جسم الإنسان', 'النسبة تتغير بحسب العمر', 'المصدر: USGS', 'صح'],
  ],
  factmyth: [
    ['المعلومة', 'التوضيح', 'المصدر', 'الإجابة'],
    ['نستخدم 10% فقط من أدمغتنا', 'نستخدم معظم مناطق الدماغ يومياً', 'المصدر: علم الأعصاب', 'خرافة'],
    ['العسل لا يفسد أبداً', 'العسل النقي يبقى صالحاً لآلاف السنين', 'المصدر: Smithsonian', 'حقيقة'],
  ],
  didyouknow: [
    ['المعلومة', 'تفاصيل', 'المصدر', 'رقم'],
    ['قلب الحوت الأزرق بحجم سيارة صغيرة', 'ويزن نحو 180 كغ', 'المصدر: NOAA', '180 كغ'],
    ['الأخطبوط لديه ثلاثة قلوب', 'اثنان للخياشيم وواحد للجسم', 'المصدر: National Geographic', '3'],
  ],
}

const prettify = (name: string) => name.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()

export default function BatchDialog() {
  const s0 = useEditor.getState()
  const templates = useMemo(() => allTemplates(s0), [s0.userTemplates])
  const prefs = useEditor((s) => s.prefs)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const [tid, setTid] = useState(templates.some((t) => t.id === s0.design.templateId) ? s0.design.templateId : templates[0].id)
  const [formats, setFormats] = useState<string[]>([prefs.homeFormat || 'post'])
  const [text, setText] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [mapping, setMapping] = useState<FieldKey[] | null>(null)
  const [imageMode, setImageMode] = useState<ImageMode>('cutout')
  const [exportImages, setExportImages] = useState(true)
  const [saveProjects, setSaveProjects] = useState(false)
  const [imageFormat, setImageFormat] = useState<'png' | 'jpg'>('png')
  const [scale, setScale] = useState(1)
  const [blankUnmapped, setBlankUnmapped] = useState(true)
  const [name, setName] = useState('LKGT - {title}')
  const [busy, setBusy] = useState<{ done: number; total: number; label: string } | null>(null)
  const ctl = useRef<Ctl>({ cancelled: false })

  const tpl = templates.find((t) => t.id === tid)!
  const cat = categoryDef(tpl.category)

  const table = useMemo(() => parseTable(text), [text])
  const cols = table.rows.reduce((m, r) => Math.max(m, r.length), 0)
  const firstLooksHeader = table.rows[0] ? table.rows[0].some((c) => guessField(c) !== 'skip') : false
  useEffect(() => setHasHeader(firstLooksHeader), [firstLooksHeader])
  const headers = hasHeader && table.rows[0] ? table.rows[0] : Array.from({ length: cols }, (_, i) => `عمود ${i + 1}`)
  const dataRows = hasHeader ? table.rows.slice(1) : table.rows
  // تخمين الربط تلقائياً ما لم يعدّله المستخدم
  const guess = useMemo<FieldKey[]>(() => {
    const used = new Set<FieldKey>()
    return headers.map((h, i) => {
      let k: FieldKey = hasHeader ? guessField(h) : i === 0 ? 'title' : 'skip'
      if (k !== 'skip' && used.has(k)) k = 'skip'
      used.add(k)
      return k
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers.join('|'), hasHeader])
  const map = mapping && mapping.length === cols ? mapping : guess

  // صفوف من الجدول أو من الصور فقط
  const { rows, mappedText, hasImageCol } = useMemo(() => {
    const hasImageCol = map.includes('image')
    let rs: BatchRow[]
    let mappedText: FieldKey[]
    if (dataRows.length) {
      rs = dataRows.map((cells) => {
        const values: BatchRow['values'] = {}
        map.forEach((k, i) => {
          if (k !== 'skip' && cells[i] !== undefined) values[k] = cells[i]
        })
        return { values }
      })
      mappedText = Array.from(new Set(map.filter((k) => k !== 'skip' && k !== 'image')))
      rs = matchImages(rs, files, hasImageCol)
    } else {
      const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      rs = sorted.map((f) => ({ values: { title: prettify(f.name) }, file: f }))
      mappedText = ['title']
    }
    return { rows: rs, mappedText, hasImageCol }
  }, [dataRows.map((r) => r.join('¦')).join('\n'), map.join('|'), files])

  const withImage = rows.filter((r) => r.file).length
  const previews = useMemo(() => rows.slice(0, 6).map((r) => fillTexts(baseDesign(useEditor.getState(), tid, formats[0] ?? 'post'), r, mappedText, blankUnmapped)), [rows, tid, formats, mappedText, blankUnmapped])

  const sampleFor = () => SAMPLE[tpl.category] ?? SAMPLE.ads
  const setSample = () => setText(sampleFor().map((r) => r.join('\t')).join('\n'))

  const toggleFormat = (id: string) => setFormats((f) => (f.includes(id) ? (f.length > 1 ? f.filter((x) => x !== id) : f) : [...f, id]))

  const start = async () => {
    if (busy || !rows.length) return
    if (!exportImages && !saveProjects) return toast('اختر إخراجاً واحداً على الأقل: صور أو مشاريع', 'info')
    ctl.current = { cancelled: false }
    setBusy({ done: 0, total: rows.length, label: 'جارِ البدء…' })
    try {
      const r = await runBatch(
        { templateId: tid, formats, rows, mapped: mappedText, blankUnmapped, imageMode, saveProjects, exportImages, imageFormat, scale, nameTemplate: name },
        ctl.current,
        (done, total, label) => setBusy({ done, total, label }),
      )
      toast(`تم توليد ${r.count} تصميم${r.files ? ` — ${r.files} صورة` : ''}${r.projects ? ` — حُفظ ${r.projects} مشروع في «مشاريعي»` : ''}`, 'ok', 7000)
    } catch (e) {
      if ((e as Error).message !== CANCELLED) {
        console.error(e)
        toast(`فشل التوليد: ${(e as Error).message}`, 'error', 7000)
      } else toast('أُلغي التوليد', 'info', 2000)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal title="توليد جماعي من جدول وصور" onClose={() => (busy ? undefined : close())} wide="xl">
      <div className="bt">
        <section className="bt-sec">
          <h4>
            <b>1</b> القالب والمقاس
          </h4>
          <Select<string> value={tid} options={templates.map((t) => ({ value: t.id, label: `${categoryDef(t.category).name} — ${t.name}` }))} onChange={setTid} />
          <div className="xp-sizes">
            {FORMATS.map((f) => (
              <button key={f.id} className={formats.includes(f.id) ? 'on' : ''} onClick={() => toggleFormat(f.id)}>
                <b>{f.name}</b>
                <small>
                  {f.w}×{f.h}
                </small>
                {formats[0] === f.id && <em className="bt-main">الأساسي</em>}
              </button>
            ))}
          </div>
          <p className="hint">أول مقاس تختاره هو مقاس التصميم (وللمشاريع المحفوظة)، وبقية المقاسات تُصدَّر بترتيب ذكي تلقائي.</p>
        </section>

        <section className="bt-sec">
          <h4>
            <b>2</b> البيانات
          </h4>
          <p className="hint">
            الصق جدولك من Excel أو Google Sheets (أو ارفع ملف CSV)، وارفع صور المنتجات — يُربط اسم الصورة بعمود «الصورة»، أو بالترتيب إن تساوى عدد الصور والصفوف. يمكنك رفع صور فقط فيُولَّد تصميم لكل صورة.
          </p>
          <textarea className="txa bt-text" dir="auto" rows={6} value={text} placeholder={sampleFor().map((r) => r.join('\t')).join('\n')} onChange={(e) => setText(e.target.value)} />
          <div className="row-btns">
            <Btn
              small
              icon={<Upload size={14} />}
              onClick={async () => {
                const [f] = await pickFile('.csv,.tsv,.txt,text/csv,text/plain')
                if (f) setText(await f.text())
              }}
            >
              رفع ملف CSV
            </Btn>
            <Btn small icon={<ImagePlus size={14} />} onClick={async () => {
                const picked = await pickFile('image/*', true)
                setFiles((old) => [...old, ...picked])
              }}>
              رفع صور المنتجات
            </Btn>
            <Btn small variant="ghost" icon={<Table2 size={14} />} onClick={setSample}>
              جدول تجريبي
            </Btn>
            <Btn small variant="ghost" icon={<FileSpreadsheet size={14} />} onClick={() => download(new Blob([toCsv(sampleFor())], { type: 'text/csv;charset=utf-8' }), `LKGT - نموذج ${cat.name}.csv`)}>
              تنزيل نموذج CSV
            </Btn>
            {(text || files.length > 0) && (
              <Btn small variant="ghost" icon={<Trash2 size={14} />} onClick={() => (setText(''), setFiles([]), setMapping(null))}>
                مسح
              </Btn>
            )}
          </div>
          {files.length > 0 && (
            <div className="bt-files">
              {files.map((f, i) => (
                <span key={i} title={f.name}>
                  {f.name}
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {cols > 0 && (
            <>
              <Switch label="الصف الأول عناوين أعمدة" checked={hasHeader} onChange={setHasHeader} />
              <div className="bt-map">
                {headers.map((h, i) => (
                  <label key={i}>
                    <span title={h}>{h || `عمود ${i + 1}`}</span>
                    <Select<FieldKey> value={map[i] ?? 'skip'} options={(Object.keys(FIELD_LABELS) as FieldKey[]).map((k) => ({ value: k, label: FIELD_LABELS[k] }))} onChange={(v) => setMapping(map.map((x, j) => (j === i ? v : x)))} />
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="bt-stats">
            <b>{rows.length}</b> تصميم
            {files.length > 0 && (
              <>
                {' · '}
                <b>{withImage}</b> بصورة
                {rows.length - withImage > 0 && <span className="warn"> · {rows.length - withImage} بلا صورة</span>}
              </>
            )}
            {files.length > 0 && !hasImageCol && dataRows.length > 0 && files.length !== rows.length && <span className="warn"> · لربط الصور: أضف عموداً باسم الملف أو اجعل عدد الصور مساوياً لعدد الصفوف</span>}
          </div>
        </section>

        {files.length > 0 && cat.hasProduct && (
          <section className="bt-sec">
            <h4>
              <b>3</b> معالجة الصور
            </h4>
            <Chips
              value={imageMode}
              wrap
              options={[
                { value: 'cutout', label: 'تفريغ تلقائي للمنتج (أبطأ)', title: 'يزيل الخلفية بالذكاء الاصطناعي — يحتاج نحو 3–8 ثوانٍ لكل صورة' },
                { value: 'product', label: 'كمنتج كما هي', title: 'مناسب لصور PNG المفرّغة أصلاً' },
                { value: 'scene', label: 'كصورة خلفية' },
              ]}
              onChange={setImageMode}
            />
            {imageMode === 'cutout' && <p className="hint">أول مرة يُحمَّل نموذج التفريغ من الإنترنت (نحو 80MB) ثم يعمل دون اتصال. صور PNG الشفافة تُستخدم كما هي دون تفريغ.</p>}
          </section>
        )}
        {files.length > 0 && !cat.hasProduct && <p className="hint">قوالب «{cat.name}» لا تعرض صورة منتج — لن تُستخدم الصور فيها (للأسماء فقط).</p>}

        <section className="bt-sec">
          <h4>
            <b>{files.length > 0 && cat.hasProduct ? 4 : 3}</b> الإخراج
          </h4>
          <Switch label="تصدير صور (ZIP)" checked={exportImages} onChange={setExportImages} />
          {exportImages && (
            <>
              <div className="xp-f">
                <span>الصيغة والدقة</span>
                <Chips
                  value={`${imageFormat}${scale}`}
                  wrap
                  options={[
                    { value: 'png1', label: 'PNG ×1' },
                    { value: 'png2', label: 'PNG ×2' },
                    { value: 'jpg1', label: 'JPG ×1' },
                    { value: 'jpg2', label: 'JPG ×2' },
                  ]}
                  onChange={(v) => (setImageFormat(v.startsWith('png') ? 'png' : 'jpg'), setScale(Number(v.slice(3))))}
                />
              </div>
              <div className="xp-f">
                <span>تسمية الملفات</span>
                <input className="txi" dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
                <div className="xp-tokens">
                  {NAME_TOKENS.map((t) => (
                    <button key={t.token} onClick={() => setName(`${name} ${t.token}`.trim())}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <Switch label="حفظ كل تصميم كمشروع قابل للتعديل (في «مشاريعي»)" checked={saveProjects} onChange={setSaveProjects} />
          <Switch label="إفراغ الحقول غير الموجودة في الجدول (بدل النصوص النائبة)" checked={blankUnmapped} onChange={setBlankUnmapped} />
        </section>

        {previews.length > 0 && (
          <section className="bt-sec">
            <h4>معاينة أول {previews.length} تصاميم (نصوص فقط — الصور تُضاف عند التوليد)</h4>
            <div className="bt-prev">
              {previews.map((d, i) => (
                <PosterThumb key={i} design={d} brand={brand} partners={partners} fontsVersion={fontsVersion} lazy={false} placeholders="none" />
              ))}
            </div>
          </section>
        )}

        <div className="xp-go">
          {busy ? (
            <div className="xp-prog">
              <div className="xp-prog-top">
                <Loader2 size={16} className="spin" />
                <b>{busy.label}</b>
                <span style={{ flex: 1 }} />
                <Btn small variant="ghost" icon={<X size={14} />} onClick={() => (ctl.current.cancelled = true)}>
                  إلغاء
                </Btn>
              </div>
              <div className="task-bar">
                <i style={{ width: `${Math.round((busy.done / Math.max(1, busy.total)) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <>
              <Btn variant="primary" icon={<Play size={16} />} disabled={!rows.length} onClick={start}>
                ابدأ التوليد ({rows.length} تصميم{formats.length > 1 ? ` × ${formats.length} مقاس` : ''})
              </Btn>
              <span className="hint">{!rows.length ? 'الصق جدولاً أو ارفع صوراً للبدء' : ''}</span>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}



import { useEffect, useMemo, useRef, useState } from 'react'
import { Clapperboard, Download, FileText, Film, Images, Layers, Loader2, Play, X } from 'lucide-react'
import { Btn, Chips, Select, Slider, Switch } from '../ui/kit'
import { Modal } from './Dialogs'
import { setPrefs, toast, useEditor } from '../store/editor'
import { FORMATS } from '../model/formats'
import { canvasOf } from '../model/types'
import { NAME_TOKENS, buildName, titleOf } from '../lib/naming'
import { PAGE_SIZES } from '../lib/pdf'
import { CANCELLED, PSD_LAYERS, runImages, runPdf, runPsd, type Ctl, type PdfJob, type Scope } from '../lib/exportJobs'
import { MOTION_PRESETS, drawSlide, motionSupport, renderSlideLayers, runMotion, type MotionPreset, type SlideLayers } from '../lib/motion'

const close = () => useEditor.setState({ dialog: null })

type Kind = 'images' | 'pdf' | 'psd' | 'video' | 'gif'

const KINDS: { id: Kind; name: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'images', name: 'صور PNG / JPG', sub: 'مقاسات متعددة في حزمة ZIP', icon: <Images size={20} /> },
  { id: 'pdf', name: 'PDF للطباعة', sub: 'A4 / A5 / A3 بدقة 150–300 dpi', icon: <FileText size={20} /> },
  { id: 'psd', name: 'PSD بطبقات', sub: 'للتعديل في فوتوشوب', icon: <Layers size={20} /> },
  { id: 'video', name: 'فيديو MP4', sub: 'ريلز وستوري متحرك', icon: <Film size={20} /> },
  { id: 'gif', name: 'GIF متحرك', sub: 'خفيف للمشاركة السريعة', icon: <Clapperboard size={20} /> },
]

/** معاينة حية للحركة على الشريحة الحالية */
function MotionPreview({ preset, seconds }: { preset: MotionPreset; seconds: number }) {
  const design = useEditor((s) => s.design)
  const cv = canvasOf(design)
  const ref = useRef<HTMLCanvasElement>(null)
  const [layers, setLayers] = useState<SlideLayers | null>(null)
  const [loading, setLoading] = useState(true)
  const W = 300
  const scale = W / cv.w
  useEffect(() => {
    let alive = true
    setLoading(true)
    renderSlideLayers(design, useEditor.getState(), scale, { cancelled: false })
      .then((L) => alive && (setLayers(L), setLoading(false)))
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.templateId, design.content, design.style, cv.w, cv.h])
  useEffect(() => {
    const c = ref.current
    if (!c || !layers) return
    const ctx = c.getContext('2d')!
    let raf = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      const cycle = seconds + 1.2
      const T = ((now - t0) / 1000) % cycle
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, c.width, c.height)
      drawSlide(ctx, layers, Math.min(T, seconds), seconds, preset, 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [layers, preset, seconds])
  return (
    <div className="mp">
      <canvas ref={ref} width={Math.round(cv.w * scale)} height={Math.round(cv.h * scale)} />
      {loading && (
        <span className="mp-load">
          <Loader2 size={18} className="spin" />
        </span>
      )}
    </div>
  )
}

export default function ExportDialog() {
  const slideCount = useEditor((s) => s.slides.length)
  const prefs = useEditor((s) => s.prefs)
  const design = useEditor((s) => s.design)
  const cv = canvasOf(design)
  const sup = useMemo(motionSupport, [])
  const [kind, setKind] = useState<Kind>('images')
  const [scope, setScope] = useState<Scope>(useEditor.getState().slides.length > 1 ? 'all' : 'current')
  // صور
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [quality, setQuality] = useState(92)
  const [scale, setScale] = useState(1)
  const sizes = prefs.sizesToExport
  // PDF
  const [page, setPage] = useState<PdfJob['page']>('a4')
  const [fit, setFit] = useState<PdfJob['fit']>('fit')
  const [margin, setMargin] = useState(8)
  const [dpi, setDpi] = useState<150 | 300>(300)
  // PSD
  const [psdScale, setPsdScale] = useState(1)
  // حركة
  const [preset, setPreset] = useState<MotionPreset>('rise')
  const [seconds, setSeconds] = useState(4)
  const [fps, setFps] = useState(30)
  const [vw, setVw] = useState(1080)
  const [gw, setGw] = useState(480)
  const [gfps, setGfps] = useState(12)
  const [cover, setCover] = useState(true)
  // تنفيذ
  const [busy, setBusy] = useState<{ done: number; total: number; label: string } | null>(null)
  const ctl = useRef<Ctl>({ cancelled: false })

  const multi = slideCount > 1
  const toggleSize = (id: string) => setPrefs({ sizesToExport: sizes.includes(id) ? sizes.filter((x) => x !== id) : [...sizes, id] })
  const nameSample = buildName(prefs.nameTemplate || '{title}', { title: titleOf(design), template: 'Template', size: cv.format ?? 'post', n: 1, project: useEditor.getState().projectName || 'project', category: 'ads', ext: format })
  const files = (scope === 'all' ? slideCount : 1) * Math.max(1, sizes.length)

  const start = async () => {
    if (busy) return
    ctl.current = { cancelled: false }
    setBusy({ done: 0, total: 1, label: 'جارِ التجهيز…' })
    const progress = (done: number, total: number, label: string) => setBusy({ done, total, label })
    try {
      if (kind === 'images') {
        const r = await runImages({ scope, sizes, format, scale, quality: quality / 100, nameTemplate: prefs.nameTemplate }, ctl.current, progress)
        toast(r.files === 1 ? `تم التصدير ✓ ${r.name}` : `تم إنشاء ${r.files} صورة داخل ${r.name}`, 'ok', 5000)
      } else if (kind === 'pdf') {
        const r = await runPdf({ scope, page, fit, margin, dpi, quality: quality / 100 }, ctl.current, progress)
        toast(`تم إنشاء PDF (${r.pages} صفحة · ~${r.dpi} dpi)`, 'ok', 5000)
      } else if (kind === 'psd') {
        const r = await runPsd({ scope, scale: psdScale }, ctl.current, progress)
        toast(r.files === 1 ? `تم إنشاء PSD بـ ${r.layers} طبقة` : `تم إنشاء ${r.files} ملف PSD`, 'ok', 5000)
      } else {
        const r = await runMotion(
          { scope, preset, seconds, fps: kind === 'gif' ? gfps : fps, width: kind === 'gif' ? gw : vw, kind: kind === 'gif' ? 'gif' : 'video', cover },
          ctl.current,
          progress,
        )
        toast(`تم إنشاء ${r.codec} (${r.seconds.toFixed(1)} ث · ${r.frames} إطار)`, 'ok', 5000)
        if (!r.compat && kind === 'video') toast('هذا الفيديو ليس بترميز H.264، وقد ترفضه إنستغرام عند الرفع — للحصول على MP4 مباشر استخدم Chrome أو Edge (أو حوّله بأي محوّل فيديو).', 'info', 9000)
      }
    } catch (e) {
      if ((e as Error).message !== CANCELLED) {
        console.error(e)
        toast(`فشل التصدير: ${(e as Error).message ?? e}`, 'error', 7000)
      } else toast('أُلغي التصدير', 'info', 2000)
    } finally {
      setBusy(null)
    }
  }

  const scopeRow = multi && (
    <div className="xp-f">
      <span>النطاق</span>
      <Chips
        value={scope}
        options={[
          { value: 'current', label: 'الشريحة الحالية' },
          { value: 'all', label: `كل الشرائح (${slideCount})` },
        ]}
        onChange={setScope}
      />
    </div>
  )

  return (
    <Modal title="تصدير متقدم" onClose={() => (busy ? undefined : close())} wide="xl">
      <div className="xp">
        <nav className="xp-nav">
          {KINDS.map((k) => (
            <button key={k.id} className={kind === k.id ? 'on' : ''} onClick={() => !busy && setKind(k.id)}>
              {k.icon}
              <span>
                <b>{k.name}</b>
                <small>{k.sub}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="xp-main">
          {scopeRow}

          {kind === 'images' && (
            <>
              <div className="xp-f">
                <span>الصيغة</span>
                <Chips value={format} options={[{ value: 'png', label: 'PNG (أعلى جودة)' }, { value: 'jpg', label: 'JPG (أخف)' }]} onChange={setFormat} />
              </div>
              {format === 'jpg' && <Slider label="جودة JPG" value={quality} min={60} max={100} unit="%" onChange={setQuality} />}
              <div className="xp-f">
                <span>الدقة</span>
                <Chips
                  value={scale}
                  options={[1, 2, 3].map((k) => ({ value: k, label: `×${k}  (${cv.w * k}×${cv.h * k})` }))}
                  onChange={setScale}
                />
              </div>
              <div className="xp-f">
                <span>المقاسات</span>
                <div className="xp-sizes">
                  <button className={sizes.includes('current') ? 'on' : ''} onClick={() => toggleSize('current')}>
                    <b>الحالي</b>
                    <small>
                      {cv.w}×{cv.h}
                    </small>
                  </button>
                  {FORMATS.map((f) => (
                    <button key={f.id} className={sizes.includes(f.id) ? 'on' : ''} onClick={() => toggleSize(f.id)}>
                      <b>{f.name}</b>
                      <small>
                        {f.w}×{f.h}
                      </small>
                    </button>
                  ))}
                </div>
                <p className="hint">كل مقاس يُعاد ترتيبه ذكياً (منتج، نصوص، لوغو، مناطق آمنة للستوري) — ثم تُجمع النتائج في ملف ZIP.</p>
              </div>
              <div className="xp-f">
                <span>تسمية الملفات</span>
                <input className="txi" dir="auto" value={prefs.nameTemplate} onChange={(e) => setPrefs({ nameTemplate: e.target.value })} />
                <div className="xp-tokens">
                  {NAME_TOKENS.map((t) => (
                    <button key={t.token} onClick={() => setPrefs({ nameTemplate: `${prefs.nameTemplate}${prefs.nameTemplate.endsWith(' ') || !prefs.nameTemplate ? '' : ' '}${t.token}` })}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="hint" dir="auto">
                  مثال: <code>{nameSample}</code>
                </p>
              </div>
            </>
          )}

          {kind === 'pdf' && (
            <>
              <div className="xp-f">
                <span>مقاس الورق</span>
                <Select<string> value={page} options={[{ value: 'design', label: 'بمقاس التصميم (رقمي)' }, ...Object.entries(PAGE_SIZES).map(([id, p]) => ({ value: id, label: p.name }))]} onChange={(v) => setPage(v as PdfJob['page'])} />
              </div>
              {page !== 'design' && (
                <>
                  <div className="xp-f">
                    <span>ملاءمة الصورة</span>
                    <Chips value={fit} options={[{ value: 'fit', label: 'احتواء كامل بهوامش' }, { value: 'fill', label: 'ملء الصفحة وقص الزائد' }]} onChange={setFit} />
                  </div>
                  {fit === 'fit' && <Slider label="الهامش" value={margin} min={0} max={30} unit="مم" onChange={setMargin} />}
                  <div className="xp-f">
                    <span>الدقة</span>
                    <Chips value={dpi} options={[{ value: 150, label: '150 dpi (خفيف)' }, { value: 300, label: '300 dpi (طباعة)' }]} onChange={setDpi} />
                  </div>
                </>
              )}
              <Slider label="جودة الصورة داخل PDF" value={quality} min={70} max={100} unit="%" onChange={setQuality} />
              <p className="hint">كل شريحة صفحة مستقلة. إن كانت دقة التصميم أقل من المطلوب للورق الكبير فستظهر الصورة أنعم قليلاً — استخدم تكبير الدقة ×2 لصور الخلفية من «صورة الخلفية».</p>
            </>
          )}

          {kind === 'psd' && (
            <>
              <div className="xp-f">
                <span>الدقة</span>
                <Chips value={psdScale} options={[1, 2].map((k) => ({ value: k, label: `×${k}  (${cv.w * k}×${cv.h * k})` }))} onChange={setPsdScale} />
              </div>
              <div className="xp-layers">
                {PSD_LAYERS.map((l) => (
                  <span key={l.id}>{l.name}</span>
                ))}
              </div>
              <p className="hint">يُنشأ ملف بطبقات مستقلة (الفارغة تُحذف تلقائياً). النصوص تُصدَّر كطبقة صورة عالية الجودة وليست نصاً قابلاً للتحرير — بسبب خطوط الهوية المخصصة.</p>
            </>
          )}

          {(kind === 'video' || kind === 'gif') && (
            <>
              <div className="xp-motion">
                <MotionPreview preset={preset} seconds={Math.min(seconds, 3.2)} />
                <div className="xp-motion-side">
                  <div className="xp-f">
                    <span>أسلوب الحركة</span>
                    <div className="xp-presets">
                      {MOTION_PRESETS.map((p) => (
                        <button key={p.id} className={preset === p.id ? 'on' : ''} onClick={() => setPreset(p.id)}>
                          <b>{p.name}</b>
                          <small>{p.hint}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <Slider label={multi && scope === 'all' ? 'مدة كل شريحة' : 'المدة'} value={seconds} min={2} max={10} step={0.5} unit="ث" onChange={setSeconds} />
              <Switch label="الإطار الأول = التصميم كاملاً (يصلح غلافاً)" checked={cover} onChange={setCover} />
              {kind === 'video' ? (
                <>
                  <div className="xp-f">
                    <span>الجودة</span>
                    <Chips value={vw} options={[{ value: 540, label: '540p' }, { value: 720, label: '720p' }, { value: 1080, label: '1080p' }]} onChange={setVw} />
                  </div>
                  <div className="xp-f">
                    <span>معدل الإطارات</span>
                    <Chips value={fps} options={[{ value: 24, label: '24' }, { value: 30, label: '30' }]} onChange={setFps} />
                  </div>
                  <p className="hint">
                    {sup.mp4
                      ? 'يُرمَّز MP4 (H.264) مباشرة في المتصفح وأسرع من الزمن الحقيقي — صالح لريلز وستوري إنستغرام. بدون صوت.'
                      : 'متصفحك لا يدعم الترميز السريع: سيُسجَّل الفيديو بالزمن الحقيقي (WebM أو MP4 حسب المتصفح). للحصول على MP4 مباشرة استخدم Chrome أو Edge.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="xp-f">
                    <span>العرض</span>
                    <Chips value={gw} options={[{ value: 360, label: '360' }, { value: 480, label: '480' }, { value: 540, label: '540' }, { value: 720, label: '720' }]} onChange={setGw} />
                  </div>
                  <div className="xp-f">
                    <span>معدل الإطارات</span>
                    <Chips value={gfps} options={[{ value: 8, label: '8' }, { value: 12, label: '12' }, { value: 15, label: '15' }]} onChange={setGfps} />
                  </div>
                  <p className="hint">GIF محدود بـ 256 لوناً لكل إطار فتبدو التدرجات أخشن من الفيديو — الفيديو أفضل للنشر على إنستغرام.</p>
                </>
              )}
            </>
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
                <Btn variant="primary" icon={kind === 'video' || kind === 'gif' ? <Play size={16} /> : <Download size={16} />} onClick={start}>
                  {kind === 'images' && (files > 1 ? `تصدير ${files} صورة (ZIP)` : 'تصدير الصورة')}
                  {kind === 'pdf' && 'إنشاء PDF'}
                  {kind === 'psd' && 'إنشاء PSD'}
                  {kind === 'video' && 'إنشاء الفيديو'}
                  {kind === 'gif' && 'إنشاء GIF'}
                </Btn>
                <span className="hint">{kind === 'images' && files > 1 ? 'يُحفظ كل شيء داخل ملف ZIP واحد' : ''}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

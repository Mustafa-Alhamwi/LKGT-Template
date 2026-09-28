import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Check, Download, Eye, EyeOff, HardDriveDownload, Loader2, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { saveAsTemplate, setPrefs, toast, useEditor } from '../store/editor'
import { buildCommands, formatKeys, keysFor } from '../lib/commands'
import { AR_WEIGHTS, LAT_WEIGHTS, UI_WEIGHTS, canQueryLocalFonts, clearImportedFonts, importFontFiles, importFromDevice } from '../lib/fonts'
import { Btn, Chips, Switch } from '../ui/kit'
import { pickFile } from '../lib/importer'
import { reloadFonts } from '../lib/fontBoot'
import { AI_MODELS, testClaude } from '../lib/claude'
import { canInstall, installApp, onInstallChange } from '../lib/pwa'

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean | 'xl' }) {
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className={`modal ${wide === 'xl' ? 'xl' : wide ? 'wide' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ibtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

const close = () => useEditor.setState({ dialog: null })

function FontRows({ title, rows, family, dir }: { title: string; rows: { w: number; label: string; ar: string; origin?: string }[]; family: (w: number) => string; dir?: 'ltr' }) {
  return (
    <div>
      <h4 className="ftitle">{title}</h4>
      {rows.map((r) => (
        <div key={r.w} className="font-line" dir={dir}>
          <span style={{ fontFamily: `${family(r.w)}, Tajawal, sans-serif`, fontWeight: r.w }}>{dir ? `LKGT Studio ${r.label}` : `أبجد هوز ${r.ar}`}</span>
          <small>{r.w}</small>
          {r.origin === 'local' || r.origin === 'file' ? <b className="ok">✓</b> : <b className="bad">غير موجود</b>}
        </div>
      ))}
    </div>
  )
}

function FontsTab() {
  const fonts = useEditor((s) => s.fonts)
  const [busy, setBusy] = useState(false)
  return (
    <div className="settings-block">
      <p>
        <b>واجهة البرنامج</b> بخط <b>Qomra</b>، و<b>التصاميم</b>: العربي بخط <b>Araboto</b> والإنكليزي بخط <b>HP Simplified</b> — يتبدّل حرفاً بحرف داخل السطر الواحد.
      </p>
      <div className="font-table three">
        <FontRows title="Qomra (الواجهة)" family={() => '"LK UI"'} rows={UI_WEIGHTS.map((w) => ({ ...w, origin: fonts?.ui[w.w] }))} />
        <FontRows title="Araboto (عربي)" family={() => '"LK Ar"'} rows={AR_WEIGHTS.map((w) => ({ ...w, origin: fonts?.ar[w.w] }))} />
        <FontRows title="HP Simplified" family={(w) => `"LK Lat ${w}"`} dir="ltr" rows={LAT_WEIGHTS.map((w) => ({ ...w, origin: fonts?.lat[w.w] }))} />
      </div>
      <p className="hint">يكتشف البرنامج الخطوط المثبتة على جهازك تلقائياً. إذا ظهر «غير موجود» لوزن مثبت عندك، استورده مرة واحدة (يُحفظ داخل البرنامج):</p>
      <div className="row-btns">
        {canQueryLocalFonts && (
          <Btn
            variant="primary"
            icon={<HardDriveDownload size={15} />}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await importFromDevice()
                await reloadFonts()
                toast(r.added.length ? `تم استيراد ${r.added.length} خط من الجهاز` : 'لم يُعثر على Qomra أو Araboto أو HP Simplified', r.added.length ? 'ok' : 'error')
              } catch (e) {
                toast(`تعذّر الوصول للخطوط: ${String(e)}`, 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            استيراد من خطوط الجهاز
          </Btn>
        )}
        <Btn
          icon={<Upload size={15} />}
          disabled={busy}
          onClick={async () => {
            const files = await pickFile('.ttf,.otf,font/ttf,font/otf', true)
            if (!files.length) return
            setBusy(true)
            const r = await importFontFiles(files)
            await reloadFonts()
            setBusy(false)
            toast(`أضيف: ${r.added.length}${r.skipped.length ? ` — تم تجاهل: ${r.skipped.join('، ')}` : ''}`, r.added.length ? 'ok' : 'error', 6000)
          }}
        >
          رفع ملفات الخطوط
        </Btn>
        <Btn
          variant="ghost"
          icon={<Trash2 size={15} />}
          onClick={async () => {
            await clearImportedFonts()
            await reloadFonts()
            toast('تم مسح الخطوط المستوردة', 'info')
          }}
        >
          مسح المستوردة
        </Btn>
      </div>
      <p className="hint">
        أو انسخ ملفات الخطوط (.ttf / .otf) إلى المجلد <code>src/fonts</code> فتُحمَّل تلقائياً — يتعرف البرنامج على الخط من اسمه داخل الملف.
      </p>
    </div>
  )
}

function BrandTab() {
  const brand = useEditor((s) => s.brand)
  return (
    <div className="settings-block">
      <p>
        الهوية الفعّالة الآن: <b>{brand.name}</b> — تتحكم بلون القوالب ومعلومات التواصل واللوغو وأماكن العناصر الثابتة.
      </p>
      <Btn variant="primary" icon={<ArrowLeftRight size={15} />} onClick={() => useEditor.setState({ dialog: 'kits' })}>
        فتح مجموعات الهوية
      </Btn>
      <p className="hint">يمكنك حفظ أكثر من مجموعة (لأكثر من علامة أو فرع) والتبديل بينها، مع إعادة تلوين القوالب تلقائياً.</p>
    </div>
  )
}

function AiTab() {
  const q = useEditor((s) => s.removalQuality)
  const prefs = useEditor((s) => s.prefs)
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)
  const model = AI_MODELS.find((m) => m.id === prefs.aiModel)
  return (
    <div className="settings-block">
      <h4 className="ftitle">التفريغ الذكي للمنتجات</h4>
      <p>التفريغ يتم بالكامل داخل متصفحك (لا تُرفع الصور لأي خادم). أول مرة يُحمَّل النموذج من الإنترنت ثم يُحفظ.</p>
      <Chips
        value={q}
        options={[
          { value: 'small', label: 'سريع (~40MB)' },
          { value: 'medium', label: 'دقيق (~80MB)' },
        ]}
        onChange={(v) => useEditor.setState({ removalQuality: v })}
      />
      <p className="hint">
        للعمل بدون إنترنت نهائياً: شغّل <code>npm run model:offline</code> مرة واحدة فينسخ النموذج إلى <code>public/imgly</code>.
      </p>
      <h4 className="ftitle" style={{ marginTop: 6 }}>مساعد الكتابة بـ Claude (اختياري)</h4>
      <p>
        بدون مفتاح يعمل مساعد الكتابة بالوضع المحلي السريع. لتفعيل وضع <b>Claude</b> الأذكى أدخل مفتاح API الخاص بك (من console.anthropic.com).
      </p>
      <div className="ai-key">
        <input
          className="txi ltr"
          dir="ltr"
          type={show ? 'text' : 'password'}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          value={prefs.aiKey}
          onChange={(e) => setPrefs({ aiKey: e.target.value.trim() })}
        />
        <button type="button" className="ibtn" title={show ? 'إخفاء' : 'إظهار'} onClick={() => setShow(!show)}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <Btn
          disabled={!prefs.aiKey || testing}
          icon={testing ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
          onClick={async () => {
            setTesting(true)
            try {
              await testClaude(prefs.aiKey, prefs.aiModel)
              toast('الاتصال بـ Claude يعمل ✓', 'ok')
            } catch (e) {
              toast(String((e as Error).message), 'error', 6000)
            } finally {
              setTesting(false)
            }
          }}
        >
          اختبار
        </Btn>
        {prefs.aiKey && (
          <Btn variant="ghost" icon={<Trash2 size={15} />} onClick={() => setPrefs({ aiKey: '' })}>
            حذف
          </Btn>
        )}
      </div>
      <Chips value={model ? prefs.aiModel : ''} wrap options={AI_MODELS.map((m) => ({ value: m.id, label: m.label, title: m.hint }))} onChange={(v) => setPrefs({ aiModel: v })} />
      <p className="hint">{model?.hint ?? 'نموذج مخصص'}</p>
      <div className="alert">
        <AlertTriangle size={16} />
        <span>المفتاح يُحفظ في متصفح هذا الجهاز فقط ويُرسَل مباشرةً إلى Anthropic — لا يمر عبر أي خادم آخر ولا يدخل في ملفات المشاريع أو القوالب. لا تستخدم مفتاحك على جهاز مشترك.</span>
      </div>
    </div>
  )
}

function AppTab() {
  const [, force] = useState(0)
  const checkBefore = useEditor((s) => s.prefs.checkBeforeExport)
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => onInstallChange(() => force((x) => x + 1)), [])
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }))
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 1e9 ? 0 : 1)} MB`
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
  const offline = !!navigator.serviceWorker?.controller
  return (
    <div className="settings-block">
      <p>
        يعمل LKGT Studio كتطبيق ويب تقدّمي (PWA): يُثبَّت على الجهاز ويعمل <b>بدون إنترنت</b> بعد أول تشغيل. أول مرة فقط يحتاج الإنترنت لتحميل نموذج التفريغ الذكي (يُحفظ بعدها).
      </p>
      <div className="app-rows">
        <div>
          <span>حالة التثبيت</span>
          <b>{standalone ? 'مثبّت ✓' : canInstall() ? 'جاهز للتثبيت' : 'يعمل داخل المتصفح'}</b>
        </div>
        <div>
          <span>العمل دون اتصال</span>
          <b>{offline ? 'جاهز ✓' : import.meta.env.DEV ? 'مُعطَّل في وضع التطوير' : 'يُفعَّل بعد إعادة فتح الصفحة'}</b>
        </div>
        <div>
          <span>مساحة التخزين المستخدمة</span>
          <b dir="ltr">{usage ? `${mb(usage.used)} / ${mb(usage.quota)}` : '—'}</b>
        </div>
      </div>
      <div className="row-btns">
        {canInstall() && (
          <Btn variant="primary" icon={<Download size={15} />} onClick={() => void installApp()}>
            تثبيت كتطبيق
          </Btn>
        )}
        <Btn
          icon={<ShieldCheck size={15} />}
          disabled={persisted === true}
          onClick={async () => {
            const ok = await navigator.storage?.persist?.()
            setPersisted(!!ok)
            toast(ok ? 'أصبح تخزين مشاريعك محمياً من الحذف التلقائي ✓' : 'لم يمنح المتصفح الحماية الدائمة — ثبّت البرنامج كتطبيق ثم أعد المحاولة', ok ? 'ok' : 'info', 5000)
          }}
        >
          {persisted ? 'التخزين محمي ✓' : 'حماية بياناتي من الحذف التلقائي'}
        </Btn>
      </div>
      <Switch label="فحص جودة التصميم تلقائياً قبل التصدير" checked={checkBefore} onChange={(v) => setPrefs({ checkBeforeExport: v })} />
      <p className="hint">المشاريع والصور والمكتبة تُحفظ على هذا الجهاز فقط (IndexedDB). للنسخ الاحتياطي: «ملف ← تصدير ملف المشروع (.lkgt)» لكل مشروع، وحزم الفريق من الصفحة الرئيسية للقوالب والهوية.</p>
    </div>
  )
}

export function SettingsDialog() {
  const [tab, setTab] = useState<'fonts' | 'brand' | 'ai' | 'app'>('fonts')
  const fonts = useEditor((s) => s.fonts)
  const missing = fonts && [fonts.ui, fonts.ar, fonts.lat].some((g) => Object.values(g).every((v) => v === 'missing'))
  return (
    <Modal title="الإعدادات" onClose={close} wide>
      {missing && (
        <div className="alert">
          <AlertTriangle size={16} /> لم يُعثر على أحد الخطوط بالكامل — يُستخدم خط بديل مؤقتاً.
        </div>
      )}
      <Chips
        value={tab}
        options={[
          { value: 'fonts', label: 'الخطوط' },
          { value: 'brand', label: 'الهوية الثابتة' },
          { value: 'ai', label: 'الذكاء الاصطناعي' },
          { value: 'app', label: 'التطبيق' },
        ]}
        onChange={setTab}
      />
      {tab === 'fonts' && <FontsTab />}
      {tab === 'brand' && <BrandTab />}
      {tab === 'ai' && <AiTab />}
      {tab === 'app' && <AppTab />}
    </Modal>
  )
}

export function SaveTemplateDialog() {
  const [name, setName] = useState('')
  const save = () => {
    const n = name.trim() || `قالبي ${new Date().toLocaleDateString('ar')}`
    saveAsTemplate(n)
    toast(`تم حفظ القالب «${n}» في «قوالبي»`, 'ok')
    close()
  }
  return (
    <Modal title="حفظ كقالب جديد" onClose={close}>
      <p className="hint">يُحفظ شكل التصميم الحالي (الألوان، الأشكال، البطاقات، مواضع النصوص، شريط التواصل…) كقالب جديد فارغ في «قوالبي».</p>
      <input className="txi big" autoFocus placeholder="اسم القالب" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <div className="row-btns">
        <Btn variant="primary" icon={<Check size={15} />} onClick={save}>
          حفظ
        </Btn>
        <Btn variant="ghost" onClick={close}>
          إلغاء
        </Btn>
      </div>
    </Modal>
  )
}

const FIXED_SHORTCUTS: [string, string][] = [
  ['نقر مزدوج على نص', 'تعديل النص مباشرة'],
  ['Ctrl + Enter / Esc', 'إنهاء تعديل النص'],
  ['سحب', 'تحريك العناصر — مع التحديد المتعدد تتحرك معاً'],
  ['Shift + نقر', 'إضافة عنصر للتحديد المتعدد'],
  ['سحب على الخلفية', 'تحديد عدة عناصر بمربع'],
  ['Shift + سحب', 'تحريك أفقي أو عمودي فقط'],
  ['Alt + سحب', 'تعطيل الالتصاق بالخطوط الإرشادية'],
  ['عجلة الفأرة', 'تكبير الخلفية أو المنتج المحدد'],
  ['Ctrl + عجلة الفأرة', 'تكبير/تصغير مساحة العمل'],
  ['الأسهم (مع تحديد)', 'تحريك دقيق 1px — مع Shift 10px'],
  ['← / → (بدون تحديد)', 'القالب التالي / السابق'],
  ['Ctrl + K', 'لوحة الأوامر — ابحث عن أي أمر'],
]

function KeyRecorder({ id, current, onDone }: { id: string; current: string; onDone: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
      if (e.key === 'Escape') return onDone()
      const inv: Record<string, string> = { BracketLeft: '[', BracketRight: ']', Slash: '/', Comma: ',', Period: '.', Equal: '=', Minus: '-' }
      let k = e.code.replace(/^Key/, '').replace(/^Digit/, '')
      k = inv[e.code] ?? k
      const spec = [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.shiftKey ? 'Shift' : '', e.altKey ? 'Alt' : '', k].filter(Boolean).join('+')
      setPrefs({ shortcuts: { ...useEditor.getState().prefs.shortcuts, [id]: spec } })
      onDone()
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [id, onDone])
  return <kbd className="rec">اضغط الاختصار الجديد… ({current || 'بدون'})</kbd>
}

export function ShortcutsDialog() {
  const [rec, setRec] = useState<string | null>(null)
  const prefs = useEditor((s) => s.prefs)
  const cmds = buildCommands().filter((c) => c.keys || prefs.shortcuts[c.id])
  return (
    <Modal title="اختصارات لوحة المفاتيح" onClose={close} wide>
      <p className="hint">الاختصارات تعمل بأي لغة كتابة (تعتمد على موضع المفتاح). انقر «تغيير» لتخصيص أي اختصار.</p>
      <div className="shortcuts">
        {FIXED_SHORTCUTS.map(([k, v]) => (
          <div key={k}>
            <kbd>{k}</kbd>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <h4 className="ftitle" style={{ marginTop: 14 }}>اختصارات قابلة للتخصيص</h4>
      <div className="shortcuts custom">
        {cmds.map((c) => {
          const cur = keysFor(c)
          return (
            <div key={c.id}>
              {rec === c.id ? <KeyRecorder id={c.id} current={cur ?? ''} onDone={() => setRec(null)} /> : <kbd>{cur ? formatKeys(cur) : 'بدون'}</kbd>}
              <span>{c.label}</span>
              <button className="link" onClick={() => setRec(c.id)}>
                تغيير
              </button>
              {prefs.shortcuts[c.id] !== undefined && (
                <button
                  className="link"
                  onClick={() => {
                    const { [c.id]: _x, ...rest } = prefs.shortcuts
                    setPrefs({ shortcuts: rest })
                  }}
                >
                  استعادة
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

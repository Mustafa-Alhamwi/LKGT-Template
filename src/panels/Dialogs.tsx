import { useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Check, HardDriveDownload, Trash2, Upload, X } from 'lucide-react'
import { saveAsTemplate, setBrand, toast, useEditor } from '../store/editor'
import { AR_WEIGHTS, LAT_WEIGHTS, UI_WEIGHTS, canQueryLocalFonts, clearImportedFonts, importFontFiles, importFromDevice } from '../lib/fonts'
import { Btn, Chips, Slider } from '../ui/kit'
import { pickFile } from '../lib/importer'
import { reloadFonts } from '../lib/fontBoot'

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
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
      <Btn icon={<ArrowLeftRight size={15} />} onClick={() => setBrand({ logoSide: brand.logoSide === 'right' ? 'left' : 'right' })}>
        لوغو LKGT على {brand.logoSide === 'right' ? 'اليمين' : 'اليسار'} — تبديل
      </Btn>
      <div className="grid-2">
        <Slider label="ارتفاع لوغو LKGT" value={brand.logo.h} min={60} max={220} onChange={(v) => setBrand({ logo: { ...brand.logo, h: v } })} />
        <Slider label="بعده عن الأعلى" value={brand.logo.top} min={0} max={200} onChange={(v) => setBrand({ logo: { ...brand.logo, top: v } })} />
        <Slider label="بعده عن الجانب" value={brand.logo.side} min={0} max={200} onChange={(v) => setBrand({ logo: { ...brand.logo, side: v } })} />
        <Slider label="أقصى عرض للوغو الشريك" value={brand.partner.maxW} min={100} max={400} onChange={(v) => setBrand({ partner: { ...brand.partner, maxW: v } })} />
        <Slider label="أقصى ارتفاع للوغو الشريك" value={brand.partner.maxH} min={40} max={200} onChange={(v) => setBrand({ partner: { ...brand.partner, maxH: v } })} />
        <Slider label="أعلى لوغو الشريك" value={brand.partner.top} min={0} max={200} onChange={(v) => setBrand({ partner: { ...brand.partner, top: v } })} />
        <Slider label="موضع شريط التواصل (ص)" value={brand.contact.y} min={1100} max={1400} onChange={(v) => setBrand({ contact: { ...brand.contact, y: v } })} />
        <Slider label="عرض الشريط" value={brand.contact.w} min={500} max={1040} onChange={(v) => setBrand({ contact: { ...brand.contact, w: v } })} />
        <Slider label="ارتفاع الشريط" value={brand.contact.h} min={36} max={100} onChange={(v) => setBrand({ contact: { ...brand.contact, h: v } })} />
        <Slider label="حجم خط الشريط" value={brand.contact.fontSize} min={16} max={40} onChange={(v) => setBrand({ contact: { ...brand.contact, fontSize: v } })} />
      </div>
      <p className="hint">هذه القيم ثابتة لكل القوالب (هوية موحدة) — عدّلها هنا فقط عند الحاجة.</p>
    </div>
  )
}

function AiTab() {
  const q = useEditor((s) => s.removalQuality)
  return (
    <div className="settings-block">
      <p>التفريغ الذكي يتم بالكامل داخل متصفحك (لا تُرفع الصور لأي خادم). أول مرة يُحمَّل النموذج من الإنترنت ثم يُحفظ.</p>
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
    </div>
  )
}

export function SettingsDialog() {
  const [tab, setTab] = useState<'fonts' | 'brand' | 'ai'>('fonts')
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
          { value: 'ai', label: 'التفريغ الذكي' },
        ]}
        onChange={setTab}
      />
      {tab === 'fonts' && <FontsTab />}
      {tab === 'brand' && <BrandTab />}
      {tab === 'ai' && <AiTab />}
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

const SHORTCUTS: [string, string][] = [
  ['نقر مزدوج على نص', 'تعديل النص مباشرة'],
  ['Ctrl + Enter / Esc', 'إنهاء تعديل النص'],
  ['سحب', 'تحريك النصوص / المنتج / الخلفية / الشكل'],
  ['Shift + سحب', 'تحريك أفقي أو عمودي فقط'],
  ['عجلة الفأرة', 'تكبير الخلفية أو المنتج المحدد'],
  ['الأسهم (مع تحديد)', 'تحريك دقيق 1px — مع Shift 10px'],
  ['← / → (بدون تحديد)', 'القالب التالي / السابق'],
  ['Delete', 'إخفاء/حذف العنصر المحدد'],
  ['Ctrl + Z / Ctrl + Y', 'تراجع / إعادة (يعمل بأي لغة كتابة)'],
  ['Ctrl + E', 'تصدير'],
  ['Ctrl + V', 'لصق صورة من الحافظة'],
  ['Esc', 'إلغاء التحديد'],
]

export function ShortcutsDialog() {
  return (
    <Modal title="اختصارات لوحة المفاتيح" onClose={close}>
      <div className="shortcuts">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k}>
            <kbd>{k}</kbd>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

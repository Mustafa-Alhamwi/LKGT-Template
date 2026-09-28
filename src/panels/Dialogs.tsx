import { useState } from 'react'
import { Check, X, AlertTriangle, HardDriveDownload, Upload, Trash2, ArrowLeftRight } from 'lucide-react'
import { saveAsTemplate, setBrand, toast, useEditor } from '../store/editor'
import {
  AR_WEIGHTS,
  LAT_WEIGHTS,
  canQueryLocalFonts,
  clearImportedFonts,
  importFontFiles,
  importFromDevice,
} from '../lib/fonts'
import { Button, Row, Segmented, Slider, Toggle } from '../ui/controls'
import { pickFile } from '../lib/importer'
import { LogoOverride } from './inspect/BrandPanels'
import { reloadFonts } from '../lib/fontBoot'

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

const close = () => useEditor.setState({ dialog: null })

function FontsTab() {
  const fonts = useEditor((s) => s.fonts)
  const [busy, setBusy] = useState(false)
  const origin = (o: string | undefined) =>
    o === 'local' ? <span className="ok">مثبت ✓</span> : o === 'file' ? <span className="ok">ملف ✓</span> : <span className="bad">غير موجود</span>
  return (
    <div className="settings-block">
      <p>
        العربي دائماً بخط <b>Araboto</b> والإنكليزي دائماً بخط <b>HP Simplified</b> — يتبدّل الخط تلقائياً حرفاً بحرف حتى داخل نفس السطر، ولكل نص وزن عربي
        ووزن إنكليزي مستقلان.
      </p>
      <div className="font-table">
        <div>
          <h4>Araboto</h4>
          {AR_WEIGHTS.map((w) => (
            <div key={w.w} className="font-line">
              <span style={{ fontFamily: '"LK Ar", Tajawal, sans-serif', fontWeight: w.w }}>أبجد هوز {w.ar}</span>
              <small>{w.w}</small>
              {origin(fonts?.ar[w.w])}
            </div>
          ))}
        </div>
        <div>
          <h4>HP Simplified</h4>
          {LAT_WEIGHTS.map((w) => (
            <div key={w.w} className="font-line" dir="ltr">
              <span style={{ fontFamily: `"LK Lat ${w.w}", Tajawal, sans-serif`, fontWeight: w.w }}>LKGT Studio {w.label}</span>
              <small>{w.w}</small>
              {origin(fonts?.lat[w.w])}
            </div>
          ))}
        </div>
      </div>
      <p className="muted small">
        البرنامج يكتشف الخطوط المثبتة على جهازك تلقائياً. إذا ظهر «غير موجود» لوزن مثبت عندك، استخدم أحد الخيارين (مرة واحدة فقط — تُحفظ داخل البرنامج):
      </p>
      <Row>
        {canQueryLocalFonts && (
          <Button
            variant="primary"
            icon={<HardDriveDownload size={15} />}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await importFromDevice()
                await reloadFonts()
                toast(r.added.length ? `تم استيراد ${r.added.length} خط من الجهاز ✓` : 'لم يُعثر على Araboto أو HP Simplified', r.added.length ? 'ok' : 'error')
              } catch (e) {
                toast(`تعذّر الوصول للخطوط: ${String(e)}`, 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            استيراد من خطوط الجهاز
          </Button>
        )}
        <Button
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
        </Button>
        <Button
          variant="ghost"
          icon={<Trash2 size={15} />}
          onClick={async () => {
            await clearImportedFonts()
            await reloadFonts()
            toast('تم مسح الخطوط المستوردة', 'info')
          }}
        >
          مسح المستوردة
        </Button>
      </Row>
      <p className="muted small">
        بديل ثالث: انسخ ملفات الخطوط (.ttf / .otf) إلى المجلد <code>src/fonts</code> داخل المشروع فتُحمَّل تلقائياً مع البرنامج.
      </p>
    </div>
  )
}

function BrandTab() {
  const brand = useEditor((s) => s.brand)
  return (
    <div className="settings-block">
      <Row>
        <Button icon={<ArrowLeftRight size={15} />} onClick={() => setBrand({ logoSide: brand.logoSide === 'right' ? 'left' : 'right' })}>
          لوغو LKGT على {brand.logoSide === 'right' ? 'اليمين' : 'اليسار'} — تبديل
        </Button>
      </Row>
      <LogoOverride />
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
      <p className="muted small">هذه القيم ثابتة لكل القوالب (هوية موحدة) — عدّلها هنا فقط عند الحاجة.</p>
    </div>
  )
}

function AiTab() {
  const q = useEditor((s) => s.removalQuality)
  return (
    <div className="settings-block">
      <p>التفريغ يتم بالكامل داخل متصفحك (بدون رفع الصور لأي خادم). أول مرة يُحمَّل النموذج من الإنترنت ثم يُحفظ.</p>
      <Segmented
        value={q}
        options={[
          { value: 'small', label: 'سريع (~40MB)' },
          { value: 'medium', label: 'دقيق (~80MB)' },
        ]}
        onChange={(v) => useEditor.setState({ removalQuality: v })}
      />
      <p className="muted small">
        للعمل بدون إنترنت نهائياً: شغّل الأمر <code>npm run model:offline</code> مرة واحدة فينسخ النموذج إلى <code>public/imgly</code>.
      </p>
    </div>
  )
}

export function SettingsDialog() {
  const [tab, setTab] = useState<'fonts' | 'brand' | 'ai'>('fonts')
  const fonts = useEditor((s) => s.fonts)
  const missing = fonts && (Object.values(fonts.ar).every((v) => v === 'missing') || Object.values(fonts.lat).every((v) => v === 'missing'))
  return (
    <Modal title="الإعدادات" onClose={close} wide>
      {missing && (
        <div className="alert">
          <AlertTriangle size={16} /> لم يتم العثور على خطوط الهوية بالكامل — يُستخدم خط بديل مؤقتاً.
        </div>
      )}
      <Segmented
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
  const [withContent, setWithContent] = useState(true)
  const save = () => {
    const n = name.trim() || `قالبي ${new Date().toLocaleDateString('ar')}`
    saveAsTemplate(n, withContent)
    toast(`تم حفظ القالب «${n}» في مكتبتك ✓`, 'ok')
    close()
  }
  return (
    <Modal title="حفظ كقالب جديد" onClose={close}>
      <p className="muted">يُحفظ التصميم الحالي (الألوان، الأشكال، مواضع النصوص، شريط التواصل...) كقالب جديد في المكتبة.</p>
      <input
        className="ui-input big"
        autoFocus
        placeholder="اسم القالب"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <Toggle label="حفظ المحتوى الحالي كمحتوى تجريبي للقالب" checked={withContent} onChange={setWithContent} />
      <Row>
        <Button variant="primary" icon={<Check size={15} />} onClick={save}>
          حفظ
        </Button>
        <Button variant="ghost" onClick={close}>
          إلغاء
        </Button>
      </Row>
    </Modal>
  )
}

const SHORTCUTS: [string, string][] = [
  ['← / →', 'التنقل بين القوالب'],
  ['نقر مزدوج على نص', 'تعديل النص مباشرة'],
  ['Ctrl + Enter / Esc', 'إنهاء تعديل النص'],
  ['سحب', 'تحريك النصوص / المنتج / الخلفية / الشكل'],
  ['Shift + سحب', 'تحريك أفقي أو عمودي فقط'],
  ['عجلة الفأرة', 'تكبير الخلفية أو المنتج المحدد'],
  ['الأسهم (مع تحديد)', 'تحريك دقيق 1px — مع Shift 10px'],
  ['Delete', 'إخفاء القسم المحدد'],
  ['Ctrl + Z / Ctrl + Y', 'تراجع / إعادة'],
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

import { useState } from 'react'
import { Copy, ImagePlus, Lock, Palette, Plus, Trash2, Unlock, X } from 'lucide-react'
import { Btn, ColorInput, Field, Group, Slider, Switch } from '../ui/kit'
import { Modal } from './Dialogs'
import { addKitToStore, deleteKit, recolorAll, setBrand, setPrefs, switchKit, toast, useEditor } from '../store/editor'
import { newKit } from '../lib/kits'
import { ContactFields } from '../editor/controls/contactFields'
import { normalizeImage, putAsset, useAsset } from '../lib/assets'
import { pickFile } from '../lib/importer'
import { LkgtLogo } from '../brand/LkgtLogo'

/* مجموعات الهوية: ألوان + معلومات تواصل + لوغو. القوالب تتلوّن تلقائياً بلون المجموعة */

const close = () => useEditor.setState({ dialog: null })

function LogoPick() {
  const brand = useEditor((s) => s.brand)
  const a = useAsset(brand.customLogoAssetId)
  return (
    <div className="kit-logo">
      <div className="kit-logo-prev">{a ? <img src={a.url} alt="" /> : <LkgtLogo variant="color" height={56} />}</div>
      <div className="row-btns">
        <Btn
          small
          icon={<ImagePlus size={14} />}
          onClick={async () => {
            const [f] = await pickFile('image/png,image/svg+xml,image/webp,image/jpeg')
            if (!f) return
            const n = f.type === 'image/svg+xml' ? { blob: f as Blob, w: 0, h: 0 } : await normalizeImage(f, 1600)
            const asset = await putAsset(n.blob, f.name, n.w ? { w: n.w, h: n.h } : undefined)
            setBrand({ customLogoAssetId: asset.id })
          }}
        >
          رفع لوغو الشركة
        </Btn>
        {brand.customLogoAssetId && (
          <Btn small variant="ghost" icon={<X size={14} />} onClick={() => setBrand({ customLogoAssetId: null })}>
            استخدام لوغو LKGT الأصلي
          </Btn>
        )}
      </div>
    </div>
  )
}

export function KitsDialog() {
  const kits = useEditor((s) => s.kits)
  const brand = useEditor((s) => s.brand)
  const view = useEditor((s) => s.view)
  const lock = useEditor((s) => s.prefs.brandLock)
  const [adv, setAdv] = useState(false)
  const [newColor, setNewColor] = useState('#2A6BFF')
  const list = kits.map((k) => (k.id === brand.id ? brand : k))
  return (
    <Modal title="مجموعات الهوية" onClose={close} wide>
      <div className="kits">
        <aside className="kit-list">
          {list.map((k) => (
            <button key={k.id} className={`kit-item ${k.id === brand.id ? 'on' : ''}`} onClick={() => switchKit(k.id)}>
              <span className="kit-dots">
                <i style={{ background: k.primary }} />
                <i style={{ background: k.secondary }} />
                {k.palette.slice(2, 4).map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <strong>{k.name}</strong>
            </button>
          ))}
          <Btn
            small
            icon={<Plus size={14} />}
            onClick={() => {
              addKitToStore(newKit(`مجموعة ${kits.length + 1}`, brand))
            }}
          >
            مجموعة جديدة
          </Btn>
        </aside>

        <div className="kit-form">
          <Group title="الأساسيات">
            <Field label="اسم المجموعة">
              <input className="txi" value={brand.name} onChange={(e) => setBrand({ name: e.target.value })} />
            </Field>
            <ColorInput label="اللون الرئيسي (تُصبَغ به القوالب الحمراء)" value={brand.primary} onChange={(v) => setBrand({ primary: v, palette: [v, ...brand.palette.slice(1)] })} />
            <ColorInput label="اللون الثانوي / الداكن" value={brand.secondary} onChange={(v) => setBrand({ secondary: v })} />
            <Switch label="تلوين القوالب تلقائياً بلون المجموعة" checked={brand.recolor} onChange={(v) => setBrand({ recolor: v })} />
            {view === 'editor' && (
              <Btn
                small
                variant="primary"
                icon={<Palette size={14} />}
                onClick={() => {
                  recolorAll(brand.primary)
                  toast('تم تلوين التصميم الحالي بألوان المجموعة', 'ok')
                }}
              >
                تطبيق الألوان على التصميم الحالي
              </Btn>
            )}
          </Group>
          <Group title="لوحة الألوان" hint="تظهر هذه الألوان أولاً في كل منتقي ألوان داخل البرنامج.">
            <div className="kit-palette">
              {brand.palette.map((c, i) => (
                <span key={`${c}${i}`} className="kit-sw" style={{ background: c }} title={c}>
                  {i > 0 && (
                    <button onClick={() => setBrand({ palette: brand.palette.filter((_, k) => k !== i) })} title="حذف">
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
              <label className="kit-add">
                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
                <Btn small icon={<Plus size={13} />} onClick={() => setBrand({ palette: [...brand.palette, newColor.toUpperCase()] })}>
                  إضافة
                </Btn>
              </label>
            </div>
          </Group>
          <Group title="اللوغو">
            <LogoPick />
          </Group>
          <Group title="معلومات التواصل (شريط الأسفل)">
            <ContactFields />
          </Group>
          <Group title="قفل الهوية للفريق" hint="عند التفعيل يُمنع تعديل اللوغو وشريط التواصل والألوان الأساسية إلا بإدخال الرمز. (حماية من الأخطاء غير مقصودة وليست حماية أمنية.)">
            <Switch
              label="تفعيل القفل"
              checked={lock.on}
              onChange={(v) => {
                if (v) {
                  const pin = prompt('اختر رمزاً لفك القفل (اختياري)', lock.pin) ?? ''
                  setPrefs({ brandLock: { on: true, pin } })
                } else {
                  const pin = lock.pin ? prompt('أدخل الرمز لفك القفل') : ''
                  if (lock.pin && pin !== lock.pin) return toast('رمز غير صحيح', 'error')
                  setPrefs({ brandLock: { on: false, pin: lock.pin } })
                }
              }}
            />
            <p className="hint">{lock.on ? <Lock size={13} /> : <Unlock size={13} />} {lock.on ? 'الهوية مقفلة الآن' : 'الهوية غير مقفلة'}</p>
          </Group>
          <Group title="متقدّم: أحجام وأماكن العناصر الثابتة">
            <Switch label="إظهار الإعدادات المتقدمة" checked={adv} onChange={setAdv} />
            {adv && (
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
            )}
          </Group>
          <div className="row-btns">
            <Btn
              small
              icon={<Copy size={14} />}
              onClick={() => {
                addKitToStore(newKit(`${brand.name} (نسخة)`, brand))
              }}
            >
              تكرار المجموعة
            </Btn>
            <Btn
              small
              variant="danger"
              icon={<Trash2 size={14} />}
              disabled={kits.length <= 1}
              onClick={() => {
                if (confirm(`حذف المجموعة «${brand.name}»؟`)) deleteKit(brand.id)
              }}
            >
              حذف المجموعة
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

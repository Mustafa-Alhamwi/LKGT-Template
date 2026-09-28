import { useMemo, useState, type CSSProperties } from 'react'
import { Boxes, ImagePlus, Package, QrCode, Smartphone, Sticker, Trash2, Type, Upload, X } from 'lucide-react'
import { Btn, Chips } from '../ui/kit'
import { addExtraText, useEditor, type LibraryPanel } from '../store/editor'
import { BUILTIN_TEXT_PRESETS, type PresetCtx } from '../model/textPresets'
import { STICKERS, STICKER_CATS, STICKER_PRESETS, StickerView, type StickerCat } from '../poster/stickers'
import { addImageFile, addQr, addSticker, addStickerPreset } from '../store/objects'
import { QrView, DEFAULT_QR } from '../poster/QrCode'
import { deleteLibraryItem, insertLibraryProduct, saveProductToLibrary } from '../store/library'
import { pickFile, importImage } from '../lib/importer'
import type { ImageFrame, QrSpec, TextStyle } from '../model/types'
import { withAlpha } from '../lib/color'
import { addDeviceImage } from './deviceAdd'

/* ------------------------------------------------------------------
 * شريط الإضافة (يمين مساحة العمل) + لوحة المكتبة: نصوص، ملصقات، QR، صور، منتجاتي
 * ------------------------------------------------------------------ */

const ITEMS: { id: Exclude<LibraryPanel, null>; label: string; icon: React.ReactNode }[] = [
  { id: 'text', label: 'نص', icon: <Type size={20} /> },
  { id: 'stickers', label: 'ملصقات', icon: <Sticker size={20} /> },
  { id: 'qr', label: 'QR وباركود', icon: <QrCode size={20} /> },
  { id: 'images', label: 'صور', icon: <ImagePlus size={20} /> },
  { id: 'products', label: 'منتجاتي', icon: <Package size={20} /> },
]

export function LibraryRail() {
  const open = useEditor((s) => s.library_)
  return (
    <>
      <nav className="rail" aria-label="إضافة عناصر">
        {ITEMS.map((it) => (
          <button key={it.id} className={open === it.id ? 'on' : ''} onClick={() => useEditor.setState({ library_: open === it.id ? null : it.id })} title={it.label}>
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      {open && <LibraryPanelView which={open} />}
    </>
  )
}

function LibraryPanelView({ which }: { which: Exclude<LibraryPanel, null> }) {
  const title = ITEMS.find((i) => i.id === which)!.label
  return (
    <aside className="lib-panel" onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <h3>{title}</h3>
        <button className="ibtn" onClick={() => useEditor.setState({ library_: null })} title="إغلاق">
          <X size={17} />
        </button>
      </header>
      <div className="lib-body">
        {which === 'text' && <TextLib />}
        {which === 'stickers' && <StickerLib />}
        {which === 'qr' && <QrLib />}
        {which === 'images' && <ImageLib />}
        {which === 'products' && <ProductLib />}
      </div>
    </aside>
  )
}

/* ------------------------------ النصوص ------------------------------ */

export function usePresetCtx(): PresetCtx {
  const primary = useEditor((s) => s.design.primary ?? s.brand.primary)
  const dark = useEditor((s) => s.design.style.theme === 'dark')
  const secondary = useEditor((s) => s.brand.secondary)
  return useMemo(() => ({ primary, dark, ink: dark ? '#FFFFFF' : secondary || '#111214' }), [primary, dark, secondary])
}

export function presetPreviewCss(st: Partial<TextStyle>, ctx: PresetCtx): CSSProperties {
  const size = Math.min(28, Math.max(15, (st.size ?? 40) * 0.26))
  const css: CSSProperties = {
    fontSize: size,
    fontWeight: st.weightAr ?? 700,
    color: st.color ?? ctx.ink,
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
  }
  if (st.gradient) {
    css.backgroundImage = `linear-gradient(${st.gradAngle ?? 90}deg, ${st.color}, ${st.color2})`
    css.WebkitBackgroundClip = 'text'
    css.backgroundClip = 'text'
    css.color = 'transparent'
    css.WebkitTextFillColor = 'transparent'
  }
  if ((st.strokeW ?? 0) > 0) css.WebkitTextStroke = `${Math.max(1, (st.strokeW ?? 0) * 0.3)}px ${st.strokeColor ?? '#fff'}`
  if (st.textShadow === 'glow') css.textShadow = `0 0 10px ${st.shadowColor ?? '#f00'}, 0 0 20px ${st.shadowColor ?? '#f00'}`
  if (st.textShadow === 'hard') css.textShadow = `2px 3px 0 ${st.shadowColor ?? '#000'}`
  if (st.strike) css.textDecoration = 'line-through'
  const d = st.decoStyle
  if (st.deco && d && ['pill', 'box', 'glass', 'tab'].includes(st.deco)) {
    css.background = d.fill
    css.padding = `${Math.max(3, d.padY * 0.28)}px ${Math.max(8, d.padX * 0.3)}px`
    css.borderRadius = st.deco === 'pill' ? 999 : st.deco === 'tab' ? 0 : Math.min(14, d.radius * 0.3)
    if (st.deco === 'tab') css.clipPath = 'polygon(6% 0, 100% 0, 94% 100%, 0 100%)'
    if (st.deco === 'glass') css.border = `1px solid ${d.stroke}`
  }
  if (st.deco === 'bar' && d) {
    css.borderInlineStart = `4px solid ${d.accent}`
    css.paddingInlineStart = 8
  }
  if (st.deco === 'rules' && d) {
    css.borderBlock = `2px solid ${d.accent}`
    css.padding = '2px 8px'
  }
  return css
}

function TextLib() {
  const ctx = usePresetCtx()
  const brand = useEditor((s) => s.brand)
  const dark = ctx.dark
  const quick: { label: string; text: string }[] = [
    { label: 'الهاتف', text: brand.phone },
    { label: 'الموقع', text: brand.website },
    { label: 'إنستغرام', text: brand.instagram ? `@${brand.instagram.replace(/^@/, '')}` : '' },
    { label: 'واتساب', text: brand.whatsapp ?? '' },
    { label: 'العنوان', text: brand.address ?? '' },
  ].filter((q) => q.text.trim())
  return (
    <>
      <Btn block variant="primary" icon={<Type size={16} />} onClick={() => addExtraText('نص جديد', {})}>
        إضافة نص عادي
      </Btn>
      <h4 className="lib-h">أنماط جاهزة</h4>
      <div className="preset-grid">
        {BUILTIN_TEXT_PRESETS.map((p) => {
          const st = p.style(ctx)
          return (
            <button key={p.id} className={`preset ${dark ? 'dk' : ''}`} onClick={() => addExtraText(p.sample, { ...st, fw: p.fw ?? 600, fit: 'none', align: 'center' })} title={p.name}>
              <span className="preset-sample">
                <span style={presetPreviewCss(st, ctx)}>{p.sample}</span>
              </span>
              <small>{p.name}</small>
            </button>
          )
        })}
      </div>
      {quick.length > 0 && (
        <>
          <h4 className="lib-h">من معلومات الهوية</h4>
          <div className="quick-chips">
            {quick.map((q) => (
              <button key={q.label} onClick={() => addExtraText(q.text, { size: 40, weightAr: 700, weightLat: 700, color: ctx.ink, fw: 700 })}>
                {q.label}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="hint">يمكنك أيضاً تحديد أي نص موجود وتطبيق نمط جاهز عليه من تبويب «الخصائص».</p>
    </>
  )
}

/* ------------------------------ الملصقات ------------------------------ */

function StickerLib() {
  const [cat, setCat] = useState<StickerCat | 'preset'>('preset')
  const [q, setQ] = useState('')
  const list = useMemo(() => STICKERS.filter((s) => s.cat === cat && (!q.trim() || s.label.includes(q.trim()))), [cat, q])
  return (
    <>
      <div className="lib-tabs">
        <Chips<string> value={cat} options={STICKER_CATS.map((c) => ({ value: c.id, label: c.label }))} onChange={(v) => setCat(v as StickerCat | 'preset')} wrap />
      </div>
      {cat !== 'preset' && (
        <label className="lib-search">
          <input placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      {cat === 'preset' ? (
        <div className="stk-grid preset">
          {STICKER_PRESETS.map((p) => (
            <button key={p.label} className="stk-tile" onClick={() => addStickerPreset(p)} title={p.label}>
              <span className="stk-prev">
                <StickerView spec={p.spec} color={p.color} color2={p.color2} />
              </span>
              <small>{p.label}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className={`stk-grid ${cat === 'icon' ? 'icons' : ''}`}>
          {list.map((s) => (
            <button key={s.id} className="stk-tile" onClick={() => addSticker(s.id)} title={s.label}>
              <span className="stk-prev" style={s.cat === 'icon' ? { background: withAlpha('#888', 0.08) } : undefined}>
                <StickerView spec={{ id: s.id, text: s.text ?? '', text2: s.text2 ?? '', strokeW: s.strokeW, bg: s.cat === 'icon' ? 'circle' : undefined }} color={s.color} color2={s.color2} />
              </span>
              <small>{s.label}</small>
            </button>
          ))}
          {!list.length && <p className="hint">لا نتائج.</p>}
        </div>
      )}
    </>
  )
}

/* ------------------------------ QR ------------------------------ */

const QR_MODES: { value: QrSpec['mode']; label: string; ph: string }[] = [
  { value: 'url', label: 'رابط', ph: 'www.lk-gt.com' },
  { value: 'whatsapp', label: 'واتساب', ph: '+963 …' },
  { value: 'phone', label: 'اتصال', ph: '+963 …' },
  { value: 'email', label: 'بريد', ph: 'info@…' },
  { value: 'text', label: 'نص', ph: 'أي نص' },
  { value: 'barcode', label: 'باركود', ph: '6294003700018' },
]

function QrLib() {
  const brand = useEditor((s) => s.brand)
  const [spec, setSpec] = useState<QrSpec>({ ...DEFAULT_QR, data: brand.website || 'www.lk-gt.com' })
  const set = (p: Partial<QrSpec>) => setSpec((x) => ({ ...x, ...p }))
  const mode = QR_MODES.find((m) => m.value === spec.mode)!
  const ig = brand.instagram?.replace(/^@/, '')
  const quick: { label: string; p: Partial<QrSpec> }[] = [
    brand.website ? { label: 'الموقع', p: { mode: 'url', data: brand.website } } : null,
    ig ? { label: 'إنستغرام', p: { mode: 'url', data: `instagram.com/${ig}` } } : null,
    brand.whatsapp || brand.phone ? { label: 'واتساب', p: { mode: 'whatsapp', data: brand.whatsapp || brand.phone } } : null,
    brand.phone ? { label: 'اتصال', p: { mode: 'phone', data: brand.phone } } : null,
    brand.email ? { label: 'بريد', p: { mode: 'email', data: brand.email } } : null,
  ].filter(Boolean) as { label: string; p: Partial<QrSpec> }[]
  return (
    <>
      <div className="quick-chips">
        {quick.map((q) => (
          <button key={q.label} onClick={() => set(q.p)}>
            {q.label}
          </button>
        ))}
      </div>
      <Chips<QrSpec['mode']> value={spec.mode} options={QR_MODES.map((m) => ({ value: m.value, label: m.label }))} onChange={(v) => set({ mode: v, data: v === 'barcode' ? '6294003700018' : spec.mode === 'barcode' ? brand.website : spec.data })} wrap />
      <input className="txi ltr" dir="ltr" placeholder={mode.ph} value={spec.data} onChange={(e) => set({ data: e.target.value })} />
      {(spec.mode === 'whatsapp' || spec.mode === 'email') && <input className="txi" placeholder={spec.mode === 'email' ? 'عنوان الرسالة (اختياري)' : 'رسالة جاهزة (اختياري)'} value={spec.extra ?? ''} onChange={(e) => set({ extra: e.target.value })} />}
      <div className="qr-preview">
        <div className="qr-prev-box">
          <QrView spec={spec} />
        </div>
      </div>
      <Btn block variant="primary" icon={<QrCode size={16} />} onClick={() => addQr(spec)}>
        إضافة إلى التصميم
      </Btn>
      <p className="hint">يمكنك تعديل الشكل والألوان بعد الإضافة من تبويب «الخصائص». تحقق من مسح الرمز بهاتفك قبل النشر.</p>
      {!brand.email && spec.mode === 'email' && <p className="hint">أضف بريدك في «الإعدادات ← الهوية» ليظهر كخيار سريع.</p>}
    </>
  )
}

/* ------------------------------ الصور ------------------------------ */

const FRAMES: { v: ImageFrame; label: string }[] = [
  { v: 'phone', label: 'هاتف' },
  { v: 'laptop', label: 'لابتوب' },
  { v: 'browser', label: 'متصفح' },
  { v: 'tablet', label: 'تابلت' },
  { v: 'polaroid', label: 'بولارويد' },
  { v: 'card', label: 'بطاقة' },
]

function ImageLib() {
  return (
    <>
      <div className="lib-actions">
        <Btn block variant="primary" icon={<Upload size={16} />} onClick={async () => (await pickFile('image/*', true)).forEach((f) => addImageFile(f))}>
          إضافة صورة
        </Btn>
        <Btn block icon={<Boxes size={16} />} onClick={async () => (await pickFile('image/*', true)).forEach((f) => addImageFile(f, { cut: true }))}>
          منتج إضافي (تفريغ تلقائي)
        </Btn>
        <Btn
          block
          icon={<ImagePlus size={16} />}
          onClick={async () => {
            const [f] = await pickFile('image/*')
            if (f) importImage(f)
          }}
        >
          استبدال صورة الخلفية الرئيسية
        </Btn>
      </div>
      <h4 className="lib-h">داخل إطار جهاز</h4>
      <div className="frame-grid">
        {FRAMES.map((f) => (
          <button key={f.v} onClick={() => addDeviceImage(f.v)}>
            <Smartphone size={18} />
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <p className="hint">يمكنك أيضاً سحب أي صورة وإفلاتها على التصميم — تُضاف كعنصر (اضغط Alt أثناء الإفلات لتفريغها تلقائياً).</p>
    </>
  )
}

/* ------------------------------ منتجاتي ------------------------------ */

function ProductLib() {
  const items = useEditor((s) => s.library)
  const product = useEditor((s) => s.design.content.product)
  return (
    <>
      <Btn block variant="primary" disabled={!product} icon={<Package size={16} />} onClick={() => product && saveProductToLibrary(product)}>
        حفظ المنتج الحالي في المكتبة
      </Btn>
      {!items.length && <p className="hint">مكتبتك فارغة. احفظ المنتجات المفرّغة لإعادة استخدامها في أي تصميم بدون إعادة التفريغ.</p>}
      <div className="lib-products">
        {items.map((it) => (
          <div key={it.id} className="lp-item">
            <div className="lp-thumb">
              <img src={it.thumb} alt="" />
            </div>
            <strong title={it.name}>{it.name}</strong>
            <div className="lp-btns">
              <button onClick={() => insertLibraryProduct(it, 'main')} title="وضعه كمنتج رئيسي للتصميم">
                رئيسي
              </button>
              <button onClick={() => insertLibraryProduct(it, 'extra')} title="إضافته كمنتج إضافي">
                إضافي
              </button>
              <button className="danger" onClick={() => deleteLibraryItem(it.id)} title="حذف من المكتبة">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}


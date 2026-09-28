import { useMemo, type ReactNode } from 'react'
import { ArrowLeftRight, Eye, EyeOff, Plus, Trash2, Upload } from 'lucide-react'
import { Btn, ColorInput, Field, Group, IconBtn, Chips, Select, Slider, Switch, TextArea, Tiles } from '../../ui/kit'
import { allPartners, changeContent, changeStyle, select, setBrand, toast, useEditor } from '../../store/editor'
import { backdropCss } from '../../poster/Backdrop'
import { CONTACT_THEME_ORDER, contactThemes } from '../../poster/ContactBar'
import { decor } from '../../model/templates'
import { RED } from '../../model/brand'
import { EffectsSection, LayerSection, ObjectHeader, ObjectSpecific, TransformSection, useDecor } from './objects'
import { isObjectKind } from '../../poster/DecorLayer'
import { LkgtLogo } from '../../brand/LkgtLogo'
import { normalizeImage, putAsset, resolvePublic, useAsset } from '../../lib/assets'
import { pickFile } from '../../lib/importer'
import type { BackdropKind, DecorItem, DecorKind, LogoVariant, PartnerLogo, PartnerVariant, ShadowKind, ShapeKind } from '../../model/types'

/* ------------------------------ الخلفية ------------------------------ */

const BACKDROPS: { value: BackdropKind; label: string }[] = [
  { value: 'solid', label: 'لون واحد' },
  { value: 'studio', label: 'استوديو' },
  { value: 'aurora', label: 'شفق' },
  { value: 'peach', label: 'تدرج' },
  { value: 'mist', label: 'ضباب' },
  { value: 'paper', label: 'ورق' },
  { value: 'grid', label: 'شبكة' },
  { value: 'dots', label: 'نقاط' },
  { value: 'split', label: 'مقسوم' },
  { value: 'red-sweep', label: 'أحمر' },
  { value: 'studio-dark', label: 'داكن' },
  { value: 'spot', label: 'بقعة ضوء' },
]

const SAMPLE: Partial<Record<BackdropKind, { color: string; color2: string }>> = {
  solid: { color: '#EDEDF0', color2: '#DDDDE2' },
  studio: { color: '#FFFFFF', color2: '#D9D9DF' },
  aurora: { color: '#FFF7F5', color2: '#FF8F96' },
  peach: { color: '#FFF5F1', color2: '#FFC3BA' },
  mist: { color: '#F3F5F8', color2: '#C9D0DC' },
  paper: { color: '#F3F1EE', color2: '#DAD5CE' },
  grid: { color: '#F6F6F8', color2: '#C7C7CF' },
  dots: { color: '#F6F6F8', color2: '#B9B9C4' },
  split: { color: '#F7F7F8', color2: '#D11A24' },
  'red-sweep': { color: '#D11A24', color2: '#7E0B13' },
  'studio-dark': { color: '#2A2A32', color2: '#050506' },
  spot: { color: '#0A0A0C', color2: '#55555F' },
}

export function BackdropControls() {
  const b = useEditor((s) => s.design.style.backdrop)
  const theme = useEditor((s) => s.design.style.theme)
  const angled = ['peach', 'linear', 'mist'].includes(b.kind)
  return (
    <>
      <Group title="الثيم">
        <Chips
          value={theme}
          options={[
            { value: 'light', label: 'فاتح' },
            { value: 'dark', label: 'داكن' },
          ]}
          onChange={(v) => changeStyle((s) => void (s.theme = v))}
        />
      </Group>
      <Group title="الخلفية">
        <Tiles<BackdropKind>
          value={b.kind === 'linear' ? 'peach' : b.kind}
          cols={4}
          items={BACKDROPS.map((k) => ({
            ...k,
            preview: <span className="mini-bd" style={backdropCss({ kind: k.value, ...(SAMPLE[k.value] ?? { color: b.color, color2: b.color2 }), angle: b.angle })} />,
          }))}
          onChange={(v) => changeStyle((s) => void (s.backdrop.kind = v))}
        />
        <ColorInput label="اللون الأول" value={b.color} onChange={(v) => changeStyle((s) => void (s.backdrop.color = v), 'bd1')} />
        <ColorInput label="اللون الثاني" value={b.color2} onChange={(v) => changeStyle((s) => void (s.backdrop.color2 = v), 'bd2')} />
        {angled && <Slider label="زاوية التدرج" value={b.angle ?? 170} min={0} max={360} unit="°" onChange={(v) => changeStyle((s) => void (s.backdrop.angle = v), 'bda')} />}
      </Group>
    </>
  )
}

export function PhotoControls() {
  const fade = useEditor((s) => s.design.style.fade)
  const fx = useEditor((s) => s.design.style.sceneFx)
  const hasScene = useEditor((s) => !!s.design.content.scene)
  return (
    <>
      <Group title="تدرّج الصورة الخلفية" hint={hasScene ? undefined : 'يظهر عند رفع صورة مشهد (خلفية الصورة تتدرج من 100% أسفل إلى 0–30% أعلى)'}>
        <Switch label="تفعيل التدرج" checked={fade.enabled} onChange={(v) => changeStyle((s) => void (s.fade.enabled = v))} />
        {fade.enabled && (
          <>
            <Slider label="الشفافية في الأعلى" value={Math.round(fade.top * 100)} min={0} max={60} unit="%" onChange={(v) => changeStyle((s) => void (s.fade.top = v / 100), 'ft')} />
            <Slider label="بداية التدرج" value={Math.round(fade.from * 100)} min={0} max={95} unit="%" onChange={(v) => changeStyle((s) => void (s.fade.from = Math.min(v / 100, s.fade.to - 0.02)), 'ff')} />
            <Slider label="نهاية التدرج" value={Math.round(fade.to * 100)} min={5} max={100} unit="%" onChange={(v) => changeStyle((s) => void (s.fade.to = Math.max(v / 100, s.fade.from + 0.02)), 'fto')} />
          </>
        )}
      </Group>
      <Group title="مؤثرات الصورة">
        <Slider label="تمويه" value={fx.blur} min={0} max={20} step={0.5} onChange={(v) => changeStyle((s) => void (s.sceneFx.blur = v), 'fxb')} />
        <Slider label="الإضاءة" value={fx.brightness} min={0.2} max={1.6} step={0.01} onChange={(v) => changeStyle((s) => void (s.sceneFx.brightness = v), 'fxbr')} />
        <Slider label="التشبع" value={fx.saturate} min={0} max={2} step={0.01} onChange={(v) => changeStyle((s) => void (s.sceneFx.saturate = v), 'fxs')} />
        <Slider label="التباين" value={fx.contrast} min={0.5} max={1.6} step={0.01} onChange={(v) => changeStyle((s) => void (s.sceneFx.contrast = v), 'fxc')} />
        <Slider label="أبيض وأسود" value={fx.grayscale} min={0} max={1} step={0.01} onChange={(v) => changeStyle((s) => void (s.sceneFx.grayscale = v), 'fxg')} />
        <ColorInput label="لون الصبغة" value={fx.tint} onChange={(v) => changeStyle((s) => void (s.sceneFx.tint = v), 'fxt')} />
        <Slider label="قوة الصبغة" value={fx.tintOpacity} min={0} max={1} step={0.01} onChange={(v) => changeStyle((s) => void (s.sceneFx.tintOpacity = v), 'fxto')} />
      </Group>
    </>
  )
}

/* ------------------------------ الشكل تحت المنتج ------------------------------ */

const I = (d: ReactNode) => (
  <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" stroke="currentColor">
    {d}
  </svg>
)
const SHAPES: { value: ShapeKind; label: string; icon: ReactNode }[] = [
  { value: 'none', label: 'بدون', icon: I(<path d="M8 8l16 16M24 8L8 24" fill="none" strokeWidth="2.4" strokeLinecap="round" />) },
  { value: 'slab', label: 'مستطيل', icon: I(<rect x="3" y="11" width="26" height="11" rx="2" stroke="none" transform="skewX(-10) translate(5 0)" />) },
  { value: 'card', label: 'بطاقة', icon: I(<rect x="4" y="6" width="24" height="20" rx="6" stroke="none" />) },
  { value: 'circle', label: 'دائرة', icon: I(<circle cx="16" cy="16" r="11" stroke="none" />) },
  { value: 'rings', label: 'حلقات', icon: I(<g fill="none" strokeWidth="1.8"><circle cx="16" cy="16" r="12" /><circle cx="16" cy="16" r="8" /><circle cx="16" cy="16" r="4" /></g>) },
  { value: 'arcs', label: 'أقواس', icon: I(<g fill="none" strokeWidth="2.2" strokeLinecap="round"><path d="M10 6a12 12 0 0 0 0 20" /><path d="M22 6a12 12 0 0 1 0 20" opacity=".6" /></g>) },
  { value: 'orbit', label: 'مدار', icon: I(<g fill="none" strokeWidth="1.8"><circle cx="16" cy="16" r="11" strokeDasharray="1.5 3.5" strokeLinecap="round" /><circle cx="26" cy="12" r="2.6" fill="currentColor" stroke="none" /></g>) },
  { value: 'floor', label: 'أرضية', icon: I(<ellipse cx="16" cy="21" rx="13" ry="5" stroke="none" opacity=".7" />) },
  { value: 'podium', label: 'منصة', icon: I(<g stroke="none"><path d="M5 14v9a11 4 0 0 0 22 0v-9z" /><ellipse cx="16" cy="14" rx="11" ry="4" opacity=".6" /></g>) },
  { value: 'arch', label: 'قوس', icon: I(<path d="M6 27V15a10 10 0 0 1 20 0v12z" stroke="none" />) },
  { value: 'halo', label: 'هالة', icon: I(<g stroke="none"><circle cx="16" cy="16" r="13" opacity=".25" /><circle cx="16" cy="16" r="8" opacity=".55" /></g>) },
  { value: 'band', label: 'شريط', icon: I(<rect x="-2" y="12" width="36" height="9" stroke="none" transform="rotate(-14 16 16)" />) },
  { value: 'wave', label: 'موجة', icon: I(<path d="M0 14c6-7 10 5 16-1s10-6 16 0v19H0z" stroke="none" />) },
  { value: 'frame', label: 'إطار', icon: I(<rect x="5" y="6" width="22" height="20" rx="2" fill="none" strokeWidth="2.2" />) },
  { value: 'blob', label: 'عضوي', icon: I(<path d="M8 9c5-6 16-4 18 4s-1 14-9 14S3 16 8 9z" stroke="none" />) },
]

const SHADOWS: { value: ShadowKind; label: string }[] = [
  { value: 'none', label: 'بدون' },
  { value: 'soft', label: 'ظل ناعم' },
  { value: 'float', label: 'طفو' },
  { value: 'contact', label: 'ظل أرضي' },
  { value: 'long', label: 'ظل ممتد' },
  { value: 'glow', label: 'توهج' },
  { value: 'outline', label: 'حدود ملونة' },
]

export function ShapeControls() {
  const sh = useEditor((s) => s.design.style.shape)
  const fx = useEditor((s) => s.design.style.productFx)
  const set = (fn: (x: typeof sh) => void, key = '') => changeStyle((s) => fn(s.shape), `sh-${key}`)
  const uses = {
    spread: ['slab', 'card', 'floor', 'podium', 'arch', 'frame'].includes(sh.kind),
    top: ['slab', 'card', 'arch', 'frame', 'band', 'circle', 'wave'].includes(sh.kind),
    bottom: ['slab', 'card', 'arch', 'frame', 'podium'].includes(sh.kind),
    radius: ['slab', 'card', 'arch', 'frame'].includes(sh.kind),
    skew: ['slab', 'band'].includes(sh.kind),
    scale: ['circle', 'rings', 'arcs', 'orbit', 'halo', 'floor', 'podium', 'band', 'blob', 'wave'].includes(sh.kind),
    stroke: ['rings', 'arcs', 'orbit', 'frame'].includes(sh.kind),
    color2: ['slab', 'card', 'circle', 'podium', 'arch', 'band', 'blob', 'wave'].includes(sh.kind),
  }
  return (
    <>
      <Group title="الشكل تحت المنتج" hint="يُحسب مكانه وحجمه تلقائياً من حدود المنتج المفرّغ — ويمكنك سحبه لإزاحته.">
        <Tiles<ShapeKind> value={sh.kind} items={SHAPES.map((x) => ({ value: x.value, label: x.label, preview: x.icon }))} cols={4} onChange={(v) => set((x) => void (x.kind = v))} />
        {sh.kind !== 'none' && (
          <>
            <ColorInput label="اللون" value={sh.color} onChange={(v) => set((x) => void (x.color = v), 'c')} />
            {uses.color2 && <ColorInput label="اللون الثاني (تدرج)" value={sh.color2} onChange={(v) => set((x) => void (x.color2 = v), 'c2')} />}
            <Slider label="الشفافية" value={sh.opacity} min={0} max={1} step={0.01} onChange={(v) => set((x) => void (x.opacity = v), 'o')} />
            {uses.spread && <Slider label="العرض الإضافي" value={sh.spread} min={-0.3} max={1} step={0.01} onChange={(v) => set((x) => void (x.spread = v), 'sp')} />}
            {uses.top && <Slider label="بداية الشكل" value={sh.top} min={-1} max={1.2} step={0.01} onChange={(v) => set((x) => void (x.top = v), 't')} />}
            {uses.bottom && <Slider label="امتداد للأسفل" value={sh.bottom} min={-100} max={400} onChange={(v) => set((x) => void (x.bottom = v), 'b')} />}
            {uses.radius && <Slider label="استدارة الزوايا" value={sh.radius} min={0} max={200} onChange={(v) => set((x) => void (x.radius = v), 'r')} />}
            {uses.skew && <Slider label="الميلان" value={sh.skew} min={-40} max={40} unit="°" onChange={(v) => set((x) => void (x.skew = v), 'sk')} />}
            {uses.scale && <Slider label="الحجم" value={sh.scale} min={0.3} max={2.5} step={0.01} onChange={(v) => set((x) => void (x.scale = v), 's')} />}
            {uses.stroke && <Slider label="سماكة الخط" value={sh.stroke} min={1} max={30} onChange={(v) => set((x) => void (x.stroke = v), 'st')} />}
            <Slider label="إزاحة أفقية" value={sh.offsetX} min={-400} max={400} onChange={(v) => set((x) => void (x.offsetX = v), 'ox')} />
            <Slider label="إزاحة عمودية" value={sh.offsetY} min={-400} max={400} onChange={(v) => set((x) => void (x.offsetY = v), 'oy')} />
          </>
        )}
      </Group>
      <Group title="ظل المنتج وتأثيراته">
        <Select value={fx.shadow} options={SHADOWS} onChange={(v) => changeStyle((s) => void (s.productFx.shadow = v))} />
        {fx.shadow !== 'none' && <Slider label="قوة الظل" value={fx.shadowOpacity} min={0} max={1} step={0.01} onChange={(v) => changeStyle((s) => void (s.productFx.shadowOpacity = v), 'pfo')} />}
        {(fx.shadow === 'glow' || fx.shadow === 'outline') && <ColorInput label="اللون" value={fx.shadowColor} onChange={(v) => changeStyle((s) => void (s.productFx.shadowColor = v), 'pfc')} />}
        <Switch label="انعكاس أسفل المنتج" checked={fx.reflection} onChange={(v) => changeStyle((s) => void (s.productFx.reflection = v))} />
      </Group>
    </>
  )
}

/* ------------------------------ شريط التواصل واللوغوهات ------------------------------ */

export function ContactControls() {
  const theme = useEditor((s) => s.design.style.contact.theme)
  const accent = useEditor((s) => s.design.style.contact.accent)
  const mode = useEditor((s) => s.design.style.theme)
  const brand = useEditor((s) => s.brand)
  const themes = contactThemes(mode, accent)
  return (
    <>
      <Group title="شكل شريط التواصل" hint="مكان الشريط ثابت في كل القوالب — اختر شكله ولونه.">
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {CONTACT_THEME_ORDER.map((id) => {
            const t = themes[id]
            return (
              <button key={id} type="button" className={`cthemetile ${mode} ${theme === id ? 'on' : ''}`} onClick={() => changeStyle((s) => void (s.contact.theme = id))}>
                <span className="cs-bar" style={{ ...t.bar, borderRadius: t.fullBleed || id === 'minimal' ? 0 : 999 }}>
                  <i style={{ background: t.icon }} />
                  <b style={{ background: t.text }} />
                  <i style={{ background: t.icon }} />
                  <b style={{ background: t.text }} />
                </span>
                <small>{t.name}</small>
              </button>
            )
          })}
        </div>
        <ColorInput label="اللون المميز" value={accent} onChange={(v) => changeStyle((s) => void (s.contact.accent = v), 'cacc')} />
      </Group>
      <Group title="معلومات التواصل (لكل القوالب)">
        <Field label="الموقع">
          <input className="txi ltr" dir="ltr" value={brand.website} onChange={(e) => setBrand({ website: e.target.value })} />
        </Field>
        <Field label="إنستغرام">
          <input className="txi ltr" dir="ltr" value={brand.instagram} onChange={(e) => setBrand({ instagram: e.target.value })} />
        </Field>
        <Field label="الهاتف">
          <input className="txi ltr" dir="ltr" value={brand.phone} onChange={(e) => setBrand({ phone: e.target.value })} />
        </Field>
      </Group>
    </>
  )
}

function PartnerThumb({ p }: { p: PartnerLogo }) {
  const a = useAsset(p.builtIn ? null : p.src)
  const src = p.builtIn ? resolvePublic(p.src) : a?.url
  return src ? <img src={src} alt={p.name} /> : <span>{p.name}</span>
}

export async function uploadPartnerLogo(): Promise<string | null> {
  const [f] = await pickFile('image/png,image/svg+xml,image/webp,image/jpeg')
  if (!f) return null
  const n = f.type === 'image/svg+xml' ? { blob: f as Blob, w: 0, h: 0 } : await normalizeImage(f, 1600)
  const a = await putAsset(n.blob, f.name, n.w ? { w: n.w, h: n.h } : undefined)
  const name = f.name.replace(/\.[^.]+$/, '')
  const logo: PartnerLogo = { id: `p_${a.id}`, name, src: a.id, builtIn: false }
  const s = useEditor.getState()
  useEditor.setState({ userPartners: [...s.userPartners, logo] })
  toast(`تمت إضافة لوغو «${name}»`, 'ok')
  return logo.id
}

export function PartnerPicker() {
  const userPartners = useEditor((s) => s.userPartners)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const current = useEditor((s) => s.design.content.partnerLogoId)
  return (
    <div className="partner-grid">
      <button className={`partner ${!current ? 'on' : ''}`} onClick={() => changeContent((c) => void (c.partnerLogoId = null))}>
        <span>بدون</span>
      </button>
      {partners.map((p) => (
        <div key={p.id} className="partner-wrap">
          <button className={`partner ${current === p.id ? 'on' : ''}`} onClick={() => changeContent((c) => void (c.partnerLogoId = p.id))} title={p.name}>
            <PartnerThumb p={p} />
          </button>
          {!p.builtIn && (
            <button className="partner-del" title="حذف من المكتبة" onClick={() => useEditor.setState({ userPartners: userPartners.filter((x) => x.id !== p.id) })}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      ))}
      <button
        className="partner add"
        onClick={async () => {
          const id = await uploadPartnerLogo()
          if (id) changeContent((c) => void (c.partnerLogoId = id))
        }}
      >
        <Upload size={16} />
        <small>رفع لوغو</small>
      </button>
    </div>
  )
}

export function LogoControls() {
  const logos = useEditor((s) => s.design.style.logos)
  const brand = useEditor((s) => s.brand)
  return (
    <>
      <Group title="لوغو الشركة الشريكة">
        <PartnerPicker />
        <Field label="لون اللوغو">
          <Chips<PartnerVariant>
            value={logos.partner}
            options={[
              { value: 'original', label: 'أصلي' },
              { value: 'white', label: 'أبيض' },
              { value: 'black', label: 'أسود' },
            ]}
            onChange={(v) => changeStyle((s) => void (s.logos.partner = v))}
          />
        </Field>
      </Group>
      <Group title="لوغو LKGT (ثابت الحجم والمكان)">
        <div className="lkgt-variants">
          {(['color', 'color-flat', 'white', 'black'] as LogoVariant[]).map((v) => (
            <button key={v} className={`${logos.lkgt === v ? 'on' : ''} v-${v}`} onClick={() => changeStyle((s) => void (s.logos.lkgt = v))}>
              <LkgtLogo variant={v} height={32} />
              <small>{{ color: 'ستيكر', 'color-flat': 'ملون', white: 'أبيض', black: 'أسود' }[v]}</small>
            </button>
          ))}
        </div>
        <Btn small icon={<ArrowLeftRight size={14} />} onClick={() => setBrand({ logoSide: brand.logoSide === 'right' ? 'left' : 'right' })}>
          تبديل جهة اللوغوهات (LKGT الآن {brand.logoSide === 'right' ? 'يمين' : 'يسار'})
        </Btn>
      </Group>
    </>
  )
}

/* ------------------------------ الزخارف ------------------------------ */

export const DECOR_KINDS: { value: DecorKind; label: string }[] = [
  { value: 'blobs', label: 'بقع ألوان ناعمة' },
  { value: 'wave', label: 'موجة' },
  { value: 'rings', label: 'حلقات (من شعار LKGT)' },
  { value: 'arc', label: 'أقواس G' },
  { value: 'glow', label: 'توهج' },
  { value: 'beam', label: 'شعاع ضوء' },
  { value: 'stripes', label: 'خطوط أفقية' },
  { value: 'grid', label: 'شبكة تقنية' },
  { value: 'dots', label: 'نقاط' },
  { value: 'plus', label: 'علامات +' },
  { value: 'corners', label: 'زوايا إطار' },
  { value: 'frame', label: 'إطار داخلي' },
  { value: 'line', label: 'خط' },
  { value: 'diagonal', label: 'مثلث زاوية' },
  { value: 'ribbon', label: 'شريط نصي' },
  { value: 'watermark', label: 'اسم المنتج كخلفية' },
  { value: 'badge', label: 'شارة دائرية' },
  { value: 'noise', label: 'حبيبات فيلم' },
]

const PRESET: Partial<Record<DecorKind, Parameters<typeof decor>[0]>> = {
  blobs: { kind: 'blobs', color: '#FF8F96', color2: '#FFC9B8', opacity: 0.5 },
  wave: { kind: 'wave', x: 0, y: 1080, w: 1080, h: 360, color: RED, opacity: 0.9 },
  rings: { kind: 'rings', x: 600, y: -220, w: 760, h: 760, color: RED, opacity: 0.18, size: 5 },
  arc: { kind: 'arc', x: 640, y: 380, w: 520, h: 520, color: RED, opacity: 0.8, size: 8 },
  glow: { kind: 'glow', x: 190, y: 560, w: 700, h: 700, color: RED, opacity: 0.35 },
  beam: { kind: 'beam', x: 190, y: -40, w: 700, h: 1250, color: '#ffffff', opacity: 0.16 },
  stripes: { kind: 'stripes', x: 0, y: 1220, w: 1080, h: 220, color: RED, opacity: 0.9, size: 24 },
  grid: { kind: 'grid', color: '#888888', opacity: 0.12, size: 60 },
  dots: { kind: 'dots', x: 60, y: 520, w: 240, h: 240, color: RED, opacity: 0.5, size: 5 },
  plus: { kind: 'plus', x: 780, y: 300, w: 220, h: 220, color: RED, opacity: 0.5, size: 3 },
  corners: { kind: 'corners', x: 40, y: 40, w: 1000, h: 1250, color: RED, size: 4, layer: 'front' },
  frame: { kind: 'frame', x: 36, y: 36, w: 1008, h: 1368, color: '#ffffff', opacity: 0.4, size: 2, layer: 'front' },
  line: { kind: 'line', x: 440, y: 230, w: 200, h: 5, color: RED },
  diagonal: { kind: 'diagonal', x: 0, y: 0, w: 380, h: 380, color: RED, opacity: 0.9 },
  ribbon: { kind: 'ribbon', x: 60, y: 930, w: 300, h: 58, rotate: -8, color: RED, color2: '#ffffff', layer: 'front', text: 'عرض خاص' },
  watermark: { kind: 'watermark', x: 40, y: 470, w: 1000, h: 300, color: RED, opacity: 0.16, size: 3, text: '{title}' },
  badge: { kind: 'badge', x: 780, y: 540, w: 190, h: 190, rotate: -12, color: RED, color2: '#ffffff', layer: 'front', text: '{badge}' },
  noise: { kind: 'noise', opacity: 0.08, layer: 'front' },
}

export function addDecor(kind: DecorKind) {
  const d = decor(PRESET[kind] ?? { kind })
  d.id = `d_${Date.now().toString(36)}`
  changeStyle((s) => void s.decor.push(d))
  select({ kind: 'decor', id: d.id })
}

export function DecorList() {
  const items = useEditor((s) => s.design.style.decor)
  return (
    <>
      <Group title="الزخارف الحالية">
        {items.length === 0 && <p className="hint">لا توجد زخارف. أضف من الأسفل.</p>}
        <ul className="rows">
          {items.map((d) => (
            <li key={d.id} className={d.visible ? '' : 'off'}>
              <IconBtn icon={d.visible ? <Eye size={15} /> : <EyeOff size={15} />} title={d.visible ? 'إخفاء' : 'إظهار'} onClick={() => changeStyle((s) => void (s.decor.find((x) => x.id === d.id)!.visible = !d.visible))} />
              <button className="row-name" onClick={() => select({ kind: 'decor', id: d.id })}>
                {DECOR_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind}
              </button>
              <IconBtn danger icon={<Trash2 size={14} />} title="حذف" onClick={() => changeStyle((s) => void (s.decor = s.decor.filter((x) => x.id !== d.id)))} />
            </li>
          ))}
        </ul>
      </Group>
      <Group title="إضافة زخرفة">
        <div className="add-grid">
          {DECOR_KINDS.map((k) => (
            <button key={k.value} onClick={() => addDecor(k.value)}>
              <Plus size={13} />
              <span>{k.label}</span>
            </button>
          ))}
        </div>
      </Group>
    </>
  )
}

export function DecorControls({ id }: { id: string }) {
  const item = useDecor(id)
  const badge = useEditor((s) => s.design.content.texts.badge)
  if (!item) return null
  if (isObjectKind(item.kind)) {
    const title = item.name || (item.kind === 'qr' ? 'رمز QR' : item.kind === 'image' ? 'صورة' : 'ملصق')
    return (
      <>
        <ObjectHeader item={item} title={title} />
        <ObjectSpecific item={item} />
        <TransformSection item={item} />
        <EffectsSection item={item} />
        <LayerSection item={item} />
      </>
    )
  }
  const set = (fn: (x: DecorItem) => void, key = '') =>
    changeStyle((s) => {
      const d = s.decor.find((x) => x.id === id)
      if (d) fn(d)
    }, `dec-${id}-${key}`)
  const noSize = ['glow', 'diagonal', 'noise', 'badge', 'line', 'beam', 'blobs', 'wave', 'ribbon'].includes(item.kind)
  return (
    <>
      <ObjectHeader item={item} title={DECOR_KINDS.find((k) => k.value === item.kind)?.label ?? 'زخرفة'} />
      <Group title="المظهر">
        {item.kind === 'badge' && <TextArea value={badge} onChange={(v) => changeContent((c) => void (c.texts.badge = v), 'badge')} placeholder="نص الشارة" />}
        {(item.kind === 'watermark' || item.kind === 'ribbon') && <TextArea value={item.text} dir="auto" onChange={(v) => set((x) => void (x.text = v), 'txt')} />}
        {item.kind === 'watermark' && <p className="hint">{'{title}'} = اسم المنتج تلقائياً</p>}
        <ColorInput label="اللون" value={item.color} onChange={(v) => set((x) => void (x.color = v), 'c')} />
        {['badge', 'ribbon', 'blobs'].includes(item.kind) && <ColorInput label={item.kind === 'blobs' ? 'اللون الثاني' : 'لون النص'} value={item.color2} onChange={(v) => set((x) => void (x.color2 = v), 'c2')} />}
        {!noSize && <Slider label="السماكة / الحجم" value={item.size} min={1} max={120} onChange={(v) => set((x) => void (x.size = v), 's')} />}
      </Group>
      <TransformSection item={item} />
      <EffectsSection item={item} />
      <LayerSection item={item} />
    </>
  )
}

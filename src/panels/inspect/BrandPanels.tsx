import { useMemo } from 'react'
import { AtSign, BadgeCheck, ArrowLeftRight, Upload, Trash2 } from 'lucide-react'
import { Button, ColorField, Field, Row, Section, Segmented } from '../../ui/controls'
import { allPartners, setBrand, toast, useEditor } from '../../store/editor'
import { CONTACT_THEME_ORDER, contactThemes } from '../../poster/ContactBar'
import { putAsset, resolvePublic, useAsset, normalizeImage } from '../../lib/assets'
import { pickFile } from '../../lib/importer'
import { setContent, setStyle } from './common'
import type { LogoVariant, PartnerLogo, PartnerVariant } from '../../model/types'
import { LkgtLogo } from '../../brand/LkgtLogo'

export function ContactPanel() {
  const theme = useEditor((s) => s.design.style.contact.theme)
  const accent = useEditor((s) => s.design.style.contact.accent)
  const mode = useEditor((s) => s.design.style.theme)
  const brand = useEditor((s) => s.brand)
  const themes = contactThemes(mode, accent)
  return (
    <Section title="شريط التواصل" icon={<AtSign size={16} />}>
      <p className="muted small">مكانه ثابت في كل القوالب — اختر شكل الشريط ولونه.</p>
      <div className="contact-grid">
        {CONTACT_THEME_ORDER.map((id) => {
          const t = themes[id]
          return (
            <button key={id} className={`contact-swatch ${theme === id ? 'active' : ''} ${mode}`} onClick={() => setStyle((s) => void (s.contact.theme = id))}>
              <span className="cs-bar" style={{ ...t.bar, borderRadius: t.fullBleed || id === 'minimal' ? 0 : 999, color: t.text }}>
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
      <ColorField label="اللون المميز للشريط" value={accent} alpha={false} onChange={(v) => setStyle((s) => void (s.contact.accent = v), 'c-acc')} />
      <div className="sub-title">معلومات التواصل (لكل القوالب)</div>
      <Field label="الموقع">
        <input className="ui-input" dir="ltr" value={brand.website} onChange={(e) => setBrand({ website: e.target.value })} />
      </Field>
      <Field label="إنستغرام">
        <input className="ui-input" dir="ltr" value={brand.instagram} onChange={(e) => setBrand({ instagram: e.target.value })} />
      </Field>
      <Field label="الهاتف">
        <input className="ui-input" dir="ltr" value={brand.phone} onChange={(e) => setBrand({ phone: e.target.value })} />
      </Field>
    </Section>
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
  toast(`تمت إضافة لوغو «${name}» ✓`, 'ok')
  return logo.id
}

export function LogosPanel() {
  const userPartners = useEditor((s) => s.userPartners)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const current = useEditor((s) => s.design.content.partnerLogoId)
  const logos = useEditor((s) => s.design.style.logos)
  const brand = useEditor((s) => s.brand)
  return (
    <Section title="اللوغوهات" icon={<BadgeCheck size={16} />}>
      <div className="sub-title">لوغو الشركة الشريكة</div>
      <div className="partner-grid">
        <button className={`partner ${!current ? 'active' : ''}`} onClick={() => setContent((c) => void (c.partnerLogoId = null))}>
          <span className="muted">بدون</span>
        </button>
        {partners.map((p) => (
          <div key={p.id} className="partner-wrap">
            <button className={`partner ${current === p.id ? 'active' : ''}`} onClick={() => setContent((c) => void (c.partnerLogoId = p.id))} title={p.name}>
              <PartnerThumb p={p} />
            </button>
            {!p.builtIn && (
              <button
                className="partner-del"
                title="حذف من المكتبة"
                onClick={() => useEditor.setState({ userPartners: userPartners.filter((x) => x.id !== p.id) })}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        <button
          className="partner add"
          onClick={async () => {
            const id = await uploadPartnerLogo()
            if (id) setContent((c) => void (c.partnerLogoId = id))
          }}
        >
          <Upload size={16} />
          <small>رفع لوغو</small>
        </button>
      </div>
      <Field label="لون لوغو الشريك">
        <Segmented<PartnerVariant>
          small
          value={logos.partner}
          options={[
            { value: 'original', label: 'أصلي' },
            { value: 'white', label: 'أبيض' },
            { value: 'black', label: 'أسود' },
          ]}
          onChange={(v) => setStyle((s) => void (s.logos.partner = v))}
        />
      </Field>
      <div className="sub-title">لوغو LKGT (ثابت الحجم والمكان)</div>
      <div className="lkgt-variants">
        {(['color', 'color-flat', 'white', 'black'] as LogoVariant[]).map((v) => (
          <button key={v} className={`${logos.lkgt === v ? 'active' : ''} v-${v}`} onClick={() => setStyle((s) => void (s.logos.lkgt = v))}>
            <LkgtLogo variant={v} height={34} />
            <small>{{ color: 'ستيكر', 'color-flat': 'ملون', white: 'أبيض', black: 'أسود' }[v]}</small>
          </button>
        ))}
      </div>
      <Row>
        <Button small icon={<ArrowLeftRight size={14} />} onClick={() => setBrand({ logoSide: brand.logoSide === 'right' ? 'left' : 'right' })}>
          تبديل جهة اللوغوهات
        </Button>
        <span className="muted small">LKGT حالياً: {brand.logoSide === 'right' ? 'يمين' : 'يسار'}</span>
      </Row>
    </Section>
  )
}

export function LogoOverride() {
  const brand = useEditor((s) => s.brand)
  const a = useAsset(brand.customLogoAssetId)
  return (
    <Row>
      <Button
        small
        icon={<Upload size={14} />}
        onClick={async () => {
          const [f] = await pickFile('image/png,image/svg+xml,image/webp')
          if (!f) return
          const asset = await putAsset(f, f.name)
          setBrand({ customLogoAssetId: asset.id })
        }}
      >
        رفع ملف لوغو LKGT الرسمي
      </Button>
      {a && (
        <Button small variant="ghost" onClick={() => setBrand({ customLogoAssetId: null })}>
          العودة للنسخة المتجهية
        </Button>
      )}
    </Row>
  )
}

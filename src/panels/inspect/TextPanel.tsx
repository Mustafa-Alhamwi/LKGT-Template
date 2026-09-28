import { AlignCenter, AlignLeft, AlignRight, Eye, EyeOff, Type, PanelTop } from 'lucide-react'
import { ColorField, Row, Section, Segmented, Select, Slider, Toggle, TextArea, Button } from '../../ui/controls'
import { setEditing, useEditor } from '../../store/editor'
import type { Decoration, FitMode, TextKey, TextPanel as TP } from '../../model/types'
import { AR_WEIGHTS, LAT_WEIGHTS } from '../../lib/fonts'
import { setContent, setStyle, TEXT_HINTS, TEXT_LABELS } from './common'

const FITS: { value: FitMode; label: string; title: string }[] = [
  { value: 'none', label: 'حجم ثابت', title: 'حجم خط ثابت' },
  { value: 'block', label: 'ملء العرض', title: 'تكبير النص ليملأ عرض الكتلة' },
  { value: 'lines', label: 'كل سطر', title: 'كل سطر يملأ العرض لوحده' },
  { value: 'kashida', label: 'كشيدة', title: 'مدّ الحروف العربية بالكشيدة لملء العرض' },
]

const DECOS: { value: Decoration; label: string }[] = [
  { value: 'none', label: 'بدون' },
  { value: 'pill', label: 'كبسولة' },
  { value: 'box', label: 'صندوق' },
  { value: 'outlineBox', label: 'صندوق بإطار' },
  { value: 'glass', label: 'زجاجي' },
  { value: 'tab', label: 'شريط مائل' },
  { value: 'rules', label: 'خطوط جانبية' },
  { value: 'underline', label: 'خط تحت' },
  { value: 'doubleUnderline', label: 'خطان تحت' },
  { value: 'bar', label: 'خط جانبي' },
  { value: 'bracket', label: 'زوايا' },
]

export function TextPanel({ k }: { k: TextKey }) {
  const st = useEditor((s) => s.design.style.text.items[k])
  const texts = useEditor((s) => s.design.content.texts)
  const fonts = useEditor((s) => s.fonts)
  const set = (fn: (x: typeof st) => void, key = '') => setStyle((s) => fn(s.text.items[k]), `${k}-${key}`)
  const d = st.decoStyle
  const value = k === 'features' ? texts.features.join('\n') : texts[k]
  const boxy = ['pill', 'box', 'outlineBox', 'glass', 'tab'].includes(st.deco)

  return (
    <>
      <Section
        title={TEXT_LABELS[k]}
        icon={<Type size={16} />}
        right={
          <button className="icon-btn" title={st.visible ? 'إخفاء القسم' : 'إظهار القسم'} onClick={() => set((x) => void (x.visible = !x.visible), 'vis')}>
            {st.visible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        }
      >
        <TextArea
          value={value}
          rows={k === 'features' || k === 'tagline' ? 3 : 2}
          dir={k === 'title' || k === 'subtitle' ? 'ltr' : 'auto'}
          onChange={(v) =>
            setContent((c) => {
              if (k === 'features') c.texts.features = v.split('\n')
              else c.texts[k] = v
            }, `text-${k}`)
          }
        />
        {TEXT_HINTS[k] && <p className="muted small">{TEXT_HINTS[k]} · سطر جديد بـ Enter</p>}
        <Button small onClick={() => setEditing(k)}>
          تعديل مباشر داخل التصميم
        </Button>
      </Section>

      <Section title="الخط" icon={<Type size={16} />}>
        <div className="font-row">
          <label>
            <span className="ui-label">وزن العربي · Araboto</span>
            <Select
              value={st.weightAr}
              options={AR_WEIGHTS.map((w) => ({
                value: w.w,
                label: `${w.ar} (${w.label})${fonts && fonts.ar[w.w] === 'missing' ? ' — غير مثبت' : ''}`,
              }))}
              onChange={(v) => set((x) => void (x.weightAr = v), 'wa')}
            />
          </label>
          <label>
            <span className="ui-label">وزن الإنكليزي · HP Simplified</span>
            <Select
              value={st.weightLat}
              options={LAT_WEIGHTS.map((w) => ({
                value: w.w,
                label: `${w.ar} (${w.label})${fonts && fonts.lat[w.w] === 'missing' ? ' — غير مثبت' : ''}`,
              }))}
              onChange={(v) => set((x) => void (x.weightLat = v), 'wl')}
            />
          </label>
        </div>
        <Segmented small value={st.fit} options={FITS} onChange={(v) => set((x) => void (x.fit = v), 'fit')} />
        {st.fit === 'none' || st.fit === 'kashida' ? (
          <Slider label="حجم الخط" value={st.size} min={10} max={220} onChange={(v) => set((x) => void (x.size = v), 'size')} format={(v) => `${v}px`} />
        ) : (
          <Slider label="أقصى حجم" value={st.maxSize} min={10} max={260} onChange={(v) => set((x) => void (x.maxSize = v), 'max')} format={(v) => `${v}px`} />
        )}
        <ColorField label="اللون" value={st.color} onChange={(v) => set((x) => void (x.color = v), 'color')} />
        <ColorField label="لون الكلمات *المميزة*" value={st.accent} alpha={false} onChange={(v) => set((x) => void (x.accent = v), 'accent')} />
        <Toggle label="أحرف كبيرة (EN)" checked={st.uppercase} onChange={(v) => set((x) => void (x.uppercase = v), 'up')} />
        <Slider label="تباعد الأحرف" value={st.tracking} min={-0.1} max={0.5} step={0.005} onChange={(v) => set((x) => void (x.tracking = v), 'tr')} />
        <Slider label="تباعد الأسطر" value={st.lineHeight} min={0.8} max={2} step={0.01} onChange={(v) => set((x) => void (x.lineHeight = v), 'lh')} />
        <Slider label="مسافة قبل العنصر" value={st.marginTop} min={-60} max={200} onChange={(v) => set((x) => void (x.marginTop = v), 'mt')} />
        <Slider label="الشفافية" value={st.opacity} min={0.1} max={1} step={0.01} onChange={(v) => set((x) => void (x.opacity = v), 'op')} />
      </Section>

      <Section title="الإطار / الزخرفة" icon={<PanelTop size={16} />} defaultOpen={st.deco !== 'none'}>
        <Select value={st.deco} options={DECOS} onChange={(v) => set((x) => void (x.deco = v), 'deco')} />
        {boxy && (
          <>
            <ColorField label="لون التعبئة" value={d.fill} onChange={(v) => set((x) => void (x.decoStyle.fill = v), 'dfill')} />
            {(st.deco === 'outlineBox' || st.deco === 'glass') && (
              <>
                <ColorField label="لون الإطار" value={d.stroke} onChange={(v) => set((x) => void (x.decoStyle.stroke = v), 'dstroke')} />
                <Slider label="سماكة الإطار" value={d.strokeWidth} min={0} max={12} onChange={(v) => set((x) => void (x.decoStyle.strokeWidth = v), 'dsw')} />
              </>
            )}
            {st.deco !== 'tab' && <Slider label="استدارة" value={Math.min(d.radius, 120)} min={0} max={120} onChange={(v) => set((x) => void (x.decoStyle.radius = v >= 120 ? 999 : v), 'drad')} />}
            <Slider label="الحشوة الأفقية" value={d.padX} min={0} max={100} onChange={(v) => set((x) => void (x.decoStyle.padX = v), 'dpx')} />
            <Slider label="الحشوة العمودية" value={d.padY} min={0} max={60} onChange={(v) => set((x) => void (x.decoStyle.padY = v), 'dpy')} />
            <Toggle label="بعرض الكتلة كاملة" checked={d.full} onChange={(v) => set((x) => void (x.decoStyle.full = v), 'dfull')} />
            <Toggle label="ظل" checked={d.shadow} onChange={(v) => set((x) => void (x.decoStyle.shadow = v), 'dsh')} />
          </>
        )}
        {['rules', 'underline', 'doubleUnderline', 'bar', 'bracket'].includes(st.deco) && (
          <>
            <ColorField label="لون الخط" value={d.accent} alpha={false} onChange={(v) => set((x) => void (x.decoStyle.accent = v), 'dacc')} />
            {st.deco === 'doubleUnderline' && <ColorField label="لون الخط الأول" value={d.stroke} alpha={false} onChange={(v) => set((x) => void (x.decoStyle.stroke = v), 'dstroke')} />}
            <Slider label="السماكة" value={d.strokeWidth} min={1} max={14} onChange={(v) => set((x) => void (x.decoStyle.strokeWidth = v), 'dsw')} />
            <Slider label="المسافة" value={st.deco === 'rules' || st.deco === 'bar' ? d.padX : d.padY} min={0} max={60} onChange={(v) => set((x) => void (st.deco === 'rules' || st.deco === 'bar' ? (x.decoStyle.padX = v) : (x.decoStyle.padY = v)), 'dgap')} />
          </>
        )}
      </Section>
    </>
  )
}

export function BlockPanel() {
  const tb = useEditor((s) => s.design.style.text)
  const set = (fn: (x: typeof tb) => void, key = '') => setStyle((s) => fn(s.text), `tb-${key}`)
  const p = tb.panel
  return (
    <Section title="كتلة النصوص" icon={<PanelTop size={16} />}>
      <p className="muted small">اسحب الكتلة لتحريكها، واسحب المقبضين الجانبيين لتغيير العرض الموحد.</p>
      <Segmented
        value={tb.align}
        options={[
          { value: 'right', label: <AlignRight size={15} />, title: 'يمين' },
          { value: 'center', label: <AlignCenter size={15} />, title: 'وسط' },
          { value: 'left', label: <AlignLeft size={15} />, title: 'يسار' },
        ]}
        onChange={(v) => set((x) => void (x.align = v), 'align')}
      />
      <Slider label="العرض الموحد" value={tb.w} min={200} max={1040} onChange={(v) => set((x) => void ((x.x = Math.round(x.x + (x.w - v) / 2)), (x.w = v)), 'w')} format={(v) => `${v}px`} />
      <Slider label="الموضع الأفقي" value={tb.x} min={-200} max={1000} onChange={(v) => set((x) => void (x.x = v), 'x')} />
      <Slider label="الموضع العمودي" value={tb.y} min={0} max={1300} onChange={(v) => set((x) => void (x.y = v), 'y')} />
      <Slider label="المسافة بين العناصر" value={tb.gap} min={0} max={80} onChange={(v) => set((x) => void (x.gap = v), 'gap')} />
      <Row>
        <Button small onClick={() => set((x) => void (x.x = Math.round(540 - x.w / 2)))}>
          توسيط أفقي
        </Button>
      </Row>
      <div className="sub-title">خلفية الكتلة</div>
      <Select<TP['kind']>
        value={p.kind}
        options={[
          { value: 'none', label: 'بدون' },
          { value: 'glass', label: 'بطاقة زجاجية' },
          { value: 'solid', label: 'بطاقة ملونة' },
          { value: 'outline', label: 'إطار فقط' },
        ]}
        onChange={(v) => set((x) => void (x.panel.kind = v), 'pk')}
      />
      {p.kind !== 'none' && (
        <>
          {p.kind !== 'outline' && <ColorField label="التعبئة" value={p.fill} onChange={(v) => set((x) => void (x.panel.fill = v), 'pf')} />}
          {p.kind !== 'solid' && <ColorField label="الإطار" value={p.stroke} onChange={(v) => set((x) => void (x.panel.stroke = v), 'ps')} />}
          <Slider label="الاستدارة" value={p.radius} min={0} max={80} onChange={(v) => set((x) => void (x.panel.radius = v), 'pr')} />
          <Slider label="الحشوة" value={p.pad} min={0} max={100} onChange={(v) => set((x) => void (x.panel.pad = v), 'pp')} />
        </>
      )}
    </Section>
  )
}

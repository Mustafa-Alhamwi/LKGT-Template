import { useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Copy, Eye, EyeOff, Link2, Scissors, Trash2 } from 'lucide-react'
import { Btn, Chips, ColorInput, Field, Group, IconBtn, Select, Slider, Switch, TextArea } from '../../ui/kit'
import {
  attachTexts,
  changeContent,
  changeStyle,
  changeTextStyle,
  detachTexts,
  duplicateExtraText,
  getTextStyle,
  removeExtraText,
  setEditing,
  useEditor,
} from '../../store/editor'
import { AR_WEIGHTS, LAT_WEIGHTS } from '../../lib/fonts'
import type { Decoration, FitMode, Selection, TextKey, TextPanel, TextStyle } from '../../model/types'

export const TEXT_LABELS: Record<TextKey, string> = {
  kicker: 'سطر تمهيدي',
  title: 'اسم المنتج',
  subtitle: 'وصف المنتج',
  tagline: 'الجملة التسويقية',
  features: 'المزايا',
  note: 'سطر إضافي',
  price: 'السعر',
}

export const TEXT_HINTS: Partial<Record<TextKey, string>> = {
  tagline: 'ضع *كلمة* بين نجمتين لتلوينها',
  features: 'ميزة في كل سطر',
}

const FITS: { value: FitMode; label: string; title: string }[] = [
  { value: 'none', label: 'ثابت', title: 'حجم خط ثابت' },
  { value: 'block', label: 'ملء العرض', title: 'تكبير النص ليملأ عرض الكتلة' },
  { value: 'lines', label: 'كل سطر', title: 'كل سطر يملأ العرض' },
  { value: 'kashida', label: 'كشيدة', title: 'مدّ الحروف العربية بالكشيدة' },
]

const DECOS: { value: Decoration; label: string }[] = [
  { value: 'none', label: 'بدون' },
  { value: 'pill', label: 'كبسولة / بطاقة' },
  { value: 'box', label: 'صندوق' },
  { value: 'outlineBox', label: 'بطاقة بإطار' },
  { value: 'glass', label: 'زجاجي' },
  { value: 'tab', label: 'شريط مائل' },
  { value: 'rules', label: 'خطوط جانبية' },
  { value: 'underline', label: 'خط تحت' },
  { value: 'doubleUnderline', label: 'خطان تحت' },
  { value: 'bar', label: 'خط جانبي' },
  { value: 'bracket', label: 'زوايا' },
]

/** قيمة النص + كاتبها لأي عنصر (مدمج أو إضافي) */
export function useTextValue(sel: Selection) {
  const value = useEditor((s) => {
    if (sel.kind === 'extra') return s.design.content.extras?.find((e) => e.id === sel.id)?.text ?? ''
    if (sel.kind === 'text') return sel.key === 'features' ? s.design.content.texts.features.join('\n') : s.design.content.texts[sel.key]
    return ''
  })
  const set = (v: string) =>
    changeContent((c) => {
      if (sel.kind === 'extra') {
        const ex = c.extras?.find((e) => e.id === sel.id)
        if (ex) ex.text = v
      } else if (sel.kind === 'text') {
        if (sel.key === 'features') c.texts.features = v.split('\n')
        else c.texts[sel.key] = v
      }
    }, `text-${sel.kind === 'extra' ? sel.id : sel.kind === 'text' ? sel.key : ''}`)
  return [value, set] as const
}

type Pill = 'text' | 'color' | 'card' | 'layout'
let lastPill: Pill = 'text'

export function TextControls({ sel }: { sel: Extract<Selection, { kind: 'text' | 'extra' }> }) {
  const st = useEditor((s) => getTextStyle(s.design, sel))
  const fonts = useEditor((s) => s.fonts)
  const [value, setValue] = useTextValue(sel)
  const [pill, setPillState] = useState<Pill>(lastPill)
  const setPill = (p: Pill) => {
    lastPill = p
    setPillState(p)
  }
  if (!st) return null
  const id = sel.kind === 'text' ? sel.key : sel.id
  const set = (fn: (x: TextStyle) => void, key = '') => changeTextStyle(sel, fn, key)
  const d = st.decoStyle
  const boxy = ['pill', 'box', 'outlineBox', 'glass', 'tab'].includes(st.deco)
  const lineDeco = ['rules', 'underline', 'doubleUnderline', 'bar', 'bracket'].includes(st.deco)
  const isFree = sel.kind === 'extra' || !!st.free
  const title = sel.kind === 'text' ? TEXT_LABELS[sel.key] : 'نص إضافي'

  return (
    <>
      <div className="el-title">
        <strong>{title}</strong>
        <span className="el-actions">
          {sel.kind === 'text' ? (
            <IconBtn icon={st.visible ? <Eye size={16} /> : <EyeOff size={16} />} title={st.visible ? 'إخفاء القسم' : 'إظهار القسم'} onClick={() => set((x) => void (x.visible = !x.visible), 'vis')} />
          ) : (
            <>
              <IconBtn icon={<Copy size={15} />} title="تكرار" onClick={() => duplicateExtraText(sel.id)} />
              <IconBtn danger icon={<Trash2 size={15} />} title="حذف" onClick={() => removeExtraText(sel.id)} />
            </>
          )}
        </span>
      </div>

      <div className="pills">
        {(
          [
            ['text', 'النص'],
            ['color', 'اللون والتأثير'],
            ['card', 'البطاقة'],
            ['layout', 'الموضع'],
          ] as [Pill, string][]
        ).map(([v, l]) => (
          <button key={v} className={pill === v ? 'on' : ''} onClick={() => setPill(v)}>
            {l}
          </button>
        ))}
      </div>

      {pill === 'text' && (
        <>
          <Group>
            <TextArea value={value} onChange={setValue} rows={sel.kind === 'text' && (sel.key === 'features' || sel.key === 'tagline') ? 3 : 2} dir={sel.kind === 'text' && (sel.key === 'title' || sel.key === 'subtitle') ? 'ltr' : 'auto'} />
            {sel.kind === 'text' && TEXT_HINTS[sel.key] && <p className="hint">{TEXT_HINTS[sel.key]}</p>}
            <Btn small onClick={() => setEditing(id)}>
              تعديل مباشر على التصميم
            </Btn>
          </Group>
          <Group title="الخط">
            <Field label="العربي · Araboto">
              <Select
                value={st.weightAr}
                options={AR_WEIGHTS.map((w) => ({ value: w.w, label: `${w.ar}${fonts && fonts.ar[w.w] === 'missing' ? ' (غير مثبت)' : ''}` }))}
                onChange={(v) => set((x) => void (x.weightAr = v), 'wa')}
              />
            </Field>
            <Field label="الإنكليزي · HP">
              <Select
                value={st.weightLat}
                options={LAT_WEIGHTS.map((w) => ({ value: w.w, label: `${w.ar}${fonts && fonts.lat[w.w] === 'missing' ? ' (غير مثبت)' : ''}` }))}
                onChange={(v) => set((x) => void (x.weightLat = v), 'wl')}
              />
            </Field>
            <Chips<FitMode> value={st.fit} options={FITS} onChange={(v) => set((x) => void (x.fit = v), 'fit')} />
            {st.fit === 'none' || st.fit === 'kashida' ? (
              <Slider label="حجم الخط" value={st.size} min={10} max={240} unit="px" onChange={(v) => set((x) => void (x.size = v), 'size')} />
            ) : (
              <Slider label="أقصى حجم" value={st.maxSize} min={10} max={280} unit="px" onChange={(v) => set((x) => void (x.maxSize = v), 'max')} />
            )}
            <Switch label="أحرف كبيرة (EN)" checked={st.uppercase} onChange={(v) => set((x) => void (x.uppercase = v), 'up')} />
            <Slider label="تباعد الأحرف" value={st.tracking} min={-0.1} max={0.5} step={0.005} onChange={(v) => set((x) => void (x.tracking = v), 'tr')} />
            <Slider label="تباعد الأسطر" value={st.lineHeight} min={0.8} max={2} step={0.01} onChange={(v) => set((x) => void (x.lineHeight = v), 'lh')} />
          </Group>
        </>
      )}

      {pill === 'color' && (
        <>
          <Group title="اللون">
            <ColorInput label="لون النص" value={st.color} alpha onChange={(v) => set((x) => void (x.color = v), 'color')} />
            <ColorInput label="لون *الكلمات المميزة*" value={st.accent} onChange={(v) => set((x) => void (x.accent = v), 'accent')} />
            <Switch label="تدرج لوني للنص" checked={!!st.gradient} onChange={(v) => set((x) => void (x.gradient = v), 'grad')} />
            {st.gradient && (
              <>
                <ColorInput label="اللون الثاني" value={st.color2 ?? '#7A0B12'} onChange={(v) => set((x) => void (x.color2 = v), 'c2')} />
                <Slider label="اتجاه التدرج" value={st.gradAngle ?? 90} min={0} max={360} unit="°" onChange={(v) => set((x) => void (x.gradAngle = v), 'ga')} />
              </>
            )}
            <Slider label="الشفافية" value={st.opacity} min={0.1} max={1} step={0.01} onChange={(v) => set((x) => void (x.opacity = v), 'op')} />
          </Group>
          <Group title="تأثيرات">
            <Slider label="سماكة حدود الحروف" value={st.strokeW ?? 0} min={0} max={12} step={0.5} unit="px" onChange={(v) => set((x) => void (x.strokeW = v), 'sw')} />
            {(st.strokeW ?? 0) > 0 && <ColorInput label="لون الحدود" value={st.strokeColor ?? '#ffffff'} onChange={(v) => set((x) => void (x.strokeColor = v), 'sc')} />}
            <Field label="ظل النص">
              <Select
                value={st.textShadow ?? 'none'}
                options={[
                  { value: 'none', label: 'بدون' },
                  { value: 'soft', label: 'ناعم' },
                  { value: 'glow', label: 'توهج' },
                  { value: 'hard', label: 'حاد' },
                ]}
                onChange={(v) => set((x) => void (x.textShadow = v), 'tsh')}
              />
            </Field>
            {(st.textShadow ?? 'none') !== 'none' && <ColorInput label="لون الظل" value={st.shadowColor ?? '#000000'} onChange={(v) => set((x) => void (x.shadowColor = v), 'tsc')} />}
          </Group>
        </>
      )}

      {pill === 'card' && (
        <Group title="شكل البطاقة" hint="غلاف يحيط بالنص: كبسولة، بطاقة، زجاج، شريط، خطوط…">
          <Select value={st.deco} options={DECOS} onChange={(v) => set((x) => void (x.deco = v), 'deco')} />
          {boxy && (
            <>
              <ColorInput label="لون البطاقة" value={d.fill} alpha onChange={(v) => set((x) => void (x.decoStyle.fill = v), 'dfill')} />
              <Switch label="تدرج لوني" checked={!!d.fill2} onChange={(v) => set((x) => void (x.decoStyle.fill2 = v ? '#7A0B12' : ''), 'dg')} />
              {!!d.fill2 && (
                <>
                  <ColorInput label="اللون الثاني" value={d.fill2} alpha onChange={(v) => set((x) => void (x.decoStyle.fill2 = v), 'dfill2')} />
                  <Slider label="اتجاه التدرج" value={d.angle ?? 135} min={0} max={360} unit="°" onChange={(v) => set((x) => void (x.decoStyle.angle = v), 'dang')} />
                </>
              )}
              {(st.deco === 'outlineBox' || st.deco === 'glass') && (
                <>
                  <ColorInput label="لون الإطار" value={d.stroke} alpha onChange={(v) => set((x) => void (x.decoStyle.stroke = v), 'dstroke')} />
                  <Slider label="سماكة الإطار" value={d.strokeWidth} min={0} max={12} step={0.5} onChange={(v) => set((x) => void (x.decoStyle.strokeWidth = v), 'dsw')} />
                </>
              )}
              {st.deco === 'glass' && <Slider label="قوة التمويه" value={d.blur ?? 14} min={0} max={40} onChange={(v) => set((x) => void (x.decoStyle.blur = v), 'dbl')} />}
              {st.deco !== 'tab' && <Slider label="استدارة الزوايا" value={Math.min(d.radius, 120)} min={0} max={120} onChange={(v) => set((x) => void (x.decoStyle.radius = v >= 120 ? 999 : v), 'drad')} />}
              <Slider label="الحشوة الأفقية" value={d.padX} min={0} max={120} onChange={(v) => set((x) => void (x.decoStyle.padX = v), 'dpx')} />
              <Slider label="الحشوة العمودية" value={d.padY} min={0} max={70} onChange={(v) => set((x) => void (x.decoStyle.padY = v), 'dpy')} />
              <Switch label="بعرض الكتلة كاملة" checked={d.full} onChange={(v) => set((x) => void (x.decoStyle.full = v), 'dfull')} />
              <Switch label="ظل" checked={d.shadow} onChange={(v) => set((x) => void (x.decoStyle.shadow = v), 'dsh')} />
              {d.shadow && (
                <>
                  <Slider label="حجم الظل" value={d.shadowSize ?? 1} min={0.3} max={3} step={0.1} onChange={(v) => set((x) => void (x.decoStyle.shadowSize = v), 'dss')} />
                  <ColorInput label="لون الظل" value={d.shadowColor ?? '#000000'} onChange={(v) => set((x) => void (x.decoStyle.shadowColor = v), 'dsc')} />
                </>
              )}
            </>
          )}
          {lineDeco && (
            <>
              <ColorInput label="لون الخط" value={d.accent} onChange={(v) => set((x) => void (x.decoStyle.accent = v), 'dacc')} />
              {st.deco === 'doubleUnderline' && <ColorInput label="لون الخط الأول" value={d.stroke} onChange={(v) => set((x) => void (x.decoStyle.stroke = v), 'dstroke')} />}
              <Slider label="السماكة" value={d.strokeWidth} min={1} max={14} onChange={(v) => set((x) => void (x.decoStyle.strokeWidth = v), 'dsw')} />
              <Slider label="المسافة" value={st.deco === 'rules' || st.deco === 'bar' ? d.padX : d.padY} min={0} max={70} onChange={(v) => set((x) => void (st.deco === 'rules' || st.deco === 'bar' ? (x.decoStyle.padX = v) : (x.decoStyle.padY = v)), 'dgap')} />
            </>
          )}
        </Group>
      )}

      {pill === 'layout' && (
        <>
          {sel.kind === 'text' && (
            <Group title="كسر البطاقة" hint="عند الكسر ينفصل هذا العنصر عن كتلة النصوص ويصبح له موضع وعرض خاصان — يبقى مكانه كما هو بدون قفزة.">
              {isFree ? (
                <Btn small icon={<Link2 size={14} />} onClick={() => attachTexts([sel.key])}>
                  إعادة دمجه في الكتلة
                </Btn>
              ) : (
                <Btn small variant="primary" icon={<Scissors size={14} />} onClick={() => detachTexts([sel.key])}>
                  كسر عن الكتلة (تحريك حرّ)
                </Btn>
              )}
            </Group>
          )}
          {isFree && (
            <Group title="الموضع">
              <Slider label="س" value={st.fx ?? 0} min={-400} max={1200} onChange={(v) => set((x) => void (x.fx = v), 'fx')} />
              <Slider label="ص" value={st.fy ?? 0} min={-100} max={1500} onChange={(v) => set((x) => void (x.fy = v), 'fy')} />
              <Slider label="العرض" value={st.fw ?? 600} min={80} max={1200} onChange={(v) => set((x) => void (x.fw = v), 'fw')} />
              <Slider label="الدوران" value={st.rotate ?? 0} min={-180} max={180} unit="°" onChange={(v) => set((x) => void (x.rotate = v), 'rot')} />
              <Btn small onClick={() => set((x) => void (x.fx = Math.round(540 - (x.fw ?? 600) / 2)))}>
                توسيط أفقي
              </Btn>
            </Group>
          )}
          <Group title="المحاذاة">
            <Chips<'inherit' | 'right' | 'center' | 'left'>
              value={st.align ?? 'inherit'}
              options={[
                ...(isFree ? [] : [{ value: 'inherit' as const, label: 'كالكتلة' }]),
                { value: 'right', label: <AlignRight size={15} />, title: 'يمين' },
                { value: 'center', label: <AlignCenter size={15} />, title: 'وسط' },
                { value: 'left', label: <AlignLeft size={15} />, title: 'يسار' },
              ]}
              onChange={(v) => set((x) => void (x.align = v), 'al')}
            />
            {!isFree && <Slider label="مسافة قبل العنصر" value={st.marginTop} min={-60} max={220} onChange={(v) => set((x) => void (x.marginTop = v), 'mt')} />}
          </Group>
        </>
      )}
    </>
  )
}

export function BlockControls() {
  const tb = useEditor((s) => s.design.style.text)
  const texts = useEditor((s) => s.design.content.texts)
  const set = (fn: (x: typeof tb) => void, key = '') => changeStyle((s) => fn(s.text), `tb-${key}`)
  const p = tb.panel
  const visibleKeys = tb.order.filter((k) => tb.items[k].visible && (k === 'features' ? texts.features.some((f) => f.trim()) : texts[k].trim()))
  const flowKeys = visibleKeys.filter((k) => !tb.items[k].free)
  const freeKeys = visibleKeys.filter((k) => tb.items[k].free)
  return (
    <>
      <Group title="كتلة النصوص" hint="اسحب الكتلة لتحريكها، واسحب المقبضين الجانبيين لتغيير العرض الموحّد.">
        <Chips
          value={tb.align}
          options={[
            { value: 'right', label: <AlignRight size={15} />, title: 'يمين' },
            { value: 'center', label: <AlignCenter size={15} />, title: 'وسط' },
            { value: 'left', label: <AlignLeft size={15} />, title: 'يسار' },
          ]}
          onChange={(v) => set((x) => void (x.align = v), 'al')}
        />
        <Slider label="العرض الموحّد" value={tb.w} min={200} max={1040} unit="px" onChange={(v) => set((x) => void ((x.x = Math.round(x.x + (x.w - v) / 2)), (x.w = v)), 'w')} />
        <Slider label="الموضع الأفقي" value={tb.x} min={-200} max={1000} onChange={(v) => set((x) => void (x.x = v), 'x')} />
        <Slider label="الموضع العمودي" value={tb.y} min={0} max={1300} onChange={(v) => set((x) => void (x.y = v), 'y')} />
        <Slider label="المسافة بين العناصر" value={tb.gap} min={0} max={80} onChange={(v) => set((x) => void (x.gap = v), 'gap')} />
        <Btn small onClick={() => set((x) => void (x.x = Math.round(540 - x.w / 2)))}>
          توسيط أفقي
        </Btn>
      </Group>
      <Group title="كسر البطاقات" hint="فصل كل عنصر نصي عن الكتلة ليتحرك ويتغير حجمه بحرية.">
        <Btn small variant="primary" icon={<Scissors size={14} />} disabled={!flowKeys.length} onClick={() => detachTexts(flowKeys)}>
          كسر الكل ({flowKeys.length})
        </Btn>
        <Btn small icon={<Link2 size={14} />} disabled={!freeKeys.length} onClick={() => attachTexts(freeKeys)}>
          إعادة دمج الكل ({freeKeys.length})
        </Btn>
      </Group>
      <Group title="خلفية الكتلة">
        <Select<TextPanel['kind']>
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
            {p.kind !== 'outline' && <ColorInput label="التعبئة" value={p.fill} alpha onChange={(v) => set((x) => void (x.panel.fill = v), 'pf')} />}
            {p.kind !== 'solid' && <ColorInput label="الإطار" value={p.stroke} alpha onChange={(v) => set((x) => void (x.panel.stroke = v), 'ps')} />}
            <Slider label="الاستدارة" value={p.radius} min={0} max={90} onChange={(v) => set((x) => void (x.panel.radius = v), 'pr')} />
            <Slider label="الحشوة" value={p.pad} min={0} max={100} onChange={(v) => set((x) => void (x.panel.pad = v), 'pp')} />
          </>
        )}
      </Group>
    </>
  )
}

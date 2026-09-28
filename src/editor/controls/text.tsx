import { useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Clipboard, ClipboardPaste, Copy, Eye, EyeOff, ImagePlus, Link2, Lock, Scissors, Trash2, Unlock, X } from 'lucide-react'
import { Btn, Chips, ColorInput, Field, Group, IconBtn, Select, Slider, Switch, TextArea } from '../../ui/kit'
import {
  applyTextPresetTo,
  attachTexts,
  changeContent,
  changeStyle,
  changeTextStyle,
  copyTextStyle,
  deleteTextPreset,
  detachTexts,
  duplicateExtraText,
  getTextStyle,
  pasteTextStyle,
  removeExtraText,
  saveTextPreset,
  setEditing,
  toast,
  useEditor,
} from '../../store/editor'
import { BUILTIN_TEXT_PRESETS } from '../../model/textPresets'
import { BLENDS } from './objects'
import { presetPreviewCss, usePresetCtx } from '../Library'
import { normalizeImage, putAsset } from '../../lib/assets'
import { pickFile } from '../../lib/importer'
import type { BlendMode, ShowWhen } from '../../model/types'
import { SHOW_WHEN_LABELS } from '../../model/showWhen'
import { ShowIfControl } from './showIf'
import { AR_WEIGHTS, LAT_WEIGHTS } from '../../lib/fonts'
import { categoryDef } from '../../model/categories'
import type { Decoration, FitMode, Selection, TextPanel, TextStyle } from '../../model/types'

/** تعريف فئة التصميم الحالية (أسماء الحقول والتلميحات) */
export function useCat() {
  return useEditor((s) => categoryDef(s.design.category))
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

type Pill = 'text' | 'color' | 'card' | 'layout' | 'style'
let lastPill: Pill = 'text'

export function TextControls({ sel }: { sel: Extract<Selection, { kind: 'text' | 'extra' }> }) {
  const st = useEditor((s) => getTextStyle(s.design, sel))
  const fonts = useEditor((s) => s.fonts)
  const cat = useCat()
  const clip = useEditor((s) => s.clip)
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
  const title = sel.kind === 'text' ? cat.labels[sel.key] : 'نص إضافي'

  return (
    <>
      <div className="el-title">
        <strong>{title}</strong>
        <span className="el-actions">
          <IconBtn icon={<Clipboard size={15} />} title="نسخ التنسيق (Ctrl+Alt+C)" onClick={() => copyTextStyle() && toast('تم نسخ التنسيق — حدد نصاً آخر والصقه', 'ok', 1800)} />
          <IconBtn icon={<ClipboardPaste size={15} />} title="لصق التنسيق (Ctrl+Alt+V)" disabled={clip?.kind !== 'style'} onClick={() => pasteTextStyle([sel])} />
          <IconBtn icon={st.locked ? <Lock size={15} /> : <Unlock size={15} />} active={!!st.locked} title={st.locked ? 'فتح القفل' : 'قفل (لا يتحرك بالسحب)'} onClick={() => set((x) => void (x.locked = !x.locked), 'lock')} />
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
            ['style', 'أنماط'],
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
            {sel.kind === 'text' && cat.hints[sel.key] && <p className="hint">{cat.hints[sel.key]}</p>}
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
            {(st.fit === 'none' || st.fit === 'kashida') && (
              <>
                <Switch label="التفاف تلقائي للكلمات" checked={!!st.wrap} onChange={(v) => set((x) => void (x.wrap = v), 'wrap')} />
                {st.wrap && <Switch label="توازن طول الأسطر" checked={!!st.balance} onChange={(v) => set((x) => void (x.balance = v), 'bal')} />}
                {st.wrap && <Slider label="أقصى عدد أسطر (0 = بلا حد) — يصغّر الخط تلقائياً" value={st.maxLines ?? 0} min={0} max={8} onChange={(v) => set((x) => void (x.maxLines = v || undefined), 'ml')} />}
              </>
            )}
            <Switch label="أحرف كبيرة (EN)" checked={st.uppercase} onChange={(v) => set((x) => void (x.uppercase = v), 'up')} />
            <Switch label="شطب النص (سعر قديم)" checked={!!st.strike} onChange={(v) => set((x) => void (x.strike = v), 'strike')} />
            {isFree && <Slider label="انحناء النص (قوس)" value={st.curve ?? 0} min={-100} max={100} onChange={(v) => set((x) => void (x.curve = v), 'curve')} />}
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
            <Field label="الدمج">
              <Select<BlendMode> value={st.blend ?? 'normal'} options={BLENDS} onChange={(v) => set((x) => void (x.blend = v), 'blend')} />
            </Field>
            <div className="row-btns">
              <Btn
                small
                icon={<ImagePlus size={14} />}
                onClick={async () => {
                  const [f] = await pickFile('image/*')
                  if (!f) return
                  const n = await normalizeImage(f, 1600)
                  const a = await putAsset(n.blob, f.name, { w: n.w, h: n.h })
                  set((x) => void (x.fillImage = a.id))
                }}
              >
                تعبئة الحروف بصورة
              </Btn>
              {st.fillImage && (
                <Btn small variant="ghost" icon={<X size={14} />} onClick={() => set((x) => void (x.fillImage = undefined))}>
                  إزالة الصورة
                </Btn>
              )}
            </div>
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

      {pill === 'style' && <StylePresets sel={sel} />}

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
          {cat.answers && (
            <Group title="الظهور" hint="تحكّم بظهور هذا النص بحسب حالة التصميم: سؤال أم كشف للإجابة.">
              <Select<ShowWhen> value={st.showWhen ?? 'always'} options={SHOW_WHEN_LABELS.map((o) => ({ value: o.value, label: o.value === 'a' ? `عندما الإجابة «${cat.answers!.a}»` : o.value === 'b' ? `عندما الإجابة «${cat.answers!.b}»` : o.label }))} onChange={(v) => set((x) => void (x.showWhen = v), 'sw')} />
            </Group>
          )}
          <Group title="قاعدة ذكية" hint="مثلاً: أخفِ هذا العنصر تلقائياً إذا لم تكتب سعراً.">
            <ShowIfControl rule={st.showIf} cat={cat} onChange={(r) => set((x) => void (x.showIf = r), 'si')} />
          </Group>
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

function StylePresets({ sel }: { sel: Extract<Selection, { kind: 'text' | 'extra' }> }) {
  const ctx = usePresetCtx()
  const user = useEditor((s) => s.textPresets)
  const [name, setName] = useState('')
  return (
    <>
      <Group title="أنماط جاهزة" hint="تُطبَّق على هذا النص فقط (يبقى نصك وموضعه كما هما).">
        <div className="preset-grid">
          {BUILTIN_TEXT_PRESETS.map((p) => {
            const st = p.style(ctx)
            return (
              <button key={p.id} className={`preset ${ctx.dark ? 'dk' : ''}`} onClick={() => applyTextPresetTo({ ...st, fit: 'none' }, [sel])} title={p.name}>
                <span className="preset-sample">
                  <span style={presetPreviewCss(st, ctx)}>{p.sample}</span>
                </span>
                <small>{p.name}</small>
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="أنماطي المحفوظة">
        <div className="ver-new">
          <input className="txi" placeholder="اسم للنمط الحالي" value={name} onChange={(e) => setName(e.target.value)} />
          <Btn
            small
            variant="primary"
            onClick={() => {
              saveTextPreset(name.trim() || `نمط ${user.length + 1}`)
              setName('')
              toast('تم حفظ النمط', 'ok', 1800)
            }}
          >
            حفظ
          </Btn>
        </div>
        {!user.length && <p className="hint">احفظ تنسيق النص الحالي (لون، بطاقة، ظل، خط…) لتطبّقه على أي نص لاحقاً.</p>}
        <div className="preset-grid">
          {user.map((p) => (
            <div key={p.id} className="preset-wrap">
              <button className={`preset ${ctx.dark ? 'dk' : ''}`} onClick={() => applyTextPresetTo({ ...p.style }, [sel])} title={p.name}>
                <span className="preset-sample">
                  <span style={presetPreviewCss(p.style, ctx)}>{p.name}</span>
                </span>
                <small>{p.name}</small>
              </button>
              <button className="partner-del" title="حذف النمط" onClick={() => deleteTextPreset(p.id)}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </Group>
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

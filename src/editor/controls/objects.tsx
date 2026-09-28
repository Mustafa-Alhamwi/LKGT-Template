import { useState } from 'react'
import { AlignCenterHorizontal, AlignCenterVertical, ArrowDownToLine, ArrowUp, ArrowUpToLine, ArrowDown, Copy, FlipHorizontal2, Lock, Scissors, Trash2, Unlock, Upload, Eye, EyeOff } from 'lucide-react'
import { Btn, Chips, ColorInput, Field, Group, IconBtn, Select, Slider, Switch, TextArea } from '../../ui/kit'
import { useEditor } from '../../store/editor'
import type { BlendMode, DecorItem, ImageFrame, ImageMask, ObjShadow, QrSpec } from '../../model/types'
import { canvasOf } from '../../model/types'
import { canFlip, isObjectKind } from '../../poster/DecorLayer'
import { findSticker } from '../../poster/stickers'
import { categoryOf } from '../../model/categories'
import { centerDecor, cutoutImageObject, duplicateDecor, orderDecor, removeDecor, setDecorLayer, updateDecor } from '../../store/objects'
import { pickFile } from '../../lib/importer'
import { SHOW_WHEN_LABELS } from '../../model/showWhen'
import { ShowIfControl } from './showIf'
import type { ShowWhen } from '../../model/types'
import { normalizeImage, putAsset } from '../../lib/assets'
import { changeContent } from '../../store/editor'
import { select } from '../../store/editor'

/* ------------------------------------------------------------------
 * خصائص العناصر الحرّة: ملصق / QR / صورة + الموضع والتأثيرات والطبقات
 * ------------------------------------------------------------------ */

export function useDecor(id: string): DecorItem | undefined {
  return useEditor((s) => s.design.style.decor.find((d) => d.id === id))
}

export function ObjectHeader({ item, title }: { item: DecorItem; title: string }) {
  return (
    <div className="el-title">
      <strong>{title}</strong>
      <span className="el-actions">
        <IconBtn icon={item.visible ? <Eye size={16} /> : <EyeOff size={16} />} title={item.visible ? 'إخفاء' : 'إظهار'} onClick={() => updateDecor(item.id, (x) => void (x.visible = !x.visible))} />
        <IconBtn icon={item.locked ? <Lock size={15} /> : <Unlock size={15} />} active={!!item.locked} title={item.locked ? 'فتح القفل' : 'قفل العنصر'} onClick={() => updateDecor(item.id, (x) => void (x.locked = !x.locked))} />
        <IconBtn icon={<Copy size={15} />} title="تكرار" onClick={() => duplicateDecor(item.id)} />
        <IconBtn
          danger
          icon={<Trash2 size={15} />}
          title="حذف"
          onClick={() => {
            removeDecor(item.id)
            select(null, false)
          }}
        />
      </span>
    </div>
  )
}

/* ------------------------------ ملصق ------------------------------ */

function StickerSection({ item }: { item: DecorItem }) {
  const def = findSticker(item.sticker?.id ?? '')
  const cat = useEditor((s) => categoryOf(s.design))
  if (!def || !item.sticker) return null
  const set = (fn: (d: DecorItem) => void, key = '') => updateDecor(item.id, fn, key)
  const sp = item.sticker
  const isIcon = def.cat === 'icon'
  const isBadge = def.cat === 'badge'
  const hasText = def.text !== undefined
  return (
    <Group title={def.label}>
      {hasText && <TextArea value={sp.text} dir="auto" rows={def.id === 'b:stars' ? 1 : 2} onChange={(v) => set((x) => void (x.sticker!.text = v), 'st')} placeholder={def.id === 'b:stars' ? 'التقييم (0–5)' : 'نص الملصق'} />}
      {def.text2 !== undefined && <TextArea value={sp.text2 ?? ''} dir="auto" rows={2} onChange={(v) => set((x) => void (x.sticker!.text2 = v), 'st2')} placeholder="نص ثانٍ" />}
      <ColorInput label={isIcon ? 'لون الأيقونة' : isBadge ? 'لون الشارة' : 'اللون'} value={item.color} onChange={(v) => set((x) => void (x.color = v), 'c')} />
      {(isBadge || isIcon || def.id === 's:blob1' || def.id === 's:blob2' || def.id === 's:confetti' || def.id === 's:sparkles') && (
        <ColorInput label={isIcon ? 'لون الخلفية' : isBadge ? 'لون النص/التفاصيل' : 'اللون الثاني'} value={item.color2} onChange={(v) => set((x) => void (x.color2 = v), 'c2')} />
      )}
      {(isIcon || def.strokeW !== undefined) && <Slider label="سماكة الخط" value={sp.strokeW ?? def.strokeW ?? 2} min={isIcon ? 1 : 2} max={isIcon ? 4 : 30} step={isIcon ? 0.25 : 1} onChange={(v) => set((x) => void (x.sticker!.strokeW = v), 'sw')} />}
      {isIcon && (
        <Field label="الخلفية">
          <Chips<string>
            value={sp.bg ?? 'circle'}
            options={[
              { value: 'none', label: 'بدون' },
              { value: 'circle', label: 'دائرة' },
              { value: 'rounded', label: 'مربع' },
              { value: 'squircle', label: 'ناعم' },
            ]}
            onChange={(v) => set((x) => void (x.sticker!.bg = v as 'none'), 'bg')}
          />
        </Field>
      )}
      {def.id.startsWith('b:chip') && cat.answers && (
        <Field label="دور الإجابة">
          <Chips<string>
            value={sp.answerRole ?? ''}
            options={[
              { value: '', label: 'ثابت' },
              { value: 'a', label: `خيار «${cat.answers.a}»` },
              { value: 'b', label: `خيار «${cat.answers.b}»` },
            ]}
            onChange={(v) => set((x) => void (x.sticker!.answerRole = (v || undefined) as 'a' | undefined), 'ar')}
          />
        </Field>
      )}
    </Group>
  )
}

/* ------------------------------ QR ------------------------------ */

const QR_MODES: { value: QrSpec['mode']; label: string }[] = [
  { value: 'url', label: 'رابط' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'phone', label: 'اتصال' },
  { value: 'email', label: 'بريد' },
  { value: 'text', label: 'نص' },
  { value: 'barcode', label: 'باركود' },
]

function QrSection({ item }: { item: DecorItem }) {
  const q = item.qr
  if (!q) return null
  const set = (fn: (q: QrSpec) => void, key = '') => updateDecor(item.id, (x) => fn(x.qr!), key)
  const barcode = q.mode === 'barcode'
  return (
    <Group title={barcode ? 'الباركود' : 'رمز QR'}>
      <Chips<QrSpec['mode']> value={q.mode} options={QR_MODES} wrap onChange={(v) => set((x) => void ((x.mode = v), v === 'barcode' && !/^\d+$/.test(x.data) && (x.data = '6294003700018')))} />
      <input className="txi ltr" dir="ltr" value={q.data} onChange={(e) => set((x) => void (x.data = e.target.value), 'qd')} />
      {(q.mode === 'whatsapp' || q.mode === 'email') && <input className="txi" placeholder={q.mode === 'email' ? 'عنوان الرسالة' : 'رسالة جاهزة'} value={q.extra ?? ''} onChange={(e) => set((x) => void (x.extra = e.target.value), 'qe')} />}
      {!barcode && (
        <Field label="الشكل">
          <Chips<QrSpec['style']>
            value={q.style}
            options={[
              { value: 'square', label: 'مربعات' },
              { value: 'rounded', label: 'ناعم' },
              { value: 'dots', label: 'نقاط' },
            ]}
            onChange={(v) => set((x) => void (x.style = v))}
          />
        </Field>
      )}
      <ColorInput label="لون الرمز" value={q.fg} onChange={(v) => set((x) => void (x.fg = v), 'fg')} />
      <Switch label="خلفية" checked={q.bgOn} onChange={(v) => set((x) => void (x.bgOn = v))} />
      {q.bgOn && (
        <>
          <ColorInput label="لون الخلفية" value={q.bg} onChange={(v) => set((x) => void (x.bg = v), 'bg')} />
          <Slider label="استدارة الخلفية" value={q.radius} min={0} max={100} onChange={(v) => set((x) => void (x.radius = v), 'qr')} />
        </>
      )}
      {!barcode && <Slider label="الهامش الداخلي" value={q.padding} min={0} max={6} step={0.5} onChange={(v) => set((x) => void (x.padding = v), 'qp')} />}
      <p className="hint">{barcode ? 'أدخل 12 أو 13 رقماً لإنتاج EAN-13، أو أي نص لإنتاج Code128.' : 'تأكد من مسح الرمز بهاتفك بعد أي تعديل على الألوان (يجب أن يبقى التباين عالياً).'}</p>
    </Group>
  )
}

/* ------------------------------ صورة ------------------------------ */

const MASKS: { value: ImageMask; label: string }[] = [
  { value: 'none', label: 'بدون' },
  { value: 'rounded', label: 'مدوّر' },
  { value: 'circle', label: 'دائرة' },
  { value: 'squircle', label: 'ناعم' },
  { value: 'arch', label: 'قوس' },
  { value: 'blob', label: 'عضوي' },
  { value: 'hex', label: 'سداسي' },
  { value: 'diamond', label: 'معيّن' },
]

const FRAME_LIST: { value: ImageFrame; label: string }[] = [
  { value: 'none', label: 'بدون' },
  { value: 'phone', label: 'هاتف' },
  { value: 'tablet', label: 'تابلت' },
  { value: 'laptop', label: 'لابتوب' },
  { value: 'browser', label: 'متصفح' },
  { value: 'polaroid', label: 'بولارويد' },
  { value: 'card', label: 'بطاقة' },
]

function ImageSection({ item }: { item: DecorItem }) {
  const im = item.image
  if (!im) return null
  const set = (fn: (i: NonNullable<DecorItem['image']>) => void, key = '') => updateDecor(item.id, (x) => fn(x.image!), key)
  const cut = !!im.maskAssetId
  return (
    <>
      <Group title={cut ? 'منتج إضافي (مفرّغ)' : 'الصورة'}>
        <div className="row-btns">
          <Btn
            small
            icon={<Upload size={14} />}
            onClick={async () => {
              const [f] = await pickFile('image/*')
              if (!f) return
              const n = await normalizeImage(f, 2000)
              const a = await putAsset(n.blob, f.name, { w: n.w, h: n.h })
              set((i) => {
                i.assetId = a.id
                i.maskAssetId = null
              })
            }}
          >
            استبدال
          </Btn>
          {!cut ? (
            <Btn small variant="primary" icon={<Scissors size={14} />} onClick={() => cutoutImageObject(item.id)}>
              تفريغ الخلفية
            </Btn>
          ) : (
            <Btn small onClick={() => set((i) => void ((i.maskAssetId = null), (i.mask = 'rounded'), (i.fit = 'cover')))}>
              إلغاء التفريغ
            </Btn>
          )}
        </div>
        {!cut && (
          <>
            <Field label="القناع">
              <Select<ImageMask> value={im.mask} options={MASKS} onChange={(v) => set((i) => void (i.mask = v))} />
            </Field>
            <Field label="إطار جهاز">
              <Select<ImageFrame> value={im.frame} options={FRAME_LIST} onChange={(v) => set((i) => void ((i.frame = v), v !== 'none' && (i.mask = 'none')))} />
            </Field>
            {im.frame === 'none' && (im.mask === 'rounded' || im.mask === 'arch') && <Slider label="استدارة الزوايا" value={im.radius} min={0} max={200} onChange={(v) => set((i) => void (i.radius = v), 'ir')} />}
            {im.frame === 'none' && im.mask !== 'hex' && im.mask !== 'diamond' && (
              <>
                <Slider label="سماكة الإطار" value={im.borderW} min={0} max={30} onChange={(v) => set((i) => void (i.borderW = v), 'ibw')} />
                {im.borderW > 0 && <ColorInput label="لون الإطار" value={im.borderColor} onChange={(v) => set((i) => void (i.borderColor = v), 'ibc')} />}
              </>
            )}
            <Field label="الملاءمة">
              <Chips<'cover' | 'contain'>
                value={im.fit}
                options={[
                  { value: 'cover', label: 'ملء' },
                  { value: 'contain', label: 'احتواء' },
                ]}
                onChange={(v) => set((i) => void (i.fit = v))}
              />
            </Field>
          </>
        )}
        <Slider label="تكبير داخل الإطار" value={im.zoom} min={0.5} max={3} step={0.01} onChange={(v) => set((i) => void (i.zoom = v), 'iz')} />
        <Slider label="إزاحة أفقية" value={im.panX} min={-50} max={50} onChange={(v) => set((i) => void (i.panX = v), 'ipx')} />
        <Slider label="إزاحة عمودية" value={im.panY} min={-50} max={50} onChange={(v) => set((i) => void (i.panY = v), 'ipy')} />
      </Group>
      <Group title="ضبط الصورة">
        <Slider label="الإضاءة" value={im.brightness} min={0.5} max={1.6} step={0.01} onChange={(v) => set((i) => void (i.brightness = v), 'ib')} />
        <Slider label="التباين" value={im.contrast} min={0.5} max={1.6} step={0.01} onChange={(v) => set((i) => void (i.contrast = v), 'ic')} />
        <Slider label="التشبع" value={im.saturate} min={0} max={2} step={0.01} onChange={(v) => set((i) => void (i.saturate = v), 'is')} />
      </Group>
    </>
  )
}

export function ObjectSpecific({ item }: { item: DecorItem }) {
  if (item.kind === 'sticker') return <StickerSection item={item} />
  if (item.kind === 'qr') return <QrSection item={item} />
  if (item.kind === 'image') return <ImageSection item={item} />
  return null
}

/* ------------------------------ مشتركة ------------------------------ */

export function TransformSection({ item }: { item: DecorItem }) {
  const cv = useEditor((s) => canvasOf(s.design))
  const [lock, setLock] = useState(true)
  const obj = isObjectKind(item.kind)
  const ratio = item.w / Math.max(1, item.h)
  const set = (fn: (d: DecorItem) => void, key = '') => updateDecor(item.id, fn, key)
  return (
    <Group title="الموضع والحجم">
      <Slider label="س" value={Math.round(item.x)} min={-Math.round(item.w)} max={cv.w} onChange={(v) => set((x) => void (x.x = v), 'x')} />
      <Slider label="ص" value={Math.round(item.y)} min={-Math.round(item.h)} max={cv.h} onChange={(v) => set((x) => void (x.y = v), 'y')} />
      <Slider
        label="العرض"
        value={Math.round(item.w)}
        min={10}
        max={Math.max(2000, cv.w * 1.6)}
        onChange={(v) =>
          set((x) => {
            const cx = x.x + x.w / 2
            const cy = x.y + x.h / 2
            x.w = v
            if (lock && obj) x.h = Math.round(v / ratio)
            x.x = Math.round(cx - x.w / 2)
            x.y = Math.round(cy - x.h / 2)
          }, 'w')
        }
      />
      <Slider
        label="الارتفاع"
        value={Math.round(item.h)}
        min={2}
        max={Math.max(2000, cv.h * 1.6)}
        onChange={(v) =>
          set((x) => {
            const cx = x.x + x.w / 2
            const cy = x.y + x.h / 2
            x.h = v
            if (lock && obj) x.w = Math.round(v * ratio)
            x.x = Math.round(cx - x.w / 2)
            x.y = Math.round(cy - x.h / 2)
          }, 'h')
        }
      />
      {obj && <Switch label="قفل نسبة العرض/الارتفاع" checked={lock} onChange={setLock} />}
      <Slider label="الدوران" value={item.rotate} min={-180} max={180} unit="°" onChange={(v) => set((x) => void (x.rotate = v), 'r')} />
      <Slider label="الشفافية" value={item.opacity} min={0} max={1} step={0.01} onChange={(v) => set((x) => void (x.opacity = v), 'o')} />
      <div className="row-btns">
        <Btn small icon={<AlignCenterHorizontal size={14} />} onClick={() => centerDecor(item.id, 'x')}>
          توسيط أفقي
        </Btn>
        <Btn small icon={<AlignCenterVertical size={14} />} onClick={() => centerDecor(item.id, 'y')}>
          توسيط عمودي
        </Btn>
        {canFlip(item) && (
          <Btn small icon={<FlipHorizontal2 size={14} />} onClick={() => set((x) => void (x.flip = !x.flip))}>
            قلب
          </Btn>
        )}
      </div>
    </Group>
  )
}

const SHADOWS: { value: ObjShadow; label: string }[] = [
  { value: 'none', label: 'بدون' },
  { value: 'soft', label: 'ناعم' },
  { value: 'float', label: 'طفو' },
  { value: 'hard', label: 'حاد' },
  { value: 'glow', label: 'توهج' },
]

export const BLENDS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'عادي' },
  { value: 'multiply', label: 'ضرب (Multiply)' },
  { value: 'screen', label: 'شاشة (Screen)' },
  { value: 'overlay', label: 'تراكب (Overlay)' },
  { value: 'soft-light', label: 'ضوء ناعم' },
  { value: 'hard-light', label: 'ضوء قاسٍ' },
  { value: 'color-dodge', label: 'تفتيح اللون' },
  { value: 'color-burn', label: 'تعتيم اللون' },
  { value: 'darken', label: 'الأغمق' },
  { value: 'lighten', label: 'الأفتح' },
  { value: 'difference', label: 'فرق' },
  { value: 'luminosity', label: 'سطوع' },
]

export function EffectsSection({ item }: { item: DecorItem }) {
  const set = (fn: (d: DecorItem) => void) => updateDecor(item.id, fn)
  return (
    <Group title="التأثيرات">
      <Field label="الظل">
        <Select<ObjShadow> value={item.shadow ?? 'none'} options={SHADOWS} onChange={(v) => set((x) => void (x.shadow = v))} />
      </Field>
      <Field label="الدمج مع الخلفية">
        <Select<BlendMode> value={item.blend ?? 'normal'} options={BLENDS} onChange={(v) => set((x) => void (x.blend = v))} />
      </Field>
    </Group>
  )
}

export function LayerSection({ item }: { item: DecorItem }) {
  const cat = useEditor((s) => categoryOf(s.design))
  return (
    <Group title="الطبقة والترتيب">
      {cat.answers && (
        <Field label="الظهور">
          <Select<ShowWhen> value={item.showWhen ?? 'always'} options={SHOW_WHEN_LABELS.map((o) => ({ value: o.value, label: o.value === 'a' ? `عندما الإجابة «${cat.answers!.a}»` : o.value === 'b' ? `عندما الإجابة «${cat.answers!.b}»` : o.label }))} onChange={(v) => updateDecor(item.id, (x) => void (x.showWhen = v))} />
        </Field>
      )}
      <ShowIfControl rule={item.showIf} cat={cat} onChange={(r) => updateDecor(item.id, (x) => void (x.showIf = r))} />
      <Chips<DecorItem['layer']>
        value={item.layer}
        options={[
          { value: 'back', label: 'خلف المنتج' },
          { value: 'front', label: 'أمام المنتج' },
          { value: 'top', label: 'فوق النصوص' },
        ]}
        onChange={(v) => setDecorLayer(item.id, v)}
      />
      <div className="row-btns">
        <Btn small icon={<ArrowUpToLine size={14} />} onClick={() => orderDecor(item.id, 'front')}>
          للأمام تماماً
        </Btn>
        <Btn small icon={<ArrowUp size={14} />} onClick={() => orderDecor(item.id, 'up')}>
          خطوة للأمام
        </Btn>
      </div>
      <div className="row-btns">
        <Btn small icon={<ArrowDown size={14} />} onClick={() => orderDecor(item.id, 'down')}>
          خطوة للخلف
        </Btn>
        <Btn small icon={<ArrowDownToLine size={14} />} onClick={() => orderDecor(item.id, 'back')}>
          للخلف تماماً
        </Btn>
      </div>
    </Group>
  )
}

void changeContent

import { Eye, EyeOff, Layers, Plus, Trash2, ArrowUp, ArrowDown, Sparkles } from 'lucide-react'
import { Button, ColorField, Section, Segmented, Select, Slider, TextArea } from '../../ui/controls'
import { select, useEditor } from '../../store/editor'
import { decor } from '../../model/templates'
import type { DecorItem, DecorKind, TextKey } from '../../model/types'
import { setContent, setStyle, TEXT_LABELS } from './common'
import { RED } from '../../model/brand'

export const DECOR_KINDS: { value: DecorKind; label: string }[] = [
  { value: 'rings', label: 'حلقات (من شعار LKGT)' },
  { value: 'arc', label: 'أقواس G' },
  { value: 'glow', label: 'توهج' },
  { value: 'beam', label: 'شعاع ضوء' },
  { value: 'stripes', label: 'خطوط أفقية' },
  { value: 'grid', label: 'شبكة تقنية' },
  { value: 'dots', label: 'نقاط' },
  { value: 'corners', label: 'زوايا إطار' },
  { value: 'frame', label: 'إطار داخلي' },
  { value: 'line', label: 'خط' },
  { value: 'diagonal', label: 'مثلث زاوية' },
  { value: 'watermark', label: 'اسم المنتج كخلفية' },
  { value: 'badge', label: 'شارة دائرية' },
  { value: 'noise', label: 'حبيبات فيلم' },
]

const PRESET: Partial<Record<DecorKind, Parameters<typeof decor>[0]>> = {
  rings: { kind: 'rings', x: 600, y: -220, w: 760, h: 760, color: RED, opacity: 0.18, size: 5 },
  arc: { kind: 'arc', x: 640, y: 380, w: 520, h: 520, color: RED, opacity: 0.8, size: 8 },
  glow: { kind: 'glow', x: 190, y: 560, w: 700, h: 700, color: RED, opacity: 0.35 },
  beam: { kind: 'beam', x: 190, y: -40, w: 700, h: 1250, color: '#ffffff', opacity: 0.16 },
  stripes: { kind: 'stripes', x: 0, y: 1220, w: 1080, h: 220, color: RED, opacity: 0.9, size: 24 },
  grid: { kind: 'grid', color: '#888888', opacity: 0.12, size: 60 },
  dots: { kind: 'dots', x: 60, y: 520, w: 240, h: 240, color: RED, opacity: 0.5, size: 5 },
  corners: { kind: 'corners', x: 40, y: 40, w: 1000, h: 1250, color: RED, size: 4, layer: 'front' },
  frame: { kind: 'frame', x: 36, y: 36, w: 1008, h: 1368, color: '#ffffff', opacity: 0.4, size: 2, layer: 'front' },
  line: { kind: 'line', x: 440, y: 230, w: 200, h: 5, color: RED },
  diagonal: { kind: 'diagonal', x: 0, y: 0, w: 380, h: 380, color: RED, opacity: 0.9 },
  watermark: { kind: 'watermark', x: 40, y: 470, w: 1000, h: 300, color: RED, opacity: 0.16, size: 3, text: '{title}' },
  badge: { kind: 'badge', x: 780, y: 540, w: 190, h: 190, rotate: -12, color: RED, color2: '#ffffff', layer: 'front', text: '{badge}' },
  noise: { kind: 'noise', opacity: 0.08, layer: 'front' },
}

export function addDecor(kind: DecorKind) {
  const d = decor(PRESET[kind] ?? { kind })
  d.id = `d_${Date.now().toString(36)}`
  setStyle((s) => void s.decor.push(d))
  select({ kind: 'decor', id: d.id })
}

export function DecorPanel({ id }: { id: string }) {
  const item = useEditor((s) => s.design.style.decor.find((d) => d.id === id))
  const badge = useEditor((s) => s.design.content.texts.badge)
  if (!item) return null
  const set = (fn: (x: DecorItem) => void, key = '') =>
    setStyle((s) => {
      const d = s.decor.find((x) => x.id === id)
      if (d) fn(d)
    }, `dec-${id}-${key}`)
  return (
    <Section title={DECOR_KINDS.find((k) => k.value === item.kind)?.label ?? 'زخرفة'} icon={<Sparkles size={16} />}>
      <Segmented
        small
        value={item.layer}
        options={[
          { value: 'back', label: 'خلف المنتج' },
          { value: 'front', label: 'أمام المنتج' },
        ]}
        onChange={(v) => set((x) => void (x.layer = v))}
      />
      {item.kind === 'badge' && <TextArea value={badge} onChange={(v) => setContent((c) => void (c.texts.badge = v), 'text-badge')} />}
      {item.kind === 'watermark' && (
        <>
          <TextArea value={item.text} dir="ltr" onChange={(v) => set((x) => void (x.text = v), 'txt')} />
          <p className="muted small">{'{title}'} = اسم المنتج تلقائياً</p>
        </>
      )}
      <ColorField label="اللون" value={item.color} alpha={false} onChange={(v) => set((x) => void (x.color = v), 'c')} />
      {item.kind === 'badge' && <ColorField label="لون النص" value={item.color2} alpha={false} onChange={(v) => set((x) => void (x.color2 = v), 'c2')} />}
      <Slider label="الشفافية" value={item.opacity} min={0} max={1} step={0.01} onChange={(v) => set((x) => void (x.opacity = v), 'o')} />
      <Slider label="س" value={item.x} min={-600} max={1080} onChange={(v) => set((x) => void (x.x = v), 'x')} />
      <Slider label="ص" value={item.y} min={-600} max={1440} onChange={(v) => set((x) => void (x.y = v), 'y')} />
      <Slider label="العرض" value={item.w} min={10} max={2000} onChange={(v) => set((x) => void (x.w = v), 'w')} />
      <Slider label="الارتفاع" value={item.h} min={2} max={2000} onChange={(v) => set((x) => void (x.h = v), 'h')} />
      <Slider label="الدوران" value={item.rotate} min={-180} max={180} onChange={(v) => set((x) => void (x.rotate = v), 'r')} format={(v) => `${v}°`} />
      {!['glow', 'diagonal', 'noise', 'badge', 'line', 'beam'].includes(item.kind) && (
        <Slider label="السماكة / الحجم" value={item.size} min={1} max={120} onChange={(v) => set((x) => void (x.size = v), 's')} />
      )}
      <Button
        small
        variant="danger"
        icon={<Trash2 size={14} />}
        onClick={() => {
          setStyle((s) => void (s.decor = s.decor.filter((x) => x.id !== id)))
          select(null)
        }}
      >
        حذف الزخرفة
      </Button>
    </Section>
  )
}

/** قائمة الأقسام: إظهار/إخفاء + ترتيب + تحديد */
export function SectionsPanel() {
  const style = useEditor((s) => s.design.style)
  const product = useEditor((s) => s.design.content.product)
  const order = style.text.order
  const move = (k: TextKey, dir: -1 | 1) =>
    setStyle((s) => {
      const o = s.text.order
      const i = o.indexOf(k)
      const j = i + dir
      if (j < 0 || j >= o.length) return
      ;[o[i], o[j]] = [o[j], o[i]]
    })
  return (
    <Section title="الأقسام والطبقات" icon={<Layers size={16} />}>
      <ul className="layers">
        {order.map((k, i) => {
          const vis = style.text.items[k].visible
          return (
            <li key={k} className={vis ? '' : 'off'}>
              <button className="icon-btn" onClick={() => setStyle((s) => void (s.text.items[k].visible = !vis))} title={vis ? 'إخفاء' : 'إظهار'}>
                {vis ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button className="layer-name" onClick={() => select({ kind: 'text', key: k })}>
                {TEXT_LABELS[k]}
              </button>
              <button className="icon-btn" disabled={i === 0} onClick={() => move(k, -1)}>
                <ArrowUp size={13} />
              </button>
              <button className="icon-btn" disabled={i === order.length - 1} onClick={() => move(k, 1)}>
                <ArrowDown size={13} />
              </button>
            </li>
          )
        })}
        <li className="sep" />
        {product && (
          <li className={product.visible ? '' : 'off'}>
            <button className="icon-btn" onClick={() => setContent((c) => void (c.product!.visible = !product.visible))}>
              {product.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button className="layer-name" onClick={() => select({ kind: 'product' })}>
              المنتج المفرّغ
            </button>
          </li>
        )}
        <li className={style.shape.kind === 'none' ? 'off' : ''}>
          <span className="icon-btn" />
          <button className="layer-name" onClick={() => select({ kind: 'shape' })}>
            الشكل تحت المنتج
          </button>
        </li>
        {style.decor.map((d) => (
          <li key={d.id} className={d.visible ? '' : 'off'}>
            <button className="icon-btn" onClick={() => setStyle((s) => void (s.decor.find((x) => x.id === d.id)!.visible = !d.visible))}>
              {d.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button className="layer-name" onClick={() => select({ kind: 'decor', id: d.id })}>
              {DECOR_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind}
            </button>
          </li>
        ))}
      </ul>
      <div className="add-decor">
        <Plus size={14} />
        <Select<DecorKind | ''>
          value=""
          options={[{ value: '', label: 'إضافة زخرفة…' }, ...DECOR_KINDS]}
          onChange={(v) => v && addDecor(v)}
        />
      </div>
    </Section>
  )
}

import { useMemo, useState, type ReactNode } from 'react'
import { AppWindow, Boxes, Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, Package, QrCode, Shapes, Sparkle, Sticker, Trash2, Type, Unlock } from 'lucide-react'
import { changeContent, changeStyle, select, selectMany, useEditor } from '../store/editor'
import type { DecorItem, FixedLayer, Selection } from '../model/types'
import { categoryOf } from '../model/categories'
import { moveDecorTo, removeDecor, toggleFixed, updateDecor } from '../store/objects'
import { findSticker } from '../poster/stickers'
import { sameSel } from './moves'

/* ------------------------------------------------------------------
 * لوحة الطبقات (مثل فوتوشوب): إخفاء، قفل، ترتيب بالسحب، تحديد
 * الترتيب من الأعلى للأسفل كما يظهر على التصميم
 * ------------------------------------------------------------------ */

type Group = 'chrome' | 'top' | 'text' | 'front' | 'product' | 'shape' | 'back' | 'scene'

const GROUP_LABEL: Record<Group, string> = {
  chrome: 'الهوية (ثابتة)',
  top: 'فوق النصوص',
  text: 'النصوص',
  front: 'أمام المنتج',
  product: 'المنتج',
  shape: 'الشكل تحت المنتج',
  back: 'خلف المنتج',
  scene: 'صورة الخلفية',
}

interface Row {
  key: string
  sel: Selection
  label: string
  icon: ReactNode
  group: Group
  visible: boolean
  locked: boolean
  toggleVisible?: () => void
  toggleLock?: () => void
  remove?: () => void
  decorId?: string
  dim?: boolean
}

function decorIcon(d: DecorItem): ReactNode {
  if (d.kind === 'image') return d.image?.maskAssetId ? <Package size={14} /> : <ImageIcon size={14} />
  if (d.kind === 'qr') return <QrCode size={14} />
  if (d.kind === 'sticker') return findSticker(d.sticker?.id ?? '')?.cat === 'shape' ? <Shapes size={14} /> : <Sticker size={14} />
  return <Sparkle size={14} />
}

const DECOR_NAMES: Record<string, string> = {
  stripes: 'خطوط أفقية',
  rings: 'حلقات',
  grid: 'شبكة',
  dots: 'نقاط',
  corners: 'زوايا إطار',
  line: 'خط',
  glow: 'توهج',
  diagonal: 'مثلث زاوية',
  watermark: 'اسم كخلفية',
  beam: 'شعاع ضوء',
  frame: 'إطار داخلي',
  badge: 'شارة دائرية',
  arc: 'أقواس',
  noise: 'حبيبات',
  wave: 'موجة',
  blobs: 'بقع ألوان',
  plus: 'علامات +',
  ribbon: 'شريط نصي',
  sticker: 'ملصق',
  qr: 'QR',
  image: 'صورة',
}

export function LayersPanel() {
  const design = useEditor((s) => s.design)
  const selection = useEditor((s) => s.selection)
  const multi = useEditor((s) => s.multi)
  const cat = categoryOf(design)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const { style, content } = design
  const hide = style.hide ?? {}
  const lock = style.lock ?? {}

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const fixed = (kind: FixedLayer, sel: Selection, label: string, icon: ReactNode, group: Group, canHide: boolean): Row => ({
      key: kind,
      sel,
      label,
      icon,
      group,
      visible: !hide[kind],
      locked: !!lock[kind],
      toggleVisible: canHide ? () => toggleFixed(kind, 'hide') : undefined,
      toggleLock: () => toggleFixed(kind, 'lock'),
    })
    out.push(fixed('contact', { kind: 'contact' }, 'شريط التواصل', <AppWindow size={14} />, 'chrome', true))
    out.push(fixed('logo', { kind: 'logo' }, 'لوغو LKGT', <Boxes size={14} />, 'chrome', true))
    out.push(fixed('partner', { kind: 'partner' }, 'لوغو الشريك', <Boxes size={14} />, 'chrome', true))
    const decorRow = (d: DecorItem, g: Group): Row => ({
      key: d.id,
      sel: { kind: 'decor', id: d.id },
      label: d.name || DECOR_NAMES[d.kind] || d.kind,
      icon: decorIcon(d),
      group: g,
      visible: d.visible,
      locked: !!d.locked,
      toggleVisible: () => updateDecor(d.id, (x) => void (x.visible = !x.visible)),
      toggleLock: () => updateDecor(d.id, (x) => void (x.locked = !x.locked)),
      remove: () => removeDecor(d.id),
      decorId: d.id,
    })
    const inLayer = (l: DecorItem['layer']) => style.decor.filter((d) => d.layer === l).reverse()
    for (const d of inLayer('top')) out.push(decorRow(d, 'top'))
    // النصوص: النصوص الإضافية، ثم الكتلة، ثم العناصر الحرّة
    for (const e of [...(content.extras ?? [])].reverse()) {
      out.push({
        key: e.id,
        sel: { kind: 'extra', id: e.id },
        label: (e.text || 'نص').split('\n')[0].slice(0, 22),
        icon: <Type size={14} />,
        group: 'text',
        visible: e.style.visible !== false,
        locked: !!e.style.locked,
        toggleVisible: () => changeContent((c) => void (c.extras!.find((x) => x.id === e.id)!.style.visible = e.style.visible === false)),
        toggleLock: () => changeContent((c) => void (c.extras!.find((x) => x.id === e.id)!.style.locked = !e.style.locked)),
        remove: () => changeContent((c) => void (c.extras = c.extras!.filter((x) => x.id !== e.id))),
      })
    }
    for (const k of style.text.order) {
      const st = style.text.items[k]
      if (!st.free) continue
      out.push({
        key: `t-${k}`,
        sel: { kind: 'text', key: k },
        label: cat.labels[k],
        icon: <Type size={14} />,
        group: 'text',
        visible: st.visible,
        locked: !!st.locked,
        toggleVisible: () => changeStyle((s) => void (s.text.items[k].visible = !st.visible)),
        toggleLock: () => changeStyle((s) => void (s.text.items[k].locked = !st.locked)),
      })
    }
    out.push({ ...fixed('textBlock', { kind: 'textBlock' }, 'كتلة النصوص', <Type size={14} />, 'text', false) })
    for (const d of inLayer('front')) out.push(decorRow(d, 'front'))
    if (content.product) {
      const p = content.product
      out.push({
        key: 'product',
        sel: { kind: 'product' },
        label: 'المنتج المفرّغ',
        icon: <Package size={14} />,
        group: 'product',
        visible: p.visible,
        locked: !!lock.product,
        toggleVisible: () => changeContent((c) => void (c.product!.visible = !p.visible)),
        toggleLock: () => toggleFixed('product', 'lock'),
      })
    }
    out.push(fixed('shape', { kind: 'shape' }, 'الشكل تحت المنتج' + (style.shape.kind === 'none' ? ' (بدون)' : ''), <Shapes size={14} />, 'shape', true))
    for (const d of inLayer('back')) out.push(decorRow(d, 'back'))
    if (content.scene) out.push(fixed('scene', { kind: 'scene' }, 'صورة الخلفية المتدرجة', <ImageIcon size={14} />, 'scene', true))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, content, cat])

  const isActive = (sel: Selection) => (multi.length > 1 ? multi.some((m) => sameSel(m, sel)) : !!selection && sameSel(selection, sel))
  let lastGroup: Group | null = null

  const onDrop = (target: { id?: string; group?: Group }) => {
    if (!drag) return
    const src = style.decor.find((d) => d.id === drag)
    if (!src) return
    if (target.id && target.id !== drag) {
      const t = style.decor.find((d) => d.id === target.id)
      if (t) {
        // الإفلات فوق صف = وضع العنصر فوقه بصرياً (بعده في المصفوفة)
        const idx = style.decor.indexOf(t)
        let next = style.decor[idx + 1]
        if (next && next.id === drag) next = style.decor[idx + 2]
        moveDecorTo(drag, t.layer, next?.id ?? null)
      }
    } else if (target.group && ['top', 'front', 'back'].includes(target.group)) {
      moveDecorTo(drag, target.group as DecorItem['layer'], null)
    }
    setDrag(null)
    setOver(null)
  }

  return (
    <div className="layers">
      {rows.map((r) => {
        const head = r.group !== lastGroup
        lastGroup = r.group
        return (
          <div key={r.key}>
            {head && (
              <div
                className={`ly-head ${over === `g:${r.group}` ? 'over' : ''}`}
                onDragOver={(e) => {
                  if (drag && ['top', 'front', 'back'].includes(r.group)) {
                    e.preventDefault()
                    setOver(`g:${r.group}`)
                  }
                }}
                onDrop={() => onDrop({ group: r.group })}
              >
                {GROUP_LABEL[r.group]}
              </div>
            )}
            <div
              className={`ly-row ${isActive(r.sel) ? 'active' : ''} ${!r.visible ? 'off' : ''} ${over === r.key && drag !== r.key ? 'over' : ''}`}
              draggable={!!r.decorId}
              onDragStart={() => r.decorId && setDrag(r.decorId)}
              onDragEnd={() => {
                setDrag(null)
                setOver(null)
              }}
              onDragOver={(e) => {
                if (drag && r.decorId) {
                  e.preventDefault()
                  setOver(r.key)
                }
              }}
              onDrop={() => r.decorId && onDrop({ id: r.decorId })}
              onClick={(e) => {
                if (e.shiftKey || e.ctrlKey || e.metaKey) select(r.sel, true, true)
                else if (multi.length > 1 && multi.some((m) => sameSel(m, r.sel))) selectMany(multi)
                else select(r.sel)
              }}
            >
              <span className="ly-grip">{r.decorId ? <GripVertical size={13} /> : null}</span>
              {r.toggleVisible ? (
                <button className="ly-b" title={r.visible ? 'إخفاء' : 'إظهار'} onClick={(e) => (e.stopPropagation(), r.toggleVisible!())}>
                  {r.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              ) : (
                <span className="ly-b ph" />
              )}
              <span className="ly-ic">{r.icon}</span>
              <span className="ly-name" title={r.label}>
                {r.label}
              </span>
              {r.toggleLock && (
                <button className={`ly-b ${r.locked ? 'lk' : 'dim'}`} title={r.locked ? 'فتح القفل' : 'قفل (لا يتحرك بالنقر على التصميم)'} onClick={(e) => (e.stopPropagation(), r.toggleLock!())}>
                  {r.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              )}
              {r.remove && (
                <button className="ly-b dim" title="حذف" onClick={(e) => (e.stopPropagation(), r.remove!())}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


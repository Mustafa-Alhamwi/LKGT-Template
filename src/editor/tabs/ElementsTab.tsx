import { Eye, EyeOff, ImagePlus, Layers, Plus, Scissors, Settings2, Trash2 } from 'lucide-react'
import { Btn, Group, IconBtn, TextArea } from '../../ui/kit'
import { addExtraText, changeContent, changeStyle, getTextStyle, removeExtraText, select, useEditor } from '../../store/editor'
import { TEXT_HINTS, TEXT_LABELS, useTextValue } from '../controls/text'
import { PartnerPicker, DECOR_KINDS, addDecor } from '../controls/design'
import { openCutoutStudio } from '../controls/product'
import { importImage, pickFile } from '../../lib/importer'
import { useAsset } from '../../lib/assets'
import { useCutout } from '../../lib/cutout'
import type { Selection, TextKey } from '../../model/types'
import { isSel } from '../../poster/EditContext'

function TextRow({ sel, label, hint }: { sel: Extract<Selection, { kind: 'text' | 'extra' }>; label: string; hint?: string }) {
  const st = useEditor((s) => getTextStyle(s.design, sel))
  const selection = useEditor((s) => s.selection)
  const [value, setValue] = useTextValue(sel)
  if (!st) return null
  const active = isSel(selection, sel)
  const isExtra = sel.kind === 'extra'
  return (
    <div className={`trow ${active ? 'active' : ''} ${!st.visible ? 'off' : ''}`}>
      <div className="trow-head">
        {!isExtra ? (
          <IconBtn
            icon={st.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            title={st.visible ? 'إخفاء القسم' : 'إظهار القسم'}
            onClick={() => changeStyle((s) => void (s.text.items[sel.key].visible = !st.visible))}
          />
        ) : (
          <IconBtn danger icon={<Trash2 size={14} />} title="حذف النص" onClick={() => removeExtraText(sel.id)} />
        )}
        <button className="trow-label" onClick={() => select(sel)}>
          {label}
          {st.free && !isExtra && (
            <em title="مفصول عن الكتلة">
              <Scissors size={11} />
            </em>
          )}
        </button>
        {hint && <span className="trow-hint">{hint}</span>}
        <IconBtn icon={<Settings2 size={15} />} title="خصائص هذا النص" onClick={() => select(sel)} />
      </div>
      {st.visible && <TextArea value={value} onChange={setValue} rows={1} dir={sel.kind === 'text' && (sel.key === 'title' || sel.key === 'subtitle') ? 'ltr' : 'auto'} />}
    </div>
  )
}

function ImageCard() {
  const scene = useEditor((s) => s.design.content.scene)
  const product = useEditor((s) => s.design.content.product)
  const sceneInfo = useAsset(scene?.assetId)
  const { cutout } = useCutout(product)
  const thumb = sceneInfo?.url ?? cutout?.url
  const pick = async (as?: 'product') => {
    const f = await pickFile(as ? 'image/png,image/webp' : 'image/*')
    if (f[0]) importImage(f[0], as ?? 'auto')
  }
  if (!thumb && !product) {
    return (
      <div className="drop-tile" onClick={() => pick()}>
        <ImagePlus size={26} />
        <strong>ارفع صورة المنتج</strong>
        <span>أو اسحبها إلى التصميم — تدريج للخلفية وتفريغ تلقائي للمنتج</span>
        <button
          className="link"
          onClick={(e) => {
            e.stopPropagation()
            pick('product')
          }}
        >
          لدي PNG مفرّغ جاهز
        </button>
      </div>
    )
  }
  return (
    <div className="img-card">
      <div className="img-card-top" onClick={() => select(scene ? { kind: 'scene' } : { kind: 'product' })}>
        {thumb && <img src={thumb} alt="" />}
        <div>
          <strong>{scene ? 'صورة + منتج مفرّغ' : 'منتج مفرّغ'}</strong>
          <span>{product?.maskAssetId ? 'تفريغ تلقائي ✓' : product ? 'PNG مفرّغ' : 'بدون تفريغ'}</span>
        </div>
      </div>
      <div className="row-btns">
        <Btn small variant="primary" icon={<Scissors size={14} />} onClick={openCutoutStudio}>
          استوديو التفريغ
        </Btn>
        <Btn small icon={<ImagePlus size={14} />} onClick={() => pick()}>
          تغيير
        </Btn>
      </div>
    </div>
  )
}

export function ElementsTab() {
  const order = useEditor((s) => s.design.style.text.order)
  const extras = useEditor((s) => s.design.content.extras ?? [])
  const decor = useEditor((s) => s.design.style.decor)
  const product = useEditor((s) => s.design.content.product)
  const shapeKind = useEditor((s) => s.design.style.shape.kind)
  const selection = useEditor((s) => s.selection)
  const layerRow = (key: string, label: string, sel: Selection, visible: boolean, toggle?: () => void, remove?: () => void) => (
    <li key={key} className={`${visible ? '' : 'off'} ${isSel(selection, sel) ? 'active' : ''}`}>
      {toggle ? <IconBtn icon={visible ? <Eye size={15} /> : <EyeOff size={15} />} title={visible ? 'إخفاء' : 'إظهار'} onClick={toggle} /> : <span className="ibtn ph" />}
      <button className="row-name" onClick={() => select(sel)}>
        {label}
      </button>
      {remove && <IconBtn danger icon={<Trash2 size={14} />} title="حذف" onClick={remove} />}
    </li>
  )
  return (
    <>
      <Group title="الصورة">
        <ImageCard />
      </Group>
      <Group title="النصوص" right={<Btn small icon={<Plus size={14} />} onClick={addExtraText}>نص جديد</Btn>}>
        {order.map((k: TextKey) => (
          <TextRow key={k} sel={{ kind: 'text', key: k }} label={TEXT_LABELS[k]} hint={TEXT_HINTS[k]} />
        ))}
        {extras.map((e, i) => (
          <TextRow key={e.id} sel={{ kind: 'extra', id: e.id }} label={`نص إضافي ${i + 1}`} />
        ))}
      </Group>
      <Group title="لوغو الشريك">
        <PartnerPicker />
      </Group>
      <Group title="الطبقات" right={<Layers size={15} className="muted" />}>
        <ul className="rows">
          {layerRow('tb', 'كتلة النصوص', { kind: 'textBlock' }, true)}
          {product && layerRow('prod', 'المنتج المفرّغ', { kind: 'product' }, product.visible, () => changeContent((c) => void (c.product!.visible = !product.visible)))}
          {layerRow('shape', 'الشكل تحت المنتج' + (shapeKind === 'none' ? ' (بدون)' : ''), { kind: 'shape' }, shapeKind !== 'none')}
          {decor.map((d) =>
            layerRow(
              d.id,
              DECOR_KINDS.find((k) => k.value === d.kind)?.label ?? d.kind,
              { kind: 'decor', id: d.id },
              d.visible,
              () => changeStyle((s) => void (s.decor.find((x) => x.id === d.id)!.visible = !d.visible)),
              () => changeStyle((s) => void (s.decor = s.decor.filter((x) => x.id !== d.id))),
            ),
          )}
          {layerRow('contact', 'شريط التواصل', { kind: 'contact' }, true)}
        </ul>
        <Btn small icon={<Plus size={14} />} onClick={() => addDecor('blobs')}>
          إضافة زخرفة
        </Btn>
      </Group>
    </>
  )
}

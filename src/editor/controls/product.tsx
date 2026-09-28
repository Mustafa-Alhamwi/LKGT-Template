import { FlipHorizontal2, Link2, Scan, Trash2, Wand2, Upload, Layers, Eye, EyeOff, Scissors } from 'lucide-react'
import { Btn, Group, IconBtn, Slider } from '../../ui/kit'
import { change, changeContent, useEditor } from '../../store/editor'
import { useAsset } from '../../lib/assets'
import { useCutout } from '../../lib/cutout'
import { autoPlacement, coverPlacement, fitWidthPlacement, productBoxOf, setProductBox } from '../../poster/geometry'
import { importImage, pickFile } from '../../lib/importer'
import { PhotoControls, ShapeControls } from './design'

export function openCutoutStudio() {
  useEditor.setState({ dialog: 'cutout' })
}

export function ProductControls() {
  const design = useEditor((s) => s.design)
  const product = design.content.product
  const scene = design.content.scene
  const { busy } = useCutout(product)
  if (!product) return null
  const box = productBoxOf(design)
  const sameAsScene = !!scene && product.sourceAssetId === scene.assetId
  const move = (b: { cx?: number; bottom?: number; w?: number }, key: string) =>
    change((d) => {
      setProductBox(d, b)
      d.touched = true
    }, `pbox-${key}`)
  return (
    <>
      <div className="el-title">
        <strong>المنتج</strong>
        <span className="el-actions">
          <IconBtn icon={product.visible ? <Eye size={16} /> : <EyeOff size={16} />} title={product.visible ? 'إخفاء' : 'إظهار'} onClick={() => changeContent((c) => void (c.product!.visible = !c.product!.visible))} />
          <IconBtn danger icon={<Trash2 size={15} />} title="حذف المنتج" onClick={() => changeContent((c) => void (c.product = null))} />
        </span>
      </div>
      <Group>
        <Btn variant="primary" block icon={<Scissors size={16} />} onClick={openCutoutStudio}>
          فتح استوديو التفريغ
        </Btn>
        <p className="hint">
          {busy ? '⏳ جارِ المعالجة…' : product.linked && scene ? 'المنتج منسوخ فوق التدرج بنفس مكانه في الصورة تماماً — اسحبه لتحريكه بشكل مستقل.' : 'اسحب المنتج في التصميم، وعجلة الفأرة للتكبير.'}
        </p>
        <div className="row-btns">
          {sameAsScene && !product.linked && (
            <Btn small icon={<Link2 size={14} />} onClick={() => changeContent((c) => void ((c.product!.linked = true), (c.product!.place = null)))}>
              للمكان الأصلي
            </Btn>
          )}
          {(product.place || product.linked) && (!sameAsScene || product.place) && (
            <Btn small icon={<Scan size={14} />} onClick={() => changeContent((c) => void ((c.product!.linked = false), (c.product!.place = null)))}>
              ملاءمة تلقائية
            </Btn>
          )}
        </div>
      </Group>
      {box && (
        <Group title="الحجم والموضع">
          <Slider label="عرض المنتج" value={Math.round(box.w)} min={80} max={1500} unit="px" onChange={(v) => move({ w: v }, 'w')} />
          <Slider label="المركز الأفقي" value={Math.round(box.x + box.w / 2)} min={-200} max={1280} onChange={(v) => move({ cx: v }, 'cx')} />
          <Slider label="الحافة السفلية" value={Math.round(box.y + box.h)} min={200} max={1700} onChange={(v) => move({ bottom: v }, 'b')} />
        </Group>
      )}
      <Group title="الوضعية">
        <Slider label="الدوران" value={product.rotate ?? 0} min={-45} max={45} step={0.5} unit="°" onChange={(v) => changeContent((c) => void (c.product!.rotate = v), 'prot')} />
        <Slider label="الشفافية" value={product.opacity ?? 1} min={0.1} max={1} step={0.01} onChange={(v) => changeContent((c) => void (c.product!.opacity = v), 'pop')} />
        <Btn small icon={<FlipHorizontal2 size={14} />} onClick={() => changeContent((c) => void (c.product!.flip = !c.product!.flip))}>
          قلب أفقي
        </Btn>
      </Group>
      <Group title="تحسين الصورة">
        <Slider label="الإضاءة" value={product.enhance.brightness} min={0.6} max={1.5} step={0.01} onChange={(v) => changeContent((c) => void (c.product!.enhance.brightness = v), 'pe-b')} />
        <Slider label="التباين" value={product.enhance.contrast} min={0.6} max={1.6} step={0.01} onChange={(v) => changeContent((c) => void (c.product!.enhance.contrast = v), 'pe-c')} />
        <Slider label="التشبع" value={product.enhance.saturate} min={0} max={2} step={0.01} onChange={(v) => changeContent((c) => void (c.product!.enhance.saturate = v), 'pe-s')} />
      </Group>
      <ShapeControls />
    </>
  )
}

export function SceneControls() {
  const scene = useEditor((s) => s.design.content.scene)
  const product = useEditor((s) => s.design.content.product)
  const info = useAsset(scene?.assetId)
  if (!scene || !info) return null
  const place = scene.place ?? autoPlacement(info.w, info.h)
  const cover = coverPlacement(info.w, info.h)
  const zoom = place.w / cover.w
  return (
    <>
      <div className="el-title">
        <strong>صورة الخلفية</strong>
        <span className="el-actions">
          <IconBtn
            danger
            icon={<Trash2 size={15} />}
            title="إزالة الصورة"
            onClick={() =>
              changeContent((c) => {
                if (c.product?.linked) c.product = null
                c.scene = null
              })
            }
          />
        </span>
      </div>
      <Group>
        <div className="scene-card">
          <img src={info.url} alt="" />
          <div>
            <strong dir="ltr">
              {info.w}×{info.h}
            </strong>
            <span>{product?.maskAssetId ? 'المنتج مفرّغ ✓' : product ? 'منتج مستقل' : 'بدون تفريغ'}</span>
          </div>
        </div>
        <div className="row-btns">
          <Btn small icon={<Wand2 size={14} />} onClick={openCutoutStudio}>
            استوديو التفريغ
          </Btn>
          <Btn
            small
            icon={<Upload size={14} />}
            onClick={async () => {
              const f = await pickFile()
              if (f[0]) importImage(f[0])
            }}
          >
            استبدال
          </Btn>
        </div>
        <div className="row-btns">
          <Btn small icon={<Scan size={14} />} onClick={() => changeContent((c) => void (c.scene!.place = coverPlacement(info.w, info.h)))}>
            ملء
          </Btn>
          <Btn small icon={<Layers size={14} />} onClick={() => changeContent((c) => void (c.scene!.place = fitWidthPlacement(info.w, info.h)))}>
            ملاءمة العرض
          </Btn>
          <Btn small onClick={() => changeContent((c) => void (c.scene!.place = null))}>
            تلقائي
          </Btn>
        </div>
        <Slider
          label="تكبير الصورة"
          value={+zoom.toFixed(2)}
          min={0.5}
          max={3}
          step={0.01}
          onChange={(z) =>
            changeContent((c) => {
              const p = c.scene!.place ?? autoPlacement(info.w, info.h)
              const h = (p.w * info.h) / info.w
              const w = cover.w * z
              c.scene!.place = { x: p.x + p.w / 2 - w / 2, y: p.y + h / 2 - (w * info.h) / info.w / 2, w }
            }, 'scene-zoom')
          }
        />
      </Group>
      <PhotoControls />
    </>
  )
}


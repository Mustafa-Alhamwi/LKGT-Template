import { Eraser, FlipHorizontal2, Link2, Scan, Trash2, Wand2, Upload, Layers, Eye, EyeOff, Scissors, Sparkles, RotateCcw } from 'lucide-react'
import { Btn, Chips, Group, IconBtn, Slider } from '../../ui/kit'
import { change, changeContent, toast, useEditor } from '../../store/editor'
import { useAsset } from '../../lib/assets'
import { enhanceAsset, useCutout } from '../../lib/cutout'
import { autoPlacement, coverPlacement, fitWidthPlacement, productBoxOf, setProductBox } from '../../poster/geometry'
import { importImage, pickFile } from '../../lib/importer'
import { PhotoControls, ShapeControls } from './design'
import { NO_FIX, canvasOf } from '../../model/types'
import type { PhotoFix } from '../../model/types'
import { setTask } from '../../store/editor'
import { openRetouch } from '../../store/retouch'

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
          {!sameAsScene && (
            <Btn small icon={<Eraser size={14} />} title="حذف غبار أو شعار من صورة المنتج" onClick={() => openRetouch('product')}>
              محو عنصر
            </Btn>
          )}
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
      <PhotoFixGroup photo={product.photo ?? NO_FIX} set={(fn, key) => changeContent((c) => void fn((c.product!.photo ??= { ...NO_FIX })), key)} />
      <Group title="ضبط سريع للألوان">
        <Slider label="الإضاءة" value={product.enhance.brightness} min={0.6} max={1.5} step={0.01} onChange={(v) => changeContent((c) => void (c.product!.enhance.brightness = v), 'pe-b')} />
        <Slider label="التباين" value={product.enhance.contrast} min={0.6} max={1.6} step={0.01} onChange={(v) => changeContent((c) => void (c.product!.enhance.contrast = v), 'pe-c')} />
        <Slider label="التشبع" value={product.enhance.saturate} min={0} max={2} step={0.01} onChange={(v) => changeContent((c) => void (c.product!.enhance.saturate = v), 'pe-s')} />
      </Group>
      <ShapeControls />
    </>
  )
}

/** تحسين جودة صورة المنتج: تلقائي + حرارة + حدّة + ضجيج + تكبير */
function PhotoFixGroup({ photo, set }: { photo: PhotoFix; set: (fn: (p: PhotoFix) => void, key: string) => void }) {
  const active = photo.auto || photo.temp !== 0 || photo.sharpen > 0 || photo.denoise > 0 || photo.upscale === 2
  return (
    <Group title="جودة الصورة" hint="تُعالَج بكسلات المنتج نفسها (غير مدمّرة — يمكن إيقافها في أي وقت).">
      <div className="row-btns">
        <Btn small variant={photo.auto ? 'primary' : 'default'} icon={<Sparkles size={14} />} onClick={() => set((p) => void (p.auto = !p.auto), 'ph-auto')}>
          {photo.auto ? 'التحسين التلقائي مُفعّل' : 'تحسين تلقائي'}
        </Btn>
        {active && (
          <Btn small variant="ghost" icon={<RotateCcw size={14} />} onClick={() => set((p) => void Object.assign(p, NO_FIX), 'ph-reset')}>
            إعادة
          </Btn>
        )}
      </div>
      <Slider label="حرارة اللون" value={photo.temp} min={-100} max={100} onChange={(v) => set((p) => void (p.temp = v), 'ph-temp')} />
      <Slider label="حدّة التفاصيل" value={photo.sharpen} min={0} max={1.5} step={0.05} onChange={(v) => set((p) => void (p.sharpen = v), 'ph-sh')} />
      <Slider label="إزالة الضجيج" value={photo.denoise} min={0} max={1} step={0.05} onChange={(v) => set((p) => void (p.denoise = v), 'ph-dn')} />
      <div className="fld">
        <span className="fld-label">الدقة</span>
        <Chips
          value={photo.upscale}
          options={[
            { value: 1, label: 'الأصلية' },
            { value: 2, label: 'تكبير ×2', title: 'تنعيم وشحذ لرفع جودة الطباعة — لا يضيف تفاصيل غير موجودة' },
          ]}
          onChange={(v) => set((p) => void (p.upscale = v as 1 | 2), 'ph-up')}
        />
      </div>
    </Group>
  )
}

export function SceneControls() {
  const scene = useEditor((s) => s.design.content.scene)
  const product = useEditor((s) => s.design.content.product)
  const info = useAsset(scene?.assetId)
  const cv = useEditor((s) => canvasOf(s.design))
  if (!scene || !info) return null
  const place = scene.place ?? autoPlacement(info.w, info.h, cv)
  const bakeScene = async (photo: PhotoFix, ok: string) => {
    setTask({ label: 'جارِ معالجة الصورة…', progress: null })
    try {
      const id = await enhanceAsset(scene.assetId, photo)
      if (!id) return toast('تعذّرت معالجة الصورة', 'error')
      if (photo.upscale === 2 && id === scene.assetId) return toast('الصورة كبيرة أصلاً ولا تحتاج تكبيراً', 'info')
      changeContent((c) => {
        const old = c.scene!.assetId
        c.scene!.assetId = id
        if (c.product && c.product.sourceAssetId === old) c.product.sourceAssetId = id
      })
      toast(ok, 'ok')
    } finally {
      setTask(null)
    }
  }
  const cover = coverPlacement(info.w, info.h, cv)
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
          <Btn small icon={<Scan size={14} />} onClick={() => changeContent((c) => void (c.scene!.place = coverPlacement(info.w, info.h, cv)))}>
            ملء
          </Btn>
          <Btn small icon={<Layers size={14} />} onClick={() => changeContent((c) => void (c.scene!.place = fitWidthPlacement(info.w, info.h, cv)))}>
            ملاءمة العرض
          </Btn>
          <Btn small onClick={() => changeContent((c) => void (c.scene!.place = null))}>
            تلقائي
          </Btn>
        </div>
        <div className="row-btns">
          <Btn small icon={<Sparkles size={14} />} title="مستويات وإضاءة وتشبع تلقائية + شحذ خفيف" onClick={() => bakeScene({ ...NO_FIX, auto: true, sharpen: 0.3 }, 'تم تحسين الصورة')}>
            تحسين تلقائي
          </Btn>
          <Btn small icon={<Layers size={14} />} title="تكبير الدقة ×2 بالتنعيم والشحذ" onClick={() => bakeScene({ ...NO_FIX, upscale: 2 }, 'تم تكبير الدقة ×2')}>
            تكبير ×2
          </Btn>
          <Btn small icon={<Eraser size={14} />} title="حذف شعار أو غبار أو عنصر من الصورة" onClick={() => openRetouch('scene')}>
            محو عنصر
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
              const p = c.scene!.place ?? autoPlacement(info.w, info.h, cv)
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


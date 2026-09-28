import { Box, Brush, Link2, Unlink, Upload, Wand2, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button, ColorField, Row, Section, Select, Slider, Toggle } from '../../ui/controls'
import { useEditor } from '../../store/editor'
import { importImage, pickFile, runAutoCutout } from '../../lib/importer'
import { setContent, setStyle } from './common'
import type { ShadowKind, ShapeKind } from '../../model/types'
import { useCutout } from '../../lib/cutout'

const SHADOWS: { value: ShadowKind; label: string }[] = [
  { value: 'none', label: 'بدون' },
  { value: 'soft', label: 'ظل ناعم' },
  { value: 'float', label: 'طفو' },
  { value: 'contact', label: 'ظل أرضي' },
  { value: 'long', label: 'ظل ممتد' },
  { value: 'glow', label: 'توهج' },
]

export function ProductPanel() {
  const product = useEditor((s) => s.design.content.product)
  const scene = useEditor((s) => s.design.content.scene)
  const fx = useEditor((s) => s.design.style.productFx)
  const { busy } = useCutout(product)

  if (!product) {
    return (
      <Section title="المنتج المفرّغ" icon={<Box size={16} />}>
        <p className="muted small">لا يوجد منتج مفرّغ. ارفع صورة المنتج (يتم التفريغ تلقائياً) أو PNG شفاف جاهز.</p>
        <Row>
          <Button
            variant="primary"
            icon={<Upload size={15} />}
            onClick={async () => {
              const f = await pickFile()
              if (f[0]) importImage(f[0])
            }}
          >
            رفع صورة
          </Button>
          <Button
            icon={<Upload size={15} />}
            onClick={async () => {
              const f = await pickFile('image/png,image/webp')
              if (f[0]) importImage(f[0], 'product')
            }}
          >
            PNG مفرّغ
          </Button>
          {scene && (
            <Button icon={<Wand2 size={15} />} onClick={() => runAutoCutout(scene.assetId)}>
              تفريغ المشهد
            </Button>
          )}
        </Row>
      </Section>
    )
  }

  const c = product.cleanup
  const setClean = (fn: (x: typeof c) => void, key: string) => setContent((ct) => fn(ct.product!.cleanup), key)

  return (
    <>
      <Section
        title="المنتج المفرّغ"
        icon={<Box size={16} />}
        right={
          <button className="icon-btn" title={product.visible ? 'إخفاء' : 'إظهار'} onClick={() => setContent((ct) => void (ct.product!.visible = !ct.product!.visible))}>
            {product.visible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        }
      >
        {busy && <p className="muted small">⏳ جارِ المعالجة…</p>}
        <p className="muted small">
          {product.linked && scene
            ? 'المنتج منسوخ فوق التدرج بنفس مكانه في الصورة تماماً. اسحبه لتحريكه بشكل مستقل.'
            : 'المنتج مستقل — اسحبه في التصميم، وعجلة الفأرة للتكبير.'}
        </p>
        <Row>
          {scene && !product.linked && product.sourceAssetId === scene.assetId && (
            <Button small icon={<Link2 size={14} />} onClick={() => setContent((ct) => void ((ct.product!.linked = true), (ct.product!.place = null)))}>
              إعادة للمكان الأصلي
            </Button>
          )}
          {!scene || product.sourceAssetId !== scene.assetId ? (
            <Button small icon={<Unlink size={14} />} onClick={() => setContent((ct) => void (ct.product!.place = null))}>
              ملاءمة تلقائية
            </Button>
          ) : null}
          <Button small icon={<Brush size={14} />} onClick={() => useEditor.setState({ dialog: 'refine' })}>
            تحسين التفريغ
          </Button>
          <Button small variant="ghost" icon={<Trash2 size={14} />} title="حذف المنتج" onClick={() => setContent((ct) => void (ct.product = null))} />
        </Row>

        <div className="sub-title">إبراز المنتج</div>
        <Slider label="الإضاءة" value={product.enhance.brightness} min={0.6} max={1.5} step={0.01} onChange={(v) => setContent((ct) => void (ct.product!.enhance.brightness = v), 'pe-b')} />
        <Slider label="التباين" value={product.enhance.contrast} min={0.6} max={1.6} step={0.01} onChange={(v) => setContent((ct) => void (ct.product!.enhance.contrast = v), 'pe-c')} />
        <Slider label="التشبع" value={product.enhance.saturate} min={0} max={2} step={0.01} onChange={(v) => setContent((ct) => void (ct.product!.enhance.saturate = v), 'pe-s')} />
        <Select value={fx.shadow} options={SHADOWS} onChange={(v) => setStyle((s) => void (s.productFx.shadow = v))} />
        {fx.shadow !== 'none' && (
          <Slider label="قوة الظل" value={fx.shadowOpacity} min={0} max={1} step={0.01} onChange={(v) => setStyle((s) => void (s.productFx.shadowOpacity = v), 'pfx-o')} />
        )}
        {fx.shadow === 'glow' && <ColorField label="لون التوهج" value={fx.shadowColor} alpha={false} onChange={(v) => setStyle((s) => void (s.productFx.shadowColor = v), 'pfx-c')} />}
        <Toggle label="انعكاس أسفل المنتج" checked={fx.reflection} onChange={(v) => setStyle((s) => void (s.productFx.reflection = v))} />
      </Section>

      {product.maskAssetId && (
        <Section title="دقة التفريغ" icon={<Wand2 size={16} />} defaultOpen={false}>
          <p className="muted small">إذا ظهرت أجزاء من الخلفية أو اختفت أجزاء من المنتج، عدّل هذه القيم.</p>
          <Slider label="عتبة الحذف" hint="أعلى = حذف أكثر" value={c.low} min={0} max={250} onChange={(v) => setClean((x) => void (x.low = v), 'cl-low')} />
          <Slider label="عتبة الإظهار" hint="أقل = منتج أكثر صلابة" value={c.high} min={5} max={255} onChange={(v) => setClean((x) => void (x.high = Math.max(v, x.low + 5)), 'cl-high')} />
          <Toggle label="حذف الشوائب" hint="إبقاء الجسم الرئيسي" checked={c.islands} onChange={(v) => setClean((x) => void (x.islands = v), 'cl-i')} />
          <Toggle label="ملء الفراغات الداخلية" hint="للمنتجات البيضاء" checked={c.fillHoles} onChange={(v) => setClean((x) => void (x.fillHoles = v), 'cl-f')} />
          <Slider label="تقليص الحواف" value={c.choke} min={0} max={8} step={1} onChange={(v) => setClean((x) => void (x.choke = v), 'cl-ch')} format={(v) => `${v}px`} />
          <Slider label="نعومة الحواف" value={c.feather} min={0} max={6} step={0.5} onChange={(v) => setClean((x) => void (x.feather = v), 'cl-fe')} format={(v) => `${v}px`} />
          {scene && (
            <Button small icon={<Wand2 size={14} />} onClick={() => runAutoCutout(scene.assetId)}>
              إعادة التفريغ بالذكاء الاصطناعي
            </Button>
          )}
        </Section>
      )}
    </>
  )
}

export const SHAPES: { value: ShapeKind; label: string; icon: string }[] = [
  { value: 'none', label: 'بدون', icon: '∅' },
  { value: 'slab', label: 'مستطيل', icon: '▰' },
  { value: 'circle', label: 'دائرة', icon: '●' },
  { value: 'rings', label: 'حلقات', icon: '◎' },
  { value: 'floor', label: 'أرضية', icon: '⬮' },
  { value: 'podium', label: 'منصة', icon: '⏏' },
  { value: 'arch', label: 'قوس', icon: '⌂' },
  { value: 'halo', label: 'هالة', icon: '✺' },
  { value: 'band', label: 'شريط مائل', icon: '⟋' },
  { value: 'frame', label: 'إطار', icon: '▢' },
  { value: 'blob', label: 'عضوي', icon: '❂' },
]

export function ShapePanel() {
  const sh = useEditor((s) => s.design.style.shape)
  const set = (fn: (x: typeof sh) => void, key = '') => setStyle((s) => fn(s.shape), key)
  const uses = {
    spread: ['slab', 'floor', 'podium', 'arch', 'frame'].includes(sh.kind),
    top: ['slab', 'arch', 'frame', 'band', 'circle'].includes(sh.kind),
    bottom: ['slab', 'arch', 'frame', 'podium'].includes(sh.kind),
    radius: ['slab', 'arch', 'frame'].includes(sh.kind),
    skew: ['slab', 'band'].includes(sh.kind),
    scale: ['circle', 'rings', 'halo', 'floor', 'podium', 'band', 'blob'].includes(sh.kind),
    stroke: ['rings', 'frame'].includes(sh.kind),
    color2: ['slab', 'circle', 'podium', 'arch', 'band', 'blob'].includes(sh.kind),
  }
  return (
    <Section title="الشكل تحت المنتج" icon={<Box size={16} />}>
      <p className="muted small">يُحسب مكانه وحجمه تلقائياً من حدود المنتج المفرّغ — ويمكن سحبه لإزاحته.</p>
      <div className="shape-grid">
        {SHAPES.map((s) => (
          <button key={s.value} className={sh.kind === s.value ? 'active' : ''} onClick={() => set((x) => void (x.kind = s.value))}>
            <span>{s.icon}</span>
            <small>{s.label}</small>
          </button>
        ))}
      </div>
      {sh.kind !== 'none' && (
        <>
          <ColorField label="اللون" value={sh.color} alpha={false} onChange={(v) => set((x) => void (x.color = v), 'sh-c')} />
          {uses.color2 && <ColorField label="اللون الثاني (تدرج)" value={sh.color2} alpha={false} onChange={(v) => set((x) => void (x.color2 = v), 'sh-c2')} />}
          <Slider label="الشفافية" value={sh.opacity} min={0} max={1} step={0.01} onChange={(v) => set((x) => void (x.opacity = v), 'sh-o')} />
          {uses.spread && <Slider label="العرض الإضافي" value={sh.spread} min={-0.3} max={1} step={0.01} onChange={(v) => set((x) => void (x.spread = v), 'sh-sp')} />}
          {uses.top && <Slider label="بداية الشكل" hint="نسبة من ارتفاع المنتج" value={sh.top} min={-1} max={1.2} step={0.01} onChange={(v) => set((x) => void (x.top = v), 'sh-t')} />}
          {uses.bottom && <Slider label="امتداد للأسفل" value={sh.bottom} min={-100} max={400} onChange={(v) => set((x) => void (x.bottom = v), 'sh-b')} />}
          {uses.radius && <Slider label="استدارة الزوايا" value={sh.radius} min={0} max={200} onChange={(v) => set((x) => void (x.radius = v), 'sh-r')} />}
          {uses.skew && <Slider label="الميلان" value={sh.skew} min={-40} max={40} onChange={(v) => set((x) => void (x.skew = v), 'sh-sk')} format={(v) => `${v}°`} />}
          {uses.scale && <Slider label="الحجم" value={sh.scale} min={0.3} max={2.5} step={0.01} onChange={(v) => set((x) => void (x.scale = v), 'sh-s')} />}
          {uses.stroke && <Slider label="سماكة الخط" value={sh.stroke} min={1} max={30} onChange={(v) => set((x) => void (x.stroke = v), 'sh-st')} />}
          {(sh.offsetX !== 0 || sh.offsetY !== 0) && (
            <Button small onClick={() => set((x) => void ((x.offsetX = 0), (x.offsetY = 0)))}>
              إعادة للمكان التلقائي
            </Button>
          )}
        </>
      )}
    </Section>
  )
}

import { Image as ImageIcon, Wand2, Trash2, Upload, Scan, Layers } from 'lucide-react'
import { Button, ColorField, Row, Section, Segmented, Slider, Toggle, Select } from '../../ui/controls'
import { useEditor } from '../../store/editor'
import { useAsset } from '../../lib/assets'
import { autoPlacement, coverPlacement, fitWidthPlacement } from '../../poster/geometry'
import { importImage, pickFile, runAutoCutout } from '../../lib/importer'
import { setContent, setStyle } from './common'
import type { BackdropKind } from '../../model/types'

export function ImagePanel() {
  const scene = useEditor((s) => s.design.content.scene)
  const product = useEditor((s) => s.design.content.product)
  const info = useAsset(scene?.assetId)
  const place = scene && info ? scene.place ?? autoPlacement(info.w, info.h) : null
  const cover = info ? coverPlacement(info.w, info.h) : null
  const zoom = place && cover ? place.w / cover.w : 1

  return (
    <Section title="صورة المنتج / المشهد" icon={<ImageIcon size={16} />}>
      {scene && info ? (
        <div className="scene-card">
          <img src={info.url} alt="" />
          <div>
            <strong>
              {info.w}×{info.h}
            </strong>
            <span className="muted small">{product?.maskAssetId ? 'مفرّغ تلقائياً ✓' : product ? 'منتج مستقل' : 'بدون تفريغ'}</span>
          </div>
        </div>
      ) : (
        <p className="muted small">لا توجد صورة مشهد. اسحب صورة إلى التصميم، أو ارفع PNG مفرغ ليوضع كمنتج مستقل.</p>
      )}
      <Row>
        <Button
          icon={<Upload size={15} />}
          variant="primary"
          onClick={async () => {
            const f = await pickFile()
            if (f[0]) importImage(f[0])
          }}
        >
          رفع صورة
        </Button>
        {scene && (
          <Button icon={<Wand2 size={15} />} onClick={() => runAutoCutout(scene.assetId)} title="إعادة التفريغ بالذكاء الاصطناعي">
            تفريغ
          </Button>
        )}
        {scene && (
          <Button
            icon={<Trash2 size={15} />}
            variant="ghost"
            title="إزالة صورة المشهد"
            onClick={() =>
              setContent((c) => {
                if (c.product?.linked) c.product = null
                c.scene = null
              })
            }
          />
        )}
      </Row>
      {scene && info && (
        <>
          <Row>
            <Button small icon={<Scan size={14} />} onClick={() => setContent((c) => void (c.scene!.place = coverPlacement(info.w, info.h)))}>
              ملء
            </Button>
            <Button small icon={<Layers size={14} />} onClick={() => setContent((c) => void (c.scene!.place = fitWidthPlacement(info.w, info.h)))}>
              ملاءمة العرض
            </Button>
          </Row>
          <Slider
            label="تكبير الصورة"
            hint="أو عجلة الفأرة"
            value={+zoom.toFixed(2)}
            min={0.5}
            max={3}
            step={0.01}
            onChange={(z) =>
              setContent((c) => {
                const p = c.scene!.place ?? autoPlacement(info.w, info.h)
                const h = (p.w * info.h) / info.w
                const w = cover!.w * z
                c.scene!.place = { x: p.x + p.w / 2 - w / 2, y: p.y + h / 2 - (w * info.h) / info.w / 2, w }
              }, 'scene-zoom')
            }
          />
        </>
      )}
    </Section>
  )
}

export function FadePanel() {
  const fade = useEditor((s) => s.design.style.fade)
  const fx = useEditor((s) => s.design.style.sceneFx)
  return (
    <Section title="تدرّج الخلفية" icon={<Layers size={16} />}>
      <Toggle label="تفعيل التدرج" checked={fade.enabled} onChange={(v) => setStyle((s) => void (s.fade.enabled = v))} />
      {fade.enabled && (
        <>
          <Slider
            label="الشفافية في الأعلى"
            hint="0–30%"
            value={Math.round(fade.top * 100)}
            min={0}
            max={60}
            onChange={(v) => setStyle((s) => void (s.fade.top = v / 100), 'fade-top')}
            format={(v) => `${v}%`}
          />
          <Slider
            label="بداية التدرج من الأسفل"
            value={Math.round(fade.from * 100)}
            min={0}
            max={95}
            onChange={(v) => setStyle((s) => void (s.fade.from = Math.min(v / 100, s.fade.to - 0.02)), 'fade-from')}
            format={(v) => `${v}%`}
          />
          <Slider
            label="نهاية التدرج"
            value={Math.round(fade.to * 100)}
            min={5}
            max={100}
            onChange={(v) => setStyle((s) => void (s.fade.to = Math.max(v / 100, s.fade.from + 0.02)), 'fade-to')}
            format={(v) => `${v}%`}
          />
        </>
      )}
      <div className="sub-title">مؤثرات صورة الخلفية</div>
      <Slider label="تمويه" value={fx.blur} min={0} max={20} step={0.5} onChange={(v) => setStyle((s) => void (s.sceneFx.blur = v), 'fx-blur')} />
      <Slider label="الإضاءة" value={fx.brightness} min={0.2} max={1.6} step={0.01} onChange={(v) => setStyle((s) => void (s.sceneFx.brightness = v), 'fx-b')} />
      <Slider label="التشبع" value={fx.saturate} min={0} max={2} step={0.01} onChange={(v) => setStyle((s) => void (s.sceneFx.saturate = v), 'fx-s')} />
      <Slider label="التباين" value={fx.contrast} min={0.5} max={1.6} step={0.01} onChange={(v) => setStyle((s) => void (s.sceneFx.contrast = v), 'fx-c')} />
      <Slider label="أبيض وأسود" value={fx.grayscale} min={0} max={1} step={0.01} onChange={(v) => setStyle((s) => void (s.sceneFx.grayscale = v), 'fx-g')} />
      <ColorField label="لون الصبغة" value={fx.tint} alpha={false} onChange={(v) => setStyle((s) => void (s.sceneFx.tint = v), 'fx-tint')} />
      <Slider label="قوة الصبغة" value={fx.tintOpacity} min={0} max={1} step={0.01} onChange={(v) => setStyle((s) => void (s.sceneFx.tintOpacity = v), 'fx-to')} />
    </Section>
  )
}

const BACKDROPS: { value: BackdropKind; label: string }[] = [
  { value: 'solid', label: 'لون واحد' },
  { value: 'studio', label: 'استوديو فاتح' },
  { value: 'studio-dark', label: 'استوديو داكن' },
  { value: 'spot', label: 'بقعة ضوء' },
  { value: 'red-sweep', label: 'أحمر متدرج' },
  { value: 'mesh', label: 'ألوان ناعمة' },
  { value: 'split', label: 'مقسوم' },
  { value: 'paper', label: 'ورق' },
]

export function BackdropPanel() {
  const b = useEditor((s) => s.design.style.backdrop)
  const theme = useEditor((s) => s.design.style.theme)
  return (
    <Section title="الخلفية والثيم" icon={<Layers size={16} />} defaultOpen={false}>
      <Segmented
        value={theme}
        options={[
          { value: 'light', label: 'فاتح' },
          { value: 'dark', label: 'داكن' },
        ]}
        onChange={(v) => setStyle((s) => void (s.theme = v))}
      />
      <Select value={b.kind} options={BACKDROPS} onChange={(v) => setStyle((s) => void (s.backdrop.kind = v))} />
      <ColorField label="اللون الأساسي" value={b.color} alpha={false} onChange={(v) => setStyle((s) => void (s.backdrop.color = v), 'bd-c1')} />
      <ColorField label="اللون الثانوي" value={b.color2} alpha={false} onChange={(v) => setStyle((s) => void (s.backdrop.color2 = v), 'bd-c2')} />
    </Section>
  )
}

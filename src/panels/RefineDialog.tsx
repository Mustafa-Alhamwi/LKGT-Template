import { useEffect, useRef, useState } from 'react'
import { Brush, Eraser, RotateCcw, Check, X } from 'lucide-react'
import { changeContent, toast, useEditor } from '../store/editor'
import { getAssetBlob, putAsset } from '../lib/assets'
import { getCutout } from '../lib/cutout'
import { Button, Segmented, Slider } from '../ui/controls'

/* ------------------------------------------------------------------
 * تحسين التفريغ يدوياً بالفرشاة: مسح أجزاء زائدة أو استعادة أجزاء مفقودة
 * تُحفظ كطبقة مستقلة (R = استعادة، G = مسح) فلا تضيع عند تعديل العتبات
 * ------------------------------------------------------------------ */

interface Buffers {
  w: number
  h: number
  rgb: Uint8ClampedArray
  base: Uint8Array
  add: Uint8Array
  erase: Uint8Array
  img: ImageData
}

export function RefineDialog() {
  const product = useEditor((s) => s.design.content.product)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufRef = useRef<Buffers | null>(null)
  const [ready, setReady] = useState(false)
  const [srcUrl, setSrcUrl] = useState<string>('')
  const [mode, setMode] = useState<'erase' | 'restore'>('erase')
  const [size, setSize] = useState(40)
  const [hard, setHard] = useState(0.6)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [bg, setBg] = useState<'check' | 'dark' | 'light'>('check')
  const drawing = useRef<{ last: { x: number; y: number } | null }>({ last: null })

  const close = () => useEditor.setState({ dialog: null })

  useEffect(() => {
    if (!product) return
    let alive = true
    ;(async () => {
      const srcBlob = await getAssetBlob(product.sourceAssetId)
      if (!srcBlob) return
      const bmp = await createImageBitmap(srcBlob)
      const w = bmp.width
      const h = bmp.height
      const oc = new OffscreenCanvas(w, h)
      const ctx = oc.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(bmp, 0, 0)
      const rgb = ctx.getImageData(0, 0, w, h).data
      bmp.close()
      // القناع الأساسي بدون تعديلات الفرشاة
      const base = new Uint8Array(w * h)
      const cut = await getCutout({ ...product, paintAssetId: null })
      if (cut) {
        const cb = await createImageBitmap(await (await fetch(cut.url)).blob())
        const c2 = new OffscreenCanvas(w, h)
        const x2 = c2.getContext('2d', { willReadFrequently: true })!
        x2.drawImage(cb, cut.crop.x, cut.crop.y)
        const a = x2.getImageData(0, 0, w, h).data
        for (let i = 0; i < w * h; i++) base[i] = a[i * 4 + 3]
      }
      const add = new Uint8Array(w * h)
      const erase = new Uint8Array(w * h)
      if (product.paintAssetId) {
        const pb = await getAssetBlob(product.paintAssetId)
        if (pb) {
          const pbm = await createImageBitmap(pb)
          const c3 = new OffscreenCanvas(w, h)
          const x3 = c3.getContext('2d', { willReadFrequently: true })!
          x3.drawImage(pbm, 0, 0, w, h)
          const p = x3.getImageData(0, 0, w, h).data
          for (let i = 0; i < w * h; i++) {
            add[i] = p[i * 4]
            erase[i] = p[i * 4 + 1]
          }
        }
      }
      const img = new ImageData(w, h)
      for (let i = 0; i < w * h; i++) {
        img.data[i * 4] = rgb[i * 4]
        img.data[i * 4 + 1] = rgb[i * 4 + 1]
        img.data[i * 4 + 2] = rgb[i * 4 + 2]
        img.data[i * 4 + 3] = Math.max(base[i], add[i]) * (1 - erase[i] / 255)
      }
      if (!alive) return
      bufRef.current = { w, h, rgb, base, add, erase, img }
      const cv = canvasRef.current!
      cv.width = w
      cv.height = h
      cv.getContext('2d')!.putImageData(img, 0, 0)
      setSrcUrl(URL.createObjectURL(srcBlob))
      setReady(true)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toImage = (e: React.PointerEvent) => {
    const cv = canvasRef.current!
    const r = cv.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height, k: cv.width / r.width }
  }

  const dab = (cx: number, cy: number) => {
    const b = bufRef.current
    if (!b) return
    const r = size
    const x0 = Math.max(0, Math.floor(cx - r))
    const y0 = Math.max(0, Math.floor(cy - r))
    const x1 = Math.min(b.w - 1, Math.ceil(cx + r))
    const y1 = Math.min(b.h - 1, Math.ceil(cy + r))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / r
        if (d > 1) continue
        const s = d < hard ? 1 : 1 - (d - hard) / Math.max(0.001, 1 - hard)
        const i = y * b.w + x
        if (mode === 'erase') {
          b.erase[i] = Math.max(b.erase[i], s * 255)
          b.add[i] = b.add[i] * (1 - s)
        } else {
          b.add[i] = Math.max(b.add[i], s * 255)
          b.erase[i] = b.erase[i] * (1 - s)
        }
        b.img.data[i * 4 + 3] = Math.max(b.base[i], b.add[i]) * (1 - b.erase[i] / 255)
      }
    }
    canvasRef.current!.getContext('2d')!.putImageData(b.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
  }

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    const step = Math.max(1, size * 0.3)
    const n = Math.ceil(dist / step)
    for (let i = 1; i <= n; i++) dab(from.x + ((to.x - from.x) * i) / n, from.y + ((to.y - from.y) * i) / n)
  }

  const apply = async () => {
    const b = bufRef.current
    if (!b) return
    const out = new ImageData(b.w, b.h)
    let any = false
    for (let i = 0; i < b.w * b.h; i++) {
      out.data[i * 4] = b.add[i]
      out.data[i * 4 + 1] = b.erase[i]
      out.data[i * 4 + 3] = 255
      if (b.add[i] || b.erase[i]) any = true
    }
    let id: string | null = null
    if (any) {
      const oc = new OffscreenCanvas(b.w, b.h)
      oc.getContext('2d')!.putImageData(out, 0, 0)
      const blob = await oc.convertToBlob({ type: 'image/png' })
      id = (await putAsset(blob, 'paint', { w: b.w, h: b.h })).id
    }
    changeContent((c) => {
      if (c.product) c.product.paintAssetId = id
    })
    toast('تم تحديث التفريغ ✓', 'ok')
    close()
  }

  const reset = () => {
    const b = bufRef.current
    if (!b) return
    b.add.fill(0)
    b.erase.fill(0)
    for (let i = 0; i < b.w * b.h; i++) b.img.data[i * 4 + 3] = b.base[i]
    canvasRef.current!.getContext('2d')!.putImageData(b.img, 0, 0)
  }

  if (!product) return null

  return (
    <div className="modal-back">
      <div className="modal refine">
        <div className="modal-head">
          <h3>تحسين التفريغ بالفرشاة</h3>
          <button className="icon-btn" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="refine-body">
          <div className="refine-tools">
            <Segmented
              value={mode}
              options={[
                { value: 'erase', label: <><Eraser size={15} /> مسح</> },
                { value: 'restore', label: <><Brush size={15} /> استعادة</> },
              ]}
              onChange={setMode}
            />
            <Slider label="حجم الفرشاة" value={size} min={4} max={250} onChange={setSize} format={(v) => `${v}px`} />
            <Slider label="صلابة الحافة" value={hard} min={0} max={1} step={0.01} onChange={setHard} />
            <Segmented
              small
              value={bg}
              options={[
                { value: 'check', label: 'مربعات' },
                { value: 'dark', label: 'داكن' },
                { value: 'light', label: 'فاتح' },
              ]}
              onChange={setBg}
            />
            <p className="muted small">المسح: لإزالة أجزاء من الخلفية بقيت مع المنتج. الاستعادة: لإرجاع أجزاء من المنتج حذفها التفريغ (الصورة الأصلية ظاهرة بشفافية كدليل).</p>
            <Button icon={<RotateCcw size={15} />} onClick={reset}>
              مسح كل التعديلات
            </Button>
            <div className="flex-1" />
            <Button variant="primary" icon={<Check size={15} />} onClick={apply} disabled={!ready}>
              تطبيق
            </Button>
            <Button variant="ghost" onClick={close}>
              إلغاء
            </Button>
          </div>
          <div className={`refine-canvas bg-${bg}`}>
            {!ready && <span className="lk-spinner" />}
            <div className="refine-stack">
              {srcUrl && <img src={srcUrl} alt="" className="refine-ghost" />}
              <canvas
                ref={canvasRef}
                style={{ cursor: 'none' }}
                onPointerDown={(e) => {
                  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                  const p = toImage(e)
                  drawing.current.last = p
                  dab(p.x, p.y)
                }}
                onPointerMove={(e) => {
                  const r = (e.target as HTMLElement).getBoundingClientRect()
                  setCursor({ x: e.clientX - r.left, y: e.clientY - r.top })
                  if (!drawing.current.last) return
                  const p = toImage(e)
                  stroke(drawing.current.last, p)
                  drawing.current.last = p
                }}
                onPointerUp={() => (drawing.current.last = null)}
                onPointerLeave={() => setCursor(null)}
              />
              {cursor && canvasRef.current && (
                <div
                  className={`brush-cursor ${mode}`}
                  style={{
                    left: cursor.x,
                    top: cursor.y,
                    width: (size * 2 * canvasRef.current.getBoundingClientRect().width) / canvasRef.current.width,
                    height: (size * 2 * canvasRef.current.getBoundingClientRect().width) / canvasRef.current.width,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

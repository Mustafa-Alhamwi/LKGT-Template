import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Brush, Check, Eraser, Loader2, RotateCcw, Trash2, Undo2, X, ZoomIn } from 'lucide-react'
import { Btn, Chips, Slider } from '../ui/kit'
import { Modal } from './Dialogs'
import { change, toast, useEditor } from '../store/editor'
import { getAssetBlob, putAsset } from '../lib/assets'
import { runInpaint } from '../lib/inpaint'
import { retouchIntent } from '../store/retouch'

const close = () => useEditor.setState({ dialog: null })

interface Target {
  id: string
  label: string
  assetId: string
}

/** محو عناصر من الصور: شعار، غبار، نص، شخص… بتلوين المنطقة فقط */
export default function RetouchDialog() {
  const design = useEditor((s) => s.design)
  const targets = useMemo<Target[]>(() => {
    const c = design.content
    const list: Target[] = []
    if (c.scene) list.push({ id: 'scene', label: 'صورة الخلفية', assetId: c.scene.assetId })
    if (c.product && (!c.scene || c.product.sourceAssetId !== c.scene.assetId)) list.push({ id: 'product', label: 'صورة المنتج', assetId: c.product.sourceAssetId })
    design.style.decor.forEach((x, i) => {
      if (x.kind === 'image' && x.image) list.push({ id: `img:${x.id}`, label: x.name || `صورة مضافة ${i + 1}`, assetId: x.image.assetId })
    })
    return list
  }, [design])

  const [tid, setTid] = useState(() => (targets.some((t) => t.id === retouchIntent.target) ? retouchIntent.target : targets[0]?.id ?? ''))
  const target = targets.find((t) => t.id === tid)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [hist, setHist] = useState<Blob[]>([])
  const [url, setUrl] = useState('')
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [brush, setBrush] = useState(40)
  const [erase, setErase] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [progress, setProgress] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [hasMask, setHasMask] = useState(false)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const [fit, setFit] = useState(0.3)
  const drawing = useRef<{ x: number; y: number } | null>(null)

  // تحميل صورة الهدف
  useEffect(() => {
    let alive = true
    setBlob(null)
    setHist([])
    setDirty(false)
    setHasMask(false)
    if (!target) return
    getAssetBlob(target.assetId).then(async (b) => {
      if (!alive || !b) return
      const bmp = await createImageBitmap(b)
      if (!alive) return
      setDims({ w: bmp.width, h: bmp.height })
      bmp.close()
      setBlob(b)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid])

  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  // مقاس العرض المناسب
  useEffect(() => {
    const el = boxRef.current
    if (!el || !dims.w) return
    const upd = () => setFit(Math.min((el.clientWidth - 8) / dims.w, (el.clientHeight - 8) / dims.h))
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    return () => ro.disconnect()
  }, [dims.w, dims.h])

  const scale = fit * zoom
  const dw = dims.w * scale
  const dh = dims.h * scale

  const clearMask = useCallback(() => {
    const c = maskRef.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setHasMask(false)
  }, [])

  const toImg = (e: React.PointerEvent) => {
    const c = maskRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }

  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = maskRef.current!.getContext('2d')!
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brush
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = 'rgba(255, 45, 70, 0.62)'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x + 0.01, b.y + 0.01)
    ctx.stroke()
  }

  const moveCursor = (e: React.PointerEvent) => {
    const cur = cursorRef.current
    const box = boxRef.current
    if (!cur || !box) return
    const r = box.getBoundingClientRect()
    const d = brush * scale
    cur.style.width = cur.style.height = `${d}px`
    cur.style.transform = `translate(${e.clientX - r.left + box.scrollLeft - d / 2}px, ${e.clientY - r.top + box.scrollTop - d / 2}px)`
    cur.style.opacity = '1'
  }

  const run = async () => {
    const c = maskRef.current
    if (!c || !blob || progress != null) return
    const ctx = c.getContext('2d')!
    const img = ctx.getImageData(0, 0, c.width, c.height)
    const mask = new Uint8Array(c.width * c.height)
    let any = false
    for (let i = 0; i < mask.length; i++) {
      if (img.data[i * 4 + 3] > 40) {
        mask[i] = 255
        any = true
      }
    }
    if (!any) return toast('لوّن أولاً فوق العنصر المراد حذفه', 'info')
    setProgress(0)
    const job = runInpaint(blob, mask, c.width, c.height, setProgress)
    cancelRef.current = job.cancel
    try {
      const out = await job.promise
      setHist((h) => [...h, blob])
      setBlob(out)
      setDirty(true)
      clearMask()
    } catch (e) {
      if ((e as Error).message !== 'cancelled') toast(`تعذّر المحو: ${(e as Error).message}`, 'error', 6000)
    } finally {
      cancelRef.current = null
      setProgress(null)
    }
  }

  const undo = () => {
    const prev = hist[hist.length - 1]
    if (!prev) return
    setBlob(prev)
    setHist((h) => h.slice(0, -1))
    setDirty(hist.length > 1)
    clearMask()
  }

  const apply = async () => {
    if (!blob || !target) return
    setProgress(0.99)
    try {
      const info = await putAsset(blob, 'retouched', dims.w ? { w: dims.w, h: dims.h } : undefined)
      const old = target.assetId
      change((d) => {
        if (target.id === 'scene') {
          d.content.scene!.assetId = info.id
          if (d.content.product && d.content.product.sourceAssetId === old) d.content.product.sourceAssetId = info.id
        } else if (target.id === 'product') d.content.product!.sourceAssetId = info.id
        else {
          const it = d.style.decor.find((x) => `img:${x.id}` === target.id)
          if (it?.image) it.image.assetId = info.id
        }
        d.touched = true
      })
      toast('تم حفظ الصورة بعد المحو', 'ok')
      close()
    } finally {
      setProgress(null)
    }
  }

  useEffect(() => () => cancelRef.current?.(), [])

  if (!targets.length) {
    return (
      <Modal title="محو عنصر من الصورة" onClose={close}>
        <p className="hint">أضف صورة (خلفية أو منتج أو صورة مضافة) إلى التصميم أولاً.</p>
      </Modal>
    )
  }

  return (
    <Modal title="محو عنصر من الصورة" onClose={() => (dirty && !confirm('تجاهل التعديلات غير المحفوظة؟') ? undefined : close())} wide="xl">
      <div className="rt">
        <div className="rt-stage">
          <div
            ref={boxRef}
            className="rt-box"
            onPointerLeave={() => cursorRef.current && (cursorRef.current.style.opacity = '0')}
            onPointerMove={moveCursor}
          >
            {url ? (
              <div className="rt-canvas" style={{ width: dw, height: dh }}>
                <img src={url} alt="" draggable={false} style={{ width: dw, height: dh }} />
                <canvas
                  ref={maskRef}
                  width={dims.w}
                  height={dims.h}
                  style={{ width: dw, height: dh, touchAction: 'none' }}
                  onPointerDown={(e) => {
                    if (progress != null) return
                    e.currentTarget.setPointerCapture(e.pointerId)
                    const p = toImg(e)
                    drawing.current = p
                    stroke(p, p)
                    if (!erase) setHasMask(true)
                  }}
                  onPointerMove={(e) => {
                    moveCursor(e)
                    if (!drawing.current) return
                    const p = toImg(e)
                    stroke(drawing.current, p)
                    drawing.current = p
                  }}
                  onPointerUp={() => (drawing.current = null)}
                  onPointerCancel={() => (drawing.current = null)}
                />
              </div>
            ) : (
              <div className="rt-load">
                <Loader2 className="spin" /> جارِ تحميل الصورة…
              </div>
            )}
            <div ref={cursorRef} className="rt-cursor" />
            {progress != null && (
              <div className="rt-busy">
                <Loader2 className="spin" size={22} />
                <b>جارِ المحو… {Math.round(progress * 100)}%</b>
                <div className="task-bar">
                  <i style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <Btn small variant="ghost" icon={<X size={14} />} onClick={() => cancelRef.current?.()}>
                  إلغاء
                </Btn>
              </div>
            )}
          </div>
        </div>

        <div className="rt-side">
          {targets.length > 1 && (
            <div className="rt-sec">
              <span>الصورة</span>
              <Chips value={tid} wrap options={targets.map((t) => ({ value: t.id, label: t.label }))} onChange={(v) => (dirty && !confirm('ستُفقد تعديلات هذه الصورة غير المحفوظة. متابعة؟') ? undefined : setTid(v))} />
            </div>
          )}
          <div className="rt-sec">
            <span>الأداة</span>
            <Chips
              value={erase ? 'erase' : 'paint'}
              options={[
                { value: 'paint', label: <><Brush size={14} /> تلوين</> },
                { value: 'erase', label: <><Eraser size={14} /> ممحاة التلوين</> },
              ]}
              onChange={(v) => setErase(v === 'erase')}
            />
          </div>
          <Slider label="حجم الفرشاة" value={brush} min={6} max={260} unit="px" onChange={setBrush} />
          <Slider label="التكبير" value={zoom} min={1} max={4} step={0.1} onChange={setZoom} />
          <p className="hint">لوّن فوق العنصر المراد حذفه (شعار، غبار، نص، سلك…) بحيث يغطّيه بالكامل مع هامش صغير، ثم اضغط «احذف المحدّد».</p>
          <Btn variant="primary" block icon={progress != null ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} disabled={!hasMask || progress != null} onClick={run}>
            احذف المحدّد
          </Btn>
          <div className="row-btns">
            <Btn small icon={<RotateCcw size={14} />} disabled={!hasMask} onClick={clearMask}>
              مسح التلوين
            </Btn>
            <Btn small icon={<Undo2 size={14} />} disabled={!hist.length || progress != null} onClick={undo}>
              تراجع
            </Btn>
            <Btn small variant="ghost" icon={<ZoomIn size={14} />} onClick={() => setZoom(1)}>
              ملاءمة
            </Btn>
          </div>
          <div className="rt-foot">
            <Btn variant="primary" block icon={<Check size={15} />} disabled={!dirty || progress != null} onClick={apply}>
              حفظ في التصميم
            </Btn>
            <p className="hint">الطريقة تعبّئ المنطقة من محيطها (نسيج/خلفية) — ممتازة للغبار والشعارات والعناصر الصغيرة والخلفيات المتجانسة، وليست توليداً بالذكاء الاصطناعي، فالأجسام الكبيرة المعقّدة قد تحتاج عدة محاولات.</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

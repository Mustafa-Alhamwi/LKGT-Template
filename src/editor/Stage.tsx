import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Maximize2, Minus, Plus } from 'lucide-react'
import { Poster } from '../poster/Poster'
import { EditCtx, type EditApi } from '../poster/EditContext'
import { allPartners, beginLive, changeContent, live, select, setEditing, useEditor } from '../store/editor'
import { bridge } from '../lib/bridge'
import type { Design, Selection } from '../model/types'
import { POSTER_H, POSTER_W } from '../model/types'
import { assetInfoSync } from '../lib/assets'
import { cutoutSync } from '../lib/cutout'
import { autoPlacement, productRectOf } from '../poster/geometry'
import { importImage, pickFile } from '../lib/importer'

/* ------------------------------------------------------------------
 * مساحة العمل: البوستر بحجمه الحقيقي مصغّراً ليناسب الشاشة
 * سحب العناصر، التحرير المباشر للنصوص، إسقاط الصور
 * ------------------------------------------------------------------ */

const productRectNow = productRectOf

function applyDrag(d: Design, d0: Design, sel: Selection, dx: number, dy: number, handle?: string) {
  switch (sel.kind) {
    case 'scene': {
      const sc0 = d0.content.scene
      if (!sc0) return
      const info = assetInfoSync(sc0.assetId)
      if (!info) return
      const base = sc0.place ?? autoPlacement(info.w, info.h)
      d.content.scene!.place = { x: base.x + dx, y: base.y + dy, w: base.w }
      return
    }
    case 'product': {
      const r = productRectNow(d0)
      if (!r || !d.content.product) return
      d.content.product.linked = false
      d.content.product.place = { x: r.x + dx, y: r.y + dy, w: r.w }
      return
    }
    case 'text':
    case 'extra': {
      const st0 = sel.kind === 'text' ? d0.style.text.items[sel.key] : d0.content.extras?.find((e) => e.id === sel.id)?.style
      const st = sel.kind === 'text' ? d.style.text.items[sel.key] : d.content.extras?.find((e) => e.id === sel.id)?.style
      if (!st0 || !st) return
      if (sel.kind === 'text' && !st0.free) return applyDrag(d, d0, { kind: 'textBlock' }, dx, dy, handle)
      const w0 = st0.fw ?? 600
      const x0 = st0.fx ?? 0
      if (handle === 'right') st.fw = Math.max(80, Math.round(w0 + dx))
      else if (handle === 'left') {
        const w = Math.max(80, w0 - dx)
        st.fx = Math.round(x0 + (w0 - w))
        st.fw = Math.round(w)
      } else {
        let x = x0 + dx
        if (Math.abs(x + w0 / 2 - POSTER_W / 2) < 10) x = POSTER_W / 2 - w0 / 2
        st.fx = Math.round(x)
        st.fy = Math.round((st0.fy ?? 0) + dy)
      }
      return
    }
    case 'textBlock': {
      const t0 = d0.style.text
      const t = d.style.text
      if (handle === 'right') {
        t.w = Math.max(160, t0.w + dx)
      } else if (handle === 'left') {
        const w = Math.max(160, t0.w - dx)
        t.x = t0.x + (t0.w - w)
        t.w = w
      } else {
        let x = t0.x + dx
        const center = x + t0.w / 2
        if (Math.abs(center - POSTER_W / 2) < 10) x = POSTER_W / 2 - t0.w / 2
        t.x = Math.round(x)
        t.y = Math.round(t0.y + dy)
      }
      return
    }
    case 'shape': {
      d.style.shape.offsetX = Math.round(d0.style.shape.offsetX + dx)
      d.style.shape.offsetY = Math.round(d0.style.shape.offsetY + dy)
      return
    }
    case 'decor': {
      const i = d0.style.decor.findIndex((x) => x.id === sel.id)
      if (i < 0) return
      d.style.decor[i].x = Math.round(d0.style.decor[i].x + dx)
      d.style.decor[i].y = Math.round(d0.style.decor[i].y + dy)
      return
    }
  }
}

export function Stage() {
  const design = useEditor((s) => s.design)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const selection = useEditor((s) => s.selection)
  const editing = useEditor((s) => s.editing)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const wrapRef = useRef<HTMLDivElement>(null)
  const posterRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 800, h: 900 })
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [dragOver, setDragOver] = useState(false)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = Math.max(0.1, Math.min((box.w - 56) / POSTER_W, (box.h - 44) / POSTER_H))
  const scale = zoom === 'fit' ? fit : zoom

  useEffect(() => {
    bridge.poster = posterRef.current
    bridge.scale = scale
    return () => {
      bridge.poster = null
    }
  }, [scale])

  const startDrag = useCallback<EditApi['startDrag']>(
    (sel, e, extra) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const st = useEditor.getState()
      if (st.editing) return
      select(sel)
      const draggable = !['contact', 'partner', 'logo'].includes(sel.kind)
      if (!draggable) return
      if (sel.kind === 'scene' && !st.design.content.scene) return
      const d0 = st.design
      const sx = e.clientX
      const sy = e.clientY
      let moved = false
      const onMove = (ev: PointerEvent) => {
        let dx = (ev.clientX - sx) / scale
        let dy = (ev.clientY - sy) / scale
        if (!moved && Math.hypot(dx, dy) < 3 / scale) return
        if (ev.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }
        if (!moved) {
          moved = true
          beginLive()
          document.body.classList.add('is-dragging')
        }
        live((d) => applyDrag(d, d0, sel, dx, dy, extra?.handle))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.classList.remove('is-dragging')
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [scale],
  )

  const api = useMemo<EditApi>(
    () => ({
      scale,
      selection,
      editing,
      select,
      startDrag,
      startEdit: (id: string) => setEditing(id),
      stopEdit: () => setEditing(null),
      commitText: (id, value) => {
        changeContent((c) => {
          if (id.startsWith('x_')) {
            const ex = c.extras?.find((e) => e.id === id)
            if (ex) ex.text = value
          } else if (id === 'features') c.texts.features = value.split('\n').map((s) => s.trim()).filter(Boolean)
          else c.texts[id as 'title'] = value
        })
        setEditing(null)
      },
      onDropZone: async () => {
        const files = await pickFile()
        if (files[0]) importImage(files[0])
      },
    }),
    [scale, selection, editing, startDrag],
  )

  // عجلة الفأرة: تكبير المشهد أو المنتج المحدد
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let began = false
    const onWheel = (e: WheelEvent) => {
      const st = useEditor.getState()
      const sel = st.selection
      if (!sel || (sel.kind !== 'scene' && sel.kind !== 'product')) return
      e.preventDefault()
      const k = Math.exp(-e.deltaY * 0.0015)
      if (!began) {
        beginLive()
        began = true
      }
      clearTimeout(timer)
      timer = setTimeout(() => (began = false), 400)
      live((d) => {
        if (sel.kind === 'scene' && d.content.scene) {
          const info = assetInfoSync(d.content.scene.assetId)
          if (!info) return
          const p = d.content.scene.place ?? autoPlacement(info.w, info.h)
          const h = (p.w * info.h) / info.w
          const cx = p.x + p.w / 2
          const cy = p.y + h / 2
          const w = Math.max(200, p.w * k)
          d.content.scene.place = { x: cx - w / 2, y: cy - (w * info.h) / info.w / 2, w }
        }
        if (sel.kind === 'product' && d.content.product) {
          const r = productRectNow(d)
          const cut = cutoutSync(d.content.product)
          if (!r || !cut) return
          const s = r.w / cut.srcW
          const bx = r.x + (cut.crop.x + cut.crop.w / 2) * s
          const by = r.y + (cut.crop.y + cut.crop.h) * s // تكبير من القاعدة
          const w = Math.max(60, r.w * k)
          const s2 = w / cut.srcW
          d.content.product.linked = false
          d.content.product.place = { x: bx - (cut.crop.x + cut.crop.w / 2) * s2, y: by - (cut.crop.y + cut.crop.h) * s2, w }
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <main className="stage">
      <div
        ref={wrapRef}
        className={`stage-wrap ${dragOver ? 'drag-over' : ''}`}
        onPointerDown={() => select(null, false)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setDragOver(true)
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith('image/'))
          if (f) importImage(f)
        }}
      >
        <div className="stage-canvas" style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: '0 0', width: POSTER_W, height: POSTER_H }}>
            <EditCtx.Provider value={api}>
              <Poster ref={posterRef} design={design} brand={brand} partners={partners} fontsVersion={fontsVersion} placeholders="edit" />
            </EditCtx.Provider>
          </div>
        </div>
        {dragOver && (
          <div className="stage-drop-hint">
            <ImagePlus size={42} />
            <strong>أفلت الصورة هنا</strong>
            <span>سيتم تدريج الخلفية وتفريغ المنتج تلقائياً</span>
          </div>
        )}
      </div>

      <div className="stage-bottom">
        <span className="stage-hint">انقر على أي عنصر لتحديده · نقرتان لتعديل النص · اسحب لتحريكه</span>
        <div className="zoom-ctl">
          <button onClick={() => setZoom(Math.max(0.15, scale / 1.2))} title="تصغير">
            <Minus size={14} />
          </button>
          <button onClick={() => setZoom('fit')} title="ملاءمة الشاشة">
            <Maximize2 size={13} /> {Math.round(scale * 100)}%
          </button>
          <button onClick={() => setZoom(Math.min(2, scale * 1.2))} title="تكبير">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </main>
  )
}

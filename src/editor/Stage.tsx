import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eraser, ImagePlus, Maximize2, RotateCcw, Sparkles } from 'lucide-react'
import { Poster } from '../poster/Poster'
import { EditCtx, type EditApi } from '../poster/EditContext'
import {
  allPartners,
  allTemplates,
  beginLive,
  change,
  changeContent,
  emptyTemplate,
  findTemplate,
  live,
  restoreDemo,
  select,
  setEditing,
  stepTemplate,
  useEditor,
} from '../store/editor'
import type { Design, Selection, TextKey } from '../model/types'
import { POSTER_H, POSTER_W } from '../model/types'
import { assetInfoSync } from '../lib/assets'
import { cutoutSync } from '../lib/cutout'
import { autoPlacement, productSourceRect, sceneRect } from '../poster/geometry'
import { importImage, pickFile } from '../lib/importer'

/* ------------------------------------------------------------------
 * مساحة العمل: البوستر بحجمه الحقيقي مصغّراً ليناسب الشاشة
 * سحب العناصر، التحرير المباشر للنصوص، إسقاط الصور
 * ------------------------------------------------------------------ */

function productRectNow(d: Design) {
  const p = d.content.product
  if (!p) return null
  const cut = cutoutSync(p)
  if (!cut) return null
  const s = sceneRect(d.content.scene, assetInfoSync(d.content.scene?.assetId))
  return productSourceRect(p, s, cut, d.style)
}

function applyDrag(d: Design, d0: Design, sel: Selection, dx: number, dy: number, handle?: string) {
  switch (sel.kind) {
    case 'scene': {
      const sc0 = d0.content.scene
      if (!sc0) return
      const info = assetInfoSync(sc0.assetId)
      if (!info) return
      const base = sc0.place ?? autoPlacement(info.w, info.h)
      d.content.scene!.place = { x: base.x + dx, y: base.y + dy, w: base.w }
      d.isDemo = false
      return
    }
    case 'product': {
      const r = productRectNow(d0)
      if (!r || !d.content.product) return
      d.content.product.linked = false
      d.content.product.place = { x: r.x + dx, y: r.y + dy, w: r.w }
      d.isDemo = false
      return
    }
    case 'text':
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
        // مغناطيس على منتصف البوستر
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
  const userTemplates = useEditor((s) => s.userTemplates)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const wrapRef = useRef<HTMLDivElement>(null)
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

  const fit = Math.max(0.1, Math.min((box.w - 48) / POSTER_W, (box.h - 40) / POSTER_H))
  const scale = zoom === 'fit' ? fit : zoom

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
      startEdit: (key: TextKey) => setEditing(key),
      stopEdit: () => setEditing(null),
      commitText: (key, value) => {
        changeContent((c) => {
          if (key === 'features') c.texts.features = value.split('\n').map((s) => s.trim()).filter(Boolean)
          else c.texts[key] = value
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
          d.isDemo = false
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
          d.isDemo = false
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const list = allTemplates({ userTemplates })
  const idx = list.findIndex((t) => t.id === design.templateId)
  const tpl = findTemplate({ userTemplates }, design.templateId)

  return (
    <main className="stage">
      <div className="stage-top">
        <button className="stage-nav" onClick={() => stepTemplate(-1)} title="القالب السابق (→)">
          <ChevronRight size={18} />
        </button>
        <div className="stage-title">
          <strong>{tpl?.name ?? 'قالب مخصص'}</strong>
          <span>
            {tpl?.nameEn ?? 'Custom'} · {idx >= 0 ? `${idx + 1} / ${list.length}` : '—'}
          </span>
        </div>
        <button className="stage-nav" onClick={() => stepTemplate(1)} title="القالب التالي (←)">
          <ChevronLeft size={18} />
        </button>
      </div>

      <div
        ref={wrapRef}
        className={`stage-wrap ${dragOver ? 'drag-over' : ''}`}
        onPointerDown={() => select(null)}
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
              <Poster design={design} brand={brand} partners={partners} fontsVersion={fontsVersion} />
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
        <button className="chip-btn accent" onClick={() => emptyTemplate()} title="إزالة المحتوى التجريبي والتعديل داخل القالب مباشرة">
          <Eraser size={16} /> تفريغ القالب
        </button>
        <button
          className="chip-btn"
          onClick={async () => {
            const f = await pickFile()
            if (f[0]) importImage(f[0])
          }}
        >
          <ImagePlus size={16} /> صورة منتج
        </button>
        {!design.isDemo && (
          <button className="chip-btn" onClick={() => restoreDemo()} title="إعادة المحتوى التجريبي للقالب">
            <Sparkles size={16} /> المحتوى التجريبي
          </button>
        )}
        <span className="flex-1" />
        <button className="chip-btn ghost" onClick={() => change((d) => void (d.style = structuredClone(tpl?.style ?? d.style)))} title="إلغاء تعديلات التصميم والعودة لنمط القالب">
          <RotateCcw size={15} />
        </button>
        <div className="zoom-ctl">
          <button onClick={() => setZoom(Math.max(0.15, scale / 1.2))}>−</button>
          <button onClick={() => setZoom('fit')} title="ملاءمة الشاشة">
            <Maximize2 size={13} /> {Math.round(scale * 100)}%
          </button>
          <button onClick={() => setZoom(Math.min(2, scale * 1.2))}>+</button>
        </div>
      </div>
    </main>
  )
}

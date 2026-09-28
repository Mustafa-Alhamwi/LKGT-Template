import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Grid3x3, ImagePlus, Magnet, Maximize2, Minus, Plus, ScanLine } from 'lucide-react'
import { Poster } from '../poster/Poster'
import { EditCtx, type EditApi } from '../poster/EditContext'
import { addSlide, allPartners, beginLive, changeContent, live, select, selectMany, setEditing, setPrefs, useEditor } from '../store/editor'
import { bridge, type Box } from '../lib/bridge'
import type { Selection } from '../model/types'
import { canvasOf } from '../model/types'
import { assetInfoSync } from '../lib/assets'
import { cutoutSync } from '../lib/cutout'
import { autoPlacement, productRectOf } from '../poster/geometry'
import { importImage, pickFile } from '../lib/importer'
import { addImageFile } from '../store/objects'
import { applyHandle, applyMove, eidOfSel, isLocked, isMovable, moverKey, sameSel, selOfEid } from './moves'
import { Filmstrip } from './Filmstrip'
import { LibraryRail } from './Library'

/* ------------------------------------------------------------------
 * مساحة العمل: البوستر بحجمه الحقيقي مصغّراً ليناسب الشاشة
 * سحب العناصر مع خطوط إرشاد ذكية، تحديد متعدد (Shift أو مربع)،
 * مقابض تحجيم وتدوير، تحرير مباشر للنصوص، إسقاط الصور
 * ------------------------------------------------------------------ */

const MARGIN = 60

interface Snapped {
  dx: number
  dy: number
  vx: number[]
  hy: number[]
}

function union(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map((b) => b.x))
  const y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.w))
  const y1 = Math.max(...boxes.map((b) => b.y + b.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function snapAxis(edges: number[], cands: number[], thr: number): { delta: number; lines: number[] } {
  let best = Infinity
  for (const e of edges) for (const c of cands) if (Math.abs(c - e) < Math.abs(best)) best = c - e
  if (Math.abs(best) > thr) return { delta: 0, lines: [] }
  const lines: number[] = []
  for (const e of edges) for (const c of cands) if (Math.abs(c - (e + best)) < 0.6 && !lines.includes(c)) lines.push(c)
  return { delta: best, lines }
}

function snapMove(box: Box, others: Box[], w: number, h: number, dx: number, dy: number, thr: number): Snapped {
  const cx: number[] = [0, w / 2, w, MARGIN, w - MARGIN]
  const cy: number[] = [0, h / 2, h, MARGIN, h - MARGIN]
  for (const o of others) {
    cx.push(o.x, o.x + o.w / 2, o.x + o.w)
    cy.push(o.y, o.y + o.h / 2, o.y + o.h)
  }
  const nx = box.x + dx
  const ny = box.y + dy
  const sx = snapAxis([nx, nx + box.w / 2, nx + box.w], cx, thr)
  const sy = snapAxis([ny, ny + box.h / 2, ny + box.h], cy, thr)
  return { dx: dx + sx.delta, dy: dy + sy.delta, vx: sx.lines, hy: sy.lines }
}

export function Stage() {
  const design = useEditor((s) => s.design)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const selection = useEditor((s) => s.selection)
  const multi = useEditor((s) => s.multi)
  const editing = useEditor((s) => s.editing)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const prefs = useEditor((s) => s.prefs)
  const slideCount = useEditor((s) => s.slides.length)
  const libOpen = useEditor((s) => !!s.library_)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const wrapRef = useRef<HTMLDivElement>(null)
  const posterRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 800, h: 900 })
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [dragOver, setDragOver] = useState(false)
  const [guides, setGuides] = useState<{ vx: number[]; hy: number[] }>({ vx: [], hy: [] })
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [multiBoxes, setMultiBoxes] = useState<Box[]>([])

  const cv = canvasOf(design)
  const POSTER_W = cv.w
  const POSTER_H = cv.h

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = Math.max(0.05, Math.min((box.w - 56) / POSTER_W, (box.h - 44) / POSTER_H))
  const scale = zoom === 'fit' ? fit : zoom

  useEffect(() => {
    bridge.poster = posterRef.current
    bridge.scale = scale
    return () => {
      bridge.poster = null
    }
  }, [scale])

  /* مربعات التحديد المتعدد */
  useLayoutEffect(() => {
    if (multi.length < 2) {
      setMultiBoxes((b) => (b.length ? [] : b))
      return
    }
    bridge.poster = posterRef.current
    bridge.scale = scale
    const boxes: Box[] = []
    for (const m of multi) {
      const eid = eidOfSel(m, design)
      const b = eid ? bridge.boxOf(eid) : null
      if (b) boxes.push(b)
    }
    setMultiBoxes(boxes)
  }, [multi, design, scale])

  const pointerPoster = (e: { clientX: number; clientY: number }) => {
    const r = posterRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const startDrag = useCallback<EditApi['startDrag']>(
    (sel, e, extra) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const st0 = useEditor.getState()
      if (st0.editing) return
      const additive = e.shiftKey || e.ctrlKey || e.metaKey
      if (additive && !extra?.handle) {
        select(sel, true, true)
        return
      }
      if (!extra?.handle) select(sel)
      const st = useEditor.getState()
      const d0 = st.design
      if (isLocked(d0, sel)) return
      if (!isMovable(sel) && !extra?.handle) return
      if (sel.kind === 'scene' && !d0.content.scene) return
      // العناصر المتحركة: كل التحديد المتعدد أو العنصر وحده
      const group = !extra?.handle && st.multi.length > 1 && st.multi.some((x) => sameSel(x, sel)) ? st.multi : [sel]
      const seen = new Set<string>()
      const movers = group.filter((g) => {
        if (isLocked(d0, g) || !isMovable(g)) return false
        const k = moverKey(g, d0)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      const sx = e.clientX
      const sy = e.clientY
      const p0 = pointerPoster(e)
      let moved = false
      // مركز العنصر (للتدوير)
      let center: { cx: number; cy: number } | undefined
      if (extra?.handle === 'rot' && posterRef.current) {
        bridge.poster = posterRef.current
        bridge.scale = scale
        const eid = eidOfSel(sel, d0)
        const b = eid ? bridge.boxOf(eid) : null
        if (b) center = { cx: b.x + b.w / 2, cy: b.y + b.h / 2 }
      }

      // أهداف الالتصاق
      let snap: { box: Box; others: Box[] } | null = null
      if (!extra?.handle && st.prefs.guides && posterRef.current) {
        bridge.poster = posterRef.current
        bridge.scale = scale
        const mine = new Set(group.map((g) => eidOfSel(g, d0)).filter(Boolean) as string[])
        const all = bridge.all()
        const moving = all.filter((a) => mine.has(a.eid)).map((a) => a.box)
        if (moving.length) {
          snap = { box: union(moving), others: all.filter((a) => !mine.has(a.eid) && a.box.w > 2 && a.box.h > 2).map((a) => a.box) }
        }
      }

      const onMove = (ev: PointerEvent) => {
        let dx = (ev.clientX - sx) / scale
        let dy = (ev.clientY - sy) / scale
        if (!moved && Math.hypot(dx, dy) < 3 / scale) return
        if (!extra?.handle && ev.shiftKey && movers.length) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }
        if (!moved) {
          moved = true
          beginLive()
          document.body.classList.add('is-dragging')
        }
        if (extra?.handle) {
          const p = pointerPoster(ev)
          live((d) => applyHandle(d, d0, sel, extra.handle!, dx, dy, { x0: p0.x, y0: p0.y, x: p.x, y: p.y, ...center }, { shift: ev.shiftKey, alt: ev.altKey }))
          return
        }
        if (snap && !ev.altKey) {
          const r = snapMove(snap.box, snap.others, POSTER_W, POSTER_H, dx, dy, 7 / scale)
          if (!(ev.shiftKey && dx === 0)) dx = r.dx
          if (!(ev.shiftKey && dy === 0)) dy = r.dy
          setGuides({ vx: r.vx, hy: r.hy })
        } else setGuides({ vx: [], hy: [] })
        live((d) => {
          for (const m of movers) applyMove(d, d0, m, dx, dy)
        })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.classList.remove('is-dragging')
        setGuides({ vx: [], hy: [] })
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, POSTER_W, POSTER_H],
  )

  /* التحديد بالمربع (Marquee) عند السحب على الخلفية */
  const startMarquee = (e: React.PointerEvent) => {
    if (e.button !== 0 || !posterRef.current) return
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    const p0 = pointerPoster(e)
    const cur = useEditor.getState()
    const base = additive ? (cur.multi.length ? cur.multi : cur.selection ? [cur.selection] : []) : []
    let active = false
    let rect: Box = { x: p0.x, y: p0.y, w: 0, h: 0 }
    const pick = (): Selection[] => {
      bridge.poster = posterRef.current
      bridge.scale = scale
      const d = useEditor.getState().design
      const out: Selection[] = []
      for (const a of bridge.all()) {
        if (['logo', 'partner', 'contact'].includes(a.eid)) continue
        const b = a.box
        if (b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y) {
          const s = selOfEid(a.eid)
          if (s && !isLocked(d, s)) out.push(s)
        }
      }
      return out
    }
    const onMove = (ev: PointerEvent) => {
      const p = pointerPoster(ev)
      if (!active && Math.hypot(p.x - p0.x, p.y - p0.y) * scale < 5) return
      active = true
      rect = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) }
      setMarquee(rect)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setMarquee(null)
      if (!active) {
        if (!additive) select(null, false)
        return
      }
      const picked = pick()
      const merged = [...base]
      for (const s of picked) if (!merged.some((x) => sameSel(x, s))) merged.push(s)
      if (merged.length) selectMany(merged)
      else select(null, false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const api = useMemo<EditApi>(
    () => ({
      scale,
      selection: multi.length > 1 ? null : selection,
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
    [scale, selection, multi, editing, startDrag],
  )

  // عجلة الفأرة: تكبير المشهد أو المنتج المحدد (Ctrl = تكبير مساحة العمل)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let began = false
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom((z) => {
          const cur = z === 'fit' ? bridge.scale : z
          return Math.max(0.1, Math.min(3, cur * Math.exp(-e.deltaY * 0.0022)))
        })
        return
      }
      const st = useEditor.getState()
      const sel = st.selection
      if (!sel || (sel.kind !== 'scene' && sel.kind !== 'product') || isLocked(st.design, sel)) return
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
          const p = d.content.scene.place ?? autoPlacement(info.w, info.h, canvasOf(d))
          const h = (p.w * info.h) / info.w
          const cx = p.x + p.w / 2
          const cy = p.y + h / 2
          const w = Math.max(200, p.w * k)
          d.content.scene.place = { x: cx - w / 2, y: cy - (w * info.h) / info.w / 2, w }
        }
        if (sel.kind === 'product' && d.content.product) {
          const r = productRectOf(d)
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

  const safeTop = cv.safeTop ?? 0
  const safeBottom = cv.safeBottom ?? 0
  const gridStep = 60

  return (
    <main className="stage">
      <div className={`stage-main ${libOpen ? 'lib-open' : ''}`}>
        <LibraryRail />
        <div
          ref={wrapRef}
          className={`stage-wrap ${dragOver ? 'drag-over' : ''}`}
          onPointerDown={startMarquee}
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
            const files = Array.from(e.dataTransfer.files).filter((x) => x.type.startsWith('image/'))
            if (!files.length) return
            // الصورة الأولى تصبح خلفية/منتج التصميم إن لم يكن فيه صورة، وإلا تُضاف كعنصر
            const cur = useEditor.getState().design.content
            if (!cur.scene && !cur.product) importImage(files[0])
            else files.forEach((f) => addImageFile(f, { cut: e.altKey }))
          }}
        >
          <div className="stage-canvas" style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
            <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: '0 0', width: POSTER_W, height: POSTER_H }}>
              <EditCtx.Provider value={api}>
                <Poster ref={posterRef} design={design} brand={brand} partners={partners} fontsVersion={fontsVersion} placeholders="edit" />
              </EditCtx.Provider>
              {/* طبقة الأدلة */}
              <div className="ov-layer" style={{ width: POSTER_W, height: POSTER_H }}>
                {prefs.showGrid && (
                  <div
                    className="ov-grid"
                    style={{
                      backgroundImage: `linear-gradient(rgba(255,46,58,0.28) ${1 / scale}px, transparent ${1 / scale}px), linear-gradient(90deg, rgba(255,46,58,0.28) ${1 / scale}px, transparent ${1 / scale}px)`,
                      backgroundSize: `${gridStep}px ${gridStep}px`,
                    }}
                  />
                )}
                {prefs.showSafe && (
                  <>
                    <div className="ov-margin" style={{ inset: MARGIN, borderWidth: 2 / scale }} />
                    {safeTop > 0 && <div className="ov-unsafe" style={{ left: 0, right: 0, top: 0, height: safeTop }} />}
                    {safeBottom > 0 && <div className="ov-unsafe" style={{ left: 0, right: 0, bottom: 0, height: safeBottom }} />}
                  </>
                )}
                {guides.vx.map((x) => (
                  <i key={`v${x}`} className="gl gl-v" style={{ left: x, width: 1.5 / scale }} />
                ))}
                {guides.hy.map((y) => (
                  <i key={`h${y}`} className="gl gl-h" style={{ top: y, height: 1.5 / scale }} />
                ))}
                {multiBoxes.map((b, i) => (
                  <div key={i} className="ov-multi" style={{ left: b.x - 6, top: b.y - 6, width: b.w + 12, height: b.h + 12, borderWidth: 3 / scale }} />
                ))}
                {multiBoxes.length > 1 &&
                  (() => {
                    const u = union(multiBoxes)
                    return <div className="ov-multi-all" style={{ left: u.x - 14, top: u.y - 14, width: u.w + 28, height: u.h + 28, borderWidth: 2 / scale }} />
                  })()}
                {marquee && <div className="ov-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, borderWidth: 2 / scale }} />}
              </div>
            </div>
          </div>
          {dragOver && (
            <div className="stage-drop-hint">
              <ImagePlus size={42} />
              <strong>أفلت الصورة هنا</strong>
              <span>الصورة الأولى تصبح خلفية التصميم وتُفرَّغ تلقائياً — والباقي يُضاف كعناصر (Alt = مع تفريغ)</span>
            </div>
          )}
        </div>
      </div>

      {slideCount > 1 && <Filmstrip />}

      <div className="stage-bottom">
        <span className="stage-hint">
          {multi.length > 1 ? `${multi.length} عناصر محددة — اسحبها معاً أو استخدم أدوات المحاذاة` : 'انقر لتحديد عنصر · Shift للتحديد المتعدد · اسحب على الخلفية للتحديد بمربع · نقرتان لتعديل النص'}
        </span>
        <div className="stage-tools">
          {slideCount === 1 && (
            <button className="chip-btn" onClick={() => addSlide('blank')} title="إضافة شريحة (كاروسيل)">
              <Plus size={14} /> شريحة
            </button>
          )}
          <button className={`ibtn sm ${prefs.guides ? 'on' : ''}`} onClick={() => setPrefs({ guides: !prefs.guides })} title="الالتصاق بخطوط الإرشاد الذكية">
            <Magnet size={16} />
          </button>
          <button className={`ibtn sm ${prefs.showGrid ? 'on' : ''}`} onClick={() => setPrefs({ showGrid: !prefs.showGrid })} title="شبكة">
            <Grid3x3 size={16} />
          </button>
          <button className={`ibtn sm ${prefs.showSafe ? 'on' : ''}`} onClick={() => setPrefs({ showSafe: !prefs.showSafe })} title="الهوامش والمناطق الآمنة">
            <ScanLine size={16} />
          </button>
          <div className="zoom-ctl">
            <button onClick={() => setZoom(Math.max(0.1, scale / 1.2))} title="تصغير">
              <Minus size={14} />
            </button>
            <button onClick={() => setZoom('fit')} title="ملاءمة الشاشة">
              <Maximize2 size={13} /> {Math.round(scale * 100)}%
            </button>
            <button onClick={() => setZoom(Math.min(3, scale * 1.2))} title="تكبير">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

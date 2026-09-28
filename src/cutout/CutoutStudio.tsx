import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BoxSelect, Brush, Check, Contrast, Hand, Lasso, Maximize2, Minus, MousePointerClick, Plus, Redo2, RotateCcw, Sparkles, Undo2, Wand2, X } from 'lucide-react'
import { Btn, Chips, Group, IconBtn, Slider, Switch } from '../ui/kit'
import { changeContent, setTask, toast, useEditor } from '../store/editor'
import { getAssetBlob, putAsset, useAsset } from '../lib/assets'
import { getCutout } from '../lib/cutout'
import { removeBackgroundMask } from '../lib/bgRemoval'
import { newProduct } from '../lib/importer'
import { backdropCss } from '../poster/Backdrop'
import { DEFAULT_CLEANUP } from '../model/demo'
import type { MaskCleanup, ProductContent } from '../model/types'
import {
  applyPatch,
  blurMask,
  diffPatch,
  edgeMap,
  growMask,
  objectAt,
  polyMask,
  rectMask,
  smartRegion,
  wandRegion,
  type Mask,
  type Patch,
} from './ops'
import './studio.css'

type Tool = 'smart' | 'wand' | 'brush' | 'lasso' | 'rect' | 'hand'
type Mode = 'add' | 'sub'
type ViewBg = 'check' | 'white' | 'black' | 'red' | 'template'
type ViewMode = 'result' | 'overlay' | 'mask'

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode; tip: string }[] = [
  { id: 'smart', label: 'تحديد ذكي', key: 'S', icon: <MousePointerClick size={20} />, tip: 'انقر على أي جسم: يحدده تلقائياً بحدوده (احتفظ به أو احذفه)' },
  { id: 'wand', label: 'عصا سحرية', key: 'W', icon: <Wand2 size={20} />, tip: 'يحدد المساحة المشابهة لللون المنقور' },
  { id: 'brush', label: 'فرشاة', key: 'B', icon: <Brush size={20} />, tip: 'ارسم لإضافة أو مسح أجزاء' },
  { id: 'lasso', label: 'لاسو', key: 'L', icon: <Lasso size={20} />, tip: 'ارسم حول المنطقة بحرية' },
  { id: 'rect', label: 'مستطيل', key: 'M', icon: <BoxSelect size={20} />, tip: 'حدد مستطيلاً' },
  { id: 'hand', label: 'تحريك', key: 'H', icon: <Hand size={20} />, tip: 'حرّك الصورة (أو Space + سحب)' },
]

interface Src {
  w: number
  h: number
  rgba: Uint8ClampedArray
}

const MAX_HISTORY = 60

export default function CutoutStudio() {
  const product0 = useEditor((s) => s.design.content.product)
  const scene = useEditor((s) => s.design.content.scene)
  const backdrop = useEditor((s) => s.design.style.backdrop)
  const quality = useEditor((s) => s.removalQuality)
  const sourceId = product0?.sourceAssetId ?? scene?.assetId ?? null
  const srcInfo = useAsset(sourceId)

  // ---- بيانات العمل (refs لأنها كبيرة)
  const srcRef = useRef<Src | null>(null)
  const baseRef = useRef<Mask | null>(null)
  const addRef = useRef<Mask | null>(null)
  const eraseRef = useRef<Mask | null>(null)
  const finalRef = useRef<Mask | null>(null)
  const undoRef = useRef<Patch[]>([])
  const redoRef = useRef<Patch[]>([])
  const labelVer = useRef(0)
  const edgesRef = useRef<Mask | null>(null)

  const cv = useRef<HTMLCanvasElement>(null)
  const ov = useRef<HTMLCanvasElement>(null)
  const view = useRef<HTMLDivElement>(null)

  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('smart')
  const [mode, setMode] = useState<Mode>('add')
  const [tol, setTol] = useState(28)
  const [contiguous, setContiguous] = useState(true)
  const [brush, setBrush] = useState(46)
  const [hard, setHard] = useState(0.7)
  const [feather, setFeather] = useState(0)
  const [grow, setGrow] = useState(0)
  const [viewBg, setViewBg] = useState<ViewBg>('check')
  const [viewMode, setViewMode] = useState<ViewMode>('result')
  const [ghost, setGhost] = useState(0)
  const [z, setZ] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [, bump] = useState(0)
  const [cleanup, setCleanup] = useState<MaskCleanup>(product0?.cleanup ?? { ...DEFAULT_CLEANUP })
  const [maskId, setMaskId] = useState<string | null>(product0?.maskAssetId ?? null)
  const [emptyBase, setEmptyBase] = useState<boolean>(!!product0?.emptyBase || !product0)
  const [dirty, setDirty] = useState(false)

  const modeRef = useRef(mode)
  modeRef.current = mode
  const st = useRef({ tool, tol, contiguous, brush, hard, feather, grow, z, pan, viewMode, viewBg })
  st.current = { tool, tol, contiguous, brush, hard, feather, grow, z, pan, viewMode, viewBg }

  const hasAiBase = !!maskId && !emptyBase

  /* ------------------------------ تحميل ------------------------------ */

  const loadBase = useCallback(async (prod: ProductContent | null, w: number, h: number): Promise<Mask> => {
    const out = new Uint8ClampedArray(w * h)
    if (!prod) return out
    const cut = await getCutout({ ...prod, paintAssetId: null })
    if (!cut) return out
    const bmp = await createImageBitmap(await (await fetch(cut.url)).blob())
    const c = new OffscreenCanvas(w, h)
    const x = c.getContext('2d', { willReadFrequently: true })!
    x.drawImage(bmp, cut.crop.x, cut.crop.y)
    bmp.close()
    const d = x.getImageData(0, 0, w, h).data
    for (let i = 0; i < w * h; i++) out[i] = d[i * 4 + 3]
    return out
  }, [])

  const baseProduct = useCallback(
    (cl: MaskCleanup, mid: string | null, empty: boolean): ProductContent | null => {
      if (!sourceId) return null
      return { ...(product0 ?? newProduct(sourceId, mid, true)), sourceAssetId: sourceId, maskAssetId: mid, paintAssetId: null, cleanup: cl, emptyBase: empty }
    },
    [product0, sourceId],
  )

  const recompute = useCallback(() => {
    const s = srcRef.current
    const base = baseRef.current
    const add = addRef.current
    const erase = eraseRef.current
    let f = finalRef.current
    if (!s || !base || !add || !erase) return
    if (!f) f = finalRef.current = new Uint8ClampedArray(s.w * s.h)
    for (let i = 0; i < f.length; i++) {
      const a = base[i] > add[i] ? base[i] : add[i]
      f[i] = a * (1 - erase[i] / 255)
    }
    labelVer.current++
  }, [])

  const render = useCallback(
    (rect?: { x: number; y: number; w: number; h: number }) => {
      const s = srcRef.current
      const f = finalRef.current
      const c = cv.current
      if (!s || !f || !c) return
      const ctx = c.getContext('2d')!
      const r = rect ?? { x: 0, y: 0, w: s.w, h: s.h }
      const x0 = Math.max(0, Math.floor(r.x))
      const y0 = Math.max(0, Math.floor(r.y))
      const x1 = Math.min(s.w, Math.ceil(r.x + r.w))
      const y1 = Math.min(s.h, Math.ceil(r.y + r.h))
      const w = x1 - x0
      const h = y1 - y0
      if (w <= 0 || h <= 0) return
      const img = ctx.createImageData(w, h)
      const mode = st.current.viewMode
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const p = (y0 + j) * s.w + (x0 + i)
          const q = (j * w + i) * 4
          const a = f[p]
          const R = s.rgba[p * 4]
          const G = s.rgba[p * 4 + 1]
          const B = s.rgba[p * 4 + 2]
          if (mode === 'result') {
            img.data[q] = R
            img.data[q + 1] = G
            img.data[q + 2] = B
            img.data[q + 3] = a
          } else if (mode === 'mask') {
            img.data[q] = img.data[q + 1] = img.data[q + 2] = a
            img.data[q + 3] = 255
          } else {
            const t = (1 - a / 255) * 0.62
            img.data[q] = R * (1 - t) + 235 * t
            img.data[q + 1] = G * (1 - t) + 30 * t
            img.data[q + 2] = B * (1 - t) + 50 * t
            img.data[q + 3] = 255
          }
        }
      }
      ctx.putImageData(img, x0, y0)
    },
    [],
  )

  const fit = useCallback(() => {
    const el = view.current
    const s = srcRef.current
    if (!el || !s) return
    const zz = Math.min((el.clientWidth - 40) / s.w, (el.clientHeight - 40) / s.h, 1.5)
    setZ(zz)
    setPan({ x: (el.clientWidth - s.w * zz) / 2, y: (el.clientHeight - s.h * zz) / 2 })
  }, [])

  const runAi = useCallback(
    async (silent = false) => {
      if (!sourceId) return
      const blob = await getAssetBlob(sourceId)
      const s = srcRef.current
      if (!blob || !s) return
      setBusy('جارِ التفريغ بالذكاء الاصطناعي…')
      try {
        const png = await removeBackgroundMask(blob, quality, (p) => setBusy(p.phase === 'download' ? `تحميل نموذج التفريغ… ${Math.round(p.ratio * 100)}%` : 'جارِ التفريغ بالذكاء الاصطناعي…'))
        const m = await putAsset(png, 'mask')
        setMaskId(m.id)
        setEmptyBase(false)
        const prod = baseProduct(cleanup, m.id, false)
        baseRef.current = await loadBase(prod, s.w, s.h)
        recompute()
        render()
        bump((n) => n + 1)
        if (!silent) toast('تم التفريغ الذكي — عدّل بالأدوات كما تشاء', 'ok')
      } catch (e) {
        console.error(e)
        toast('تعذّر التفريغ الذكي (تحقق من الاتصال لتحميل النموذج أول مرة). يمكنك التحديد يدوياً بالأدوات.', 'error', 7000)
      } finally {
        setBusy(null)
      }
    },
    [sourceId, quality, cleanup, baseProduct, loadBase, recompute, render],
  )

  // فتح الاستوديو
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!sourceId || !srcInfo) return
      if (srcRef.current) return
      const blob = await getAssetBlob(sourceId)
      if (!blob || !alive) return
      const bmp = await createImageBitmap(blob)
      const w = bmp.width
      const h = bmp.height
      const oc = new OffscreenCanvas(w, h)
      const ctx = oc.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      const rgba = ctx.getImageData(0, 0, w, h).data
      srcRef.current = { w, h, rgba }
      const add = new Uint8ClampedArray(w * h)
      const erase = new Uint8ClampedArray(w * h)
      if (product0?.paintAssetId) {
        const pb = await getAssetBlob(product0.paintAssetId)
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
      addRef.current = add
      eraseRef.current = erase
      baseRef.current = product0 ? await loadBase({ ...product0, paintAssetId: null }, w, h) : new Uint8ClampedArray(w * h)
      if (!alive) return
      const c = cv.current!
      c.width = w
      c.height = h
      const o = ov.current!
      o.width = w
      o.height = h
      recompute()
      render()
      fit()
      setReady(true)
      if (!product0) runAi(true)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcInfo])

  useEffect(() => {
    if (ready) render()
  }, [viewMode, ready, render])

  /* ------------------------------ سجل ------------------------------ */

  const commit = useCallback(
    (before: { add: Mask; erase: Mask }) => {
      const s = srcRef.current!
      const patch = diffPatch(s.w, s.h, before.add, before.erase, addRef.current!, eraseRef.current!)
      if (!patch) return
      undoRef.current.push(patch)
      if (undoRef.current.length > MAX_HISTORY) undoRef.current.shift()
      redoRef.current = []
      setDirty(true)
      bump((n) => n + 1)
    },
    [],
  )

  const snapshot = () => ({ add: addRef.current!.slice(), erase: eraseRef.current!.slice() })

  const undo = useCallback(() => {
    const p = undoRef.current.pop()
    const s = srcRef.current
    if (!p || !s) return
    applyPatch(p, s.w, addRef.current!, eraseRef.current!, false)
    redoRef.current.push(p)
    recompute()
    render()
    bump((n) => n + 1)
  }, [recompute, render])

  const redo = useCallback(() => {
    const p = redoRef.current.pop()
    const s = srcRef.current
    if (!p || !s) return
    applyPatch(p, s.w, addRef.current!, eraseRef.current!, true)
    undoRef.current.push(p)
    recompute()
    render()
    bump((n) => n + 1)
  }, [recompute, render])

  /* ------------------------------ تطبيق التحديد ------------------------------ */

  const applyMask = useCallback(
    (m: Mask, md: Mode) => {
      const s = srcRef.current!
      const add = addRef.current!
      const erase = eraseRef.current!
      const before = snapshot()
      let mm = m
      if (st.current.grow) mm = growMask(mm, s.w, s.h, st.current.grow)
      if (st.current.feather > 0) mm = blurMask(mm, s.w, s.h, st.current.feather)
      for (let i = 0; i < mm.length; i++) {
        const v = mm[i]
        if (!v) continue
        if (md === 'add') {
          if (v > add[i]) add[i] = v
          erase[i] = erase[i] * (1 - v / 255)
        } else {
          if (v > erase[i]) erase[i] = v
          add[i] = add[i] * (1 - v / 255)
        }
      }
      commit(before)
      recompute()
      render()
    },
    [commit, recompute, render],
  )

  const invert = useCallback(() => {
    const s = srcRef.current
    if (!s) return
    const add = addRef.current!
    const erase = eraseRef.current!
    const base = baseRef.current!
    const f = finalRef.current!
    const before = snapshot()
    for (let i = 0; i < f.length; i++) {
      const T = 255 - f[i]
      add[i] = T
      erase[i] = T < base[i] ? (1 - T / Math.max(1, base[i])) * 255 : 0
    }
    commit(before)
    recompute()
    render()
  }, [commit, recompute, render])

  const clearEdits = useCallback(() => {
    const before = snapshot()
    addRef.current!.fill(0)
    eraseRef.current!.fill(0)
    commit(before)
    recompute()
    render()
  }, [commit, recompute, render])

  /* ------------------------------ مؤشر / رسم ------------------------------ */

  const toImg = (e: { clientX: number; clientY: number }) => {
    const c = cv.current!
    const r = c.getBoundingClientRect()
    const s = srcRef.current!
    return { x: ((e.clientX - r.left) / r.width) * s.w, y: ((e.clientY - r.top) / r.height) * s.h }
  }

  const drag = useRef<null | { kind: 'pan' | 'brush' | 'lasso' | 'rect'; sx: number; sy: number; ox: number; oy: number; pts: { x: number; y: number }[]; before?: { add: Mask; erase: Mask }; mode: Mode; last?: { x: number; y: number } }>(null)
  const spaceDown = useRef(false)
  const hoverRegion = useRef<{ key: string; mask: Mask } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearOverlay = () => {
    const o = ov.current
    if (o) o.getContext('2d')!.clearRect(0, 0, o.width, o.height)
  }

  const paintOverlayMask = (m: Mask, md: Mode) => {
    const o = ov.current
    const s = srcRef.current
    if (!o || !s) return
    const ctx = o.getContext('2d')!
    const img = ctx.createImageData(s.w, s.h)
    const col = md === 'add' ? [30, 150, 255] : [255, 50, 60]
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue
      img.data[i * 4] = col[0]
      img.data[i * 4 + 1] = col[1]
      img.data[i * 4 + 2] = col[2]
      img.data[i * 4 + 3] = m[i] * 0.5
    }
    ctx.putImageData(img, 0, 0)
  }

  const regionAt = useCallback((x: number, y: number, md: Mode): Mask | null => {
    const s = srcRef.current
    const f = finalRef.current
    if (!s || !f) return null
    const ix = Math.max(0, Math.min(s.w - 1, Math.floor(x)))
    const iy = Math.max(0, Math.min(s.h - 1, Math.floor(y)))
    const key = `${ix},${iy},${md},${st.current.tol},${labelVer.current},${st.current.tool}`
    if (hoverRegion.current?.key === key) return hoverRegion.current.mask
    let m: Mask
    if (st.current.tool === 'wand') m = wandRegion(s.rgba, s.w, s.h, ix, iy, st.current.tol, st.current.contiguous)
    else if (f[iy * s.w + ix] >= 128) m = objectAt(f, (edgesRef.current ??= edgeMap(s.rgba, s.w, s.h)), s.w, s.h, ix, iy, st.current.tol)
    else m = smartRegion(s.rgba, s.w, s.h, ix, iy, st.current.tol)
    hoverRegion.current = { key, mask: m }
    return m
  }, [])

  const brushDab = (x: number, y: number, md: Mode) => {
    const s = srcRef.current!
    const add = addRef.current!
    const erase = eraseRef.current!
    const r = st.current.brush
    const hd = st.current.hard
    const x0 = Math.max(0, Math.floor(x - r))
    const y0 = Math.max(0, Math.floor(y - r))
    const x1 = Math.min(s.w - 1, Math.ceil(x + r))
    const y1 = Math.min(s.h - 1, Math.ceil(y + r))
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const d = Math.hypot(xx - x, yy - y) / r
        if (d > 1) continue
        const k = d < hd ? 1 : 1 - (d - hd) / Math.max(0.001, 1 - hd)
        const v = k * 255
        const i = yy * s.w + xx
        if (md === 'add') {
          if (v > add[i]) add[i] = v
          erase[i] = erase[i] * (1 - k)
        } else {
          if (v > erase[i]) erase[i] = v
          add[i] = add[i] * (1 - k)
        }
      }
    }
    recompute()
    render({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
  }

  const effMode = (e: { altKey: boolean }): Mode => (e.altKey ? (modeRef.current === 'add' ? 'sub' : 'add') : modeRef.current)

  const onDown = (e: React.PointerEvent) => {
    if (!ready || busy) return
    const s = srcRef.current!
    const isPan = e.button === 1 || tool === 'hand' || spaceDown.current
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (isPan) {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, pts: [], mode }
      return
    }
    if (e.button !== 0) return
    const p = toImg(e)
    const md = effMode(e)
    if (tool === 'smart' || tool === 'wand') {
      clearTimeout(hoverTimer.current)
      const m = regionAt(p.x, p.y, md)
      if (m) applyMask(m.slice() as Mask, md)
      hoverRegion.current = null
      clearOverlay()
      return
    }
    if (tool === 'brush') {
      drag.current = { kind: 'brush', sx: 0, sy: 0, ox: 0, oy: 0, pts: [], before: snapshot(), mode: md, last: p }
      brushDab(p.x, p.y, md)
      return
    }
    if (tool === 'lasso') {
      drag.current = { kind: 'lasso', sx: 0, sy: 0, ox: 0, oy: 0, pts: [p], mode: md }
      return
    }
    if (tool === 'rect') {
      drag.current = { kind: 'rect', sx: p.x, sy: p.y, ox: p.x, oy: p.y, pts: [], mode: md }
      void s
    }
  }

  const drawShape = () => {
    const d = drag.current
    const o = ov.current
    if (!d || !o) return
    const ctx = o.getContext('2d')!
    ctx.clearRect(0, 0, o.width, o.height)
    ctx.lineWidth = 2 / st.current.z
    ctx.setLineDash([8 / st.current.z, 6 / st.current.z])
    ctx.strokeStyle = d.mode === 'add' ? '#2f9bff' : '#ff3b46'
    ctx.fillStyle = d.mode === 'add' ? 'rgba(47,155,255,.18)' : 'rgba(255,59,70,.2)'
    if (d.kind === 'lasso' && d.pts.length > 1) {
      ctx.beginPath()
      ctx.moveTo(d.pts[0].x, d.pts[0].y)
      d.pts.forEach((q) => ctx.lineTo(q.x, q.y))
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    if (d.kind === 'rect') {
      ctx.beginPath()
      ctx.rect(Math.min(d.sx, d.ox), Math.min(d.sy, d.oy), Math.abs(d.ox - d.sx), Math.abs(d.oy - d.sy))
      ctx.fill()
      ctx.stroke()
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const vr = view.current!.getBoundingClientRect()
    setCursor({ x: e.clientX - vr.left, y: e.clientY - vr.top })
    const d = drag.current
    if (d) {
      if (d.kind === 'pan') {
        setPan({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy })
      } else if (d.kind === 'brush') {
        const p = toImg(e)
        const last = d.last!
        const dist = Math.hypot(p.x - last.x, p.y - last.y)
        const step = Math.max(1, st.current.brush * 0.25)
        const n = Math.ceil(dist / step)
        for (let i = 1; i <= n; i++) brushDab(last.x + ((p.x - last.x) * i) / n, last.y + ((p.y - last.y) * i) / n, d.mode)
        d.last = p
      } else if (d.kind === 'lasso') {
        d.pts.push(toImg(e))
        drawShape()
      } else if (d.kind === 'rect') {
        const p = toImg(e)
        d.ox = p.x
        d.oy = p.y
        drawShape()
      }
      return
    }
    // معاينة التحديد الذكي عند المرور
    if ((tool === 'smart' || tool === 'wand') && ready && !busy) {
      const p = toImg(e)
      const md = effMode(e)
      clearTimeout(hoverTimer.current)
      hoverTimer.current = setTimeout(() => {
        const m = regionAt(p.x, p.y, md)
        if (m) paintOverlayMask(m, md)
      }, 70)
    }
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const s = srcRef.current!
    if (d.kind === 'brush' && d.before) {
      commit(d.before)
    } else if (d.kind === 'lasso') {
      clearOverlay()
      if (d.pts.length > 2) applyMask(polyMask(d.pts, s.w, s.h), d.mode)
    } else if (d.kind === 'rect') {
      clearOverlay()
      if (Math.abs(d.ox - d.sx) > 2 && Math.abs(d.oy - d.sy) > 2) applyMask(rectMask(d.sx, d.sy, d.ox, d.oy, s.w, s.h), d.mode)
    }
  }

  // عجلة الفأرة: تكبير حول المؤشر
  useEffect(() => {
    const el = view.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const { z: z0, pan: p0 } = st.current
      const z1 = Math.max(0.05, Math.min(12, z0 * Math.exp(-e.deltaY * 0.0016)))
      setZ(z1)
      setPan({ x: mx - ((mx - p0.x) / z0) * z1, y: my - ((my - p0.y) / z0) * z1 })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* ------------------------------ الحفظ / الإغلاق ------------------------------ */

  const close = useCallback(() => {
    if (dirty && !confirm('إغلاق الاستوديو بدون تطبيق التعديلات؟')) return
    useEditor.setState({ dialog: null })
  }, [dirty])

  const apply = useCallback(async () => {
    const s = srcRef.current
    if (!s || !sourceId) return
    setTask({ label: 'جارِ تطبيق التفريغ…', progress: null })
    try {
      const add = addRef.current!
      const erase = eraseRef.current!
      let any = false
      const out = new ImageData(s.w, s.h)
      for (let i = 0; i < s.w * s.h; i++) {
        out.data[i * 4] = add[i]
        out.data[i * 4 + 1] = erase[i]
        out.data[i * 4 + 3] = 255
        if (add[i] || erase[i]) any = true
      }
      let paintId: string | null = null
      if (any) {
        const oc = new OffscreenCanvas(s.w, s.h)
        oc.getContext('2d')!.putImageData(out, 0, 0)
        paintId = (await putAsset(await oc.convertToBlob({ type: 'image/png' }), 'paint', { w: s.w, h: s.h })).id
      }
      const linked = !!scene && sourceId === scene.assetId ? (product0?.linked ?? true) : false
      changeContent((c) => {
        const base = c.product ?? newProduct(sourceId, maskId, linked)
        c.product = { ...base, sourceAssetId: sourceId, maskAssetId: maskId, paintAssetId: paintId, cleanup, emptyBase, linked, visible: true }
      })
      useEditor.setState({ dialog: null })
      toast('تم تطبيق التفريغ', 'ok')
    } finally {
      setTask(null)
    }
  }, [sourceId, scene, product0, maskId, cleanup, emptyBase])

  // تحديث القاعدة عند تغيير عتبات التنقية
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const changeCleanup = (fn: (c: MaskCleanup) => void) => {
    const next = { ...cleanup }
    fn(next)
    setCleanup(next)
    setDirty(true)
    clearTimeout(cleanupTimer.current)
    cleanupTimer.current = setTimeout(async () => {
      const s = srcRef.current
      if (!s) return
      const prod = baseProduct(next, maskId, emptyBase)
      baseRef.current = await loadBase(prod, s.w, s.h)
      recompute()
      render()
    }, 160)
  }

  /* ------------------------------ لوحة المفاتيح ------------------------------ */

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !(e.ctrlKey || e.metaKey)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.code === 'KeyZ') {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.code === 'KeyY') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.code === 'KeyI') {
        e.preventDefault()
        invert()
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        spaceDown.current = true
        return
      }
      if (e.code === 'Escape') return close()
      if (e.code === 'Enter' && mod) return void apply()
      const map: Record<string, Tool> = { KeyS: 'smart', KeyW: 'wand', KeyB: 'brush', KeyL: 'lasso', KeyM: 'rect', KeyH: 'hand' }
      if (map[e.code] && !mod) return setTool(map[e.code])
      if (e.code === 'KeyX') return setMode((m) => (m === 'add' ? 'sub' : 'add'))
      if (e.code === 'BracketLeft') return setBrush((b) => Math.max(4, b - 6))
      if (e.code === 'BracketRight') return setBrush((b) => Math.min(300, b + 6))
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up)
    }
  }, [undo, redo, invert, close, apply])

  /* ------------------------------ الواجهة ------------------------------ */

  const stageBg = useMemo<React.CSSProperties>(() => {
    switch (viewBg) {
      case 'white':
        return { background: '#fff' }
      case 'black':
        return { background: '#000' }
      case 'red':
        return { background: '#d11a24' }
      case 'template':
        return backdropCss(backdrop)
      default:
        return { background: 'repeating-conic-gradient(#b9b9c0 0 25%, #f4f4f6 0 50%) 0 0 / 24px 24px' }
    }
  }, [viewBg, backdrop])

  const s0 = srcRef.current
  const tip = TOOLS.find((t) => t.id === tool)!
  const cursorPx = tool === 'brush' ? brush * 2 * z : 0

  return (
    <div className="cs">
      <header className="cs-top">
        <strong className="cs-title">استوديو التفريغ</strong>
        <div className="cs-group">
          <IconBtn icon={<Undo2 size={18} />} title="تراجع (Ctrl+Z)" onClick={undo} disabled={!undoRef.current.length} />
          <IconBtn icon={<Redo2 size={18} />} title="إعادة (Ctrl+Y)" onClick={redo} disabled={!redoRef.current.length} />
        </div>
        <div className="cs-mode">
          <button className={mode === 'add' ? 'on add' : ''} onClick={() => setMode('add')}>
            <Plus size={15} /> إبقاء / إضافة
          </button>
          <button className={mode === 'sub' ? 'on sub' : ''} onClick={() => setMode('sub')}>
            <Minus size={15} /> حذف / طرح
          </button>
        </div>
        <span className="cs-hint">X للتبديل · اضغط Alt لعكس الوضع مؤقتاً</span>
        <span className="flex-1" />
        <div className="cs-group">
          <Chips<ViewMode>
            value={viewMode}
            options={[
              { value: 'result', label: 'النتيجة' },
              { value: 'overlay', label: 'الأحمر = محذوف' },
              { value: 'mask', label: 'القناع' },
            ]}
            onChange={setViewMode}
          />
          <select className="sel" value={viewBg} onChange={(e) => setViewBg(e.target.value as ViewBg)} title="خلفية المعاينة">
            <option value="check">مربعات شفافية</option>
            <option value="white">أبيض</option>
            <option value="black">أسود</option>
            <option value="red">أحمر</option>
            <option value="template">خلفية القالب</option>
          </select>
          <div className="zoom-ctl">
            <button onClick={() => setZ((v) => Math.max(0.05, v / 1.25))}>
              <Minus size={14} />
            </button>
            <button onClick={fit}>
              <Maximize2 size={13} /> {Math.round(z * 100)}%
            </button>
            <button onClick={() => setZ((v) => Math.min(12, v * 1.25))}>
              <Plus size={14} />
            </button>
          </div>
        </div>
        <Btn variant="ghost" icon={<X size={16} />} onClick={close}>
          إلغاء
        </Btn>
        <Btn variant="primary" icon={<Check size={16} />} onClick={apply} disabled={!ready || !!busy}>
          تطبيق
        </Btn>
      </header>

      <div className="cs-body">
        <aside className="cs-tools">
          {TOOLS.map((t) => (
            <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
              {t.icon}
              <span>{t.label}</span>
              <kbd>{t.key}</kbd>
            </button>
          ))}
          <div className="cs-tools-sep" />
          <button onClick={invert} title="عكس التحديد (Ctrl+I)">
            <Contrast size={20} />
            <span>عكس</span>
          </button>
          <button onClick={clearEdits} title="مسح كل تعديلاتي والرجوع لنتيجة الذكاء الاصطناعي">
            <RotateCcw size={20} />
            <span>تصفير</span>
          </button>
        </aside>

        <div
          ref={view}
          className={`cs-view ${tool === 'hand' ? 'hand' : ''}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => {
            setCursor(null)
            clearTimeout(hoverTimer.current)
            if (!drag.current) clearOverlay()
          }}
        >
          <div className="cs-stage" style={{ width: s0?.w ?? 0, height: s0?.h ?? 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`, ...stageBg }}>
            {ghost > 0 && srcInfo && <img className="cs-ghost" src={srcInfo.url} style={{ opacity: ghost }} alt="" draggable={false} />}
            <canvas ref={cv} className="cs-cv" />
            <canvas ref={ov} className="cs-ov" />
          </div>
          {cursor && tool === 'brush' && ready && <i className={`cs-brush ${mode}`} style={{ left: cursor.x, top: cursor.y, width: cursorPx, height: cursorPx }} />}
          {(!ready || busy) && (
            <div className="cs-busy">
              <span className="spinner" />
              <span>{busy ?? 'جارِ تحميل الصورة…'}</span>
            </div>
          )}
          <div className="cs-tip">{tip.tip}</div>
        </div>

        <aside className="cs-panel">
          <Group title={tip.label}>
            {(tool === 'smart' || tool === 'wand') && (
              <>
                <Slider label="الحساسية (Tolerance)" value={tol} min={1} max={100} onChange={setTol} />
                {tool === 'wand' && <Switch label="متجاورة فقط" checked={contiguous} onChange={setContiguous} />}
                <p className="hint">
                  {tool === 'smart'
                    ? 'مرّر المؤشر لترى الجسم الذي سيُحدَّد (أزرق = إضافة، أحمر = حذف) ثم انقر. النقر على جزء ظاهر يحدد الجسم بحدوده؛ وعلى منطقة محذوفة يستعيدها. إذا التصق جسمان زد الحساسية لفصلهما.'
                    : 'ارفع الحساسية لتشمل ألواناً أكثر تقارباً.'}
                </p>
              </>
            )}
            {tool === 'brush' && (
              <>
                <Slider label="حجم الفرشاة" value={brush} min={4} max={300} unit="px" onChange={setBrush} />
                <Slider label="صلابة الحافة" value={hard} min={0} max={1} step={0.01} onChange={setHard} />
                <p className="hint">الأقواس [ ] لتغيير الحجم.</p>
              </>
            )}
            {(tool === 'lasso' || tool === 'rect') && <p className="hint">ارسم المنطقة ثم اترك — تُضاف أو تُطرح حسب الوضع.</p>}
            {tool === 'hand' && <p className="hint">اسحب لتحريك الصورة، والعجلة للتكبير.</p>}
            {tool !== 'hand' && tool !== 'brush' && (
              <>
                <Slider label="تنعيم حافة التحديد" value={feather} min={0} max={20} unit="px" onChange={setFeather} />
                <Slider label="توسيع / تقليص" value={grow} min={-12} max={12} unit="px" onChange={setGrow} />
              </>
            )}
          </Group>

          {hasAiBase && (
            <Group title="تنقية التفريغ الذكي">
              <Slider label="عتبة الحذف" value={cleanup.low} min={0} max={250} onChange={(v) => changeCleanup((c) => void (c.low = v))} />
              <Slider label="عتبة الإظهار" value={cleanup.high} min={5} max={255} onChange={(v) => changeCleanup((c) => void (c.high = Math.max(v, c.low + 5)))} />
              <Switch label="حذف الشوائب المنفصلة" checked={cleanup.islands} onChange={(v) => changeCleanup((c) => void (c.islands = v))} />
              <Switch label="ملء الفراغات الداخلية" checked={cleanup.fillHoles} onChange={(v) => changeCleanup((c) => void (c.fillHoles = v))} />
              <Slider label="تقليص الحواف" value={cleanup.choke} min={0} max={8} unit="px" onChange={(v) => changeCleanup((c) => void (c.choke = v))} />
              <Slider label="تنعيم الشكل" value={cleanup.smooth ?? 0} min={0} max={6} unit="px" onChange={(v) => changeCleanup((c) => void (c.smooth = v))} />
              <Slider label="نعومة الحواف" value={cleanup.feather} min={0} max={6} step={0.5} unit="px" onChange={(v) => changeCleanup((c) => void (c.feather = v))} />
              <Switch label="إزالة هالة الخلفية من الحواف" checked={!!cleanup.decontaminate} onChange={(v) => changeCleanup((c) => void (c.decontaminate = v))} />
            </Group>
          )}

          <Group title="الذكاء الاصطناعي">
            <Btn small block icon={<Sparkles size={14} />} onClick={() => runAi()} disabled={!ready || !!busy}>
              {hasAiBase ? 'إعادة التفريغ الذكي' : 'تفريغ ذكي تلقائي'}
            </Btn>
            <Chips
              value={quality}
              options={[
                { value: 'small', label: 'سريع' },
                { value: 'medium', label: 'دقيق' },
              ]}
              onChange={(v) => useEditor.setState({ removalQuality: v })}
            />
            <p className="hint">التعديلات اليدوية تبقى محفوظة حتى لو أعدت التفريغ الذكي.</p>
          </Group>

          <Group title="العرض">
            <Slider label="إظهار الصورة الأصلية خلف النتيجة" value={ghost} min={0} max={0.8} step={0.01} onChange={setGhost} />
          </Group>
        </aside>
      </div>
    </div>
  )
}

import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { allPartners, syncedSlides, useEditor } from '../store/editor'
import type { EditorState } from '../store/editor'
import { renderCanvas } from './exporter'
import { prepare, checkCancel, download, type Ctl, type OnProgress, type Scope } from './exportJobs'
import { canvasOf, type Design } from '../model/types'
import { buildName, safeName, titleOf } from './naming'
import { categoryDef } from '../model/categories'

/* ------------------------------------------------------------------
 * تصدير الحركة (فيديو MP4 / GIF): نرسم كل مجموعة طبقات من التصميم مرة واحدة
 * كصورة شفافة، ثم نحرّكها بمنحنيات تسارع ونركّب الإطارات ونرمّزها.
 * ------------------------------------------------------------------ */

export type MotionPreset = 'rise' | 'pop' | 'slide' | 'fade' | 'zoom' | 'still'

export const MOTION_PRESETS: { id: MotionPreset; name: string; hint: string }[] = [
  { id: 'rise', name: 'صعود متتابع', hint: 'العناصر تصعد وتظهر بالتتابع' },
  { id: 'pop', name: 'ظهور نابض', hint: 'المنتج والنصوص تكبر بنبضة لطيفة' },
  { id: 'slide', name: 'انزلاق', hint: 'المنتج من جهة والنصوص من الجهة الأخرى' },
  { id: 'fade', name: 'تلاشٍ ناعم', hint: 'ظهور هادئ ومتتابع' },
  { id: 'zoom', name: 'تقريب سينمائي', hint: 'تقريب بطيء للخلفية مع ظهور العناصر' },
  { id: 'still', name: 'ثابت', hint: 'بلا حركة عناصر — مع تقريب خفيف جداً' },
]

const GROUPS: { id: string; layers: string[] }[] = [
  { id: 'bg', layers: ['backdrop', 'scene'] },
  { id: 'back', layers: ['decor-back', 'shape'] },
  { id: 'product', layers: ['product'] },
  { id: 'front', layers: ['decor-front'] },
  { id: 'text', layers: ['text'] },
  { id: 'top', layers: ['decor-top'] },
  { id: 'chrome', layers: ['chrome'] },
]

interface GroupCanvas {
  canvas: HTMLCanvasElement
  cx: number
  cy: number
}
export interface SlideLayers {
  w: number
  h: number
  groups: Record<string, GroupCanvas | null>
}

/* ------------------------------ الطبقات ------------------------------ */

function contentCenter(c: HTMLCanvasElement): { cx: number; cy: number } | null {
  const k = 6
  const sw = Math.max(1, Math.round(c.width / k))
  const sh = Math.max(1, Math.round(c.height / k))
  const t = document.createElement('canvas')
  t.width = sw
  t.height = sh
  const tctx = t.getContext('2d', { willReadFrequently: true })!
  tctx.drawImage(c, 0, 0, sw, sh)
  const d = tctx.getImageData(0, 0, sw, sh).data
  let x0 = sw
  let y0 = sh
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (d[(y * sw + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  return { cx: ((x0 + x1 + 1) / 2) * (c.width / sw), cy: ((y0 + y1 + 1) / 2) * (c.height / sh) }
}

export async function renderSlideLayers(d: Design, s: EditorState, scale: number, ctl: Ctl): Promise<SlideLayers> {
  const cv = canvasOf(d)
  const groups: SlideLayers['groups'] = {}
  for (const g of GROUPS) {
    checkCancel(ctl)
    const c = await renderCanvas(d, s.brand, allPartners(s), s.fontsVersion, { scale, format: 'png', layers: { include: g.layers } })
    if (g.id === 'bg') {
      groups[g.id] = { canvas: c, cx: c.width / 2, cy: c.height / 2 }
      continue
    }
    const center = contentCenter(c)
    groups[g.id] = center ? { canvas: c, ...center } : null
  }
  return { w: Math.round(cv.w * scale), h: Math.round(cv.h * scale), groups }
}

/* ------------------------------ الحركة ------------------------------ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeBack = (t: number, s = 1.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)

interface Tx {
  alpha: number
  dx: number
  dy: number
  scale: number
}

function groupTx(preset: MotionPreset, id: string, t: number, W: number, H: number, dur: number, gc: GroupCanvas): Tx {
  const tx: Tx = { alpha: 1, dx: 0, dy: 0, scale: 1 }
  if (id === 'bg') {
    const kb = preset === 'zoom' ? 0.1 : preset === 'still' ? 0.03 : 0.05
    tx.scale = 1 + kb * easeInOut(clamp01(t / dur))
    return tx
  }
  if (preset === 'still') return tx
  const rightSide = gc.cx > W / 2
  switch (preset) {
    case 'rise': {
      const st: Record<string, [number, number]> = { back: [0, 0.5], product: [0.25, 1.0], front: [0.7, 1.2], text: [0.55, 1.25], top: [1.0, 1.5], chrome: [1.1, 1.7] }
      const [a, b] = st[id] ?? [0, 0.6]
      const e = easeOut(seg(t, a, b))
      tx.alpha = e
      tx.dy = (1 - e) * H * (id === 'product' ? 0.07 : id === 'chrome' ? 0.03 : 0.045)
      if (id === 'top') tx.scale = 0.85 + 0.15 * easeBack(seg(t, a, b))
      break
    }
    case 'pop': {
      const st: Record<string, [number, number]> = { back: [0, 0.4], product: [0.2, 0.95], front: [0.7, 1.1], text: [0.5, 1.15], top: [0.9, 1.4], chrome: [1.0, 1.5] }
      const [a, b] = st[id] ?? [0, 0.6]
      const p = seg(t, a, b)
      tx.alpha = clamp01(p * 2.2)
      tx.scale = (id === 'product' ? 0.55 : id === 'chrome' ? 1 : 0.86) + (id === 'chrome' ? 0 : id === 'product' ? 0.45 : 0.14) * easeBack(p, id === 'product' ? 1.9 : 1.3)
      if (id === 'chrome') tx.dy = (1 - easeOut(p)) * H * 0.03
      break
    }
    case 'slide': {
      const st: Record<string, [number, number]> = { back: [0, 0.5], product: [0.15, 0.95], front: [0.6, 1.1], text: [0.4, 1.1], top: [0.9, 1.4], chrome: [1.0, 1.6] }
      const [a, b] = st[id] ?? [0, 0.6]
      const e = easeOut(seg(t, a, b))
      tx.alpha = clamp01(e * 1.6)
      const dir = id === 'product' ? (rightSide ? 1 : -1) : id === 'text' ? (rightSide ? -1 : 1) : 0
      tx.dx = dir * (1 - e) * W * (id === 'product' ? 0.28 : 0.2)
      if (id === 'chrome') tx.dy = (1 - e) * H * 0.04
      break
    }
    case 'fade': {
      const st: Record<string, [number, number]> = { back: [0, 0.6], product: [0.3, 1.1], front: [0.8, 1.3], text: [0.7, 1.4], top: [1.1, 1.6], chrome: [1.3, 1.9] }
      const [a, b] = st[id] ?? [0, 0.7]
      tx.alpha = easeInOut(seg(t, a, b))
      break
    }
    case 'zoom': {
      const st: Record<string, [number, number]> = { back: [0, 0.6], product: [0.3, 1.1], front: [0.7, 1.2], text: [0.7, 1.3], top: [1.0, 1.5], chrome: [1.2, 1.8] }
      const [a, b] = st[id] ?? [0, 0.7]
      const e = easeOut(seg(t, a, b))
      tx.alpha = e
      tx.scale = 1 + 0.06 * easeInOut(clamp01(t / dur)) + (1 - e) * 0.04
      break
    }
  }
  return tx
}

export function drawSlide(ctx: CanvasRenderingContext2D, L: SlideLayers, t: number, dur: number, preset: MotionPreset, outScale: number, alpha = 1) {
  for (const g of GROUPS) {
    const gc = L.groups[g.id]
    if (!gc) continue
    const tx = groupTx(preset, g.id, t, L.w, L.h, dur, gc)
    if (tx.alpha <= 0.002) continue
    ctx.save()
    ctx.globalAlpha = alpha * tx.alpha
    ctx.translate((gc.cx + tx.dx) * outScale, (gc.cy + tx.dy) * outScale)
    ctx.scale(tx.scale * outScale, tx.scale * outScale)
    ctx.translate(-gc.cx, -gc.cy)
    ctx.drawImage(gc.canvas, 0, 0)
    ctx.restore()
  }
}

/* ------------------------------ الفيديو ------------------------------ */

export interface MotionJob {
  scope: Scope
  preset: MotionPreset
  /** مدة كل شريحة (ثوانٍ) */
  seconds: number
  fps: number
  /** عرض الإخراج بالبكسل */
  width: number
  kind: 'video' | 'gif'
  /** الإطار الأول = التصميم مكتملاً (ليصلح غلافاً في إنستغرام) */
  cover?: boolean
}

const XFADE = 0.5

export function motionSupport() {
  const hasCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
  const rec = typeof MediaRecorder !== 'undefined'
  return { mp4: hasCodecs, recorder: rec }
}

interface CodecPick {
  codec: string
  mux: 'avc' | 'vp9'
}

/** H.264 أولاً (مقبول في إنستغرام)، وإلا VP9 داخل MP4 (يعمل في المتصفحات لكن قد لا تقبله إنستغرام) */
async function pickCodec(w: number, h: number, fps: number, bitrate: number): Promise<CodecPick | null> {
  if (typeof VideoEncoder === 'undefined') return null
  const cands: CodecPick[] = [
    ...['avc1.640033', 'avc1.640032', 'avc1.4d0033', 'avc1.4d0032', 'avc1.42003e', 'avc1.42001f'].map((codec) => ({ codec, mux: 'avc' as const })),
    { codec: 'vp09.00.50.08', mux: 'vp9' },
  ]
  for (const c of cands) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec: c.codec, width: w, height: h, bitrate, framerate: fps })
      if (r.supported) return c
    } catch {
      /* التالي */
    }
  }
  return null
}

/** الخط الزمني: يبدأ كل شريحة قبل نهاية السابقة بنصف ثانية (تداخل ناعم) */
function timeline(n: number, per: number) {
  const step = per - XFADE
  return { step, total: n === 1 ? per : n * step + XFADE }
}

export async function runMotion(job: MotionJob, ctl: Ctl, progress: OnProgress): Promise<{ name: string; seconds: number; frames: number; codec: string; compat: boolean }> {
  const s = useEditor.getState()
  const all = job.scope === 'all' ? syncedSlides(s) : [s.design]
  await prepare(all)
  const first = all[0]
  const cv = canvasOf(first)
  const per = Math.max(2, job.seconds)
  const { step, total } = timeline(all.length, per)
  const fps = job.kind === 'gif' ? Math.min(15, job.fps) : job.fps
  const frames = Math.round(total * fps)

  // مقاس الإخراج (زوجي للفيديو)
  const outW = Math.max(120, Math.round(job.width / 2) * 2)
  const outH = Math.round((outW * cv.h) / cv.w / 2) * 2
  const layerScale = outW / cv.w

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: job.kind === 'gif' })!

  const bitrate = Math.round(outW * outH * fps * 0.11)
  const codec = job.kind === 'video' ? await pickCodec(outW, outH, fps, bitrate) : null
  // التسجيل بالزمن الحقيقي لا يحتمل التوقف لرسم شريحة جديدة → نجهّزها كلها مسبقاً
  const keepAll = job.kind === 'video' && !codec

  // ذاكرة الطبقات: شريحتان كحد أقصى (ما لم نحتج الكل)
  const cache = new Map<number, SlideLayers>()
  const layersFor = async (k: number) => {
    let L = cache.get(k)
    if (!L) {
      progress(0, frames, `تجهيز الشريحة ${k + 1} من ${all.length}…`)
      L = await renderSlideLayers(all[k], s, layerScale, ctl)
      cache.set(k, L)
    }
    return L
  }

  const drawAt = async (T: number) => {
    // إطار الغلاف: أول إطار يعرض التصميم مكتملاً
    if (job.cover !== false && T < 0.5 / fps) {
      const L0 = await layersFor(0)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, outW, outH)
      drawSlide(ctx, L0, Math.min(per, 2.4), per, job.preset, 1, 1)
      return
    }
    // الشرائح النشطة عند الزمن T
    const active: number[] = []
    for (let k = 0; k < all.length; k++) {
      const st = k * step
      if (T >= st - 1e-6 && T < st + per) active.push(k)
    }
    if (!active.length) active.push(all.length - 1)
    if (!keepAll) for (const k of Array.from(cache.keys())) if (!active.includes(k) && k < active[0]) cache.delete(k)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, outW, outH)
    for (const k of active) {
      const L = await layersFor(k)
      const local = T - k * step
      const a = k === 0 ? 1 : clamp01(local / XFADE)
      drawSlide(ctx, L, local, per, job.preset, 1, a)
    }
  }
  // الطبقات تُرسم بمقياس الإخراج مباشرة لذلك outScale = 1

  const name = buildName('{title} - motion', { title: titleOf(first), template: '', size: `${outW}x${outH}`, n: 1, project: s.projectName || safeName(titleOf(first)), category: categoryDef(first.category).name, ext: job.kind === 'gif' ? 'gif' : 'mp4' })

  /* ---------- GIF ---------- */
  if (job.kind === 'gif') {
    const gif = GIFEncoder()
    const delay = Math.round(1000 / fps)
    for (let i = 0; i < frames; i++) {
      checkCancel(ctl)
      progress(i, frames, `إطار ${i + 1} من ${frames}`)
      await drawAt(i / fps)
      const data = ctx.getImageData(0, 0, outW, outH).data
      const palette = quantize(data, 256, { format: 'rgb444' })
      const index = applyPalette(data, palette, 'rgb444')
      gif.writeFrame(index, outW, outH, { palette, delay, repeat: 0 })
      if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0))
    }
    gif.finish()
    download(gif.bytes(), name, 'image/gif')
    return { name, seconds: total, frames, codec: 'GIF', compat: true }
  }

  /* ---------- MP4 عبر WebCodecs (أسرع من الزمن الحقيقي) ---------- */
  if (codec) {
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
    const target = new ArrayBufferTarget()
    const muxer = new Muxer({ target, video: { codec: codec.mux, width: outW, height: outH }, fastStart: 'in-memory' })
    let encErr: unknown = null
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        encErr = e
      },
    })
    encoder.configure({ codec: codec.codec, width: outW, height: outH, bitrate, framerate: fps })
    try {
      for (let i = 0; i < frames; i++) {
        checkCancel(ctl)
        if (encErr) throw encErr
        progress(i, frames, `إطار ${i + 1} من ${frames}`)
        await drawAt(i / fps)
        const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
        encoder.encode(vf, { keyFrame: i % (fps * 2) === 0 })
        vf.close()
        while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4))
      }
      await encoder.flush()
    } finally {
      try {
        encoder.close()
      } catch {
        /* */
      }
    }
    muxer.finalize()
    download(new Blob([target.buffer], { type: 'video/mp4' }), name, 'video/mp4')
    const h264 = codec.mux === 'avc'
    return { name, seconds: total, frames, codec: h264 ? 'MP4 · H.264' : 'MP4 · VP9', compat: h264 }
  }

  /* ---------- بديل: MediaRecorder بالزمن الحقيقي ---------- */
  if (typeof MediaRecorder === 'undefined') throw new Error('المتصفح لا يدعم تصدير الفيديو — استخدم Chrome أو Edge، أو صدّر GIF')
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/webm;codecs=h264', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  const stream = canvas.captureStream(fps)
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: bitrate })
  const parts: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()))
  for (let k = 0; k < all.length; k++) await layersFor(k)
  await drawAt(0)
  rec.start(250)
  const t0 = performance.now()
  for (;;) {
    checkCancel(ctl)
    const T = (performance.now() - t0) / 1000
    if (T >= total) break
    progress(Math.round(T * fps), frames, `تسجيل ${T.toFixed(1)} / ${total.toFixed(1)} ث`)
    await drawAt(T)
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  }
  await drawAt(total - 0.001)
  rec.stop()
  await stopped
  const actual = rec.mimeType || mime || 'video/webm'
  const isMp4 = actual.includes('mp4')
  const h264 = /avc1|h264/i.test(actual)
  const outName = isMp4 ? name : name.replace(/\.mp4$/, '.webm')
  download(new Blob(parts, { type: actual }), outName, actual)
  return { name: outName, seconds: total, frames, codec: `${isMp4 ? 'MP4' : 'WebM'} · ${h264 ? 'H.264' : 'VP9/VP8'}`, compat: h264 && isMp4 }
}

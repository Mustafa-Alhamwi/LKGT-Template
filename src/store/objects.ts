import { change, changeStyle, select, setTask, toast, useEditor } from './editor'
import type { DecorItem, FixedLayer, ImageSpec, QrSpec, StickerSpec } from '../model/types'
import { canvasOf } from '../model/types'
import { decor } from '../model/templates'
import { STICKERS, defaultStickerSize, findSticker, type StickerPreset } from '../poster/stickers'
import { DEFAULT_QR } from '../poster/QrCode'
import { DEFAULT_IMAGE } from '../poster/ImageObject'
import { getAssetBlob, normalizeImage, putAsset } from '../lib/assets'
import { removeBackgroundMask } from '../lib/bgRemoval'
import { getCutout } from '../lib/cutout'
import { DEFAULT_CLEANUP } from '../model/demo'

/* ------------------------------------------------------------------
 * عناصر التصميم الحرّة: ملصقات، أيقونات، QR، صور (تُخزَّن في style.decor)
 * الترتيب داخل المصفوفة = ترتيب الطبقات ضمن نفس المجموعة (خلف/أمام/فوق النص)
 * ------------------------------------------------------------------ */

const rid = () => `o_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

function centerPos(w: number, h: number, count: number) {
  const cv = canvasOf(useEditor.getState().design)
  const off = (count % 6) * 28
  return { x: Math.round((cv.w - w) / 2 + off), y: Math.round(cv.h * 0.4 - h / 2 + off) }
}

export function addObject(item: Partial<DecorItem> & Pick<DecorItem, 'kind' | 'w' | 'h'>): string {
  const s = useEditor.getState()
  const count = s.design.style.decor.filter((d) => d.carry).length
  const pos = centerPos(item.w, item.h, count)
  const base = decor({ x: pos.x, y: pos.y, layer: 'top', ...item })
  base.id = rid()
  base.carry = true
  base.rotate = item.rotate ?? 0
  change((d) => {
    d.style.decor.push(base)
    d.touched = true
  })
  select({ kind: 'decor', id: base.id })
  return base.id
}

export function addSticker(id: string, patch: Partial<DecorItem> & { spec?: Partial<StickerSpec> } = {}) {
  const def = findSticker(id)
  if (!def) return
  const size = defaultStickerSize(def)
  const { spec, ...rest } = patch
  const isShape = def.cat === 'shape'
  return addObject({
    kind: 'sticker',
    w: size.w,
    h: size.h,
    color: def.color,
    color2: def.color2,
    layer: isShape ? 'back' : 'top',
    sticker: { id, text: def.text ?? '', text2: def.text2 ?? '', strokeW: def.strokeW, bg: def.cat === 'icon' ? 'circle' : undefined, ...spec },
    name: def.label,
    ...rest,
  })
}

export function addStickerPreset(p: StickerPreset) {
  const def = findSticker(p.spec.id)
  if (!def) return
  const size = defaultStickerSize(def)
  const k = p.w ? p.w / size.w : 1
  return addObject({
    kind: 'sticker',
    w: Math.round(size.w * k),
    h: Math.round(size.h * k),
    color: p.color,
    color2: p.color2,
    sticker: { ...p.spec },
    name: p.label,
  })
}

export function addQr(patch: Partial<QrSpec> = {}) {
  const barcode = patch.mode === 'barcode'
  return addObject({
    kind: 'qr',
    w: barcode ? 420 : 300,
    h: barcode ? 200 : 300,
    qr: { ...DEFAULT_QR, ...patch },
    name: barcode ? 'باركود' : 'رمز QR',
    shadow: 'soft',
  })
}

/** إضافة صورة (منتج إضافي أو شعار أو خلفية صغيرة) — cut = تفريغ الخلفية تلقائياً */
export async function addImageFile(file: Blob, opts: { cut?: boolean; name?: string; layer?: DecorItem['layer'] } = {}) {
  if (!file.type.startsWith('image/')) return toast('الملف ليس صورة', 'error')
  setTask({ label: 'جارِ تحضير الصورة…', progress: null })
  try {
    const n = await normalizeImage(file, 2000)
    const asset = await putAsset(n.blob, (file as File).name ?? 'image', { w: n.w, h: n.h })
    const cv = canvasOf(useEditor.getState().design)
    const w = Math.round(Math.min(440, cv.w * 0.42))
    const h = Math.round((w * asset.h) / asset.w)
    let maskId: string | null = null
    if (opts.cut && !n.hasAlpha) {
      setTask({ label: 'جارِ تفريغ المنتج بالذكاء الاصطناعي…', progress: 0 })
      const q = useEditor.getState().removalQuality
      const png = await removeBackgroundMask(n.blob, q, (p) => setTask({ label: p.phase === 'download' ? 'تحميل نموذج التفريغ (أول مرة فقط)…' : 'جارِ تفريغ المنتج…', progress: p.ratio }))
      maskId = (await putAsset(png, 'mask')).id
    }
    const image: ImageSpec = { assetId: asset.id, ...DEFAULT_IMAGE, maskAssetId: maskId, mask: opts.cut || n.hasAlpha ? 'none' : 'rounded', fit: n.hasAlpha || maskId ? 'contain' : 'cover' }
    const id = addObject({
      kind: 'image',
      w,
      h,
      layer: opts.layer ?? 'front',
      image,
      name: opts.name ?? (maskId || n.hasAlpha ? 'منتج إضافي' : 'صورة'),
      shadow: maskId || n.hasAlpha ? 'soft' : 'none',
    })
    // نضبط النسبة على المنتج المفرّغ بعد القص
    if (maskId || n.hasAlpha) {
      const cut = await getCutout({ sourceAssetId: asset.id, maskAssetId: maskId, paintAssetId: null, cleanup: { ...DEFAULT_CLEANUP }, linked: false, place: null, enhance: { brightness: 1, contrast: 1, saturate: 1 }, visible: true })
      if (cut) {
        const hh = Math.round((w * cut.crop.h) / cut.crop.w)
        updateDecor(id, (x) => {
          x.h = hh
          x.y = Math.round(x.y + (h - hh) / 2)
        })
      }
    }
    return id
  } catch (e) {
    toast(`تعذّرت إضافة الصورة: ${String(e)}`, 'error')
  } finally {
    setTask(null)
  }
}

/** تفريغ صورة موجودة (تحويلها لمنتج إضافي) */
export async function cutoutImageObject(id: string) {
  const item = useEditor.getState().design.style.decor.find((d) => d.id === id)
  if (!item?.image) return
  setTask({ label: 'جارِ تفريغ المنتج بالذكاء الاصطناعي…', progress: 0 })
  try {
    const blob = await getAssetBlob(item.image.assetId)
    if (!blob) throw new Error('missing')
    const q = useEditor.getState().removalQuality
    const png = await removeBackgroundMask(blob, q, (p) => setTask({ label: p.phase === 'download' ? 'تحميل نموذج التفريغ…' : 'جارِ التفريغ…', progress: p.ratio }))
    const mask = await putAsset(png, 'mask')
    updateDecor(id, (x) => {
      x.image!.maskAssetId = mask.id
      x.image!.mask = 'none'
      x.image!.fit = 'contain'
      x.shadow = x.shadow && x.shadow !== 'none' ? x.shadow : 'soft'
    })
    toast('تم تفريغ الصورة ✓', 'ok')
  } catch (e) {
    toast(`تعذّر التفريغ: ${String(e)}`, 'error')
  } finally {
    setTask(null)
  }
}

export function updateDecor(id: string, fn: (d: DecorItem) => void, key = '') {
  changeStyle((s) => {
    const d = s.decor.find((x) => x.id === id)
    if (d) fn(d)
  }, key ? `dec-${id}-${key}` : '')
}

export function removeDecor(id: string) {
  changeStyle((s) => void (s.decor = s.decor.filter((x) => x.id !== id)))
  const st = useEditor.getState()
  if (st.selection?.kind === 'decor' && st.selection.id === id) useEditor.setState({ selection: null, multi: [] })
}

export function duplicateDecor(id: string) {
  const nid = rid()
  changeStyle((s) => {
    const i = s.decor.findIndex((x) => x.id === id)
    if (i < 0) return
    const c: DecorItem = JSON.parse(JSON.stringify(s.decor[i]))
    c.id = nid
    c.x += 36
    c.y += 36
    c.carry = true
    s.decor.splice(i + 1, 0, c)
  })
  select({ kind: 'decor', id: nid })
}

/** ترتيب الطبقة: front/back = أعلى/أسفل المجموعة، up/down = خطوة */
export function orderDecor(id: string, op: 'front' | 'back' | 'up' | 'down') {
  changeStyle((s) => {
    const i = s.decor.findIndex((x) => x.id === id)
    if (i < 0) return
    const item = s.decor[i]
    const sameIdx = s.decor.map((x, k) => (x.layer === item.layer ? k : -1)).filter((k) => k >= 0)
    const pos = sameIdx.indexOf(i)
    let target = pos
    if (op === 'front') target = sameIdx.length - 1
    else if (op === 'back') target = 0
    else if (op === 'up') target = Math.min(sameIdx.length - 1, pos + 1)
    else target = Math.max(0, pos - 1)
    if (target === pos) return
    s.decor.splice(i, 1)
    // موضع الإدخال: قبل/بعد العنصر الذي يشغل target في المجموعة (بعد الحذف)
    const rest = s.decor.map((x, k) => (x.layer === item.layer ? k : -1)).filter((k) => k >= 0)
    const at = target >= rest.length ? (rest.length ? rest[rest.length - 1] + 1 : s.decor.length) : rest[target]
    s.decor.splice(at, 0, item)
  })
}

/** نقل عنصر إلى مجموعة/موضع (سحب وإفلات في لوحة الطبقات) */
export function moveDecorTo(id: string, layer: DecorItem['layer'], beforeId: string | null) {
  changeStyle((s) => {
    const i = s.decor.findIndex((x) => x.id === id)
    if (i < 0) return
    const [item] = s.decor.splice(i, 1)
    item.layer = layer
    let at = s.decor.length
    if (beforeId) {
      const b = s.decor.findIndex((x) => x.id === beforeId)
      if (b >= 0) at = b
    } else {
      // نهاية المجموعة
      const last = s.decor.map((x, k) => (x.layer === layer ? k : -1)).filter((k) => k >= 0).pop()
      at = last == null ? s.decor.length : last + 1
    }
    s.decor.splice(at, 0, item)
  })
}

export function setDecorLayer(id: string, layer: DecorItem['layer']) {
  moveDecorTo(id, layer, null)
}

export function toggleFixed(kind: FixedLayer, prop: 'hide' | 'lock') {
  changeStyle((s) => {
    const m = (s[prop] = s[prop] ?? {})
    m[kind] = !m[kind]
  })
}

export function centerDecor(id: string, axis: 'x' | 'y' | 'both') {
  const cv = canvasOf(useEditor.getState().design)
  updateDecor(id, (d) => {
    if (axis !== 'y') d.x = Math.round((cv.w - d.w) / 2)
    if (axis !== 'x') d.y = Math.round((cv.h - d.h) / 2)
  })
}

export { STICKERS }

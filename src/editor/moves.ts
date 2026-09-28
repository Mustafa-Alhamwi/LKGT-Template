import type { Design, Selection, TextKey } from '../model/types'
import { canvasOf } from '../model/types'
import { assetInfoSync } from '../lib/assets'
import { autoPlacement, productRectOf } from '../poster/geometry'
import { isObjectKind } from '../poster/DecorLayer'

/* ------------------------------------------------------------------
 * حركات العناصر: تحريك، تغيير عرض، تحجيم، تدوير — يستخدمها السحب
 * وأسهم لوحة المفاتيح وأدوات المحاذاة
 * ------------------------------------------------------------------ */

export function sameSel(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'text' && b.kind === 'text') return a.key === b.key
  if ((a.kind === 'extra' && b.kind === 'extra') || (a.kind === 'decor' && b.kind === 'decor')) return a.id === b.id
  return true
}

/** معرّف عنصر DOM المقابل للتحديد (للقياس) */
export function eidOfSel(sel: Selection, d: Design): string | null {
  switch (sel.kind) {
    case 'text':
      return d.style.text.items[sel.key]?.free ? `text:${sel.key}` : 'block'
    case 'extra':
      return `text:${sel.id}`
    case 'textBlock':
      return 'block'
    case 'decor':
      return `decor:${sel.id}`
    case 'product':
      return 'product'
    case 'logo':
      return 'logo'
    case 'partner':
      return 'partner'
    case 'contact':
      return 'contact'
    default:
      return null
  }
}

export function selOfEid(eid: string): Selection | null {
  if (eid === 'block') return { kind: 'textBlock' }
  if (eid === 'product') return { kind: 'product' }
  if (eid === 'logo') return { kind: 'logo' }
  if (eid === 'partner') return { kind: 'partner' }
  if (eid === 'contact') return { kind: 'contact' }
  if (eid.startsWith('decor:')) return { kind: 'decor', id: eid.slice(6) }
  if (eid.startsWith('text:')) {
    const id = eid.slice(5)
    return id.startsWith('x_') ? { kind: 'extra', id } : { kind: 'text', key: id as TextKey }
  }
  return null
}

/** هوية المُحرِّك: كل عناصر الكتلة غير الحرّة تتحرك معاً كوحدة واحدة */
export function moverKey(sel: Selection, d: Design): string {
  if (sel.kind === 'text' && !d.style.text.items[sel.key]?.free) return 'textBlock'
  if (sel.kind === 'text') return `text:${sel.key}`
  if (sel.kind === 'extra' || sel.kind === 'decor') return `${sel.kind}:${sel.id}`
  return sel.kind
}

export function isLocked(d: Design, sel: Selection): boolean {
  const lock = d.style.lock ?? {}
  switch (sel.kind) {
    case 'scene':
      return !!lock.scene
    case 'product':
      return !!lock.product
    case 'shape':
      return !!lock.shape
    case 'textBlock':
      return !!lock.textBlock
    case 'logo':
      return !!lock.logo
    case 'partner':
      return !!lock.partner
    case 'contact':
      return !!lock.contact
    case 'text': {
      const st = d.style.text.items[sel.key]
      return !!st?.locked || (!st?.free && !!lock.textBlock)
    }
    case 'extra':
      return !!d.content.extras?.find((e) => e.id === sel.id)?.style.locked
    case 'decor':
      return !!d.style.decor.find((x) => x.id === sel.id)?.locked
  }
}

/** هل يمكن تحريك هذا النوع بالسحب */
export function isMovable(sel: Selection): boolean {
  return !['contact', 'partner', 'logo'].includes(sel.kind)
}

/** إزاحة عنصر بمقدار (dx, dy) نسبة لحالة البداية d0 */
export function applyMove(d: Design, d0: Design, sel: Selection, dx: number, dy: number): void {
  const cv = canvasOf(d0)
  switch (sel.kind) {
    case 'scene': {
      const sc0 = d0.content.scene
      if (!sc0 || !d.content.scene) return
      const info = assetInfoSync(sc0.assetId)
      if (!info) return
      const base = sc0.place ?? autoPlacement(info.w, info.h, cv)
      d.content.scene.place = { x: base.x + dx, y: base.y + dy, w: base.w }
      return
    }
    case 'product': {
      const r = productRectOf(d0)
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
      if (sel.kind === 'text' && !st0.free) return applyMove(d, d0, { kind: 'textBlock' }, dx, dy)
      st.fx = Math.round((st0.fx ?? 0) + dx)
      st.fy = Math.round((st0.fy ?? 0) + dy)
      return
    }
    case 'textBlock': {
      d.style.text.x = Math.round(d0.style.text.x + dx)
      d.style.text.y = Math.round(d0.style.text.y + dy)
      return
    }
    case 'shape': {
      d.style.shape.offsetX = Math.round(d0.style.shape.offsetX + dx)
      d.style.shape.offsetY = Math.round(d0.style.shape.offsetY + dy)
      return
    }
    case 'decor': {
      const i = d0.style.decor.findIndex((x) => x.id === sel.id)
      if (i < 0 || !d.style.decor[i]) return
      d.style.decor[i].x = Math.round(d0.style.decor[i].x + dx)
      d.style.decor[i].y = Math.round(d0.style.decor[i].y + dy)
      return
    }
  }
}

export interface Mods {
  shift?: boolean
  alt?: boolean
}

/** مقابض العرض والتحجيم والتدوير */
export function applyHandle(
  d: Design,
  d0: Design,
  sel: Selection,
  handle: string,
  dx: number,
  dy: number,
  pt: { x0: number; y0: number; x: number; y: number; cx?: number; cy?: number },
  mods: Mods = {},
): void {
  switch (sel.kind) {
    case 'text':
    case 'extra': {
      const st0 = sel.kind === 'text' ? d0.style.text.items[sel.key] : d0.content.extras?.find((e) => e.id === sel.id)?.style
      const st = sel.kind === 'text' ? d.style.text.items[sel.key] : d.content.extras?.find((e) => e.id === sel.id)?.style
      if (!st0 || !st) return
      if (sel.kind === 'text' && !st0.free) return applyHandle(d, d0, { kind: 'textBlock' }, handle, dx, dy, pt, mods)
      const w0 = st0.fw ?? 600
      const x0 = st0.fx ?? 0
      if (handle === 'right') st.fw = Math.max(80, Math.round(w0 + dx))
      else if (handle === 'left') {
        const w = Math.max(80, w0 - dx)
        st.fx = Math.round(x0 + (w0 - w))
        st.fw = Math.round(w)
      } else if (handle === 'rot') {
        const cx = pt.cx ?? x0 + w0 / 2
        const cy = pt.cy ?? (st0.fy ?? 0) + 40
        st.rotate = rotateFrom(st0.rotate ?? 0, cx, cy, pt, mods)
      }
      return
    }
    case 'textBlock': {
      const t0 = d0.style.text
      const t = d.style.text
      if (handle === 'right') {
        t.w = Math.round(Math.max(160, t0.w + dx))
      } else if (handle === 'left') {
        const w = Math.max(160, t0.w - dx)
        t.x = Math.round(t0.x + (t0.w - w))
        t.w = Math.round(w)
      }
      return
    }
    case 'decor': {
      const i = d0.style.decor.findIndex((x) => x.id === sel.id)
      const it0 = d0.style.decor[i]
      const it = d.style.decor[i]
      if (!it0 || !it) return
      if (handle === 'rot') {
        it.rotate = rotateFrom(it0.rotate, it0.x + it0.w / 2, it0.y + it0.h / 2, pt, mods)
        return
      }
      const th = (it0.rotate * Math.PI) / 180
      const cos = Math.cos(th)
      const sin = Math.sin(th)
      const lx = dx * cos + dy * sin
      const ly = -dx * sin + dy * cos
      const sxs = handle.includes('e') ? 1 : -1
      const sys = handle.includes('s') ? 1 : -1
      let nw = it0.w + sxs * lx
      let nh = it0.h + sys * ly
      const keep = isObjectKind(it0.kind) ? !mods.alt : !!mods.shift
      if (keep) {
        const k = Math.max(nw / it0.w, nh / it0.h, 20 / Math.min(it0.w, it0.h))
        nw = it0.w * k
        nh = it0.h * k
      } else {
        nw = Math.max(16, nw)
        nh = Math.max(16, nh)
      }
      const sl = (sxs * (nw - it0.w)) / 2
      const st2 = (sys * (nh - it0.h)) / 2
      const cx = it0.x + it0.w / 2 + (sl * cos - st2 * sin)
      const cy = it0.y + it0.h / 2 + (sl * sin + st2 * cos)
      it.w = Math.round(nw)
      it.h = Math.round(nh)
      it.x = Math.round(cx - nw / 2)
      it.y = Math.round(cy - nh / 2)
      return
    }
  }
}

function rotateFrom(rot0: number, cx: number, cy: number, pt: { x0: number; y0: number; x: number; y: number }, mods: Mods): number {
  const a0 = Math.atan2(pt.y0 - cy, pt.x0 - cx)
  const a1 = Math.atan2(pt.y - cy, pt.x - cx)
  let r = rot0 + ((a1 - a0) * 180) / Math.PI
  r = ((((r + 180) % 360) + 360) % 360) - 180
  if (mods.shift) r = Math.round(r / 15) * 15
  else {
    for (const s of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) if (Math.abs(r - s) < 3) r = s
  }
  return Math.round(r * 10) / 10
}

/** إزاحة عنصر مباشرة على التصميم d (لوحة المفاتيح، المحاذاة) */
export function translateSel(d: Design, sel: Selection, dx: number, dy: number) {
  applyMove(d, d, sel, dx, dy)
}

import { change, changeStyle, select, selectMany, syncedSlides, toast, useEditor } from './editor'
import type { DecorItem, ExtraText, Selection } from '../model/types'
import { moverKey, translateSel, isLocked } from '../editor/moves'
import { orderDecor } from './objects'
import { bridge } from '../lib/bridge'

/* ------------------------------------------------------------------
 * أوامر التحرير على التحديد الحالي: حذف، تكرار، نسخ/لصق، تحريك، قفل، ترتيب
 * ------------------------------------------------------------------ */

function current(): Selection[] {
  const s = useEditor.getState()
  if (s.multi.length > 1) return s.multi
  return s.selection ? [s.selection] : []
}

export function deleteSelection() {
  const list = current()
  if (!list.length) return
  change((d) => {
    for (const sel of list) {
      if (isLocked(d, sel)) continue
      if (sel.kind === 'text') d.style.text.items[sel.key].visible = false
      if (sel.kind === 'extra') d.content.extras = (d.content.extras ?? []).filter((x) => x.id !== sel.id)
      if (sel.kind === 'product' && d.content.product) d.content.product.visible = false
      if (sel.kind === 'shape') d.style.shape.kind = 'none'
      if (sel.kind === 'decor') d.style.decor = d.style.decor.filter((x) => x.id !== sel.id)
    }
  })
  select(null, false)
}

let idSeq = 0
const rid = (p: string) => `${p}${Date.now().toString(36)}${(idSeq++).toString(36)}`

export function duplicateSelection() {
  const list = current()
  const created: Selection[] = []
  change((d) => {
    for (const sel of list) {
      if (sel.kind === 'decor') {
        const i = d.style.decor.findIndex((x) => x.id === sel.id)
        if (i < 0) continue
        const c: DecorItem = JSON.parse(JSON.stringify(d.style.decor[i]))
        c.id = rid('o_')
        c.x += 36
        c.y += 36
        c.carry = true
        d.style.decor.splice(i + 1, 0, c)
        created.push({ kind: 'decor', id: c.id })
      }
      if (sel.kind === 'extra') {
        const src = d.content.extras?.find((x) => x.id === sel.id)
        if (!src) continue
        const c: ExtraText = JSON.parse(JSON.stringify(src))
        c.id = rid('x_')
        c.style.fx = (c.style.fx ?? 0) + 36
        c.style.fy = (c.style.fy ?? 0) + 36
        d.content.extras!.push(c)
        created.push({ kind: 'extra', id: c.id })
      }
    }
  })
  if (created.length === 1) select(created[0])
  else if (created.length > 1) selectMany(created)
}

export function copySelection() {
  const s = useEditor.getState()
  const sel = s.selection
  if (!sel) return false
  if (sel.kind === 'extra') {
    const item = s.design.content.extras?.find((x) => x.id === sel.id)
    if (item) useEditor.setState({ clip: { kind: 'extra', item: structuredClone(item) } })
    return !!item
  }
  if (sel.kind === 'decor') {
    const item = s.design.style.decor.find((x) => x.id === sel.id)
    if (item) useEditor.setState({ clip: { kind: 'object', item: structuredClone(item) } })
    return !!item
  }
  return false
}

export function pasteClip(): boolean {
  const s = useEditor.getState()
  const clip = s.clip
  if (!clip || clip.kind === 'style') return false
  if (clip.kind === 'extra') {
    const c = structuredClone(clip.item)
    c.id = rid('x_')
    c.style.fx = (c.style.fx ?? 0) + 40
    c.style.fy = (c.style.fy ?? 0) + 40
    change((d) => void (d.content.extras = [...(d.content.extras ?? []), c]))
    select({ kind: 'extra', id: c.id })
    useEditor.setState({ clip: { kind: 'extra', item: c } })
    return true
  }
  const c = structuredClone(clip.item)
  c.id = rid('o_')
  c.x += 40
  c.y += 40
  c.carry = true
  changeStyle((st) => void st.decor.push(c))
  select({ kind: 'decor', id: c.id })
  useEditor.setState({ clip: { kind: 'object', item: c } })
  return true
}

export function nudgeSelection(dx: number, dy: number) {
  const list = current()
  if (!list.length) return false
  const d0 = useEditor.getState().design
  const seen = new Set<string>()
  const movers = list.filter((s) => {
    if (['contact', 'partner', 'logo'].includes(s.kind) || isLocked(d0, s)) return false
    const k = moverKey(s, d0)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (!movers.length) return false
  change((d) => {
    for (const m of movers) translateSel(d, m, dx, dy)
  }, `nudge-${movers.map((m) => m.kind).join()}`)
  return true
}

export function selectAll() {
  const d = useEditor.getState().design
  bridge.scale = bridge.scale || 1
  const list: Selection[] = []
  for (const it of d.content.extras ?? []) list.push({ kind: 'extra', id: it.id })
  for (const x of d.style.decor) if (x.visible && !x.locked && (x.carry || ['sticker', 'qr', 'image'].includes(x.kind))) list.push({ kind: 'decor', id: x.id })
  for (const k of d.style.text.order) {
    const st = d.style.text.items[k]
    if (st.visible && st.free && !st.locked) list.push({ kind: 'text', key: k })
  }
  if (!list.length) return toast('لا توجد عناصر حرّة لتحديدها', 'info')
  selectMany(list)
}

export function toggleLockSelection() {
  const list = current()
  change((d) => {
    for (const sel of list) {
      if (sel.kind === 'decor') {
        const x = d.style.decor.find((y) => y.id === sel.id)
        if (x) x.locked = !x.locked
      } else if (sel.kind === 'extra') {
        const x = d.content.extras?.find((y) => y.id === sel.id)
        if (x) x.style.locked = !x.style.locked
      } else if (sel.kind === 'text') {
        const st = d.style.text.items[sel.key]
        st.locked = !st.locked
      } else if (['scene', 'product', 'shape', 'textBlock', 'logo', 'partner', 'contact'].includes(sel.kind)) {
        const lock = (d.style.lock = d.style.lock ?? {})
        const k = sel.kind as keyof typeof lock
        lock[k] = !lock[k]
      }
    }
  })
}

export function orderSelection(op: 'front' | 'back' | 'up' | 'down') {
  const sel = useEditor.getState().selection
  if (sel?.kind === 'decor') orderDecor(sel.id, op)
}

export function nextSlide(dir: 1 | -1) {
  const s = useEditor.getState()
  const n = syncedSlides(s).length
  if (n < 2) return
  const i = Math.max(0, Math.min(n - 1, s.slideIndex + dir))
  void import('./editor').then((m) => m.switchSlide(i))
}

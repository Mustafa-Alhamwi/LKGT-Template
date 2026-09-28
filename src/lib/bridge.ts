/**
 * جسر بين مساحة العمل والمخزن: قياس مواضع العناصر الفعلية على البوستر
 * (كسر البطاقات، المحاذاة الذكية، التحديد بالمربع، المحاذاة والتوزيع).
 */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const bridge = {
  poster: null as HTMLElement | null,
  scale: 1,
  measure(id: string): { x: number; y: number; w: number } | null {
    const root = bridge.poster
    if (!root) return null
    const el = root.querySelector<HTMLElement>(`.lk-ti[data-key="${id}"]`)
    if (!el) return null
    const a = root.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { x: (r.left - a.left) / bridge.scale, y: (r.top - a.top) / bridge.scale, w: r.width / bridge.scale }
  },
  /** مربع عنصر بإحداثيات البوستر */
  rectOf(el: Element): Box | null {
    const root = bridge.poster
    if (!root) return null
    const a = root.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return { x: (r.left - a.left) / bridge.scale, y: (r.top - a.top) / bridge.scale, w: r.width / bridge.scale, h: r.height / bridge.scale }
  },
  /** كل العناصر القابلة للقياس: معرّفها ومربعها */
  all(): { eid: string; box: Box }[] {
    const root = bridge.poster
    if (!root) return []
    const out: { eid: string; box: Box }[] = []
    root.querySelectorAll<HTMLElement>('[data-eid]').forEach((el) => {
      const b = bridge.rectOf(el)
      if (b) out.push({ eid: el.dataset.eid!, box: b })
    })
    return out
  },
  boxOf(eid: string): Box | null {
    const root = bridge.poster
    if (!root) return null
    const el = root.querySelector<HTMLElement>(`[data-eid="${eid}"]`)
    return el ? bridge.rectOf(el) : null
  },
}

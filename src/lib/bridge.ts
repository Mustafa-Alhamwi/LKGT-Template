/**
 * جسر بين مساحة العمل والمخزن: قياس مواضع العناصر الفعلية على البوستر
 * (يُستخدم عند «كسر البطاقات» ليبقى كل عنصر في مكانه بدون قفزة).
 */
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
}

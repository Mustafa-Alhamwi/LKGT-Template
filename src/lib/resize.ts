import type { BrandConfig, Canvas, DecorItem, Design, TemplateStyle, TextStyle } from '../model/types'
import { canvasOf } from '../model/types'
import { DEFAULT_BRAND } from '../model/brand'
import { shapeOf } from '../model/formats'
import { productBoxOf, setProductBox } from '../poster/geometry'

/* ------------------------------------------------------------------
 * التحويل الذكي بين المقاسات: القوالب مبنية على 1080×1440 ونعيد ترتيبها
 * لأي مقاس: عمودي (ستوري)، مربع، أفقي (عمودين: منتج + نص)…
 * ------------------------------------------------------------------ */

/** أنواع الزخارف التي تحافظ على نسبتها (دوائر، شارات…) أو تمتد مع اللوحة */
const KEEP_ASPECT = new Set(['rings', 'arc', 'badge', 'plus', 'dots', 'ribbon', 'diagonal', 'sticker', 'qr', 'image', 'watermark'])
const INSET_FRAME = new Set(['frame', 'corners'])

interface Ctx {
  from: Canvas
  to: Canvas
  sx: number
  sy: number
  /** مقياس موحّد عند التصغير فقط */
  su: number
}

function mkCtx(from: Canvas, to: Canvas): Ctx {
  const sx = to.w / from.w
  const sy = to.h / from.h
  return { from, to, sx, sy, su: Math.min(1, sx, sy) }
}

function mapDecor(d: DecorItem, c: Ctx): DecorItem {
  const { from, to, sx, sy, su } = c
  const o = { ...d }
  if (INSET_FRAME.has(d.kind)) {
    o.w = d.w + (to.w - from.w)
    o.h = d.h + (to.h - from.h)
    return o
  }
  if (d.kind === 'noise') {
    o.w = to.w
    o.h = to.h
    o.x = 0
    o.y = 0
    return o
  }
  const keep = KEEP_ASPECT.has(d.kind)
  // أفقياً
  const fullW = d.w >= from.w * 0.92 && Math.abs(d.x) <= from.w * 0.06
  if (fullW) {
    o.x = d.x * sx
    o.w = d.w * sx
  } else if (keep) {
    const w = d.w * su
    o.x = (d.x + d.w / 2) * sx - w / 2
    o.w = w
  } else {
    o.x = d.x * sx
    o.w = d.w * sx
  }
  // عمودياً
  const top = d.y <= from.h * 0.06
  const bottom = d.y + d.h >= from.h * 0.94
  if (top && bottom) {
    o.y = d.y * sy
    o.h = keep ? d.h * su : d.h * sy
  } else if (bottom && !keep) {
    o.h = d.h
    o.y = d.y + (to.h - from.h)
  } else if (top && !keep) {
    o.y = d.y
    o.h = d.h
  } else {
    const h = keep ? d.h * su : d.h * Math.min(1, sy)
    o.y = (d.y + d.h / 2) * sy - h / 2
    o.h = h
  }
  if (keep && !fullW) {
    // النسبة كما هي
    const k = su
    o.w = d.w * k
    o.h = d.h * k
    o.x = (d.x + d.w / 2) * sx - o.w / 2
    o.y = (d.y + d.h / 2) * sy - o.h / 2
  }
  return o
}

function scaleTextItem(st: TextStyle, fs: number): TextStyle {
  if (fs === 1) return st
  return { ...st, size: Math.round(st.size * fs), maxSize: Math.round(st.maxSize * fs), marginTop: Math.round(st.marginTop * fs) }
}

/** تحويل نمط القالب من مقاس لآخر */
export function resizeStyle(st: TemplateStyle, from: Canvas, to: Canvas, brand: BrandConfig = DEFAULT_BRAND): TemplateStyle {
  if (from.w === to.w && from.h === to.h) return st
  const c = mkCtx(from, to)
  const kind = shapeOf(to)
  const out = structuredClone(st)
  // الخط يصغر قليلاً في المقاسات القصيرة
  const fs = c.sy < 1 ? Math.max(0.72, Math.pow(c.su, 0.7)) : 1

  // كتلة النصوص ومجموعتها (العناصر الحرّة المفصولة)
  const tb0 = st.text
  const tb = out.text
  let gx: (x: number) => number
  let gy: (y: number) => number
  let gw: number
  if (kind === 'wide') {
    tb.w = Math.round(to.w * 0.46)
    tb.x = Math.round(to.w - tb.w - Math.max(70, to.w * 0.05))
    const minTop = brand.logo.top + brand.logo.h + 34
    tb.y = Math.round(Math.max(minTop, to.h * 0.2))
    gw = tb.w / tb0.w
    gx = (x) => tb.x + (x - tb0.x) * gw
    gy = (y) => tb.y + (y - tb0.y) * Math.min(1, gw) * 0.95
  } else {
    tb.x = Math.round(tb0.x * c.sx)
    tb.w = Math.round(tb0.w * c.sx)
    tb.y = Math.round(tb0.y * c.sy)
    gw = c.sx
    gx = (x) => x * c.sx
    gy = (y) => y * c.sy
  }
  // هامش آمن للوغو (الستوري)
  const need = brand.logo.top + brand.logo.h + (to.safeTop ?? 0) + 34
  const lift = kind === 'wide' ? 0 : Math.max(0, need - tb.y)
  tb.y += lift
  tb.gap = Math.round(tb0.gap * fs)
  for (const k of Object.keys(tb.items) as (keyof typeof tb.items)[]) {
    let it = scaleTextItem(tb.items[k], fs)
    if (it.free) {
      it = { ...it, fx: Math.round(gx(it.fx ?? 0)), fy: Math.round(gy(it.fy ?? 0) + lift), fw: Math.round((it.fw ?? 600) * gw) }
    }
    tb.items[k] = it
  }
  tb.panel = { ...tb.panel, pad: Math.round(tb.panel.pad * fs) }

  // منطقة المنتج
  const a = st.productArea
  if (kind === 'wide') {
    const w = Math.round(to.w * 0.42)
    out.productArea = { x: Math.round(Math.max(40, to.w * 0.05)), y: Math.round(brand.logo.top + 30), w, h: Math.round(to.h - brand.logo.top - 30 - 190) }
  } else {
    out.productArea = { x: Math.round(a.x * c.sx), y: Math.round(a.y * c.sy), w: Math.round(a.w * c.sx), h: Math.round(a.h * c.sy) }
  }

  // زخارف وعناصر
  out.decor = st.decor.map((d) => mapDecor(d, c))
  // إزاحة الشكل تحت المنتج
  out.shape.offsetX = Math.round(st.shape.offsetX * c.sx)
  out.shape.offsetY = Math.round(st.shape.offsetY * c.sy)
  return out
}

/** تحويل تصميم كامل (نمط + محتوى) لمقاس جديد */
export function resizeDesign(d: Design, to: Canvas, brand: BrandConfig = DEFAULT_BRAND): Design {
  const from = canvasOf(d)
  if (from.w === to.w && from.h === to.h) return { ...structuredClone(d), canvas: to }
  const c = mkCtx(from, to)
  const kind = shapeOf(to)
  const box0 = productBoxOf(d)
  const out: Design = structuredClone(d)
  out.style = resizeStyle(d.style, from, to, brand)
  out.canvas = to

  // الخلفية: الوضع التلقائي هو الأنسب للمقاس الجديد
  if (out.content.scene) out.content.scene.place = null

  // النصوص الإضافية: مواضع نسبية
  const fs = c.sy < 1 ? Math.max(0.72, Math.pow(c.su, 0.7)) : 1
  out.content.extras = (out.content.extras ?? []).map((e) => {
    const st = scaleTextItem(e.style, fs)
    return {
      ...e,
      style: {
        ...st,
        fx: Math.round(((e.style.fx ?? 0) + (e.style.fw ?? 600) / 2) * c.sx - ((e.style.fw ?? 600) * c.sx) / 2),
        fy: Math.round((e.style.fy ?? 0) * c.sy),
        fw: Math.round((e.style.fw ?? 600) * Math.min(c.sx, kind === 'wide' ? 0.6 : 1.2)),
      },
    }
  })

  // المنتج المستقل: يحافظ على موضعه النسبي
  const p = out.content.product
  if (p && !p.linked && box0) {
    const sp = Math.max(0.5, Math.min(c.sx, c.sy * 1.15, 2))
    const wide = kind === 'wide'
    setProductBox(out, {
      cx: wide ? out.style.productArea.x + out.style.productArea.w / 2 : (box0.x + box0.w / 2) * c.sx,
      bottom: wide ? out.style.productArea.y + out.style.productArea.h * 0.94 : (box0.y + box0.h) * c.sy,
      w: box0.w * (wide ? Math.min(1, (out.style.productArea.w * 0.95) / box0.w) : sp),
    })
  }
  return out
}

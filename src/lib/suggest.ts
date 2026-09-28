import { RED } from '../model/brand'
import { allTemplates, recolorAll, applyTemplate, templateStyleFor, toast, useEditor } from '../store/editor'
import type { Design, Template } from '../model/types'
import { extractPalette, accentOf, colorDistance, type PaletteColor } from './palette'
import { makeRecolorer, mapColors, hslOf } from './color'
import { getCutout } from './cutout'
import { assetInfoSync } from './assets'

/* ------------------------------------------------------------------
 * اقتراحات تصميم ذكية: قوالب أخرى بألوان منتجك + ألوان بديلة للتصميم الحالي
 * ------------------------------------------------------------------ */

export interface Variant {
  id: string
  label: string
  sub: string
  design: Design
  apply: () => void
}

/** لوحة ألوان مصدر التصميم (المنتج المفرّغ أو صورة الخلفية) */
export async function designPalette(d: Design): Promise<PaletteColor[]> {
  try {
    if (d.content.product) {
      const cut = await getCutout(d.content.product)
      if (cut) return await extractPalette(cut.url)
    }
    const sid = d.content.scene?.assetId
    if (sid) {
      const a = assetInfoSync(sid)
      if (a) return await extractPalette(a.url)
    }
  } catch {
    /* */
  }
  return []
}

function recolored(d: Design, accent: string): Design {
  const fn = makeRecolorer(accent, d.primary ?? RED)
  if (!fn) return { ...d, primary: accent }
  return { ...d, style: mapColors(d.style, fn), primary: accent }
}

export async function buildVariants(): Promise<Variant[]> {
  const s = useEditor.getState()
  const d = s.design
  const pal = await designPalette(d)
  const accents: string[] = []
  // ألوان مميزة متباينة الصبغة من المنتج
  for (const c of [...pal].sort((a, b) => b.s * b.weight - a.s * a.weight)) {
    if (c.s < 0.28 || c.l < 0.14 || c.l > 0.85) continue
    if (accents.every((a) => colorDistance(a, c.hex) > 90)) accents.push(c.hex)
    if (accents.length >= 3) break
  }
  const top = accentOf(pal)
  if (top && !accents.length) accents.push(top.hex)

  const variants: Variant[] = []
  // 1) ألوان بديلة للتصميم الحالي
  for (const a of accents.slice(0, 3)) {
    variants.push({
      id: `col-${a}`,
      label: 'ألوان من منتجك',
      sub: a,
      design: recolored(d, a),
      apply: () => {
        recolorAll(a)
        toast('تم تطبيق الألوان المقترحة', 'ok')
      },
    })
  }
  // 2) قوالب أخرى من نفس الفئة (متباعدة بالشكل) مصبوغة بلون المنتج
  const cat = d.category ?? 'ads'
  const pool = allTemplates(s).filter((t) => t.category === cat && t.id !== d.templateId)
  const step = Math.max(1, Math.floor(pool.length / 7))
  const picks: Template[] = []
  for (let i = 0; i < pool.length && picks.length < 7; i += step) picks.push(pool[i])
  picks.forEach((t, i) => {
    const r = templateStyleFor(s, t, d)
    let variant: Design = { ...d, templateId: t.id, style: r.style, primary: r.primary }
    const a = accents[i % Math.max(1, accents.length)]
    if (a) variant = recolored(variant, a)
    variants.push({
      id: `tpl-${t.id}`,
      label: t.name,
      sub: a ? 'بألوان منتجك' : t.nameEn,
      design: variant,
      apply: () => {
        applyTemplate(t.id)
        if (a) recolorAll(a)
      },
    })
  })
  return variants
}

/** ترتيب القوالب بحسب قربها من لوحة ألوان صورة مرجعية */
export function rankTemplates(ref: PaletteColor[], templates: Template[], avgL: number): { t: Template; cost: number }[] {
  const dark = avgL < 0.42
  return templates
    .map((t) => {
      const st = t.style
      const colors = [
        [st.backdrop.color, 0.32],
        [st.backdrop.color2, 0.22],
        [st.shape.kind !== 'none' ? st.shape.color : st.backdrop.color2, 0.14],
        [st.text.items.title.color, 0.14],
        [st.text.items.tagline.decoStyle.fill, 0.1],
        [st.contact.accent, 0.08],
      ] as [string, number][]
      let cost = 0
      for (const [c, w] of colors) {
        const dm = Math.min(...ref.slice(0, 5).map((r, i) => colorDistance(c, r.hex) * (1 + i * 0.12)))
        cost += (w * dm) / 441
      }
      if ((st.theme === 'dark') !== dark) cost += 0.12
      const h = hslOf(st.backdrop.color)
      void h
      return { t, cost }
    })
    .sort((a, b) => a.cost - b.cost)
}

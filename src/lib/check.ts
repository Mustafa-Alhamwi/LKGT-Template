import { allPartners, change, changeContent, useEditor } from '../store/editor'
import { bridge, type Box } from './bridge'
import { renderCanvas } from './exporter'
import { contrastRatio, readableOn } from './color'
import { proofread, applyFixes } from './proofread'
import { canvasOf, type Selection, type TextKey } from '../model/types'
import { categoryOf } from '../model/categories'
import { assetInfoSync } from './assets'
import { cutoutSync } from './cutout'
import { productRectOf, sceneRect } from '../poster/geometry'
import { translateSel } from '../editor/moves'
import { showIfOk, showWhenOk } from '../model/showWhen'

/* ------------------------------------------------------------------
 * فحص جودة التصميم قبل النشر: محتوى، وضوح، تباين، هوامش، تداخل، دقة، لغة
 * ------------------------------------------------------------------ */

export type IssueLevel = 'error' | 'warn' | 'info'
export type IssueGroup = 'محتوى' | 'وضوح' | 'تخطيط' | 'صور' | 'لغة'

export interface Issue {
  id: string
  level: IssueLevel
  group: IssueGroup
  title: string
  detail: string
  sel?: Selection
  fixLabel?: string
  fix?: () => void
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

const TEXT_KEYS: TextKey[] = ['kicker', 'title', 'subtitle', 'tagline', 'features', 'note', 'oldPrice', 'price', 'discount', 'cta']

export async function runCheck(): Promise<Issue[]> {
  const s = useEditor.getState()
  const d = s.design
  const cv = canvasOf(d)
  const cat = categoryOf(d)
  const issues: Issue[] = []
  const answer = d.content.answer ?? null
  const texts = d.content.texts

  const valueOf = (k: TextKey) => (k === 'features' ? texts.features.filter((f) => f.trim()).join('\n') : texts[k] ?? '')

  /* ---------- المحتوى ---------- */
  for (const k of TEXT_KEYS) {
    const st = d.style.text.items[k]
    if (!st.visible || !showWhenOk(st.showWhen, answer) || !showIfOk(st.showIf, texts)) continue
    const v = valueOf(k).trim()
    if (!v) continue
    const ph = k === 'features' ? cat.placeholders.features.join('\n') : cat.placeholders[k]
    if (ph && v === ph.trim() && ['title', 'subtitle', 'tagline', 'kicker', 'price', 'note', 'features', 'oldPrice', 'discount', 'cta'].includes(k)) {
      issues.push({
        id: `ph-${k}`,
        level: k === 'title' ? 'error' : 'warn',
        group: 'محتوى',
        title: `نص نائب لم يُستبدل: «${cat.labels[k]}»`,
        detail: 'ما زال هذا الحقل يحمل النص التجريبي — اكتب نصك أو أخفِ الحقل.',
        sel: { kind: 'text', key: k },
        fixLabel: 'إخفاء الحقل',
        fix: () => change((x) => void (x.style.text.items[k].visible = false)),
      })
    }
  }
  if (cat.hasProduct && !d.content.product) {
    issues.push({ id: 'no-product', level: 'warn', group: 'محتوى', title: 'لا توجد صورة منتج', detail: 'أضف صورة المنتج من تبويب العناصر أو بإسقاطها على التصميم.' })
  }
  if (cat.answers && !answer) {
    issues.push({ id: 'no-answer', level: 'info', group: 'محتوى', title: 'التصميم في وضع «السؤال»', detail: 'الإجابة لم تُكشف بعد. اختر الإجابة الصحيحة من تبويب العناصر عند إعداد منشور الإجابة.' })
  }
  if (!s.brand.phone && !s.brand.website && !s.brand.whatsapp) {
    issues.push({ id: 'no-contact', level: 'info', group: 'محتوى', title: 'معلومات التواصل فارغة', detail: 'أضف موقعك أو هاتفك من مجموعات الهوية ليظهر في الشريط السفلي.' })
  }

  /* ---------- اللغة ---------- */
  const proofItems: { label: string; text: string; set: (v: string) => void; sel: Selection }[] = []
  for (const k of TEXT_KEYS) {
    const st = d.style.text.items[k]
    if (!st.visible) continue
    if (k === 'features') continue
    proofItems.push({
      label: cat.labels[k],
      text: texts[k] ?? '',
      sel: { kind: 'text', key: k },
      set: (v) => changeContent((c) => void (c.texts[k as 'title'] = v)),
    })
  }
  for (const e of d.content.extras ?? []) {
    proofItems.push({ label: 'نص إضافي', text: e.text, sel: { kind: 'extra', id: e.id }, set: (v) => changeContent((c) => void (c.extras!.find((x) => x.id === e.id)!.text = v)) })
  }
  for (const it of proofItems) {
    const fixes = proofread(it.text)
    if (!fixes.length) continue
    issues.push({
      id: `lang-${JSON.stringify(it.sel)}`,
      level: 'warn',
      group: 'لغة',
      title: `ملاحظات لغوية في «${it.label}» (${fixes.length})`,
      detail: fixes
        .slice(0, 4)
        .map((f) => `«${f.wrong.trim() || '␣'}» ← «${f.right.trim() || '␣'}» (${f.reason})`)
        .join(' · '),
      sel: it.sel,
      fixLabel: 'تصحيح تلقائي',
      fix: () => it.set(applyFixes(it.text, fixes)),
    })
  }

  /* ---------- الصور ---------- */
  const scAsset = assetInfoSync(d.content.scene?.assetId)
  const sr = sceneRect(d.content.scene, scAsset, cv)
  if (sr && scAsset && sr.w / scAsset.w > 1.7) {
    issues.push({ id: 'lowres-scene', level: 'warn', group: 'صور', title: 'دقة صورة الخلفية منخفضة', detail: `الصورة تُكبَّر ${(sr.w / scAsset.w).toFixed(1)}× فقد تظهر مموّهة. استخدم صورة أكبر أو قلّل تكبيرها.`, sel: { kind: 'scene' } })
  }
  const pr = productRectOf(d)
  const cut = cutoutSync(d.content.product)
  if (pr && cut && !d.content.scene && pr.w / cut.srcW > 1.7) {
    issues.push({ id: 'lowres-product', level: 'warn', group: 'صور', title: 'دقة صورة المنتج منخفضة', detail: `تُكبَّر ${(pr.w / cut.srcW).toFixed(1)}× — قد تفقد الحدّة. جرّب «تحسين الصورة → رفع الدقة».`, sel: { kind: 'product' } })
  }

  /* ---------- قياسات من الشاشة ---------- */
  const root = bridge.poster
  if (root) {
    const boxes: { sel: Selection; label: string; box: Box; kind: 'block' | 'free' | 'obj'; key?: string; eid: string }[] = []
    const blockBox = bridge.boxOf('block')
    if (blockBox) boxes.push({ sel: { kind: 'textBlock' }, label: 'كتلة النصوص', box: blockBox, kind: 'block', eid: 'block' })
    for (const k of TEXT_KEYS) {
      const st = d.style.text.items[k]
      if (st.free && st.visible && showWhenOk(st.showWhen, answer) && showIfOk(st.showIf, texts) && valueOf(k).trim()) {
        const b = bridge.boxOf(`text:${k}`)
        if (b) boxes.push({ sel: { kind: 'text', key: k }, label: cat.labels[k], box: b, kind: 'free', eid: `text:${k}` })
      }
    }
    for (const e of d.content.extras ?? []) {
      const b = bridge.boxOf(`text:${e.id}`)
      if (b) boxes.push({ sel: { kind: 'extra', id: e.id }, label: 'نص إضافي', box: b, kind: 'free', eid: `text:${e.id}` })
    }
    for (const x of d.style.decor) {
      if (!x.visible || !['sticker', 'qr', 'image'].includes(x.kind)) continue
      const b = bridge.boxOf(`decor:${x.id}`)
      if (b) boxes.push({ sel: { kind: 'decor', id: x.id }, label: x.name || 'عنصر', box: b, kind: 'obj', eid: `decor:${x.id}` })
    }

    // حجم الخط
    root.querySelectorAll<HTMLElement>('.lk-ti').forEach((el) => {
      const id = el.dataset.key ?? ''
      // أعمق سطر نصي (المزايا تُغلَّف بحاويات dir أيضاً)
      const line = Array.from(el.querySelectorAll<HTMLElement>('div[dir]')).find((n) => !n.querySelector('div[dir]'))
      if (!line) return
      const size = parseFloat(getComputedStyle(line).fontSize)
      const isKey = (TEXT_KEYS as string[]).includes(id)
      const sel: Selection = isKey ? { kind: 'text', key: id as TextKey } : { kind: 'extra', id }
      const isNote = id === 'note'
      if (size < (isNote ? 20 : 26)) {
        const st = isKey ? d.style.text.items[id as TextKey] : d.content.extras?.find((e) => e.id === id)?.style
        const fixable = st && (st.fit === 'none' || st.fit === 'kashida')
        issues.push({
          id: `small-${id}`,
          level: size < 18 ? 'error' : 'warn',
          group: 'وضوح',
          title: `خط صغير: «${isKey ? cat.labels[id as TextKey] : 'نص إضافي'}» (${Math.round(size)}px)`,
          detail: 'الخط الصغير يصعب قراءته على الهاتف. الأفضل 28px فأكثر للنصوص الأساسية.',
          sel,
          fixLabel: fixable ? 'رفعه إلى 30px' : undefined,
          fix: fixable
            ? () =>
                change((x) => {
                  const t = isKey ? x.style.text.items[id as TextKey] : x.content.extras?.find((e) => e.id === id)?.style
                  if (t) t.size = 30
                })
            : undefined,
        })
      }
    })

    // الهوامش
    const M = 36
    for (const b of boxes) {
      const { x, y, w, h } = b.box
      const out = x < M || y < M || x + w > cv.w - M || y + h > cv.h - M
      if (out && !(b.kind === 'obj' && (w > cv.w * 0.7 || h > cv.h * 0.7))) {
        issues.push({
          id: `edge-${b.eid}`,
          level: 'warn',
          group: 'تخطيط',
          title: `«${b.label}» قريب من حافة التصميم`,
          detail: 'قد يُقصّ عند النشر أو يبدو ملتصقاً بالحافة. اترك هامشاً 40px على الأقل.',
          sel: b.sel,
          fixLabel: 'تحريكه للداخل',
          fix: () => {
            const dx = x < M ? M - x : x + w > cv.w - M ? cv.w - M - (x + w) : 0
            const dy = y < M ? M - y : y + h > cv.h - M ? cv.h - M - (y + h) : 0
            change((dd) => translateSel(dd, b.sel, Math.round(dx), Math.round(dy)))
          },
        })
      }
    }

    // تداخل مع اللوغوهات وشريط التواصل
    const chrome: { name: string; box: Box | null; below: boolean }[] = [
      { name: 'شريط التواصل', box: d.style.hide?.contact ? null : bridge.boxOf('contact'), below: true },
      { name: 'لوغو LKGT', box: d.style.hide?.logo ? null : bridge.boxOf('logo'), below: false },
      { name: 'لوغو الشريك', box: d.style.hide?.partner ? null : bridge.boxOf('partner'), below: false },
    ]
    for (const b of boxes.filter((x) => x.kind !== 'obj')) {
      for (const c of chrome) {
        if (!c.box) continue
        const ov = overlap(b.box, c.box)
        if (ov > 400) {
          const dy = c.below ? -(b.box.y + b.box.h - c.box.y + 24) : c.box.y + c.box.h - b.box.y + 24
          issues.push({
            id: `chrome-${b.eid}-${c.name}`,
            level: 'error',
            group: 'تخطيط',
            title: `«${b.label}» يتداخل مع ${c.name}`,
            detail: 'عناصر الهوية الثابتة يجب أن تبقى واضحة وغير مغطاة.',
            sel: b.sel,
            fixLabel: c.below ? 'رفعه فوق الشريط' : 'إنزاله تحت اللوغو',
            fix: () => change((dd) => translateSel(dd, b.sel, 0, Math.round(dy))),
          })
        }
      }
    }

    // المناطق الآمنة للستوري
    const sT = cv.safeTop ?? 0
    const sB = cv.safeBottom ?? 0
    if (sT || sB) {
      for (const b of boxes.filter((x) => x.kind !== 'obj')) {
        if ((sT && b.box.y < sT * 0.75) || (sB && b.box.y + b.box.h > cv.h - sB * 0.75)) {
          issues.push({ id: `safe-${b.eid}`, level: 'warn', group: 'تخطيط', title: `«${b.label}» داخل منطقة واجهة الستوري`, detail: 'أعلى وأسفل الستوري تغطيهما أزرار إنستغرام. حرّك العنصر للداخل.', sel: b.sel })
        }
      }
    }

    // المنتج مقصوص
    const pb = bridge.boxOf('product')
    if (pb) {
      const cutX = Math.max(0, -pb.x) + Math.max(0, pb.x + pb.w - cv.w)
      const cutY = Math.max(0, -pb.y) + Math.max(0, pb.y + pb.h - cv.h)
      if (cutX > pb.w * 0.06 || cutY > pb.h * 0.06) {
        issues.push({ id: 'product-crop', level: 'info', group: 'تخطيط', title: 'المنتج يخرج من حدود التصميم', detail: 'جزء من المنتج مقصوص. إن لم يكن مقصوداً صغّره أو حرّكه.', sel: { kind: 'product' } })
      }
    }

    // التباين
    try {
      const partners = allPartners(s)
      const canvas = await renderCanvas(d, s.brand, partners, s.fontsVersion, { scale: 0.3, format: 'png', layers: { exclude: ['text', 'decor-top', 'chrome'] } })
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const k = canvas.width / cv.w
      const avg = (b: Box) => {
        const x = Math.max(0, Math.floor(b.x * k))
        const y = Math.max(0, Math.floor(b.y * k))
        const w = Math.max(1, Math.min(canvas.width - x, Math.floor(b.w * k)))
        const h = Math.max(1, Math.min(canvas.height - y, Math.floor(b.h * k)))
        const data = ctx.getImageData(x, y, w, h).data
        let r = 0, g = 0, bl = 0, n = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 30) continue
          r += data[i]
          g += data[i + 1]
          bl += data[i + 2]
          n++
        }
        return n ? `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(bl / n)})` : '#FFFFFF'
      }
      const check = (label: string, sel: Selection, id: string, box: Box, color: string, size: number, deco: string | null, setColor: (c: string) => void) => {
        const bg = deco ?? avg(box)
        const ratio = contrastRatio(color, bg)
        const need = size >= 40 ? 3 : 4.5
        if (ratio < need) {
          const better = readableOn(bg)
          issues.push({
            id: `contrast-${id}`,
            level: ratio < 2 ? 'error' : 'warn',
            group: 'وضوح',
            title: `تباين ضعيف: «${label}» (${ratio.toFixed(1)}:1)`,
            detail: `لون النص قريب من لون الخلفية خلفه. الحد الأدنى الموصى به ${need}:1.`,
            sel,
            fixLabel: better === '#111214' ? 'جعل النص داكناً' : 'جعل النص فاتحاً',
            fix: () => setColor(better),
          })
        }
      }
      for (const kx of TEXT_KEYS) {
        const st = d.style.text.items[kx]
        if (!st.visible || !valueOf(kx).trim() || st.gradient || st.fillImage || !showWhenOk(st.showWhen, answer) || !showIfOk(st.showIf, texts)) continue
        const b = bridge.boxOf(st.free ? `text:${kx}` : `text:${kx}`)
        if (!b) continue
        const boxed = ['pill', 'box', 'outlineBox', 'tab'].includes(st.deco) && st.decoStyle.fill && st.decoStyle.fill !== 'transparent' && !st.decoStyle.fill.includes('rgba')
        const panel = !st.free && d.style.text.panel.kind === 'solid' ? d.style.text.panel.fill : null
        check(cat.labels[kx], { kind: 'text', key: kx }, kx, b, st.color, st.size, boxed ? st.decoStyle.fill : panel, (c) => change((x) => void (x.style.text.items[kx].color = c)))
      }
      for (const e of d.content.extras ?? []) {
        const st = e.style
        if (st.visible === false || st.gradient || st.fillImage || !e.text.trim()) continue
        const b = bridge.boxOf(`text:${e.id}`)
        if (!b) continue
        const boxed = ['pill', 'box', 'outlineBox', 'tab'].includes(st.deco) && st.decoStyle.fill && !st.decoStyle.fill.includes('rgba')
        check('نص إضافي', { kind: 'extra', id: e.id }, e.id, b, st.color, st.size, boxed ? st.decoStyle.fill : null, (c) => change((x) => void (x.content.extras!.find((y) => y.id === e.id)!.style.color = c)))
      }
    } catch {
      /* فحص التباين اختياري */
    }
  }

  const order: Record<IssueLevel, number> = { error: 0, warn: 1, info: 2 }
  return issues.sort((a, b) => order[a.level] - order[b.level])
}

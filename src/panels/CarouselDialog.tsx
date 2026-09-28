import { useMemo, useState } from 'react'
import { GalleryHorizontal } from 'lucide-react'
import { Btn, Chips, Group, Switch } from '../ui/kit'
import { Modal } from './Dialogs'
import { replaceSlides, syncedSlides, toast, useEditor } from '../store/editor'
import { emptyContent } from '../model/demo'
import { canvasOf, type Design } from '../model/types'
import { decor } from '../model/templates'
import { defaultStickerSize, findSticker } from '../poster/stickers'

/* كاروسيل من نص: كل فقرة = شريحة بنفس التصميم الحالي (مثالي لـ «هل تعلم» والنصائح) */

const close = () => useEditor.setState({ dialog: null })

function parts(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function CarouselDialog() {
  const [text, setText] = useState('')
  const [split, setSplit] = useState<'first' | 'whole'>('first')
  const [numbering, setNumbering] = useState(true)
  const [swipe, setSwipe] = useState(true)
  const list = useMemo(() => parts(text), [text])
  const design = useEditor((s) => s.design)
  const brand = useEditor((s) => s.brand)
  const cv = canvasOf(design)

  const build = () => {
    if (!list.length) return toast('اكتب نصاً أولاً (افصل الفقرات بسطر فارغ)', 'error')
    const cur = syncedSlides()[useEditor.getState().slideIndex]
    const total = list.length
    const slides: Design[] = list.map((par, i) => {
      const lines = par.split('\n')
      const title = split === 'first' && lines.length > 1 ? lines[0] : par
      const tagline = split === 'first' && lines.length > 1 ? lines.slice(1).join(' ') : ''
      const content = emptyContent(cur.content.partnerLogoId, cur.category ?? 'ads')
      content.texts.title = title
      content.texts.tagline = tagline
      const d: Design = { ...structuredClone(cur), content: { ...content, extras: [] }, touched: true }
      d.style.decor = d.style.decor.filter((x) => !x.carry)
      const add = (id: string, x: number, y: number, w: number, h: number, color: string, color2: string, txt: string) => {
        const it = decor({ kind: 'sticker', layer: 'top', x, y, w, h, color, color2, sticker: { id, text: txt } })
        it.id = `o_c${i}_${id}`
        it.carry = true
        d.style.decor.push(it)
      }
      if (numbering && total > 1) {
        const w = 104
        add('b:ring', Math.round((cv.w - w) / 2), (cv.safeTop ?? 0) + 70, w, w, brand.secondary, '#FFFFFF', `${String(i + 1).padStart(2, '0')}`)
      }
      if (swipe && total > 1) {
        const def = findSticker('b:pill')!
        const sz = defaultStickerSize(def)
        const w = 230
        const h = Math.round((w * sz.h) / sz.w)
        const y = brand.contact.y + (cv.h - 1440) - (cv.safeBottom ?? 0) - h - 26
        if (i < total - 1) add('b:pill', 60, y, w, h, brand.primary, '#FFFFFF', 'اسحب')
        else add('b:pill', 60, y, w, h, brand.secondary, '#FFFFFF', 'تابعنا')
      }
      return d
    })
    const ok = syncedSlides().length <= 1 || confirm('سيتم استبدال شرائح المشروع الحالية. المتابعة؟')
    if (!ok) return
    replaceSlides(slides, 0)
    toast(`تم إنشاء ${slides.length} شريحة ✓`, 'ok')
    close()
  }

  return (
    <Modal title="كاروسيل من نص" onClose={close}>
      <p className="hint">الصق النص وافصل بين الشرائح بسطر فارغ. يُستخدم شكل القالب الحالي لكل الشرائح.</p>
      <textarea className="txa big" rows={9} dir="auto" placeholder={'هل تعلم أن ...\nشرح مختصر\n\nالنصيحة الثانية ...\n\nالنصيحة الثالثة ...'} value={text} onChange={(e) => setText(e.target.value)} />
      <Group>
        <Chips<'first' | 'whole'>
          value={split}
          options={[
            { value: 'first', label: 'السطر الأول عنوان والباقي شرح' },
            { value: 'whole', label: 'كل الفقرة كعنوان' },
          ]}
          onChange={setSplit}
        />
        <Switch label="ترقيم الشرائح (01، 02…)" checked={numbering} onChange={setNumbering} />
        <Switch label="زر «اسحب» على الشرائح" checked={swipe} onChange={setSwipe} />
      </Group>
      <div className="row-btns">
        <Btn variant="primary" icon={<GalleryHorizontal size={15} />} onClick={build} disabled={!list.length}>
          إنشاء {list.length || ''} شريحة
        </Btn>
        <Btn variant="ghost" onClick={close}>
          إلغاء
        </Btn>
      </div>
    </Modal>
  )
}

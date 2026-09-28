import { useDeferredValue, useMemo, useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { PosterThumb } from '../poster/PosterThumb'
import { addSlide, allPartners, deleteSlide, duplicateSlide, moveSlide, switchSlide, syncedSlides, useEditor } from '../store/editor'

/* شريط الشرائح (كاروسيل): تنقّل، ترتيب بالسحب، نسخ، حذف */

export function Filmstrip() {
  const slides = useEditor((s) => s.slides)
  const index = useEditor((s) => s.slideIndex)
  const design = useEditor((s) => s.design)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const deferred = useDeferredValue(design)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const list = slides.map((x, i) => (i === index ? deferred : x))
  void syncedSlides

  return (
    <div className="filmstrip">
      <div className="fs-list">
        {list.map((d, i) => (
          <div
            key={i}
            className={`fs-item ${i === index ? 'on' : ''} ${over === i && drag !== null && drag !== i ? 'over' : ''}`}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(i)
            }}
            onDragEnd={() => {
              setDrag(null)
              setOver(null)
            }}
            onDrop={() => {
              if (drag !== null && drag !== i) moveSlide(drag, i)
              setDrag(null)
              setOver(null)
            }}
            onClick={() => switchSlide(i)}
          >
            <div className="fs-thumb">
              <PosterThumb design={d} brand={brand} partners={partners} fontsVersion={fontsVersion} placeholders="thumb" lazy={false} />
            </div>
            <span className="fs-n">{i + 1}</span>
            <div className="fs-act">
              <button title="نسخ الشريحة" onClick={(e) => (e.stopPropagation(), duplicateSlide(i))}>
                <Copy size={12} />
              </button>
              {list.length > 1 && (
                <button title="حذف الشريحة" onClick={(e) => (e.stopPropagation(), deleteSlide(i))}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        <button className="fs-add" onClick={() => addSlide('blank')} title="شريحة فارغة بنفس التصميم">
          <Plus size={18} />
          <span>شريحة</span>
        </button>
        <button className="fs-add ghost" onClick={() => addSlide('duplicate')} title="نسخ الشريحة الحالية">
          <Copy size={15} />
          <span>نسخ</span>
        </button>
      </div>
    </div>
  )
}

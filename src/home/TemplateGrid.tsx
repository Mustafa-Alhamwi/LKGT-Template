import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Poster } from '../poster/Poster'
import { POSTER_W } from '../model/types'
import type { BrandConfig, Design, PartnerLogo, Template, TemplateStyle } from '../model/types'
import { emptyContent } from '../model/demo'
import { Menu, MenuItem } from '../ui/kit'
import { deleteUserTemplate, duplicateTemplate, renameUserTemplate, useEditor } from '../store/editor'

/* شبكة القوالب: معاينات حية لكل قالب (فارغة بلا صور) — تُرسم فقط عند ظهورها */

const Thumb = memo(function Thumb({
  style,
  brand,
  partners,
  fontsVersion,
}: {
  style: TemplateStyle
  brand: BrandConfig
  partners: PartnerLogo[]
  fontsVersion: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVis(true), { rootMargin: '400px' })
    io.observe(el)
    return () => {
      ro.disconnect()
      io.disconnect()
    }
  }, [])
  const design = useMemo<Design>(() => ({ templateId: 't', style, content: emptyContent(), touched: false }), [style])
  const s = w / POSTER_W
  return (
    <div ref={ref} className="thumb-frame">
      {vis && w > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: POSTER_W, transform: `scale(${s})`, transformOrigin: '0 0' }}>
          <Poster design={design} brand={brand} partners={partners} fontsVersion={fontsVersion} placeholders="thumb" />
        </div>
      )}
    </div>
  )
})

export interface GridItem {
  t: Template
  style: TemplateStyle
}

export function TemplateGrid({
  items,
  onPick,
  activeId,
  brand,
  partners,
  fontsVersion,
  min = 220,
}: {
  items: GridItem[]
  onPick: (id: string) => void
  activeId?: string
  brand: BrandConfig
  partners: PartnerLogo[]
  fontsVersion: number
  min?: number
}) {
  const overrides = useEditor((s) => s.overrides)
  return (
    <div className="tgrid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {items.map(({ t, style }) => (
        <div key={t.id} className={`tcard ${t.id === activeId ? 'active' : ''}`}>
          <button className="tcard-main" onClick={() => onPick(t.id)}>
            <Thumb style={style} brand={brand} partners={partners} fontsVersion={fontsVersion} />
            <div className="tcard-meta">
              <div>
                <strong>{t.name}</strong>
                <span>{t.nameEn}</span>
              </div>
              <i className={`tdot ${style.theme}`} title={style.theme === 'dark' ? 'داكن' : 'فاتح'} />
            </div>
            <span className="tcard-use">استخدام القالب</span>
          </button>
          <div className="tcard-menu">
            <Menu trigger={<MoreHorizontal size={16} />}>
              {(close) => (
                <>
                  <MenuItem
                    icon={<Copy size={15} />}
                    onClick={() => {
                      duplicateTemplate(t.id)
                      close()
                    }}
                  >
                    نسخ كقالب جديد
                  </MenuItem>
                  {!t.builtIn && (
                    <MenuItem
                      icon={<Pencil size={15} />}
                      onClick={() => {
                        const n = prompt('اسم القالب', t.name)
                        if (n) renameUserTemplate(t.id, n)
                        close()
                      }}
                    >
                      إعادة تسمية
                    </MenuItem>
                  )}
                  {t.builtIn && overrides[t.id] && (
                    <MenuItem
                      icon={<RotateCcw size={15} />}
                      onClick={() => {
                        const { [t.id]: _x, ...rest } = overrides
                        useEditor.setState({ overrides: rest })
                        close()
                      }}
                    >
                      استعادة التصميم الأصلي
                    </MenuItem>
                  )}
                  {!t.builtIn && (
                    <MenuItem
                      danger
                      icon={<Trash2 size={15} />}
                      onClick={() => {
                        if (confirm(`حذف القالب «${t.name}»؟`)) deleteUserTemplate(t.id)
                        close()
                      }}
                    >
                      حذف
                    </MenuItem>
                  )}
                </>
              )}
            </Menu>
          </div>
        </div>
      ))}
    </div>
  )
}

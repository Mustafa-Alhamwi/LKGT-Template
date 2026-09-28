import { useMemo } from 'react'
import { Copy, MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react'
import { PosterThumb } from '../poster/PosterThumb'
import type { BrandConfig, Design, PartnerLogo, Template, TemplateStyle } from '../model/types'
import { DEFAULT_CANVAS } from '../model/types'
import { emptyContent } from '../model/demo'
import { categoryDef } from '../model/categories'
import { Menu, MenuItem } from '../ui/kit'
import { deleteUserTemplate, duplicateTemplate, renameUserTemplate, toggleFavorite, useEditor } from '../store/editor'

/* شبكة القوالب: معاينات حية لكل قالب (فارغة بلا صور) — تُرسم فقط عند ظهورها */

export interface GridItem {
  t: Template
  style: TemplateStyle
}

function TemplateThumb({ item, brand, partners, fontsVersion }: { item: GridItem; brand: BrandConfig; partners: PartnerLogo[]; fontsVersion: number }) {
  const design = useMemo<Design>(
    () => ({ templateId: item.t.id, style: item.style, content: emptyContent(null, item.t.category), touched: false, category: item.t.category, canvas: DEFAULT_CANVAS }),
    [item],
  )
  return <PosterThumb design={design} brand={brand} partners={partners} fontsVersion={fontsVersion} />
}

export function TemplateGrid({
  items,
  onPick,
  activeId,
  brand,
  partners,
  fontsVersion,
  min = 220,
  showCategory = false,
}: {
  items: GridItem[]
  onPick: (id: string) => void
  activeId?: string
  brand: BrandConfig
  partners: PartnerLogo[]
  fontsVersion: number
  min?: number
  showCategory?: boolean
}) {
  const overrides = useEditor((s) => s.overrides)
  const favorites = useEditor((s) => s.favorites)
  return (
    <div className="tgrid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {items.map((item) => {
        const { t, style } = item
        const fav = favorites.includes(t.id)
        return (
          <div key={t.id} className={`tcard ${t.id === activeId ? 'active' : ''}`}>
            <button className="tcard-main" onClick={() => onPick(t.id)}>
              <TemplateThumb item={item} brand={brand} partners={partners} fontsVersion={fontsVersion} />
              <div className="tcard-meta">
                <div>
                  <strong>{t.name}</strong>
                  <span>{showCategory ? categoryDef(t.category).name : t.nameEn}</span>
                </div>
                <i className={`tdot ${style.theme}`} title={style.theme === 'dark' ? 'داكن' : 'فاتح'} />
              </div>
              <span className="tcard-use">استخدام القالب</span>
            </button>
            <button className={`tcard-fav ${fav ? 'on' : ''}`} title={fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'} onClick={() => toggleFavorite(t.id)}>
              <Star size={15} fill={fav ? 'currentColor' : 'none'} />
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
        )
      })}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { allPartners, applyTemplate, useEditor } from '../store/editor'
import { EditorHeader } from './Header'
import { Stage } from './Stage'
import { Inspector } from './Inspector'
import { FilterBar, useTemplateItems, type Filter } from '../home/Home'
import { categoryDef } from '../model/categories'
import { TemplateGrid } from '../home/TemplateGrid'

function Gallery() {
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const activeId = useEditor((s) => s.design.templateId)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const cat = useEditor((s) => s.design.category ?? 'ads')
  const [filter, setFilter] = useState<Filter>('all')
  const [all, setAll] = useState(false)
  const [q, setQ] = useState('')
  const items = useTemplateItems(filter, q, all ? 'all' : cat)
  return (
    <div className="drawer-back" onPointerDown={() => useEditor.setState({ gallery: false })}>
      <div className="drawer" onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>تغيير القالب</h3>
            <p>يبقى محتواك (الصورة والنصوص) كما هو ويتغير التصميم فقط. الفئة: {categoryDef(cat).name}</p>
          </div>
          <button className="ibtn" onClick={() => useEditor.setState({ gallery: false })}>
            <ChevronLeft size={18} />
          </button>
        </header>
        <FilterBar filter={filter} setFilter={setFilter} q={q} setQ={setQ} />
        <label className="drawer-all">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> عرض قوالب كل الفئات
        </label>
        <div className="drawer-body">
          <TemplateGrid
            items={items}
            min={170}
            activeId={activeId}
            brand={brand}
            partners={partners}
            fontsVersion={fontsVersion}
            showCategory={all}
            onPick={(id) => {
              applyTemplate(id)
              useEditor.setState({ gallery: false })
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function Editor() {
  const gallery = useEditor((s) => s.gallery)
  return (
    <div className="editor">
      <EditorHeader />
      <div className="ed-body">
        <Stage />
        <Inspector />
      </div>
      {gallery && <Gallery />}
    </div>
  )
}

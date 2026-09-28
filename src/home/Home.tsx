import { useMemo, useState } from 'react'
import { ArrowLeft, Moon, Plus, Search, Settings, Sun, Upload, Download } from 'lucide-react'
import { LkgtLogo } from '../brand/LkgtLogo'
import { CATEGORIES } from '../model/templates'
import {
  allPartners,
  allTemplates,
  continueDesign,
  newBlankTemplate,
  openTemplate,
  templateStyle,
  toast,
  useEditor,
} from '../store/editor'
import { TemplateGrid } from './TemplateGrid'
import { exportTemplatesFile, importTemplatesFile } from '../lib/templateIO'
import { pickFile } from '../lib/importer'

type Filter = 'all' | 'light' | 'dark' | 'mine'

export function useTemplateItems(filter: Filter, q: string) {
  const userTemplates = useEditor((s) => s.userTemplates)
  const overrides = useEditor((s) => s.overrides)
  return useMemo(() => {
    const query = q.trim().toLowerCase()
    return allTemplates({ userTemplates })
      .map((t) => ({ t, style: templateStyle({ overrides }, t) }))
      .filter(({ t, style }) => {
        if (filter === 'light' && style.theme !== 'light') return false
        if (filter === 'dark' && style.theme !== 'dark') return false
        if (filter === 'mine' && t.builtIn) return false
        if (!query) return true
        return `${t.name} ${t.nameEn} ${t.tags.join(' ')}`.toLowerCase().includes(query)
      })
  }, [userTemplates, overrides, filter, q])
}

export function FilterBar({ filter, setFilter, q, setQ }: { filter: Filter; setFilter: (f: Filter) => void; q: string; setQ: (s: string) => void }) {
  return (
    <div className="filterbar">
      <div className="chips">
        {(
          [
            ['all', 'الكل'],
            ['light', 'فاتحة'],
            ['dark', 'داكنة'],
            ['mine', 'قوالبي'],
          ] as [Filter, string][]
        ).map(([v, l]) => (
          <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>
      <label className="search">
        <Search size={16} />
        <input placeholder="ابحث عن قالب…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
    </div>
  )
}

export function Home() {
  const uiTheme = useEditor((s) => s.uiTheme)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const userTemplates = useEditor((s) => s.userTemplates)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const touched = useEditor((s) => s.design.touched)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const items = useTemplateItems(filter, q)

  return (
    <div className="home">
      <header className="home-top">
        <div className="brand">
          <LkgtLogo variant="color" height={40} />
          <div>
            <strong>استوديو LKGT</strong>
            <span>قوالب السوشال ميديا</span>
          </div>
        </div>
        <nav className="cats">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={c.id === 'ads' ? 'on' : ''} disabled={!c.ready} title={c.ready ? '' : 'قريباً'}>
              {c.name}
              {!c.ready && <em>قريباً</em>}
            </button>
          ))}
        </nav>
        <div className="home-actions">
          <button className="ibtn" title="استيراد قوالب من ملف" onClick={async () => {
            const [f] = await pickFile('.json,application/json')
            if (f) importTemplatesFile(f).catch((e) => toast(String(e), 'error'))
          }}>
            <Upload size={18} />
          </button>
          <button className="ibtn" title="تصدير قوالبي لملف" disabled={!userTemplates.length} onClick={() => exportTemplatesFile(userTemplates).catch((e) => toast(String(e), 'error'))}>
            <Download size={18} />
          </button>
          <button className="ibtn" title={uiTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'} onClick={() => useEditor.setState({ uiTheme: uiTheme === 'dark' ? 'light' : 'dark' })}>
            {uiTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="ibtn" title="الإعدادات" onClick={() => useEditor.setState({ dialog: 'settings' })}>
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="home-body">
        <section className="hero">
          <div>
            <h1>اختر قالباً وابدأ التصميم</h1>
            <p>{items.length} قالب لإعلانات المنتجات بمقاس إنستغرام 1080×1440 — كلها فارغة وجاهزة لتضع منتجك ونصوصك.</p>
          </div>
          <div className="hero-actions">
            {touched && (
              <button className="btn primary lg" onClick={continueDesign}>
                <ArrowLeft size={18} />
                <span>متابعة تصميمي الحالي</span>
              </button>
            )}
            <button className="btn lg" onClick={newBlankTemplate}>
              <Plus size={18} />
              <span>قالب جديد من الصفر</span>
            </button>
          </div>
        </section>

        <FilterBar filter={filter} setFilter={setFilter} q={q} setQ={setQ} />

        {items.length ? (
          <TemplateGrid items={items} onPick={openTemplate} brand={brand} partners={partners} fontsVersion={fontsVersion} />
        ) : (
          <div className="empty big">
            <strong>{filter === 'mine' ? 'لم تحفظ أي قالب بعد' : 'لا توجد نتائج'}</strong>
            <p>{filter === 'mine' ? 'افتح أي قالب، عدّله، ثم احفظه كقالب جديد من قائمة «حفظ».' : 'جرّب كلمة بحث أخرى.'}</p>
          </div>
        )}
      </main>
    </div>
  )
}

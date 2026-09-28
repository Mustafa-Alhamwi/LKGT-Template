import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, BookOpen, Boxes, X, CalendarDays, Command, Copy, FileArchive, FolderOpen, Layers, MoreHorizontal, Moon, Pencil, Plus, Search, Settings, Sun, Trash2, Upload, Download, Star,
} from 'lucide-react'
import { LkgtLogo } from '../brand/LkgtLogo'
import { CATEGORY_DEFS } from '../model/categories'
import { FORMATS } from '../model/formats'
import {
  allPartners,
  allTemplates,
  continueDesign,
  newBlankTemplate,
  openTemplate,
  setPrefs,
  styleFor,
  toast,
  useEditor,
} from '../store/editor'
import type { CategoryId, TemplateStyle } from '../model/types'
import { TemplateGrid } from './TemplateGrid'
import { exportPack, importPack } from '../lib/packIO'
import { pickFile } from '../lib/importer'
import { COLOR_FAMILIES, familyOf, type ColorFam } from '../lib/color'
import { Menu, MenuItem } from '../ui/kit'
import { deleteProjectById, duplicateProjectById, importProjectFile, listProjects, openProjectById, renameProjectById, type ProjectMeta } from '../store/projects'
import { categoryDef } from '../model/categories'
import { openKits } from '../store/lock'

export type Filter = 'all' | 'fav' | 'light' | 'dark' | 'mine'

/** عائلة اللون الغالبة في القالب */
function templateFamily(st: TemplateStyle): ColorFam {
  const cands = [st.backdrop.color2, st.backdrop.color, st.shape.kind !== 'none' ? st.shape.color : '', st.text.items.title.color, st.contact.accent]
  for (const c of cands) {
    if (!c) continue
    const f = familyOf(c)
    if (f) return f
  }
  return 'neutral'
}

export function useTemplateItems(filter: Filter, q: string, category: CategoryId | 'all' = 'all', color: ColorFam | 'all' = 'all') {
  const userTemplates = useEditor((s) => s.userTemplates)
  const overrides = useEditor((s) => s.overrides)
  const brand = useEditor((s) => s.brand)
  const favorites = useEditor((s) => s.favorites)
  return useMemo(() => {
    const query = q.trim().toLowerCase()
    return allTemplates({ userTemplates })
      .map((t) => ({ t, style: styleFor({ overrides, brand }, t) }))
      .filter(({ t, style }) => {
        if (category !== 'all' && t.category !== category) return false
        if (filter === 'fav' && !favorites.includes(t.id)) return false
        if (filter === 'light' && style.theme !== 'light') return false
        if (filter === 'dark' && style.theme !== 'dark') return false
        if (filter === 'mine' && t.builtIn) return false
        if (color !== 'all' && templateFamily(style) !== color) return false
        if (!query) return true
        return `${t.name} ${t.nameEn} ${t.tags.join(' ')}`.toLowerCase().includes(query)
      })
  }, [userTemplates, overrides, brand, favorites, filter, q, category, color])
}

export function FilterBar({
  filter,
  setFilter,
  q,
  setQ,
  color,
  setColor,
}: {
  filter: Filter
  setFilter: (f: Filter) => void
  q: string
  setQ: (s: string) => void
  color?: ColorFam | 'all'
  setColor?: (c: ColorFam | 'all') => void
}) {
  return (
    <div className="filterbar">
      <div className="chips">
        {(
          [
            ['all', 'الكل'],
            ['fav', '★ المفضلة'],
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
      {setColor && (
        <div className="color-dots" title="تصفية بحسب اللون">
          <button className={color === 'all' ? 'on all' : 'all'} onClick={() => setColor('all')} title="كل الألوان">
            <span />
          </button>
          {COLOR_FAMILIES.map((c) => (
            <button key={c.id} className={color === c.id ? 'on' : ''} onClick={() => setColor(color === c.id ? 'all' : c.id)} title={c.label}>
              <span style={{ background: c.dot }} />
            </button>
          ))}
        </div>
      )}
      <label className="search">
        <Search size={16} />
        <input placeholder="ابحث عن قالب…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
    </div>
  )
}

const fmtRel = (t: number) => {
  const d = (Date.now() - t) / 1000
  const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })
  if (d < 90) return 'الآن'
  if (d < 3600) return rtf.format(-Math.round(d / 60), 'minute')
  if (d < 86400) return rtf.format(-Math.round(d / 3600), 'hour')
  return rtf.format(-Math.round(d / 86400), 'day')
}

function Projects() {
  const view = useEditor((s) => s.view)
  const dialog = useEditor((s) => s.dialog)
  const [list, setList] = useState<ProjectMeta[] | null>(null)
  const load = () => listProjects().then(setList)
  // تُحدَّث القائمة عند دخول الرئيسية وبعد إغلاق أي نافذة (مثل التوليد الجماعي)
  useEffect(() => {
    if (view === 'home' && !dialog) void load()
  }, [view, dialog])
  if (!list || !list.length) return null
  return (
    <section className="projects">
      <div className="sec-head">
        <h2>مشاريعي</h2>
        <span>{list.length} مشروع محفوظ تلقائياً</span>
      </div>
      <div className="proj-row">
        {list.slice(0, 24).map((p) => (
          <div key={p.id} className="proj-card">
            <button className="proj-main" onClick={() => openProjectById(p.id)}>
              <div className="proj-thumb" style={{ aspectRatio: `${p.canvas.w} / ${p.canvas.h}` }}>
                {p.thumb ? <img src={p.thumb} alt="" /> : <Layers size={22} />}
                {p.slideCount > 1 && <b className="proj-slides">{p.slideCount} شرائح</b>}
              </div>
              <strong title={p.name}>{p.name}</strong>
              <span>
                {categoryDef(p.category as CategoryId).name} · {fmtRel(p.updated)}
              </span>
            </button>
            <div className="proj-menu">
              <Menu trigger={<MoreHorizontal size={16} />}>
                {(close) => (
                  <>
                    <MenuItem
                      icon={<Pencil size={15} />}
                      onClick={async () => {
                        close()
                        const n = prompt('اسم المشروع', p.name)
                        if (n) {
                          await renameProjectById(p.id, n)
                          void load()
                        }
                      }}
                    >
                      إعادة تسمية
                    </MenuItem>
                    <MenuItem
                      icon={<Copy size={15} />}
                      onClick={async () => {
                        close()
                        await duplicateProjectById(p.id)
                        void load()
                      }}
                    >
                      تكرار
                    </MenuItem>
                    <MenuItem
                      danger
                      icon={<Trash2 size={15} />}
                      onClick={async () => {
                        close()
                        if (confirm(`حذف المشروع «${p.name}» نهائياً؟`)) {
                          await deleteProjectById(p.id)
                          void load()
                        }
                      }}
                    >
                      حذف
                    </MenuItem>
                  </>
                )}
              </Menu>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FmtIcon({ w, h }: { w: number; h: number }) {
  const k = 20 / Math.max(w, h)
  return <i className="fmt-ic" style={{ width: Math.max(8, w * k), height: Math.max(8, h * k) }} />
}

function Welcome() {
  const [seen, setSeen] = useState(() => {
    try {
      return !!localStorage.getItem('lkgt-welcome')
    } catch {
      return true
    }
  })
  if (seen) return null
  const dismiss = () => {
    try {
      localStorage.setItem('lkgt-welcome', '1')
    } catch {
      /* */
    }
    setSeen(true)
  }
  return (
    <div className="welcome">
      <div>
        <b>أهلاً بك في استوديو LKGT 👋</b>
        <span>أنشئ منشورات إعلانية جاهزة في دقائق: اختر قالباً، أسقط صورة المنتج، واكتب نصك — ثم صدّر لأي مقاس. تعرّف على الأدوات الذكية في الدليل.</span>
      </div>
      <button
        className="btn primary sm"
        onClick={() => {
          dismiss()
          useEditor.setState({ dialog: 'guide' })
        }}
      >
        <BookOpen size={15} />
        <span>افتح الدليل</span>
      </button>
      <button className="ibtn" onClick={dismiss} title="إخفاء">
        <X size={16} />
      </button>
    </div>
  )
}

export function Home() {
  const uiTheme = useEditor((s) => s.uiTheme)
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const userTemplates = useEditor((s) => s.userTemplates)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const touched = useEditor((s) => s.design.touched || s.slides.length > 1)
  const projectName = useEditor((s) => s.projectName)
  const cat = useEditor((s) => s.homeCat)
  const homeFormat = useEditor((s) => s.prefs.homeFormat)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const [filter, setFilter] = useState<Filter>('all')
  const [color, setColor] = useState<ColorFam | 'all'>('all')
  const [q, setQ] = useState('')
  const items = useTemplateItems(filter, q, cat, color)
  const def = categoryDef(cat)
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of allTemplates({ userTemplates })) m[t.category] = (m[t.category] ?? 0) + 1
    return m
  }, [userTemplates])

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
          {CATEGORY_DEFS.map((c) => (
            <button key={c.id} className={c.id === cat ? 'on' : ''} onClick={() => useEditor.setState({ homeCat: c.id })}>
              {c.name}
              <em className="cnt">{counts[c.id] ?? 0}</em>
            </button>
          ))}
        </nav>
        <div className="home-actions">
          <button className="ibtn" title="لوحة الأوامر (Ctrl+K)" onClick={() => useEditor.setState({ dialog: 'commands' })}>
            <Command size={18} />
          </button>
          <button className="ibtn" title="دليل البرنامج" onClick={() => useEditor.setState({ dialog: 'guide' })}>
            <BookOpen size={18} />
          </button>
          <Menu trigger={<FolderOpen size={18} />} align="end">
            {(close) => (
              <>
                <MenuItem
                  icon={<FileArchive size={15} />}
                  onClick={async () => {
                    close()
                    const [f] = await pickFile('.lkgt,application/zip')
                    if (f) importProjectFile(f).catch((e) => toast(String(e), 'error'))
                  }}
                >
                  فتح ملف مشروع (.lkgt)
                </MenuItem>
                <MenuItem
                  icon={<Upload size={15} />}
                  onClick={async () => {
                    close()
                    const [f] = await pickFile('.lkpack,.json,application/zip,application/json')
                    if (f) importPack(f).catch((e) => toast(String(e), 'error'))
                  }}
                >
                  استيراد حزمة فريق (.lkpack)
                </MenuItem>
                <MenuItem
                  icon={<Download size={15} />}
                  onClick={() => {
                    close()
                    exportPack().catch((e) => toast(String(e), 'error'))
                  }}
                >
                  تصدير حزمة الفريق (قوالب + هوية + أنماط)
                </MenuItem>
              </>
            )}
          </Menu>
          <button className="ibtn" title="مجموعات الهوية" onClick={openKits}>
            <Boxes size={18} />
          </button>
          <button className="ibtn" title="تقويم المحتوى" onClick={() => useEditor.setState({ dialog: 'calendar' })}>
            <CalendarDays size={18} />
          </button>
          <button className="ibtn" title="توليد جماعي من صور وجدول" onClick={() => useEditor.setState({ dialog: 'batch' })}>
            <Layers size={18} />
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
        <Welcome />
        <section className="hero">
          <div>
            <h1>{def.name}</h1>
            <p>
              {def.blurb} — {items.length} قالب جاهز وفارغ، يتحول تلقائياً لأي مقاس.
            </p>
            <div className="fmt-pick" role="radiogroup" aria-label="مقاس التصميم">
              {FORMATS.slice(0, 5).map((f) => (
                <button key={f.id} className={homeFormat === f.id ? 'on' : ''} onClick={() => setPrefs({ homeFormat: f.id })} title={f.sub}>
                  <FmtIcon w={f.w} h={f.h} />
                  <span>{f.name.split(' ')[0] === 'منشور' ? f.name : f.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="hero-actions">
            {touched && (
              <button className="btn primary lg" onClick={continueDesign}>
                <ArrowLeft size={18} />
                <span>متابعة: {projectName || 'تصميمي الحالي'}</span>
              </button>
            )}
            <button className="btn lg" onClick={() => newBlankTemplate(cat)}>
              <Plus size={18} />
              <span>قالب جديد من الصفر</span>
            </button>
          </div>
        </section>

        <Projects />

        <FilterBar filter={filter} setFilter={setFilter} q={q} setQ={setQ} color={color} setColor={setColor} />

        {items.length ? (
          <TemplateGrid items={items} onPick={(id) => openTemplate(id)} brand={brand} partners={partners} fontsVersion={fontsVersion} />
        ) : (
          <div className="empty big">
            <Star size={30} />
            <strong>{filter === 'mine' ? 'لم تحفظ أي قالب بعد' : filter === 'fav' ? 'لا توجد قوالب مفضلة' : 'لا توجد نتائج'}</strong>
            <p>{filter === 'mine' ? 'افتح أي قالب، عدّله، ثم احفظه كقالب جديد من قائمة «ملف».' : filter === 'fav' ? 'انقر النجمة على أي قالب لإضافته إلى المفضلة.' : 'جرّب كلمة بحث أو لوناً آخر.'}</p>
          </div>
        )}
      </main>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Download, Images, LayoutGrid, Redo2, RotateCcw, Save, Settings, Eraser, Undo2, Keyboard, Sun, Moon, Copy } from 'lucide-react'
import { LkgtLogo } from '../brand/LkgtLogo'
import { Chips, Menu, MenuItem } from '../ui/kit'
import {
  allPartners,
  applyTemplate,
  clearContent,
  findTemplate,
  goHome,
  redo,
  restoreTemplateOriginal,
  resetStyle,
  saveTemplateDefault,
  stepTemplate,
  toast,
  undo,
  useEditor,
} from '../store/editor'
import { exportAllTemplates, exportCurrent } from '../lib/actions'
import { Stage } from './Stage'
import { Inspector } from './Inspector'
import { FilterBar, useTemplateItems } from '../home/Home'
import { TemplateGrid } from '../home/TemplateGrid'

function Gallery() {
  const brand = useEditor((s) => s.brand)
  const userPartners = useEditor((s) => s.userPartners)
  const fontsVersion = useEditor((s) => s.fontsVersion)
  const activeId = useEditor((s) => s.design.templateId)
  const partners = useMemo(() => allPartners({ userPartners }), [userPartners])
  const [filter, setFilter] = useState<'all' | 'light' | 'dark' | 'mine'>('all')
  const [q, setQ] = useState('')
  const items = useTemplateItems(filter, q)
  return (
    <div className="drawer-back" onPointerDown={() => useEditor.setState({ gallery: false })}>
      <div className="drawer" onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>تغيير القالب</h3>
            <p>يبقى محتواك (الصورة والنصوص) كما هو ويتغير التصميم فقط.</p>
          </div>
          <button className="ibtn" onClick={() => useEditor.setState({ gallery: false })}>
            <ChevronLeft size={18} />
          </button>
        </header>
        <FilterBar filter={filter} setFilter={setFilter} q={q} setQ={setQ} />
        <div className="drawer-body">
          <TemplateGrid
            items={items}
            min={170}
            activeId={activeId}
            brand={brand}
            partners={partners}
            fontsVersion={fontsVersion}
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
  const templateId = useEditor((s) => s.design.templateId)
  const userTemplates = useEditor((s) => s.userTemplates)
  const overrides = useEditor((s) => s.overrides)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const uiTheme = useEditor((s) => s.uiTheme)
  const fmt = useEditor((s) => s.exportFormat)
  const scale = useEditor((s) => s.exportScale)
  const gallery = useEditor((s) => s.gallery)
  const t = findTemplate({ userTemplates }, templateId)
  const hasOverride = !!t && t.builtIn && !!overrides[t.id]

  return (
    <div className="editor">
      <header className="ed-top">
        <div className="ed-start">
          <button className="btn ghost" onClick={goHome} title="العودة لاختيار القوالب">
            <ArrowRight size={17} />
            <span>الرئيسية</span>
          </button>
          <span className="vsep" />
          <LkgtLogo variant="color" height={26} />
          <button className="tname" onClick={() => useEditor.setState({ gallery: true })} title="تغيير القالب">
            <LayoutGrid size={16} />
            <span>
              <strong>{t?.name ?? 'قالب جديد'}</strong>
              <em>{t?.nameEn ?? 'New template'}</em>
            </span>
            <ChevronDown size={15} />
          </button>
          <button className="ibtn" onClick={() => stepTemplate(-1)} title="القالب السابق">
            <ChevronRight size={18} />
          </button>
          <button className="ibtn" onClick={() => stepTemplate(1)} title="القالب التالي">
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="ed-end">
          <button className="ibtn" onClick={undo} disabled={!canUndo} title="تراجع (Ctrl+Z)">
            <Undo2 size={18} />
          </button>
          <button className="ibtn" onClick={redo} disabled={!canRedo} title="إعادة (Ctrl+Y)">
            <Redo2 size={18} />
          </button>
          <span className="vsep" />
          <Menu
            trigger={
              <>
                <Save size={16} />
                <span>حفظ</span>
                <ChevronDown size={14} />
              </>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Save size={15} />}
                  onClick={() => {
                    if (saveTemplateDefault()) toast(`تم جعل هذا التصميم هو الشكل الافتراضي لقالب «${t?.name}»`, 'ok')
                    close()
                  }}
                >
                  جعله الشكل الافتراضي لهذا القالب
                </MenuItem>
                <MenuItem
                  icon={<Copy size={15} />}
                  onClick={() => {
                    close()
                    useEditor.setState({ dialog: 'saveTemplate' })
                  }}
                >
                  حفظ كقالب جديد…
                </MenuItem>
                <MenuItem
                  icon={<RotateCcw size={15} />}
                  onClick={() => {
                    resetStyle()
                    close()
                  }}
                >
                  تجاهل تعديلات التصميم
                </MenuItem>
                {hasOverride && (
                  <MenuItem
                    icon={<RotateCcw size={15} />}
                    onClick={() => {
                      restoreTemplateOriginal()
                      toast('تمت العودة لتصميم القالب الأصلي', 'ok')
                      close()
                    }}
                  >
                    استعادة تصميم القالب الأصلي
                  </MenuItem>
                )}
                <MenuItem
                  danger
                  icon={<Eraser size={15} />}
                  onClick={() => {
                    if (confirm('مسح كل المحتوى (الصورة والنصوص)؟')) clearContent()
                    close()
                  }}
                >
                  مسح المحتوى (قالب فارغ)
                </MenuItem>
              </>
            )}
          </Menu>
          <button className="ibtn" onClick={() => useEditor.setState({ dialog: 'shortcuts' })} title="اختصارات">
            <Keyboard size={18} />
          </button>
          <button className="ibtn" onClick={() => useEditor.setState({ uiTheme: uiTheme === 'dark' ? 'light' : 'dark' })} title="تبديل مظهر البرنامج">
            {uiTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="ibtn" onClick={() => useEditor.setState({ dialog: 'settings' })} title="الإعدادات">
            <Settings size={18} />
          </button>
          <div className="export-split">
            <button className="btn primary" onClick={exportCurrent} title="تصدير (Ctrl+E)">
              <Download size={16} />
              <span>تصدير {fmt.toUpperCase()}</span>
            </button>
            <Menu trigger={<ChevronDown size={16} />} align="end">
              {(close) => (
                <div className="exp-menu">
                  <div>
                    <span>الصيغة</span>
                    <Chips value={fmt} options={[{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }]} onChange={(v) => useEditor.setState({ exportFormat: v })} />
                  </div>
                  <div>
                    <span>الدقة</span>
                    <Chips<1 | 2> value={scale} options={[{ value: 1, label: '1080×1440' }, { value: 2, label: '2160×2880' }]} onChange={(v) => useEditor.setState({ exportScale: v })} />
                  </div>
                  <MenuItem
                    icon={<Images size={15} />}
                    onClick={() => {
                      close()
                      exportAllTemplates()
                    }}
                  >
                    تصدير المحتوى بكل القوالب
                  </MenuItem>
                </div>
              )}
            </Menu>
          </div>
        </div>
      </header>
      <div className="ed-body">
        <Stage />
        <Inspector />
      </div>
      {gallery && <Gallery />}
    </div>
  )
}

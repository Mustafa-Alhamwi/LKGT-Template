import { useState } from 'react'
import { TOOL_ITEMS } from './toolItems'
import {
  ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Command, Copy, Download, FileArchive, FilePlus2, FolderOpen, History, Images, LayoutGrid, Moon, Palette,
  Redo2, RotateCcw, Ruler, Save, Settings, Eraser, Sun, Undo2, Keyboard, WandSparkles,
} from 'lucide-react'
import { LkgtLogo } from '../brand/LkgtLogo'
import { Btn, Chips, Menu, MenuItem } from '../ui/kit'
import {
  clearContent,
  findTemplate,
  goHome,
  newProjectLike,
  redo,
  renameProject,
  resetStyle,
  restoreTemplateOriginal,
  saveTemplateDefault,
  setCanvas,
  setFormat,
  stepTemplate,
  toast,
  undo,
  useEditor,
} from '../store/editor'
import { exportAllTemplates, exportCurrent } from '../lib/actions'
import { FORMATS, customCanvas } from '../model/formats'
import { canvasOf } from '../model/types'
import { exportProjectFile, importProjectFile, saveVersion } from '../store/projects'
import { pickFile } from '../lib/importer'
import { categoryOf } from '../model/categories'

/* شريط أعلى المحرر: تنقل، مشروع، مقاس، ملف، أدوات، تصدير */

function FmtIcon({ w, h }: { w: number; h: number }) {
  const k = 18 / Math.max(w, h)
  return <i className="fmt-ic" style={{ width: Math.max(8, w * k), height: Math.max(8, h * k) }} />
}

function SizeMenu() {
  const design = useEditor((s) => s.design)
  const cv = canvasOf(design)
  const [w, setW] = useState(cv.w)
  const [h, setH] = useState(cv.h)
  return (
    <Menu
      trigger={
        <>
          <Ruler size={16} />
          <span className="ed-size">{cv.w}×{cv.h}</span>
          <ChevronDown size={14} />
        </>
      }
    >
      {(close) => (
        <div className="size-menu">
          <div className="sm-title">مقاس التصميم</div>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              className={`sm-item ${cv.format === f.id ? 'on' : ''}`}
              onClick={() => {
                close()
                void setFormat(f.id)
              }}
            >
              <FmtIcon w={f.w} h={f.h} />
              <span>
                <strong>{f.name}</strong>
                <em>{f.sub}</em>
              </span>
            </button>
          ))}
          <div className="sm-custom">
            <span>مخصص</span>
            <input type="number" value={w} onChange={(e) => setW(+e.target.value)} />
            <b>×</b>
            <input type="number" value={h} onChange={(e) => setH(+e.target.value)} />
            <Btn
              small
              onClick={() => {
                close()
                void setCanvas(customCanvas(w, h))
              }}
            >
              تطبيق
            </Btn>
          </div>
          <p className="hint">يُعاد ترتيب عناصر التصميم تلقائياً (اللوغو والتواصل يبقيان في أماكنهما الثابتة). للستوري تُراعى المناطق الآمنة.</p>
        </div>
      )}
    </Menu>
  )
}

export function EditorHeader() {
  const templateId = useEditor((s) => s.design.templateId)
  const userTemplates = useEditor((s) => s.userTemplates)
  const overrides = useEditor((s) => s.overrides)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const uiTheme = useEditor((s) => s.uiTheme)
  const fmt = useEditor((s) => s.exportFormat)
  const scale = useEditor((s) => s.exportScale)
  const projectName = useEditor((s) => s.projectName)
  const cv = useEditor((s) => canvasOf(s.design))
  const cat = useEditor((s) => categoryOf(s.design))
  const t = findTemplate({ userTemplates }, templateId)
  const hasOverride = !!t && t.builtIn && !!overrides[t.id]

  return (
    <header className="ed-top">
      <div className="ed-start">
        <button className="btn ghost" onClick={goHome} title="العودة للرئيسية (يُحفظ العمل تلقائياً)">
          <ArrowRight size={17} />
          <span className="hide-sm">الرئيسية</span>
        </button>
        <span className="vsep" />
        <LkgtLogo variant="color" height={26} />
        <button className="tname" onClick={() => useEditor.setState({ gallery: true })} title="تغيير القالب (Ctrl+T)">
          <LayoutGrid size={16} />
          <span>
            <strong>{t?.name ?? 'قالب جديد'}</strong>
            <em>{cat.name}</em>
          </span>
          <ChevronDown size={15} />
        </button>
        <button className="ibtn" onClick={() => stepTemplate(-1)} title="القالب السابق">
          <ChevronRight size={18} />
        </button>
        <button className="ibtn" onClick={() => stepTemplate(1)} title="القالب التالي">
          <ChevronLeft size={18} />
        </button>
        <input className="proj-name" value={projectName} placeholder="اسم المشروع…" onChange={(e) => renameProject(e.target.value)} title="اسم المشروع" />
      </div>

      <div className="ed-end">
        <button className="ibtn" onClick={undo} disabled={!canUndo} title="تراجع (Ctrl+Z)">
          <Undo2 size={18} />
        </button>
        <button className="ibtn" onClick={redo} disabled={!canRedo} title="إعادة (Ctrl+Y)">
          <Redo2 size={18} />
        </button>
        <span className="vsep" />
        <SizeMenu />
        <Menu
          trigger={
            <>
              <Save size={16} />
              <span className="hide-sm">ملف</span>
              <ChevronDown size={14} />
            </>
          }
        >
          {(close) => (
            <>
              <MenuItem icon={<FilePlus2 size={15} />} onClick={() => (newProjectLike(), close())}>
                مشروع جديد بنفس القالب
              </MenuItem>
              <MenuItem
                icon={<History size={15} />}
                onClick={() => {
                  close()
                  useEditor.setState({ dialog: 'versions' })
                }}
              >
                سجل النسخ والاستعادة…
              </MenuItem>
              <MenuItem
                icon={<Save size={15} />}
                onClick={() => {
                  void saveVersion('يدوي')
                  toast('تم حفظ نسخة من المشروع', 'ok')
                  close()
                }}
              >
                حفظ نسخة الآن (Ctrl+S)
              </MenuItem>
              <MenuItem icon={<FileArchive size={15} />} onClick={() => (void exportProjectFile().catch((e) => toast(String(e), 'error')), close())}>
                تصدير ملف المشروع (.lkgt)
              </MenuItem>
              <MenuItem
                icon={<FolderOpen size={15} />}
                onClick={async () => {
                  close()
                  const [f] = await pickFile('.lkgt,application/zip')
                  if (f) importProjectFile(f).catch((e) => toast(String(e), 'error'))
                }}
              >
                فتح ملف مشروع…
              </MenuItem>
              <div className="menu-sep" />
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
              <MenuItem icon={<RotateCcw size={15} />} onClick={() => (resetStyle(), close())}>
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
        <ToolsMenu />
        <button className="ibtn" onClick={() => useEditor.setState({ dialog: 'commands' })} title="لوحة الأوامر (Ctrl+K)">
          <Command size={18} />
        </button>
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
                  <Chips<1 | 2> value={scale} options={[{ value: 1, label: `${cv.w}×${cv.h}` }, { value: 2, label: `${cv.w * 2}×${cv.h * 2}` }]} onChange={(v) => useEditor.setState({ exportScale: v })} />
                </div>
                <MenuItem
                  icon={<WandSparkles size={15} />}
                  onClick={() => {
                    close()
                    useEditor.setState({ dialog: 'export' })
                  }}
                >
                  تصدير متقدم: مقاسات، PDF، PSD، فيديو…
                </MenuItem>
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
  )
}

function ToolsMenu() {
  return (
    <Menu
      trigger={
        <>
          <Palette size={16} />
          <span className="hide-sm">أدوات</span>
          <ChevronDown size={14} />
        </>
      }
    >
      {(close) => (
        <>
          {TOOL_ITEMS.map((it) => (
            <MenuItem
              key={it.id}
              icon={it.icon}
              onClick={() => {
                close()
                it.run()
              }}
            >
              {it.label}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  )
}

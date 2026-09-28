import { lazy, Suspense, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { Home } from './home/Home'
import { Editor } from './editor/Editor'
import { SaveTemplateDialog, SettingsDialog, ShortcutsDialog } from './panels/Dialogs'
import { redo, select, setEditing, stepTemplate, toast, undo, useEditor } from './store/editor'
import { importImage } from './lib/importer'
import { buildCommands, keysFor, matchKey } from './lib/commands'
import { deleteSelection, nudgeSelection } from './store/actions'
import { addImageFile } from './store/objects'
import { CommandPalette } from './panels/CommandPalette'
import { VersionsDialog } from './panels/VersionsDialog'
import { KitsDialog } from './panels/KitsDialog'
import { CarouselDialog } from './panels/CarouselDialog'
import { CheckDialog, PaletteDialog, ReferenceDialog, SuggestDialog } from './panels/SmartDialogs'
import { CopyDialog } from './panels/CopyDialog'

const CutoutStudio = lazy(() => import('./cutout/CutoutStudio'))

function Toasts() {
  const toasts = useEditor((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === 'ok' ? <CheckCircle2 size={16} /> : t.kind === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

function TaskOverlay() {
  const task = useEditor((s) => s.task)
  if (!task) return null
  return (
    <div className="task">
      <span className="spinner sm" />
      <span>{task.label}</span>
      {task.progress != null && (
        <div className="task-bar">
          <i style={{ width: `${Math.round(task.progress * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

/** حقل يملك تراجعه الأصلي (نصوص عادية خارج سجل التصميم) */
function hasNativeUndo(t: HTMLElement) {
  if (t.isContentEditable) return true
  if (t.tagName === 'INPUT' && t.classList.contains('txi')) return true
  return false
}

function isTyping(t: HTMLElement) {
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

/** أوامر تعمل حتى أثناء الكتابة في حقل */
const TYPING_OK = new Set(['export', 'exportMenu', 'settings', 'shortcuts', 'undo', 'redo'])

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState()
      if (s.dialog === 'cutout' || s.dialog === 'retouch') return // للاستوديو اختصاراته الخاصة
      const t = e.target as HTMLElement
      const mod = e.ctrlKey || e.metaKey
      const typing = isTyping(t)
      // نستخدم e.code (موضع المفتاح) حتى تعمل الاختصارات مع لوحة المفاتيح العربية
      if (mod && e.code === 'KeyK') {
        e.preventDefault()
        useEditor.setState({ dialog: s.dialog === 'commands' ? null : 'commands' })
        return
      }
      if (s.dialog === 'commands') return
      if (mod && e.code === 'KeyZ') {
        if (s.view !== 'editor' || hasNativeUndo(t) || (s.dialog && typing)) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.code === 'KeyY') {
        if (s.view !== 'editor' || hasNativeUndo(t) || (s.dialog && typing)) return
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.code === 'KeyS') {
        e.preventDefault()
        if (s.view === 'editor') {
          void import('./store/projects').then((m) => m.saveVersion('يدوي'))
          toast('تم حفظ نسخة من المشروع — كل التعديلات تُحفظ تلقائياً أيضاً', 'ok', 2400)
        }
        return
      }
      // الأوامر ذات الاختصارات (قابلة للتخصيص)
      if (s.view === 'editor' || e.code === 'Comma' || e.code === 'Slash') {
        for (const c of buildCommands()) {
          const keys = keysFor(c)
          if (!keys || !matchKey(e, keys)) continue
          if (typing && !TYPING_OK.has(c.id)) return
          if (s.dialog && !TYPING_OK.has(c.id) && c.id !== 'settings' && c.id !== 'shortcuts') return
          if (c.enabled && !c.enabled()) return
          e.preventDefault()
          c.run()
          return
        }
      }
      if (s.view !== 'editor') return
      if (typing || s.dialog) return
      const sel = s.selection
      if (e.key === 'Escape') {
        if (s.library_) return useEditor.setState({ library_: null })
        if (s.gallery) return useEditor.setState({ gallery: false })
        setEditing(null)
        select(null, false)
        return
      }
      if ((e.key === 'Enter' || e.key === 'F2') && (sel?.kind === 'text' || sel?.kind === 'extra')) {
        e.preventDefault()
        setEditing(sel.kind === 'text' ? sel.key : sel.id)
        return
      }
      if (e.key === 'Backspace' && sel) {
        e.preventDefault()
        deleteSelection()
        return
      }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const a = arrows[e.key]
      if (a) {
        const k = e.shiftKey ? 10 : 1
        if (nudgeSelection(a[0] * k, a[1] * k)) {
          e.preventDefault()
          return
        }
        if (a[0] !== 0 && !s.selection && !s.multi.length) {
          e.preventDefault()
          stepTemplate(a[0] < 0 ? 1 : -1)
        }
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      const s = useEditor.getState()
      if (s.view !== 'editor' || s.dialog || isTyping(e.target as HTMLElement)) return
      const files = Array.from(e.clipboardData?.files ?? []).filter((x) => x.type.startsWith('image/'))
      if (files.length) {
        e.preventDefault()
        const c = s.design.content
        if (!c.scene && !c.product) importImage(files[0])
        else files.forEach((f) => addImageFile(f))
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])
}

export default function App() {
  const uiTheme = useEditor((s) => s.uiTheme)
  const dialog = useEditor((s) => s.dialog)
  const view = useEditor((s) => s.view)
  useShortcuts()
  useEffect(() => {
    document.documentElement.dataset.theme = uiTheme
  }, [uiTheme])

  return (
    <div className="app">
      {view === 'home' ? <Home /> : <Editor />}
      <TaskOverlay />
      <Toasts />
      {dialog === 'settings' && <SettingsDialog />}
      {dialog === 'saveTemplate' && <SaveTemplateDialog />}
      {dialog === 'shortcuts' && <ShortcutsDialog />}
      {dialog === 'commands' && <CommandPalette />}
      {dialog === 'versions' && <VersionsDialog />}
      {dialog === 'kits' && <KitsDialog />}
      {dialog === 'carousel' && <CarouselDialog />}
      {dialog === 'check' && <CheckDialog />}
      {dialog === 'palette' && <PaletteDialog />}
      {dialog === 'suggest' && <SuggestDialog />}
      {dialog === 'reference' && <ReferenceDialog />}
      {dialog === 'copy' && <CopyDialog />}
      {dialog === 'cutout' && (
        <Suspense fallback={null}>
          <CutoutStudio />
        </Suspense>
      )}
    </div>
  )
}

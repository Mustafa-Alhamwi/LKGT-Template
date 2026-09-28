import { lazy, Suspense, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { Home } from './home/Home'
import { Editor } from './editor/Editor'
import { SaveTemplateDialog, SettingsDialog, ShortcutsDialog } from './panels/Dialogs'
import { change, redo, select, setEditing, stepTemplate, toast, undo, useEditor } from './store/editor'
import { exportCurrent } from './lib/actions'
import { importImage } from './lib/importer'

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

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState()
      if (s.dialog === 'cutout') return // للاستوديو اختصاراته الخاصة
      const t = e.target as HTMLElement
      const mod = e.ctrlKey || e.metaKey
      // نستخدم e.code (موضع المفتاح) حتى يعمل الاختصار مع لوحة المفاتيح العربية
      if (mod && e.code === 'KeyZ') {
        if (s.view !== 'editor' || hasNativeUndo(t) || (s.dialog && isTyping(t))) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.code === 'KeyY') {
        if (s.view !== 'editor' || hasNativeUndo(t) || (s.dialog && isTyping(t))) return
        e.preventDefault()
        redo()
        return
      }
      if (s.view !== 'editor') return
      if (mod && e.code === 'KeyE') {
        e.preventDefault()
        exportCurrent()
        return
      }
      if (mod && e.code === 'KeyS') {
        e.preventDefault()
        toast('كل التعديلات محفوظة تلقائياً — للتصدير Ctrl+E', 'ok', 2200)
        return
      }
      if (isTyping(t) || s.dialog) return
      const sel = s.selection
      if (e.key === 'Escape') {
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
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        change((d) => {
          if (sel.kind === 'text') d.style.text.items[sel.key].visible = false
          if (sel.kind === 'extra') d.content.extras = (d.content.extras ?? []).filter((x) => x.id !== sel.id)
          if (sel.kind === 'product' && d.content.product) d.content.product.visible = false
          if (sel.kind === 'shape') d.style.shape.kind = 'none'
          if (sel.kind === 'decor') d.style.decor = d.style.decor.filter((x) => x.id !== sel.id)
        })
        select(null, false)
        return
      }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const a = arrows[e.key]
      if (a) {
        const movable = sel && ['text', 'extra', 'textBlock', 'shape', 'decor', 'product', 'scene'].includes(sel.kind)
        if (!movable) {
          if (a[0] !== 0) {
            e.preventDefault()
            stepTemplate(a[0] < 0 ? 1 : -1)
          }
          return
        }
        e.preventDefault()
        const k = e.shiftKey ? 10 : 1
        const [dx, dy] = [a[0] * k, a[1] * k]
        change((d) => {
          if (sel.kind === 'text') {
            const st = d.style.text.items[sel.key]
            if (st.free) {
              st.fx = (st.fx ?? 0) + dx
              st.fy = (st.fy ?? 0) + dy
            } else {
              d.style.text.x += dx
              d.style.text.y += dy
            }
          } else if (sel.kind === 'extra') {
            const st = d.content.extras?.find((x) => x.id === sel.id)?.style
            if (st) {
              st.fx = (st.fx ?? 0) + dx
              st.fy = (st.fy ?? 0) + dy
            }
          } else if (sel.kind === 'textBlock') {
            d.style.text.x += dx
            d.style.text.y += dy
          } else if (sel.kind === 'shape') {
            d.style.shape.offsetX += dx
            d.style.shape.offsetY += dy
          } else if (sel.kind === 'decor') {
            const it = d.style.decor.find((x) => x.id === sel.id)
            if (it) {
              it.x += dx
              it.y += dy
            }
          } else if (sel.kind === 'scene' && d.content.scene?.place) {
            d.content.scene.place.x += dx
            d.content.scene.place.y += dy
          } else if (sel.kind === 'product' && d.content.product?.place && !d.content.product.linked) {
            d.content.product.place.x += dx
            d.content.product.place.y += dy
          }
        }, `nudge-${sel.kind}`)
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      const s = useEditor.getState()
      if (s.view !== 'editor' || s.dialog || isTyping(e.target as HTMLElement)) return
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'))
      if (f) {
        e.preventDefault()
        importImage(f)
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
      {dialog === 'cutout' && (
        <Suspense fallback={null}>
          <CutoutStudio />
        </Suspense>
      )}
    </div>
  )
}

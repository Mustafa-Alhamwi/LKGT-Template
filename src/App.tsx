import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { TopBar } from './panels/TopBar'
import { Library } from './panels/Library'
import { Inspector } from './panels/Inspector'
import { Stage } from './editor/Stage'
import { SettingsDialog, SaveTemplateDialog, ShortcutsDialog } from './panels/Dialogs'
import { RefineDialog } from './panels/RefineDialog'
import { change, redo, select, setEditing, stepTemplate, toast, undo, useEditor } from './store/editor'
import { exportCurrent } from './lib/actions'
import { importImage } from './lib/importer'

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
      <span className="lk-spinner small" />
      <span>{task.label}</span>
      {task.progress != null && (
        <div className="task-bar">
          <i style={{ width: `${Math.round(task.progress * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e)) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y' && !isTyping(e)) {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        exportCurrent()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        toast('كل التعديلات محفوظة تلقائياً ✓ — للتصدير Ctrl+E', 'ok', 2200)
        return
      }
      if (isTyping(e) || s.dialog) return
      const sel = s.selection
      if (e.key === 'Escape') {
        setEditing(null)
        select(null)
        return
      }
      if ((e.key === 'Enter' || e.key === 'F2') && sel?.kind === 'text') {
        e.preventDefault()
        setEditing(sel.key)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        change((d) => {
          if (sel.kind === 'text') d.style.text.items[sel.key].visible = false
          if (sel.kind === 'product' && d.content.product) d.content.product.visible = false
          if (sel.kind === 'shape') d.style.shape.kind = 'none'
          if (sel.kind === 'decor') d.style.decor = d.style.decor.filter((x) => x.id !== sel.id)
        })
        select(null)
        return
      }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const a = arrows[e.key]
      if (a) {
        const movable = sel && ['text', 'textBlock', 'shape', 'decor', 'product', 'scene'].includes(sel.kind)
        if (!movable) {
          if (a[0] !== 0) {
            e.preventDefault()
            stepTemplate(a[0] < 0 ? 1 : -1) // واجهة من اليمين لليسار: السهم الأيسر = التالي
          }
          return
        }
        e.preventDefault()
        const k = e.shiftKey ? 10 : 1
        const [dx, dy] = [a[0] * k, a[1] * k]
        change((d) => {
          if (sel.kind === 'text' || sel.kind === 'textBlock') {
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
      if (e.key === 'PageDown') stepTemplate(1)
      if (e.key === 'PageUp') stepTemplate(-1)
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e as unknown as KeyboardEvent)) return
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
  useShortcuts()
  useEffect(() => {
    document.documentElement.dataset.theme = uiTheme
  }, [uiTheme])

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <Library onSaveTemplate={() => useEditor.setState({ dialog: 'saveTemplate' })} />
        <Stage />
        <Inspector />
      </div>
      <TaskOverlay />
      <Toasts />
      {dialog === 'settings' && <SettingsDialog />}
      {dialog === 'saveTemplate' && <SaveTemplateDialog />}
      {dialog === 'shortcuts' && <ShortcutsDialog />}
      {dialog === 'refine' && <RefineDialog />}
    </div>
  )
}

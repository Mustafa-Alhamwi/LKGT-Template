import { useEffect, useRef, useState } from 'react'
import { Download, Moon, Redo2, Settings, Sun, Undo2, ChevronDown, Images, Keyboard, Type } from 'lucide-react'
import { LkgtLogo } from '../brand/LkgtLogo'
import { CATEGORIES } from '../model/templates'
import { redo, undo, useEditor } from '../store/editor'
import { exportAllTemplates, exportCurrent } from '../lib/actions'

function FontBadge() {
  const fonts = useEditor((s) => s.fonts)
  if (!fonts) return <span className="font-badge wait">…الخطوط</span>
  const arOk = Object.values(fonts.ar).filter((v) => v !== 'missing').length
  const latOk = Object.values(fonts.lat).filter((v) => v !== 'missing').length
  const ok = arOk > 0 && latOk > 0
  return (
    <button
      className={`font-badge ${ok ? (arOk === 6 && latOk === 3 ? 'ok' : 'partial') : 'bad'}`}
      onClick={() => useEditor.setState({ dialog: 'settings' })}
      title="حالة خطوط الهوية — انقر للتفاصيل"
    >
      <Type size={14} />
      <span>Araboto {arOk}/6</span>
      <span>HP {latOk}/3</span>
    </button>
  )
}

export function TopBar() {
  const uiTheme = useEditor((s) => s.uiTheme)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const fmt = useEditor((s) => s.exportFormat)
  const scale = useEditor((s) => s.exportScale)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  return (
    <header className="topbar">
      <div className="brand">
        <LkgtLogo variant="color" height={34} />
        <div className="brand-text">
          <strong>LKGT Studio</strong>
          <span>استوديو قوالب السوشال ميديا</span>
        </div>
      </div>

      <nav className="cats">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`cat ${c.id === 'ads' ? 'active' : ''}`} disabled={!c.ready} title={c.ready ? '' : 'قريباً'}>
            {c.name}
            {!c.ready && <em>قريباً</em>}
          </button>
        ))}
      </nav>

      <div className="top-actions">
        <FontBadge />
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title="تراجع (Ctrl+Z)">
          <Undo2 size={18} />
        </button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title="إعادة (Ctrl+Y)">
          <Redo2 size={18} />
        </button>
        <button className="icon-btn" onClick={() => useEditor.setState({ dialog: 'shortcuts' })} title="اختصارات لوحة المفاتيح">
          <Keyboard size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => useEditor.setState({ uiTheme: uiTheme === 'dark' ? 'light' : 'dark' })}
          title={uiTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
        >
          {uiTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="icon-btn" onClick={() => useEditor.setState({ dialog: 'settings' })} title="الإعدادات">
          <Settings size={18} />
        </button>
        <div className="export-split" ref={menuRef}>
          <button className="ui-btn primary" onClick={exportCurrent} title="تصدير (Ctrl+E)">
            <Download size={16} />
            <span>تصدير {fmt.toUpperCase()}</span>
          </button>
          <button className="ui-btn primary caret" onClick={() => setMenu(!menu)}>
            <ChevronDown size={16} />
          </button>
          {menu && (
            <div className="menu">
              <div className="menu-group">
                <span>الصيغة</span>
                <div className="ui-seg small">
                  {(['png', 'jpg'] as const).map((f) => (
                    <button key={f} className={fmt === f ? 'active' : ''} onClick={() => useEditor.setState({ exportFormat: f })}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu-group">
                <span>الدقة</span>
                <div className="ui-seg small">
                  <button className={scale === 1 ? 'active' : ''} onClick={() => useEditor.setState({ exportScale: 1 })}>
                    1080×1440
                  </button>
                  <button className={scale === 2 ? 'active' : ''} onClick={() => useEditor.setState({ exportScale: 2 })}>
                    2160×2880
                  </button>
                </div>
              </div>
              <button
                className="menu-item"
                onClick={() => {
                  setMenu(false)
                  exportAllTemplates()
                }}
              >
                <Images size={16} /> تصدير المحتوى بكل القوالب
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

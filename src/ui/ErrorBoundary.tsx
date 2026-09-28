import { Component, type ErrorInfo, type ReactNode } from 'react'

/* شبكة أمان: أي خطأ غير متوقع في الواجهة لا يترك صفحة بيضاء، بل شاشة استرداد */

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  private home = () => {
    import('../store/editor').then((m) => m.useEditor.setState({ view: 'home', dialog: null, selection: null, multi: [], editing: null }))
    this.reset()
  }

  private hardReset = () => {
    if (!confirm('سيُعاد ضبط التصميم الحالي والإعدادات المحفوظة في هذا المتصفح. مشاريعك المحفوظة (في «مشاريعي») تبقى كما هي. متابعة؟')) return
    try {
      localStorage.removeItem('lkgt-studio:v3')
      localStorage.removeItem('lkgt-studio:v2')
    } catch {
      /* */
    }
    location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b0f', color: '#f2f2f6', fontFamily: 'Tajawal, "Segoe UI", sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 520, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 46 }}>🛠️</div>
          <h2 style={{ margin: 0 }}>حدث خطأ غير متوقع</h2>
          <p style={{ margin: 0, color: '#9a9aa8', lineHeight: 1.8 }}>عملك محفوظ تلقائياً. جرّب إحدى الخيارات التالية:</p>
          <code style={{ direction: 'ltr', background: '#15151c', border: '1px solid #2a2a36', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#ff8a93', wordBreak: 'break-word' }}>{String(error.message).slice(0, 240)}</code>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={this.reset} style={btn(true)}>
              إعادة المحاولة
            </button>
            <button onClick={this.home} style={btn()}>
              العودة للرئيسية
            </button>
            <button onClick={() => location.reload()} style={btn()}>
              إعادة تحميل الصفحة
            </button>
            <button onClick={this.hardReset} style={{ ...btn(), color: '#ff8a93' }}>
              إعادة ضبط البرنامج
            </button>
          </div>
        </div>
      </div>
    )
  }
}

const btn = (primary = false): React.CSSProperties => ({
  border: primary ? 0 : '1px solid #2a2a36',
  background: primary ? '#e8212c' : '#1c1c25',
  color: '#fff',
  borderRadius: 12,
  padding: '10px 18px',
  fontFamily: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
})

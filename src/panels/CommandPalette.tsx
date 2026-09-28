import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { buildCommands, formatKeys, keysFor, type Command } from '../lib/commands'
import { useEditor } from '../store/editor'

/* لوحة الأوامر (Ctrl+K): ابحث واكتب أي أمر: قالب، مقاس، إضافة عنصر، تصدير… */

const norm = (s: string) => s.toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')

export function CommandPalette() {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const cmds = useMemo(() => buildCommands().filter((c) => !c.enabled || c.enabled()), [])
  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    const scored = cmds
      .map((c) => {
        const hay = norm(`${c.label} ${c.group} ${c.keywords ?? ''}`)
        if (!words.every((w) => hay.includes(w))) return null
        const label = norm(c.label)
        const score = words.reduce((s, w) => s + (label.startsWith(w) ? 3 : label.includes(w) ? 2 : 1), 0)
        return { c, score }
      })
      .filter(Boolean) as { c: Command; score: number }[]
    return scored.sort((a, b) => b.score - a.score).slice(0, 60).map((x) => x.c)
  }, [q, cmds])
  useEffect(() => setI(0), [q])
  useEffect(() => {
    ref.current?.querySelector('.cp-item.on')?.scrollIntoView({ block: 'nearest' })
  }, [i])
  const close = () => useEditor.setState({ dialog: null })
  const run = (c: Command) => {
    close()
    setTimeout(() => c.run(), 30)
  }
  return (
    <div className="modal-back top" onPointerDown={close}>
      <div className="cp" onPointerDown={(e) => e.stopPropagation()}>
        <label className="cp-in">
          <Search size={18} />
          <input
            autoFocus
            placeholder="اكتب أمراً… (قالب، ستوري، QR، تصدير، تراجع)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setI((v) => Math.min(list.length - 1, v + 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setI((v) => Math.max(0, v - 1)))
              else if (e.key === 'Enter' && list[i]) run(list[i])
              else if (e.key === 'Escape') close()
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <div className="cp-list" ref={ref}>
          {list.map((c, k) => {
            const keys = keysFor(c)
            return (
              <button key={c.id} className={`cp-item ${k === i ? 'on' : ''}`} onMouseEnter={() => setI(k)} onClick={() => run(c)}>
                <span className="cp-g">{c.group}</span>
                <span className="cp-l">{c.label}</span>
                {keys && <kbd>{formatKeys(keys)}</kbd>}
              </button>
            )
          })}
          {!list.length && <div className="cp-empty">لا توجد نتائج</div>}
        </div>
      </div>
    </div>
  )
}

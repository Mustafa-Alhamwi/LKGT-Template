import { Type } from 'lucide-react'
import { Section, TextArea } from '../../ui/controls'
import { useEditor, select } from '../../store/editor'
import type { TextKey } from '../../model/types'
import { setContent, TEXT_HINTS, TEXT_LABELS } from './common'

const KEYS: TextKey[] = ['title', 'subtitle', 'tagline', 'kicker', 'note', 'features', 'price']

export function ContentPanel() {
  const texts = useEditor((s) => s.design.content.texts)
  const items = useEditor((s) => s.design.style.text.items)
  const badge = texts.badge
  const hasBadge = useEditor((s) => s.design.style.decor.some((d) => d.kind === 'badge' && d.visible))
  return (
    <Section title="النصوص" icon={<Type size={16} />}>
      <p className="muted small">انقر مرتين على أي نص في التصميم لتعديله مباشرة.</p>
      {KEYS.map((k) => {
        const hidden = !items[k].visible
        const value = k === 'features' ? texts.features.join('\n') : texts[k]
        return (
          <div key={k} className={`content-field ${hidden ? 'is-hidden' : ''}`}>
            <div className="content-label">
              <button className="link" onClick={() => select({ kind: 'text', key: k })}>
                {TEXT_LABELS[k]}
              </button>
              {hidden && <span className="tag">مخفي في هذا القالب</span>}
              {TEXT_HINTS[k] && <em className="ui-hint">{TEXT_HINTS[k]}</em>}
            </div>
            <TextArea
              value={value}
              rows={k === 'features' ? 3 : 1}
              dir={k === 'title' || k === 'subtitle' ? 'ltr' : 'auto'}
              onChange={(v) =>
                setContent((c) => {
                  if (k === 'features') c.texts.features = v.split('\n')
                  else c.texts[k] = v
                }, `text-${k}`)
              }
            />
          </div>
        )
      })}
      {hasBadge && (
        <div className="content-field">
          <div className="content-label">
            <span>نص الشارة</span>
          </div>
          <TextArea value={badge} onChange={(v) => setContent((c) => void (c.texts.badge = v), 'text-badge')} />
        </div>
      )}
    </Section>
  )
}

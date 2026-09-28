import { ArrowDown, ArrowUp, Eye, EyeOff } from 'lucide-react'
import { setBrand, useEditor } from '../../store/editor'
import type { BrandKit, ContactItemKey } from '../../model/types'

/* حقول معلومات التواصل + اختيار ما يظهر في الشريط وترتيبه */

const FIELDS: { key: ContactItemKey; field: 'website' | 'instagram' | 'phone' | 'whatsapp' | 'email' | 'address'; label: string; ltr: boolean }[] = [
  { key: 'web', field: 'website', label: 'الموقع', ltr: true },
  { key: 'ig', field: 'instagram', label: 'إنستغرام', ltr: true },
  { key: 'ph', field: 'phone', label: 'الهاتف', ltr: true },
  { key: 'wa', field: 'whatsapp', label: 'واتساب', ltr: true },
  { key: 'mail', field: 'email', label: 'البريد', ltr: true },
  { key: 'addr', field: 'address', label: 'العنوان', ltr: false },
]

export function ContactFields({ brand: given }: { brand?: BrandKit }) {
  const active = useEditor((s) => s.brand)
  const brand = given ?? active
  const order: ContactItemKey[] = brand.contactItems ?? ['web', 'ig', 'ph']
  const on = new Set(order)
  const update = (patch: Partial<BrandKit>) => setBrand(patch)
  const toggle = (k: ContactItemKey) => update({ contactItems: on.has(k) ? order.filter((x) => x !== k) : [...order, k] })
  const move = (k: ContactItemKey, d: -1 | 1) => {
    const i = order.indexOf(k)
    const j = i + d
    if (i < 0 || j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    update({ contactItems: next })
  }
  return (
    <div className="contact-fields">
      {FIELDS.map((f) => (
        <div key={f.key} className={`cf-row ${on.has(f.key) ? '' : 'off'}`}>
          <button className="ibtn sm" title={on.has(f.key) ? 'إخفاء من الشريط' : 'إظهار في الشريط'} onClick={() => toggle(f.key)}>
            {on.has(f.key) ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <span className="cf-label">{f.label}</span>
          <input className={`txi ${f.ltr ? 'ltr' : ''}`} dir={f.ltr ? 'ltr' : 'auto'} value={brand[f.field] ?? ''} onChange={(e) => update({ [f.field]: e.target.value } as Partial<BrandKit>)} />
          <button className="ibtn sm" disabled={!on.has(f.key) || order[0] === f.key} onClick={() => move(f.key, -1)} title="قبل">
            <ArrowUp size={14} />
          </button>
          <button className="ibtn sm" disabled={!on.has(f.key) || order[order.length - 1] === f.key} onClick={() => move(f.key, 1)} title="بعد">
            <ArrowDown size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

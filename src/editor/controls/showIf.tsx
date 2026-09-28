import { Field, Select } from '../../ui/kit'
import { CATEGORY_DEFS, type CategoryDef } from '../../model/categories'
import type { ShowIf, TextKey } from '../../model/types'

/* قاعدة ذكية للظهور: «يظهر فقط إن كان حقل … معبّأً / فارغاً» */

const KEYS: TextKey[] = ['kicker', 'title', 'subtitle', 'tagline', 'features', 'note', 'price', 'oldPrice', 'discount', 'cta']

export function ShowIfControl({ rule, onChange, cat }: { rule?: ShowIf; onChange: (r: ShowIf | undefined) => void; cat: CategoryDef }) {
  const mode = rule ? rule.when : 'off'
  const labels = (cat ?? CATEGORY_DEFS[0]).labels
  return (
    <>
      <Field label="قاعدة ذكية">
        <Select<'off' | 'filled' | 'empty'>
          value={mode}
          options={[
            { value: 'off', label: 'بدون (يظهر دائماً)' },
            { value: 'filled', label: 'يظهر إن كان حقل … معبّأً' },
            { value: 'empty', label: 'يظهر إن كان حقل … فارغاً' },
          ]}
          onChange={(v) => onChange(v === 'off' ? undefined : { key: rule?.key ?? 'price', when: v })}
        />
      </Field>
      {rule && (
        <Field label="الحقل">
          <Select<TextKey> value={rule.key} options={KEYS.map((k) => ({ value: k, label: labels[k] }))} onChange={(v) => onChange({ ...rule, key: v })} />
        </Field>
      )}
    </>
  )
}

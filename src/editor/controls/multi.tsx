import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Copy, Lock, Trash2, StretchHorizontal, StretchVertical, ClipboardPaste, Clipboard } from 'lucide-react'
import { Btn, Chips, Group, IconBtn } from '../../ui/kit'
import { applyTextPresetTo, change, copyTextStyle, pasteTextStyle, select, useEditor } from '../../store/editor'
import { bridge, type Box } from '../../lib/bridge'
import { BUILTIN_TEXT_PRESETS } from '../../model/textPresets'
import { canvasOf } from '../../model/types'
import type { Selection } from '../../model/types'
import { eidOfSel, isLocked, moverKey, translateSel } from '../moves'
import { useState } from 'react'
import { presetPreviewCss, usePresetCtx } from '../Library'

/* ------------------------------------------------------------------
 * تحديد متعدد: محاذاة، توزيع، وإجراءات جماعية
 * ------------------------------------------------------------------ */

interface Item {
  sel: Selection
  box: Box
}

function collect(list: Selection[]): Item[] {
  const d = useEditor.getState().design
  const seen = new Set<string>()
  const out: Item[] = []
  for (const sel of list) {
    if (isLocked(d, sel)) continue
    const k = moverKey(sel, d)
    if (seen.has(k)) continue
    const eid = eidOfSel(sel, d)
    const box = eid ? bridge.boxOf(eid) : null
    if (!box) continue
    seen.add(k)
    out.push({ sel, box })
  }
  return out
}

function unionBox(items: Item[]): Box {
  const x0 = Math.min(...items.map((i) => i.box.x))
  const y0 = Math.min(...items.map((i) => i.box.y))
  const x1 = Math.max(...items.map((i) => i.box.x + i.box.w))
  const y1 = Math.max(...items.map((i) => i.box.y + i.box.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

export function alignSelection(list: Selection[], mode: AlignMode, to: 'sel' | 'canvas') {
  const items = collect(list)
  if (!items.length) return
  const cv = canvasOf(useEditor.getState().design)
  const ref: Box = to === 'canvas' ? { x: 0, y: 0, w: cv.w, h: cv.h } : unionBox(items)
  change((d) => {
    for (const it of items) {
      const b = it.box
      let dx = 0
      let dy = 0
      if (mode === 'left') dx = ref.x - b.x
      if (mode === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2)
      if (mode === 'right') dx = ref.x + ref.w - (b.x + b.w)
      if (mode === 'top') dy = ref.y - b.y
      if (mode === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2)
      if (mode === 'bottom') dy = ref.y + ref.h - (b.y + b.h)
      translateSel(d, it.sel, Math.round(dx), Math.round(dy))
    }
  })
}

export function distributeSelection(list: Selection[], axis: 'h' | 'v') {
  const items = collect(list)
  if (items.length < 3) return
  const sorted = [...items].sort((a, b) => (axis === 'h' ? a.box.x - b.box.x : a.box.y - b.box.y))
  const first = sorted[0].box
  const last = sorted[sorted.length - 1].box
  const total = axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y
  const sizes = sorted.reduce((s, i) => s + (axis === 'h' ? i.box.w : i.box.h), 0)
  const gap = (total - sizes) / (sorted.length - 1)
  let cursor = axis === 'h' ? first.x + first.w + gap : first.y + first.h + gap
  change((d) => {
    for (let i = 1; i < sorted.length - 1; i++) {
      const b = sorted[i].box
      const delta = axis === 'h' ? cursor - b.x : cursor - b.y
      translateSel(d, sorted[i].sel, axis === 'h' ? Math.round(delta) : 0, axis === 'v' ? Math.round(delta) : 0)
      cursor += (axis === 'h' ? b.w : b.h) + gap
    }
  })
}

export function MultiControls() {
  const multi = useEditor((s) => s.multi)
  const clip = useEditor((s) => s.clip)
  const [to, setTo] = useState<'sel' | 'canvas'>('sel')
  const ctx = usePresetCtx()
  const hasText = multi.some((m) => m.kind === 'text' || m.kind === 'extra')
  const A = (mode: AlignMode, icon: React.ReactNode, title: string) => <IconBtn icon={icon} title={title} onClick={() => alignSelection(multi, mode, to)} />
  return (
    <>
      <div className="el-title">
        <strong>{multi.length} عناصر محددة</strong>
        <span className="el-actions">
          <IconBtn
            icon={<Lock size={15} />}
            title="قفل الكل"
            onClick={() =>
              change((d) => {
                for (const m of multi) {
                  if (m.kind === 'decor') {
                    const x = d.style.decor.find((y) => y.id === m.id)
                    if (x) x.locked = true
                  }
                  if (m.kind === 'extra') {
                    const x = d.content.extras?.find((y) => y.id === m.id)
                    if (x) x.style.locked = true
                  }
                }
              })
            }
          />
          <IconBtn
            danger
            icon={<Trash2 size={15} />}
            title="حذف الكل"
            onClick={() => {
              change((d) => {
                for (const m of multi) {
                  if (m.kind === 'decor') d.style.decor = d.style.decor.filter((y) => y.id !== m.id)
                  if (m.kind === 'extra') d.content.extras = (d.content.extras ?? []).filter((y) => y.id !== m.id)
                  if (m.kind === 'text') d.style.text.items[m.key].visible = false
                  if (m.kind === 'product' && d.content.product) d.content.product.visible = false
                }
              })
              select(null, false)
            }}
          />
        </span>
      </div>
      <Group title="المحاذاة" hint="اسحب العناصر معاً، أو حاذِها بالنسبة لبعضها أو للوحة.">
        <Chips<'sel' | 'canvas'>
          value={to}
          options={[
            { value: 'sel', label: 'بين العناصر' },
            { value: 'canvas', label: 'إلى اللوحة' },
          ]}
          onChange={setTo}
        />
        <div className="align-row">
          {A('left', <AlignStartVertical size={17} />, 'محاذاة لليسار')}
          {A('hcenter', <AlignCenterVertical size={17} />, 'توسيط أفقي')}
          {A('right', <AlignEndVertical size={17} />, 'محاذاة لليمين')}
          <span className="vsep" />
          {A('top', <AlignStartHorizontal size={17} />, 'محاذاة للأعلى')}
          {A('vcenter', <AlignCenterHorizontal size={17} />, 'توسيط عمودي')}
          {A('bottom', <AlignEndHorizontal size={17} />, 'محاذاة للأسفل')}
        </div>
        <div className="row-btns">
          <Btn small icon={<StretchHorizontal size={14} />} disabled={multi.length < 3} onClick={() => distributeSelection(multi, 'h')}>
            توزيع أفقي
          </Btn>
          <Btn small icon={<StretchVertical size={14} />} disabled={multi.length < 3} onClick={() => distributeSelection(multi, 'v')}>
            توزيع عمودي
          </Btn>
        </div>
      </Group>
      {hasText && (
        <>
          <Group title="تنسيق النصوص المحددة">
            <div className="row-btns">
              <Btn small icon={<Clipboard size={14} />} onClick={() => copyTextStyle()}>
                نسخ تنسيق الأخير
              </Btn>
              <Btn small icon={<ClipboardPaste size={14} />} disabled={clip?.kind !== 'style'} onClick={() => pasteTextStyle()}>
                لصق التنسيق
              </Btn>
            </div>
          </Group>
          <Group title="أنماط جاهزة لكل النصوص">
            <div className="preset-grid mini">
              {BUILTIN_TEXT_PRESETS.slice(0, 8).map((p) => {
                const st = p.style(ctx)
                return (
                  <button key={p.id} className={`preset ${ctx.dark ? 'dk' : ''}`} onClick={() => applyTextPresetTo({ ...st, fit: 'none' })} title={p.name}>
                    <span className="preset-sample">
                      <span style={presetPreviewCss(st, ctx)}>{p.sample}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Group>
        </>
      )}
      <Group>
        <Btn
          small
          icon={<Copy size={14} />}
          onClick={() => {
            // تكرار كل العناصر الحرّة المحددة
            change((d) => {
              for (const m of multi) {
                if (m.kind === 'decor') {
                  const i = d.style.decor.findIndex((y) => y.id === m.id)
                  if (i >= 0) {
                    const c = JSON.parse(JSON.stringify(d.style.decor[i]))
                    c.id = `o_${Date.now().toString(36)}${i}`
                    c.x += 36
                    c.y += 36
                    d.style.decor.push(c)
                  }
                }
                if (m.kind === 'extra') {
                  const src = d.content.extras?.find((y) => y.id === m.id)
                  if (src) {
                    const c = JSON.parse(JSON.stringify(src))
                    c.id = `x_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`
                    c.style.fx = (c.style.fx ?? 0) + 36
                    c.style.fy = (c.style.fy ?? 0) + 36
                    d.content.extras!.push(c)
                  }
                }
              }
            })
          }}
        >
          تكرار المحدد
        </Btn>
      </Group>
    </>
  )
}

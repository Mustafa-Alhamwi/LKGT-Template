import { MousePointerClick } from 'lucide-react'
import { Btn, Empty } from '../../ui/kit'
import { select, useEditor } from '../../store/editor'
import { BlockControls, TextControls } from '../controls/text'
import { ProductControls, SceneControls } from '../controls/product'
import { ContactControls, DecorControls, LogoControls, ShapeControls } from '../controls/design'
import { MultiControls } from '../controls/multi'

export function PropsTab() {
  const sel = useEditor((s) => s.selection)
  const multi = useEditor((s) => s.multi)
  if (multi.length > 1) return <MultiControls />
  if (!sel) {
    return (
      <Empty icon={<MousePointerClick size={30} />} title="لم تحدد عنصراً" text="انقر على أي عنصر في التصميم لتعديل خصائصه هنا، أو اختر من الأزرار:">
        <div className="quick">
          <Btn small onClick={() => select({ kind: 'textBlock' })}>كتلة النصوص</Btn>
          <Btn small onClick={() => select({ kind: 'shape' })}>الشكل تحت المنتج</Btn>
          <Btn small onClick={() => select({ kind: 'contact' })}>شريط التواصل</Btn>
          <Btn small onClick={() => select({ kind: 'partner' })}>اللوغوهات</Btn>
        </div>
      </Empty>
    )
  }
  switch (sel.kind) {
    case 'text':
    case 'extra':
      return <TextControls sel={sel} />
    case 'textBlock':
      return <BlockControls />
    case 'product':
      return <ProductControls />
    case 'scene':
      return <SceneControls />
    case 'shape':
      return <ShapeControls />
    case 'decor':
      return <DecorControls id={sel.id} />
    case 'contact':
      return <ContactControls />
    case 'partner':
    case 'logo':
      return <LogoControls />
  }
}

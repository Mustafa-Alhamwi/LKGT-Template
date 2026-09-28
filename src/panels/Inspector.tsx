import { SlidersHorizontal, X } from 'lucide-react'
import { select, useEditor } from '../store/editor'
import { ContentPanel } from './inspect/ContentPanel'
import { BackdropPanel, FadePanel, ImagePanel } from './inspect/ImagePanel'
import { ProductPanel, ShapePanel } from './inspect/ProductPanel'
import { BlockPanel, TextPanel } from './inspect/TextPanel'
import { ContactPanel, LogosPanel } from './inspect/BrandPanels'
import { DecorPanel, SectionsPanel } from './inspect/DecorPanel'
import { TEXT_LABELS } from './inspect/common'
import type { Selection } from '../model/types'

function selTitle(s: Selection): string {
  switch (s.kind) {
    case 'scene':
      return 'صورة الخلفية'
    case 'product':
      return 'المنتج'
    case 'shape':
      return 'الشكل تحت المنتج'
    case 'textBlock':
      return 'كتلة النصوص'
    case 'text':
      return TEXT_LABELS[s.key]
    case 'contact':
      return 'شريط التواصل'
    case 'partner':
    case 'logo':
      return 'اللوغوهات'
    case 'decor':
      return 'زخرفة'
  }
}

export function Inspector() {
  const sel = useEditor((s) => s.selection)

  let body: React.ReactNode
  if (!sel) {
    body = (
      <>
        <ContentPanel />
        <ImagePanel />
        <FadePanel />
        <SectionsPanel />
        <ContactPanel />
        <LogosPanel />
        <BackdropPanel />
      </>
    )
  } else {
    switch (sel.kind) {
      case 'scene':
        body = (
          <>
            <ImagePanel />
            <FadePanel />
            <BackdropPanel />
          </>
        )
        break
      case 'product':
        body = (
          <>
            <ProductPanel />
            <ShapePanel />
          </>
        )
        break
      case 'shape':
        body = (
          <>
            <ShapePanel />
            <ProductPanel />
          </>
        )
        break
      case 'text':
        body = (
          <>
            <TextPanel k={sel.key} />
            <BlockPanel />
          </>
        )
        break
      case 'textBlock':
        body = (
          <>
            <BlockPanel />
            <SectionsPanel />
          </>
        )
        break
      case 'contact':
        body = <ContactPanel />
        break
      case 'partner':
      case 'logo':
        body = <LogosPanel />
        break
      case 'decor':
        body = (
          <>
            <DecorPanel id={sel.id} />
            <SectionsPanel />
          </>
        )
        break
    }
  }

  return (
    <aside className="panel inspector">
      <div className="panel-head">
        <SlidersHorizontal size={18} />
        <h2>{sel ? selTitle(sel) : 'خصائص التصميم'}</h2>
        {sel && (
          <button className="icon-btn" onClick={() => select(null)} title="إلغاء التحديد (Esc)">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="panel-scroll">{body}</div>
    </aside>
  )
}

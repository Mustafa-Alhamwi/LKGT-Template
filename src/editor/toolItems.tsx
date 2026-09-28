import { Boxes, GalleryHorizontal, History, ImageIcon, Palette, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditor, type Dialog } from '../store/editor'
import { openKits } from '../store/lock'

/** عناصر قائمة «أدوات» في المحرر — تُضاف الأدوات الذكية هنا */
export interface ToolItem {
  id: string
  label: string
  icon: ReactNode
  run: () => void
}

const dlg = (dialog: Dialog) => () => useEditor.setState({ dialog })

export const TOOL_ITEMS: ToolItem[] = [
  { id: 'check', label: 'فحص جودة التصميم قبل النشر', icon: <ShieldCheck size={15} />, run: dlg('check') },
  { id: 'suggest', label: 'اقتراحات تصميم ذكية', icon: <Sparkles size={15} />, run: dlg('suggest') },
  { id: 'palette', label: 'ألوان من صورة المنتج', icon: <Palette size={15} />, run: dlg('palette') },
  { id: 'reference', label: 'تصميم من صورة مرجعية', icon: <ImageIcon size={15} />, run: dlg('reference') },
  { id: 'carousel', label: 'كاروسيل من نص (شريحة لكل فقرة)', icon: <GalleryHorizontal size={15} />, run: dlg('carousel') },
  { id: 'kits', label: 'مجموعات الهوية والألوان', icon: <Boxes size={15} />, run: openKits },
  { id: 'versions', label: 'سجل النسخ والاستعادة', icon: <History size={15} />, run: dlg('versions') },
]

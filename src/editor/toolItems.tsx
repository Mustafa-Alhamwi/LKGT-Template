import { History } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Dialog } from '../store/editor'

/** عناصر قائمة «أدوات» في المحرر — تُضاف الأدوات الذكية هنا */
export const TOOL_ITEMS: { dialog: Exclude<Dialog, null>; label: string; icon: ReactNode }[] = [
  { dialog: 'versions', label: 'سجل النسخ والاستعادة', icon: <History size={15} /> },
]

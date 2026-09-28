import { createContext, useContext } from 'react'
import type { Selection, TextKey } from '../model/types'

/**
 * سياق التحرير: يتوفر فقط داخل مساحة العمل.
 * المصغرات والتصدير تعرض البوستر بدون أي عناصر تفاعلية.
 */
export interface EditApi {
  scale: number
  selection: Selection | null
  editing: TextKey | null
  select: (s: Selection | null) => void
  startDrag: (s: Selection, e: React.PointerEvent, extra?: { handle?: string }) => void
  startEdit: (key: TextKey) => void
  commitText: (key: TextKey, value: string, index?: number) => void
  stopEdit: () => void
  onDropZone: () => void
}

export const EditCtx = createContext<EditApi | null>(null)

export function useEdit() {
  return useContext(EditCtx)
}

export function isSel(a: Selection | null, b: Selection): boolean {
  if (!a || a.kind !== b.kind) return false
  if (a.kind === 'text' && b.kind === 'text') return a.key === b.key
  if (a.kind === 'decor' && b.kind === 'decor') return a.id === b.id
  return true
}

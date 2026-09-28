import { createContext, useContext } from 'react'
import type { Canvas } from '../model/types'
import { DEFAULT_CANVAS } from '../model/types'

/** مقاس لوحة البوستر الحالي — يتوفر لكل طبقات الرسم */
export const CanvasCtx = createContext<Canvas>(DEFAULT_CANVAS)

export function useCanvas(): Canvas {
  return useContext(CanvasCtx)
}

import { setPrefs, toast, useEditor } from './editor'

/* قفل الهوية للفريق: منع تعديل اللوغو وشريط التواصل والألوان الأساسية إلا بالرمز */

export function isBrandLocked(): boolean {
  return useEditor.getState().prefs.brandLock.on
}

export function useBrandLocked(): boolean {
  return useEditor((s) => s.prefs.brandLock.on)
}

/** يطلب الرمز إن وُجد. يرجع true عند النجاح */
export function askPin(): boolean {
  const { on, pin } = useEditor.getState().prefs.brandLock
  if (!on || !pin) return true
  const v = prompt('الهوية مقفلة — أدخل رمز الفتح')
  if (v === pin) return true
  if (v !== null) toast('رمز غير صحيح', 'error')
  return false
}

export function unlockBrand() {
  if (!askPin()) return
  const l = useEditor.getState().prefs.brandLock
  setPrefs({ brandLock: { ...l, on: false } })
  toast('تم فتح قفل الهوية', 'ok')
}

export function openKits() {
  if (!askPin()) return
  useEditor.setState({ dialog: 'kits' })
}

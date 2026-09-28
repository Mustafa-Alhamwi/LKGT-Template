import type { ImageFrame } from '../model/types'
import { pickFile } from '../lib/importer'
import { addImageFile, updateDecor } from '../store/objects'

const SIZES: Record<ImageFrame, [number, number, string]> = {
  none: [420, 420, 'صورة'],
  phone: [300, 620, 'هاتف'],
  tablet: [520, 690, 'تابلت'],
  laptop: [660, 430, 'لابتوب'],
  browser: [660, 470, 'متصفح'],
  polaroid: [380, 460, 'بولارويد'],
  card: [430, 430, 'بطاقة'],
}

/** يضيف صورة داخل إطار جهاز/بطاقة */
export async function addDeviceImage(frame: ImageFrame) {
  const [f] = await pickFile('image/*')
  if (!f) return
  const id = await addImageFile(f, { layer: 'front', name: SIZES[frame][2] })
  if (!id) return
  const [w, h] = SIZES[frame]
  updateDecor(id, (d) => {
    const cx = d.x + d.w / 2
    const cy = d.y + d.h / 2
    d.w = w
    d.h = h
    d.x = Math.round(cx - w / 2)
    d.y = Math.round(cy - h / 2)
    d.shadow = 'float'
    d.image!.frame = frame
    d.image!.mask = 'none'
    d.image!.fit = 'cover'
  })
}

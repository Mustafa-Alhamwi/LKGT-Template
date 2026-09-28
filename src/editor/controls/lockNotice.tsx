import { Lock } from 'lucide-react'
import { Btn, Empty } from '../../ui/kit'
import { unlockBrand } from '../../store/lock'

export function BrandLockNotice() {
  return (
    <Empty icon={<Lock size={30} />} title="عناصر الهوية مقفلة" text="اللوغو وشريط التواصل والألوان الأساسية مقفلة لحماية الهوية الموحدة. اطلب الرمز من المسؤول أو افتح القفل.">
      <Btn small onClick={unlockBrand}>
        فتح القفل
      </Btn>
    </Empty>
  )
}

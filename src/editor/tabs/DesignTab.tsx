import { useState } from 'react'
import { BackdropControls, ContactControls, DecorList, LogoControls, PhotoControls, ShapeControls } from '../controls/design'
import { BrandLockNotice } from '../controls/lockNotice'
import { useBrandLocked } from '../../store/lock'

type Pill = 'bg' | 'product' | 'brand' | 'decor'
let last: Pill = 'bg'

export function DesignTab() {
  const [pill, setPillState] = useState<Pill>(last)
  const locked = useBrandLocked()
  const setPill = (p: Pill) => {
    last = p
    setPillState(p)
  }
  return (
    <>
      <div className="pills">
        {(
          [
            ['bg', 'الخلفية'],
            ['product', 'المنتج والظل'],
            ['brand', 'الشريط واللوغو'],
            ['decor', 'زخارف'],
          ] as [Pill, string][]
        ).map(([v, l]) => (
          <button key={v} className={pill === v ? 'on' : ''} onClick={() => setPill(v)}>
            {l}
          </button>
        ))}
      </div>
      {pill === 'bg' && (
        <>
          <BackdropControls />
          <PhotoControls />
        </>
      )}
      {pill === 'product' && <ShapeControls />}
      {pill === 'brand' && locked && <BrandLockNotice />}
      {pill === 'brand' && !locked && (
        <>
          <ContactControls />
          <LogoControls />
        </>
      )}
      {pill === 'decor' && <DecorList />}
    </>
  )
}

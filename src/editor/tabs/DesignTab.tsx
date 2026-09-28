import { useState } from 'react'
import { BackdropControls, ContactControls, DecorList, LogoControls, PhotoControls, ShapeControls } from '../controls/design'

type Pill = 'bg' | 'product' | 'brand' | 'decor'
let last: Pill = 'bg'

export function DesignTab() {
  const [pill, setPillState] = useState<Pill>(last)
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
      {pill === 'brand' && (
        <>
          <ContactControls />
          <LogoControls />
        </>
      )}
      {pill === 'decor' && <DecorList />}
    </>
  )
}

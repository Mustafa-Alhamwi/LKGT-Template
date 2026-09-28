import { memo, useEffect, useRef, useState } from 'react'
import { Poster } from './Poster'
import type { BrandConfig, Design, PartnerLogo } from '../model/types'
import { canvasOf } from '../model/types'

/** معاينة مصغّرة حيّة لأي تصميم (تُرسم فقط عند ظهورها) */
export const PosterThumb = memo(function PosterThumb({
  design,
  brand,
  partners,
  fontsVersion,
  placeholders = 'thumb',
  lazy = true,
}: {
  design: Design
  brand: BrandConfig
  partners: PartnerLogo[]
  fontsVersion: number
  placeholders?: 'none' | 'thumb'
  lazy?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [vis, setVis] = useState(!lazy)
  const cv = canvasOf(design)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    let io: IntersectionObserver | undefined
    if (lazy) {
      io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVis(true), { rootMargin: '400px' })
      io.observe(el)
    }
    return () => {
      ro.disconnect()
      io?.disconnect()
    }
  }, [lazy])
  const s = w / cv.w
  return (
    <div ref={ref} className="thumb-frame" style={{ aspectRatio: `${cv.w} / ${cv.h}` }}>
      {vis && w > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: cv.w, height: cv.h, transform: `scale(${s})`, transformOrigin: '0 0' }}>
          <Poster design={design} brand={brand} partners={partners} fontsVersion={fontsVersion} placeholders={placeholders} />
        </div>
      )}
    </div>
  )
})

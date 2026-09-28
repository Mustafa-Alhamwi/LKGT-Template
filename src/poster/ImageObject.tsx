import type { CSSProperties, ReactNode } from 'react'
import type { DecorItem, ImageMask, ImageSpec, ProductContent } from '../model/types'
import { useAsset } from '../lib/assets'
import { useCutout } from '../lib/cutout'
import { DEFAULT_CLEANUP } from '../model/demo'

/* ------------------------------------------------------------------
 * صورة إضافية داخل التصميم: قناع (دائرة/قوس/…)، إطارات أجهزة، أو منتج مفرّغ
 * ------------------------------------------------------------------ */

export function maskStyle(mask: ImageMask, radius: number, w: number): CSSProperties {
  switch (mask) {
    case 'circle':
      return { borderRadius: '50%' }
    case 'rounded':
      return { borderRadius: radius }
    case 'squircle':
      return { borderRadius: '30%' }
    case 'arch':
      return { borderRadius: `${w / 2}px ${w / 2}px ${Math.min(radius, 40)}px ${Math.min(radius, 40)}px` }
    case 'blob':
      return { borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' }
    case 'hex':
      return { clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' }
    case 'diamond':
      return { clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' }
    default:
      return {}
  }
}

function imgFilter(i: ImageSpec): string | undefined {
  const p: string[] = []
  if (i.brightness !== 1) p.push(`brightness(${i.brightness})`)
  if (i.contrast !== 1) p.push(`contrast(${i.contrast})`)
  if (i.saturate !== 1) p.push(`saturate(${i.saturate})`)
  return p.length ? p.join(' ') : undefined
}

function Photo({ url, i }: { url: string; i: ImageSpec }) {
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: i.fit,
        filter: imgFilter(i),
        transform: `translate(${i.panX}%, ${i.panY}%) scale(${i.zoom})`,
      }}
    />
  )
}

/** منتج مفرّغ إضافي (باستخدام نفس محرك التفريغ) */
function CutImage({ i }: { i: ImageSpec }) {
  const product: ProductContent = {
    sourceAssetId: i.assetId,
    maskAssetId: i.maskAssetId,
    paintAssetId: null,
    cleanup: { ...DEFAULT_CLEANUP },
    linked: false,
    place: null,
    enhance: { brightness: i.brightness, contrast: i.contrast, saturate: i.saturate },
    visible: true,
  }
  const { cutout } = useCutout(product)
  if (!cutout) return null
  return <img src={cutout.url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: `translate(${i.panX}%, ${i.panY}%) scale(${i.zoom})` }} />
}

const dark = '#15161a'

function Frame({ d, i, children }: { d: DecorItem; i: ImageSpec; children: (inset: CSSProperties) => ReactNode }) {
  const w = d.w
  const h = d.h
  switch (i.frame) {
    case 'phone': {
      const bez = Math.max(6, w * 0.035)
      const r = w * 0.15
      return (
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: r, background: `linear-gradient(145deg, #3a3b42, ${dark} 40%, #0a0a0c)`, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.14), inset 0 0 0 5px #050506' }} />
          {children({ position: 'absolute', left: bez, top: bez, right: bez, bottom: bez, borderRadius: r - bez * 0.6, overflow: 'hidden', background: '#000' })}
          <div style={{ position: 'absolute', left: '50%', top: bez * 1.4, width: w * 0.26, height: w * 0.065, borderRadius: 999, background: '#050506', transform: 'translateX(-50%)' }} />
        </div>
      )
    }
    case 'tablet': {
      const bez = Math.max(8, Math.min(w, h) * 0.045)
      return (
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: Math.min(w, h) * 0.06, background: `linear-gradient(145deg, #3a3b42, ${dark})`, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.14)' }} />
          {children({ position: 'absolute', left: bez, top: bez, right: bez, bottom: bez, borderRadius: Math.min(w, h) * 0.02, overflow: 'hidden', background: '#000' })}
        </div>
      )
    }
    case 'laptop': {
      const baseH = h * 0.075
      const bez = Math.max(6, w * 0.018)
      return (
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', left: w * 0.06, right: w * 0.06, top: 0, bottom: baseH, borderRadius: `${w * 0.02}px ${w * 0.02}px 0 0`, background: `linear-gradient(160deg, #34353c, ${dark})`, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.12)' }} />
          {children({ position: 'absolute', left: w * 0.06 + bez, right: w * 0.06 + bez, top: bez, bottom: baseH + bez * 0.6, overflow: 'hidden', background: '#000', borderRadius: 4 })}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: baseH, borderRadius: `2px 2px ${w * 0.05}px ${w * 0.05}px`, background: 'linear-gradient(180deg, #d7d9de, #9ea1a9)', boxShadow: '0 6px 10px rgba(0,0,0,0.25)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: baseH * 0.55, width: w * 0.14, height: baseH * 0.45, borderRadius: `0 0 ${w * 0.02}px ${w * 0.02}px`, background: 'rgba(0,0,0,0.18)', transform: 'translateX(-50%)' }} />
        </div>
      )
    }
    case 'browser': {
      const bar = Math.max(30, h * 0.09)
      return (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.12)' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: bar, background: '#eceef2', borderBottom: '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }} dir="ltr">
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <i key={c} style={{ width: bar * 0.24, height: bar * 0.24, borderRadius: '50%', background: c, display: 'block' }} />
            ))}
            <span style={{ flex: 1, marginInlineStart: 10, height: bar * 0.52, borderRadius: 999, background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
          </div>
          {children({ position: 'absolute', left: 0, right: 0, top: bar, bottom: 0, overflow: 'hidden' })}
        </div>
      )
    }
    case 'polaroid': {
      const p = w * 0.06
      return (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 6, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
          {children({ position: 'absolute', left: p, right: p, top: p, bottom: p * 3.2, overflow: 'hidden', background: '#e8e8ec' })}
        </div>
      )
    }
    case 'card': {
      const p = Math.max(10, w * 0.04)
      return (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: Math.max(16, i.radius) + p * 0.4 }}>
          {children({ position: 'absolute', left: p, right: p, top: p, bottom: p, overflow: 'hidden', borderRadius: Math.max(10, i.radius) })}
        </div>
      )
    }
    default:
      return null
  }
}

export function ImageBody({ d }: { d: DecorItem }) {
  const i = d.image
  const asset = useAsset(i?.assetId)
  if (!i) return null
  if (i.maskAssetId) return <CutImage i={i} />
  if (!asset) return <div style={{ position: 'absolute', inset: 0, background: 'rgba(128,128,140,0.18)', borderRadius: 12 }} />
  if (i.frame !== 'none') {
    return <Frame d={d} i={i}>{(inset) => <div style={inset}><Photo url={asset.url} i={i} /></div>}</Frame>
  }
  const ms = maskStyle(i.mask, i.radius, d.w)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        ...ms,
        boxShadow: i.borderW > 0 && !ms.clipPath ? `inset 0 0 0 ${i.borderW}px ${i.borderColor}` : undefined,
      }}
    >
      <Photo url={asset.url} i={i} />
      {i.borderW > 0 && !ms.clipPath && <div style={{ position: 'absolute', inset: 0, ...ms, boxShadow: `inset 0 0 0 ${i.borderW}px ${i.borderColor}` }} />}
    </div>
  )
}

export const DEFAULT_IMAGE: Omit<ImageSpec, 'assetId'> = {
  maskAssetId: null,
  fit: 'cover',
  mask: 'rounded',
  radius: 36,
  borderW: 0,
  borderColor: '#FFFFFF',
  frame: 'none',
  brightness: 1,
  contrast: 1,
  saturate: 1,
  zoom: 1,
  panX: 0,
  panY: 0,
}

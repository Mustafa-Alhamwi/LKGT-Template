import type { BrandConfig, LogoVariant, PartnerLogo, PartnerVariant } from '../model/types'
import { LkgtLogo, LOGO_ASPECT } from '../brand/LkgtLogo'
import { isSel, useEdit } from './EditContext'
import { useAsset, resolvePublic } from '../lib/assets'
import { useCanvas } from './CanvasContext'

const PARTNER_FILTER: Record<PartnerVariant, string | undefined> = {
  original: undefined,
  white: 'brightness(0) invert(1)',
  black: 'brightness(0)',
}

interface Props {
  brand: BrandConfig
  lkgt: LogoVariant
  partnerVariant: PartnerVariant
  partner: PartnerLogo | undefined
  ghost?: boolean
  hideLkgt?: boolean
  hidePartner?: boolean
}

export function Logos({ brand, lkgt, partnerVariant, partner, ghost, hideLkgt, hidePartner }: Props) {
  const edit = useEdit()
  const cv = useCanvas()
  const safeTop = cv.safeTop ?? 0
  const custom = useAsset(brand.customLogoAssetId)
  const partnerAsset = useAsset(partner && !partner.builtIn ? partner.src : null)
  const lkSide = brand.logoSide
  const pSide = lkSide === 'right' ? 'left' : 'right'
  const h = brand.logo.h
  const w = custom ? (h * custom.w) / custom.h : h * LOGO_ASPECT
  const partnerSrc = partner ? (partner.builtIn ? resolvePublic(partner.src) : partnerAsset?.url) : undefined

  return (
    <>
      {!hideLkgt && <div
        className="lk-logo"
        data-eid="logo"
        style={{ position: 'absolute', top: brand.logo.top + safeTop, [lkSide]: brand.logo.side, width: w, height: h, zIndex: 6 }}
        onPointerDown={
          edit
            ? (e) => {
                e.stopPropagation()
                edit.select({ kind: 'logo' })
              }
            : undefined
        }
      >
        {custom ? (
          <img src={custom.url} alt="LKGT" style={{ width: '100%', height: '100%', filter: lkgt === 'white' ? 'brightness(0) invert(1)' : undefined }} draggable={false} />
        ) : (
          <LkgtLogo variant={lkgt} height={h} style={{ display: 'block' }} />
        )}
        {edit && isSel(edit.selection, { kind: 'logo' }) && <div className="lk-sel" style={{ inset: -6 }} data-label="شعار LKGT (ثابت)" />}
      </div>}

      {!hidePartner && <div
        className="lk-partner"
        data-eid="partner"
        style={{
          position: 'absolute',
          top: brand.partner.top + safeTop,
          [pSide]: brand.partner.side,
          width: brand.partner.maxW,
          height: brand.partner.maxH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: pSide === 'left' ? 'flex-start' : 'flex-end',
          pointerEvents: edit ? 'auto' : 'none',
          zIndex: 6,
        }}
        onPointerDown={
          edit
            ? (e) => {
                e.stopPropagation()
                edit.select({ kind: 'partner' })
              }
            : undefined
        }
      >
        {partnerSrc ? (
          <img
            src={partnerSrc}
            alt={partner?.name}
            draggable={false}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: PARTNER_FILTER[partnerVariant] }}
          />
        ) : ghost ? (
          <div className="lk-ghost">لوغو الشريك</div>
        ) : null}
        {edit && isSel(edit.selection, { kind: 'partner' }) && <div className="lk-sel" style={{ inset: -6 }} data-label="لوغو الشريك" />}
      </div>}
    </>
  )
}


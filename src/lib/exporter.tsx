import { createRoot } from 'react-dom/client'
import { toCanvas } from 'html-to-image'
import type { BrandConfig, Design, PartnerLogo } from '../model/types'
import { POSTER_H, POSTER_W } from '../model/types'
import { Poster } from '../poster/Poster'
import { getExportFontCss, initFonts } from './fonts'
import { getCutout } from './cutout'
import { loadAsset } from './assets'
import { offscreenRoot } from './offscreen'

/* ------------------------------------------------------------------
 * التصدير: نرسم البوستر بحجمه الحقيقي خارج الشاشة ثم نحوله لصورة
 * PNG/JPG بمقاس 1080×1440 (أو ضعفه للدقة العالية)
 * ------------------------------------------------------------------ */

const EDITOR_ONLY = ['lk-sel', 'lk-handle', 'lk-dropzone', 'lk-ghost', 'lk-product-loading']

let fallbackCss: string | null = null

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.readAsDataURL(blob)
  })
}

/** خط Tajawal الاحتياطي (يُضمَّن فقط إذا لم تتوفر خطوط الهوية) */
async function getFallbackCss(): Promise<string> {
  if (fallbackCss != null) return fallbackCss
  const rules: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList
    try {
      list = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(list)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      if (!/tajawal/i.test(rule.style.getPropertyValue('font-family'))) continue
      let css = rule.cssText
      const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1])
      for (const u of urls) {
        if (u.startsWith('data:')) continue
        try {
          const abs = new URL(u, sheet.href ?? document.baseURI).href
          css = css.replace(u, await toDataUrl(abs))
        } catch {
          /* skip */
        }
      }
      rules.push(css)
    }
  }
  fallbackCss = rules.join('\n')
  return fallbackCss
}

async function waitImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? img.decode().catch(() => undefined)
        : new Promise<void>((res) => {
            img.onload = () => res()
            img.onerror = () => res()
          }),
    ),
  )
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

export interface ExportOptions {
  scale: 1 | 2
  format: 'png' | 'jpg'
}

export async function renderDesign(
  design: Design,
  brand: BrandConfig,
  partners: PartnerLogo[],
  fontsVersion: number,
  opts: ExportOptions,
): Promise<Blob> {
  const status = await initFonts()
  // تجهيز الأصول قبل الرسم
  if (design.content.scene) await loadAsset(design.content.scene.assetId)
  if (design.content.product?.visible) await getCutout(design.content.product)
  if (brand.customLogoAssetId) await loadAsset(brand.customLogoAssetId)
  const partner = partners.find((p) => p.id === design.content.partnerLogoId)
  if (partner && !partner.builtIn) await loadAsset(partner.src)

  const host = document.createElement('div')
  host.style.cssText = `position:absolute;left:0;top:0;width:${POSTER_W}px;height:${POSTER_H}px;`
  offscreenRoot().appendChild(host)
  const root = createRoot(host)
  try {
    let node: HTMLDivElement | null = null
    root.render(
      <Poster
        ref={(n) => {
          node = n
        }}
        design={design}
        brand={brand}
        partners={partners}
        fontsVersion={fontsVersion}
      />,
    )
    for (let i = 0; i < 20 && !node; i++) await frame()
    await frame()
    await frame()
    if (!node) throw new Error('render failed')
    await waitImages(node)
    await document.fonts.ready
    await frame()

    const missing = Object.values(status.ar).includes('missing') || Object.values(status.lat).includes('missing')
    const fontEmbedCSS = getExportFontCss() + (missing ? '\n' + (await getFallbackCss()) : '')

    const canvas = await toCanvas(node, {
      width: POSTER_W,
      height: POSTER_H,
      canvasWidth: POSTER_W * opts.scale,
      canvasHeight: POSTER_H * opts.scale,
      pixelRatio: 1,
      skipAutoScale: true,
      cacheBust: false,
      fontEmbedCSS,
      backgroundColor: opts.format === 'jpg' ? '#ffffff' : undefined,
      filter: (el) => !(el instanceof HTMLElement && EDITOR_ONLY.some((c) => el.classList?.contains(c))),
    })
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, opts.format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95),
    )
    if (!blob) throw new Error('encode failed')
    return blob
  } finally {
    root.unmount()
    host.remove()
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function exportFileName(design: Design, templateName: string, ext: string): string {
  const title = (design.content.texts.title || 'design').replace(/\*/g, '').trim()
  const safe = `${title} - ${templateName}`.replace(/[\\/:*?"<>|\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `LKGT - ${safe}.${ext}`
}

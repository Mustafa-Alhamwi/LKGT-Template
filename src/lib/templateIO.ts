import type { AdContent, Template } from '../model/types'
import { blobToDataUrl, dataUrlToBlob, getAssetBlob, putAsset } from './assets'
import { downloadBlob } from './exporter'
import { toast, useEditor } from '../store/editor'

/* تصدير/استيراد القوالب كملف JSON واحد (مع الصور مضمّنة) */

interface Bundle {
  kind: 'lkgt-templates'
  version: 1
  templates: Template[]
  assets: Record<string, string>
}

function assetIds(c: AdContent | undefined): string[] {
  if (!c) return []
  return [c.scene?.assetId, c.product?.sourceAssetId, c.product?.maskAssetId, c.product?.paintAssetId].filter(
    (x): x is string => !!x && !x.startsWith('demo:'),
  )
}

export async function exportTemplatesFile(templates: Template[]) {
  const assets: Record<string, string> = {}
  for (const t of templates) {
    for (const id of assetIds(t.demo)) {
      if (assets[id]) continue
      const b = await getAssetBlob(id)
      if (b) assets[id] = await blobToDataUrl(b)
    }
  }
  const bundle: Bundle = { kind: 'lkgt-templates', version: 1, templates, assets }
  downloadBlob(new Blob([JSON.stringify(bundle)], { type: 'application/json' }), `LKGT-templates-${new Date().toISOString().slice(0, 10)}.json`)
}

export async function importTemplatesFile(file: File) {
  const bundle = JSON.parse(await file.text()) as Bundle
  if (bundle.kind !== 'lkgt-templates') throw new Error('ملف غير صالح')
  const map: Record<string, string> = {}
  for (const [oldId, url] of Object.entries(bundle.assets ?? {})) {
    const a = await putAsset(await dataUrlToBlob(url), 'imported')
    map[oldId] = a.id
  }
  const remap = (id: string | null | undefined) => (id && map[id] ? map[id] : id ?? null)
  const s = useEditor.getState()
  const existing = new Set(s.userTemplates.map((t) => t.id))
  const added: Template[] = bundle.templates.map((t) => {
    const copy: Template = JSON.parse(JSON.stringify(t))
    if (existing.has(copy.id)) copy.id = `${copy.id}-${Date.now().toString(36)}`
    copy.builtIn = false
    if (copy.demo) {
      if (copy.demo.scene) copy.demo.scene.assetId = remap(copy.demo.scene.assetId)!
      if (copy.demo.product) {
        copy.demo.product.sourceAssetId = remap(copy.demo.product.sourceAssetId)!
        copy.demo.product.maskAssetId = remap(copy.demo.product.maskAssetId)
        copy.demo.product.paintAssetId = remap(copy.demo.product.paintAssetId)
      }
    }
    return copy
  })
  useEditor.setState({ userTemplates: [...s.userTemplates, ...added] })
  toast(`تم استيراد ${added.length} قالب ✓`, 'ok')
}

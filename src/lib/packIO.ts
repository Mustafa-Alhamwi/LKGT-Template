import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { BrandKit, PartnerLogo, Template } from '../model/types'
import { downloadBlob } from './exporter'
import { getAssetBlob, putAsset } from './assets'
import { useEditor, toast, type TextPreset } from '../store/editor'
import { collectAssetIds } from '../store/projects'

/* ------------------------------------------------------------------
 * حزمة الفريق (.lkpack): قوالبك + مجموعات الهوية + أنماط النصوص + لوغوهات الشركاء
 * للمشاركة بين أعضاء الفريق (ملف واحد بدون حاجة لخادم)
 * ------------------------------------------------------------------ */

interface PackMeta {
  kind: 'lkgt-pack'
  version: 1
  templates: Template[]
  kits: BrandKit[]
  textPresets: TextPreset[]
  partners: PartnerLogo[]
  assets: Record<string, { type: string; w: number; h: number }>
}

export async function exportPack() {
  const s = useEditor.getState()
  const kits = s.kits.map((k) => (k.id === s.brand.id ? s.brand : k))
  const meta: PackMeta = {
    kind: 'lkgt-pack',
    version: 1,
    templates: s.userTemplates,
    kits,
    textPresets: s.textPresets,
    partners: s.userPartners,
    assets: {},
  }
  const json = JSON.stringify({ ...meta, assets: undefined })
  const files: Record<string, Uint8Array> = {}
  for (const id of await collectAssetIds(json)) {
    const blob = await getAssetBlob(id)
    if (!blob) continue
    files[`assets/${id}`] = new Uint8Array(await blob.arrayBuffer())
    const bmp = await createImageBitmap(blob).catch(() => null)
    meta.assets[id] = { type: blob.type || 'image/png', w: bmp?.width ?? 0, h: bmp?.height ?? 0 }
    bmp?.close()
  }
  files['pack.json'] = strToU8(JSON.stringify(meta))
  downloadBlob(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' }), `LKGT-team-pack-${new Date().toISOString().slice(0, 10)}.lkpack`)
}

export async function importPack(file: File) {
  // دعم ملفات القوالب القديمة (JSON)
  if (/\.json$/i.test(file.name)) return importLegacyJson(file)
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const raw = files['pack.json']
  if (!raw) throw new Error('ملف حزمة غير صالح')
  const meta = JSON.parse(strFromU8(raw)) as PackMeta
  if (meta.kind !== 'lkgt-pack') throw new Error('ملف حزمة غير صالح')
  let json = JSON.stringify({ templates: meta.templates, kits: meta.kits, textPresets: meta.textPresets, partners: meta.partners })
  for (const [oldId, info] of Object.entries(meta.assets ?? {})) {
    const bytes = files[`assets/${oldId}`]
    if (!bytes) continue
    const a = await putAsset(new Blob([bytes as BlobPart], { type: info.type }), 'imported', info.w ? { w: info.w, h: info.h } : undefined)
    json = json.split(oldId).join(a.id)
  }
  const data = JSON.parse(json) as Pick<PackMeta, 'templates' | 'kits' | 'textPresets' | 'partners'>
  const s = useEditor.getState()
  const stamp = Date.now().toString(36)
  const templates = data.templates.map((t) => ({ ...t, id: `${t.id}-${stamp}`, builtIn: false }))
  const kitIds = new Set(s.kits.map((k) => k.id))
  const kits = data.kits.filter((k) => !kitIds.has(k.id))
  const presetIds = new Set(s.textPresets.map((p) => p.id))
  const presets = data.textPresets.filter((p) => !presetIds.has(p.id))
  const pIds = new Set(s.userPartners.map((p) => p.id))
  const partners = data.partners.filter((p) => !pIds.has(p.id))
  useEditor.setState({
    userTemplates: [...s.userTemplates, ...templates],
    kits: [...s.kits, ...kits],
    textPresets: [...s.textPresets, ...presets],
    userPartners: [...s.userPartners, ...partners],
  })
  toast(`تم استيراد الحزمة: ${templates.length} قالب، ${kits.length} هوية، ${presets.length} نمط ✓`, 'ok')
}

interface LegacyBundle {
  kind: 'lkgt-templates'
  templates: Template[]
  assets: Record<string, string>
}

async function importLegacyJson(file: File) {
  const bundle = JSON.parse(await file.text()) as LegacyBundle
  if (bundle.kind !== 'lkgt-templates') throw new Error('ملف غير صالح')
  const s = useEditor.getState()
  const stamp = Date.now().toString(36)
  const added = bundle.templates.map((t) => ({ ...t, id: `${t.id}-${stamp}`, builtIn: false }))
  useEditor.setState({ userTemplates: [...s.userTemplates, ...added] })
  toast(`تم استيراد ${added.length} قالب ✓`, 'ok')
}

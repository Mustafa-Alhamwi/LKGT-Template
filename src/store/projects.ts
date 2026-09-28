import { createStore, del, get, keys, set as idbSet } from 'idb-keyval'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { allPartners, hooks, loadProject, replaceSlides, syncedSlides, toast, useEditor } from './editor'
import type { Canvas, Design } from '../model/types'
import { canvasOf } from '../model/types'
import { renderDesign, downloadBlob } from '../lib/exporter'
import { blobToDataUrl, getAssetBlob, putAsset } from '../lib/assets'

/* ------------------------------------------------------------------
 * المشاريع: حفظ تلقائي في IndexedDB، نسخ (Versions)، ملف مشروع .lkgt
 * ------------------------------------------------------------------ */

const metaStore = createStore('lkgt-projects-meta', 'meta')
const dataStore = createStore('lkgt-projects-data', 'data')
const verStore = createStore('lkgt-projects-versions', 'v')

export interface ProjectMeta {
  id: string
  name: string
  created: number
  updated: number
  slideCount: number
  canvas: Canvas
  category: string
  templateId: string
  thumb?: string
}

interface ProjectData {
  id: string
  name: string
  created: number
  slides: Design[]
  slideIndex: number
}

export interface VersionRec {
  id: string
  projectId: string
  at: number
  label: string
  auto: boolean
  slides: Design[]
  slideIndex: number
  thumb?: string
}

const ASSET_RE = /a_[0-9a-z]+_[0-9a-z]+/g

/* ------------------------------ الحفظ ------------------------------ */

let thumbAt = 0

function isWorthSaving(slides: Design[]): boolean {
  return slides.some((d) => d.touched || (d.content.extras?.length ?? 0) > 0 || d.style.decor.some((x) => x.carry))
}

export async function makeThumb(design: Design): Promise<string | undefined> {
  try {
    const s = useEditor.getState()
    const blob = await renderDesign(design, s.brand, allPartners(s), s.fontsVersion, { scale: 0.22, format: 'jpg', quality: 0.8 })
    return await blobToDataUrl(blob)
  } catch {
    return undefined
  }
}

let saveFailWarned = false

export async function saveProjectNow(withThumb = false): Promise<void> {
  try {
    await saveProjectCore(withThumb)
  } catch (e) {
    console.error('autosave failed', e)
    if (!saveFailWarned) {
      saveFailWarned = true
      toast('تعذّر الحفظ التلقائي للمشروع — قد تكون مساحة التخزين ممتلئة. صدّر ملف المشروع (.lkgt) للاحتفاظ بنسخة.', 'error', 9000)
    }
  }
}

async function saveProjectCore(withThumb = false): Promise<void> {
  const s = useEditor.getState()
  const slides = syncedSlides(s)
  if (!isWorthSaving(slides)) return
  const cur = slides[s.slideIndex]
  const old = (await get(s.projectId, metaStore)) as ProjectMeta | undefined
  let thumb = old?.thumb
  if (withThumb || !thumb) {
    thumb = (await makeThumb(slides[0])) ?? thumb
    thumbAt = Date.now()
  }
  const name = s.projectName || (cur.content.texts.title || 'مشروع').replace(/\*/g, '').split('\n')[0].slice(0, 40)
  const meta: ProjectMeta = {
    id: s.projectId,
    name,
    created: s.projectCreated,
    updated: Date.now(),
    slideCount: slides.length,
    canvas: canvasOf(cur),
    category: cur.category ?? 'ads',
    templateId: cur.templateId,
    thumb,
  }
  const data: ProjectData = { id: s.projectId, name, created: s.projectCreated, slides, slideIndex: s.slideIndex }
  await idbSet(s.projectId, data, dataStore)
  await idbSet(s.projectId, meta, metaStore)
  useEditor.setState({ savedAt: Date.now() })
}

/** ينشئ مشروعاً محفوظاً من تصاميم جاهزة دون فتحه (للتوليد الجماعي) */
export async function createProjectRecord(name: string, slides: Design[]): Promise<string> {
  const id = `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  const first = slides[0]
  const meta: ProjectMeta = {
    id,
    name,
    created: Date.now(),
    updated: Date.now(),
    slideCount: slides.length,
    canvas: canvasOf(first),
    category: first.category ?? 'ads',
    templateId: first.templateId,
    thumb: await makeThumb(first),
  }
  const data: ProjectData = { id, name, created: meta.created, slides, slideIndex: 0 }
  await idbSet(id, data, dataStore)
  await idbSet(id, meta, metaStore)
  return id
}

/** شرائح مشروع محفوظ (دون فتحه) */
export async function getProjectSlides(id: string): Promise<Design[] | null> {
  const d = (await get(id, dataStore)) as ProjectData | undefined
  return d ? d.slides : null
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const ids = (await keys(metaStore)) as string[]
  const all = await Promise.all(ids.map((id) => get(id, metaStore) as Promise<ProjectMeta | undefined>))
  return (all.filter(Boolean) as ProjectMeta[]).sort((a, b) => b.updated - a.updated)
}

export async function openProjectById(id: string) {
  const data = (await get(id, dataStore)) as ProjectData | undefined
  if (!data) return toast('تعذّر فتح المشروع', 'error')
  loadProject(data)
}

export async function deleteProjectById(id: string) {
  await del(id, metaStore)
  await del(id, dataStore)
  const vs = await listVersions(id)
  await Promise.all(vs.map((v) => del(v.id, verStore)))
}

export async function renameProjectById(id: string, name: string) {
  const m = (await get(id, metaStore)) as ProjectMeta | undefined
  const d = (await get(id, dataStore)) as ProjectData | undefined
  if (m) await idbSet(id, { ...m, name }, metaStore)
  if (d) await idbSet(id, { ...d, name }, dataStore)
  if (useEditor.getState().projectId === id) useEditor.setState({ projectName: name })
}

export async function duplicateProjectById(id: string) {
  const d = (await get(id, dataStore)) as ProjectData | undefined
  const m = (await get(id, metaStore)) as ProjectMeta | undefined
  if (!d || !m) return
  const nid = `p_${Date.now().toString(36)}`
  const name = `${m.name} (نسخة)`
  await idbSet(nid, { ...d, id: nid, name, created: Date.now() }, dataStore)
  await idbSet(nid, { ...m, id: nid, name, created: Date.now(), updated: Date.now() }, metaStore)
}

/* ------------------------------ النسخ ------------------------------ */

export async function listVersions(projectId: string): Promise<VersionRec[]> {
  const ids = ((await keys(verStore)) as string[]).filter((k) => k.startsWith(`${projectId}:`))
  const all = await Promise.all(ids.map((id) => get(id, verStore) as Promise<VersionRec | undefined>))
  return (all.filter(Boolean) as VersionRec[]).sort((a, b) => b.at - a.at)
}

export async function saveVersion(label: string, auto = false) {
  const s = useEditor.getState()
  const slides = syncedSlides(s)
  if (!isWorthSaving(slides)) return
  await saveProjectNow()
  const at = Date.now()
  const rec: VersionRec = {
    id: `${s.projectId}:${at}`,
    projectId: s.projectId,
    at,
    label,
    auto,
    slides: structuredClone(slides),
    slideIndex: s.slideIndex,
    thumb: await makeThumb(slides[s.slideIndex]),
  }
  await idbSet(rec.id, rec, verStore)
  // نحتفظ بآخر 40 نسخة (الآلية أولاً بالحذف)
  const all = await listVersions(s.projectId)
  const extra = all.slice(40)
  await Promise.all(extra.map((v) => del(v.id, verStore)))
}

export async function restoreVersion(v: VersionRec) {
  await saveVersion('قبل الاستعادة', true)
  replaceSlides(structuredClone(v.slides), v.slideIndex)
  toast('تمت استعادة النسخة (يمكنك التراجع بـ Ctrl+Z)', 'ok')
}

export async function deleteVersion(id: string) {
  await del(id, verStore)
}

/* ------------------------------ ملف المشروع ------------------------------ */

interface FileMeta {
  kind: 'lkgt-project'
  version: 1
  name: string
  created: number
  slides: Design[]
  slideIndex: number
  assets: Record<string, { type: string; w: number; h: number }>
}

export async function collectAssetIds(json: string): Promise<string[]> {
  return [...new Set(json.match(ASSET_RE) ?? [])]
}

export async function exportProjectFile() {
  const s = useEditor.getState()
  const slides = syncedSlides(s)
  const json = JSON.stringify(slides)
  const ids = await collectAssetIds(json)
  const files: Record<string, Uint8Array> = {}
  const assets: FileMeta['assets'] = {}
  for (const id of ids) {
    const blob = await getAssetBlob(id)
    if (!blob) continue
    files[`assets/${id}`] = new Uint8Array(await blob.arrayBuffer())
    const bmp = await createImageBitmap(blob).catch(() => null)
    assets[id] = { type: blob.type || 'image/png', w: bmp?.width ?? 0, h: bmp?.height ?? 0 }
    bmp?.close()
  }
  const meta: FileMeta = { kind: 'lkgt-project', version: 1, name: s.projectName || 'مشروع LKGT', created: s.projectCreated, slides, slideIndex: s.slideIndex, assets }
  files['project.json'] = strToU8(JSON.stringify(meta))
  const zip = zipSync(files, { level: 0 })
  downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${meta.name.replace(/[\\/:*?"<>|]+/g, ' ')}.lkgt`)
}

export async function importProjectFile(file: File) {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const raw = files['project.json']
  if (!raw) throw new Error('ملف مشروع غير صالح')
  const meta = JSON.parse(strFromU8(raw)) as FileMeta
  if (meta.kind !== 'lkgt-project') throw new Error('ملف مشروع غير صالح')
  let json = JSON.stringify(meta.slides)
  for (const [oldId, info] of Object.entries(meta.assets)) {
    const bytes = files[`assets/${oldId}`]
    if (!bytes) continue
    const a = await putAsset(new Blob([bytes as BlobPart], { type: info.type }), 'imported', info.w ? { w: info.w, h: info.h } : undefined)
    json = json.split(oldId).join(a.id)
  }
  const slides = JSON.parse(json) as Design[]
  loadProject({ id: `p_${Date.now().toString(36)}`, name: meta.name, created: Date.now(), slides, slideIndex: meta.slideIndex })
  toast('تم فتح المشروع ✓', 'ok')
}

/* ------------------------------ تشغيل الحفظ التلقائي ------------------------------ */

let timer: ReturnType<typeof setTimeout> | undefined
let verTimer: ReturnType<typeof setInterval> | undefined

export function startAutosave() {
  hooks.beforeReplace = () => {
    clearTimeout(timer)
    void saveProjectNow(true)
  }
  useEditor.subscribe((s, prev) => {
    if (s.design === prev.design && s.slides === prev.slides && s.projectName === prev.projectName) return
    clearTimeout(timer)
    timer = setTimeout(() => void saveProjectNow(Date.now() - thumbAt > 20000), 1800)
  })
  // حفظ فوري عند إخفاء الصفحة أو إغلاقها
  const flush = () => {
    clearTimeout(timer)
    void saveProjectNow()
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
  window.addEventListener('pagehide', flush)
  clearInterval(verTimer)
  let lastSig = ''
  verTimer = setInterval(() => {
    const s = useEditor.getState()
    if (s.view !== 'editor') return
    const sig = JSON.stringify(syncedSlides(s)).length + ':' + s.projectId
    if (sig !== lastSig) {
      lastSig = sig
      void saveVersion('حفظ تلقائي', true)
    }
  }, 5 * 60 * 1000)
  window.addEventListener('beforeunload', () => void saveProjectNow())
}

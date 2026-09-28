import { createStore, del, get, set, keys } from 'idb-keyval'
import { useEffect, useState } from 'react'
import { DEMO_ASSETS } from '../model/demo'

/* ------------------------------------------------------------------
 * مخزن الصور (IndexedDB) — الصور تبقى محفوظة بعد إعادة فتح البرنامج
 * ------------------------------------------------------------------ */

export interface AssetInfo {
  url: string
  w: number
  h: number
}

interface StoredAsset {
  blob: Blob
  w: number
  h: number
  name: string
}

const store = createStore('lkgt-studio', 'assets')
const cache = new Map<string, AssetInfo>()
const pending = new Map<string, Promise<AssetInfo | null>>()
const listeners = new Set<() => void>()

const BASE = import.meta.env.BASE_URL

export function resolvePublic(path: string): string {
  return `${BASE}${path}`.replace(/\/{2,}/g, '/')
}

function notify() {
  listeners.forEach((l) => l())
}

export function assetInfoSync(id: string | null | undefined): AssetInfo | undefined {
  if (!id) return undefined
  const d = DEMO_ASSETS[id]
  if (d) return { url: resolvePublic(d.url), w: d.w, h: d.h }
  return cache.get(id)
}

export function loadAsset(id: string): Promise<AssetInfo | null> {
  const sync = assetInfoSync(id)
  if (sync) return Promise.resolve(sync)
  let p = pending.get(id)
  if (!p) {
    p = (async () => {
      const rec = (await get(id, store)) as StoredAsset | undefined
      if (!rec) return null
      const info = { url: URL.createObjectURL(rec.blob), w: rec.w, h: rec.h }
      cache.set(id, info)
      notify()
      return info
    })()
    pending.set(id, p)
  }
  return p
}

export async function getAssetBlob(id: string): Promise<Blob | null> {
  const d = DEMO_ASSETS[id]
  if (d) return (await fetch(resolvePublic(d.url))).blob()
  const rec = (await get(id, store)) as StoredAsset | undefined
  return rec?.blob ?? null
}

function newId() {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function putAsset(blob: Blob, name = 'image', knownSize?: { w: number; h: number }): Promise<{ id: string } & AssetInfo> {
  let w = knownSize?.w ?? 0
  let h = knownSize?.h ?? 0
  if (!w || !h) {
    const bmp = await createImageBitmap(blob)
    w = bmp.width
    h = bmp.height
    bmp.close()
  }
  const id = newId()
  await set(id, { blob, w, h, name } satisfies StoredAsset, store)
  const info = { url: URL.createObjectURL(blob), w, h }
  cache.set(id, info)
  notify()
  return { id, ...info }
}

export async function deleteAsset(id: string) {
  if (id.startsWith('demo:')) return
  await del(id, store)
  const c = cache.get(id)
  if (c) URL.revokeObjectURL(c.url)
  cache.delete(id)
}

export async function listAssetIds(): Promise<string[]> {
  return (await keys(store)) as string[]
}

/** تصغير الصور الضخمة عند الاستيراد (أقصى ضلع 2600px) للحفاظ على السرعة */
export async function normalizeImage(file: Blob, maxSide = 2600): Promise<{ blob: Blob; w: number; h: number; hasAlpha: boolean }> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  // فحص وجود شفافية (عينات متفرقة)
  let hasAlpha = false
  if (file.type !== 'image/jpeg') {
    const data = ctx.getImageData(0, 0, w, h).data
    const step = Math.max(4, Math.floor(data.length / 4 / 40000)) * 4
    for (let i = 3; i < data.length; i += step) {
      if (data[i] < 250) {
        hasAlpha = true
        break
      }
    }
  }
  if (scale === 1 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
    return { blob: file, w, h, hasAlpha }
  }
  const blob = await canvas.convertToBlob(hasAlpha ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.93 })
  return { blob, w, h, hasAlpha }
}

export function useAsset(id: string | null | undefined): AssetInfo | undefined {
  const [, force] = useState(0)
  const info = assetInfoSync(id)
  useEffect(() => {
    if (!id || info) return
    let alive = true
    loadAsset(id).then(() => alive && force((n) => n + 1))
    return () => {
      alive = false
    }
  }, [id, info])
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return info
}

/** تحويل صورة لـ data URL (لتصدير القوالب كملف واحد) */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

import { useEffect, useState } from 'react'
import type { ProductContent } from '../model/types'
import { getAssetBlob } from './assets'
import type { CutoutRequest, CutoutResponse } from '../workers/cutout.worker'

/* ------------------------------------------------------------------
 * واجهة المنتج المفرغ: تُحسب مرة واحدة لكل إعدادات وتُشارك بين
 * المحرر ومصغرات المكتبة والتصدير.
 * ------------------------------------------------------------------ */

export interface Cutout {
  url: string
  /** مكان القص داخل الصورة المصدر (px المصدر) */
  crop: { x: number; y: number; w: number; h: number }
  srcW: number
  srcH: number
}

type Entry = { status: 'pending'; promise: Promise<Cutout | null> } | { status: 'done'; value: Cutout | null }

const cache = new Map<string, Entry>()
let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, (r: CutoutResponse) => void>()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/cutout.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<CutoutResponse>) => {
      const cb = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      cb?.(e.data)
    }
  }
  return worker
}

export function cutoutKey(p: ProductContent): string {
  return JSON.stringify([p.sourceAssetId, p.maskAssetId, p.paintAssetId, p.cleanup, !!p.emptyBase])
}

async function compute(p: ProductContent): Promise<Cutout | null> {
  const [source, mask, paint] = await Promise.all([
    getAssetBlob(p.sourceAssetId),
    p.maskAssetId ? getAssetBlob(p.maskAssetId) : Promise.resolve(null),
    p.paintAssetId ? getAssetBlob(p.paintAssetId) : Promise.resolve(null),
  ])
  if (!source) return null
  const id = ++seq
  const req: CutoutRequest = { id, source, mask, paint, cleanup: p.cleanup, emptyBase: p.emptyBase }
  const res = await new Promise<CutoutResponse>((resolve) => {
    waiting.set(id, resolve)
    getWorker().postMessage(req)
  })
  if (!res.ok || !res.blob || !res.crop) return null
  return { url: URL.createObjectURL(res.blob), crop: res.crop, srcW: res.srcW!, srcH: res.srcH! }
}

export function getCutout(p: ProductContent): Promise<Cutout | null> {
  const key = cutoutKey(p)
  const e = cache.get(key)
  if (e) return e.status === 'done' ? Promise.resolve(e.value) : e.promise
  const promise = compute(p).then((value) => {
    cache.set(key, { status: 'done', value })
    // حد أعلى للذاكرة
    if (cache.size > 40) {
      const first = cache.keys().next().value as string
      const old = cache.get(first)
      if (old?.status === 'done' && old.value) URL.revokeObjectURL(old.value.url)
      cache.delete(first)
    }
    return value
  })
  cache.set(key, { status: 'pending', promise })
  return promise
}

export function cutoutSync(p: ProductContent | null | undefined): Cutout | null | undefined {
  if (!p) return undefined
  const e = cache.get(cutoutKey(p))
  return e?.status === 'done' ? e.value : undefined
}

/** يعيد آخر نتيجة جاهزة ويحافظ على السابقة أثناء إعادة الحساب (بدون وميض) */
export function useCutout(p: ProductContent | null | undefined): { cutout: Cutout | null; busy: boolean } {
  const key = p ? cutoutKey(p) : ''
  const sync = cutoutSync(p)
  const [last, setLast] = useState<Cutout | null>(sync ?? null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!p) {
      setLast(null)
      return
    }
    const s = cutoutSync(p)
    if (s !== undefined) {
      setLast(s)
      setBusy(false)
      return
    }
    let alive = true
    setBusy(true)
    const t = setTimeout(() => {
      getCutout(p).then((v) => {
        if (!alive) return
        setLast(v)
        setBusy(false)
      })
    }, 60)
    return () => {
      alive = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { cutout: sync !== undefined ? sync : last, busy }
}

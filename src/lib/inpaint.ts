import type { InpaintRequest, InpaintResponse } from '../workers/inpaint.worker'

/** يشغّل محو العناصر في Worker مستقل (يمكن إلغاؤه) */
export function runInpaint(image: Blob, mask: Uint8Array, w: number, h: number, onProgress?: (p: number) => void): { promise: Promise<Blob>; cancel: () => void } {
  const worker = new Worker(new URL('../workers/inpaint.worker.ts', import.meta.url), { type: 'module' })
  let rejectFn: (e: Error) => void = () => {}
  const promise = new Promise<Blob>((resolve, reject) => {
    rejectFn = reject
    worker.onmessage = (e: MessageEvent<InpaintResponse>) => {
      const r = e.data
      if (!r.ok) {
        worker.terminate()
        return reject(new Error(r.error ?? 'فشل المحو'))
      }
      if (r.progress != null) onProgress?.(r.progress)
      if (r.done && r.blob) {
        worker.terminate()
        resolve(r.blob)
      }
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message))
    }
    const req: InpaintRequest = { id: 1, image, mask, w, h, seed: Math.floor(Math.random() * 1e6) }
    worker.postMessage(req, [mask.buffer])
  })
  return {
    promise,
    cancel: () => {
      worker.terminate()
      rejectFn(new Error('cancelled'))
    },
  }
}

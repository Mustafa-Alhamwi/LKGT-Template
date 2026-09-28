/// <reference lib="webworker" />
/* ------------------------------------------------------------------
 * محو عناصر من الصورة (Inpainting) — خوارزمية «رقع» مستوحاة من PatchMatch:
 * تُملأ المنطقة المحددة من الخارج إلى الداخل (طبقة بعد طبقة)، وكل بكسل
 * يأخذ لونه من أفضل رقعة مشابهة في المحيط المعروف (بحث عشوائي + انتشار).
 * تعمل على منطقة الاهتمام فقط (المحدد + هامش) فتبقى سريعة على الصور الكبيرة.
 * ------------------------------------------------------------------ */

export interface InpaintRequest {
  id: number
  image: Blob
  /** قناع بحجم الصورة: 255 = احذف */
  mask: Uint8Array
  w: number
  h: number
  seed?: number
}

export interface InpaintResponse {
  id: number
  ok: boolean
  error?: string
  blob?: Blob
  progress?: number
  done?: boolean
}

function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  let cur = m
  for (let it = 0; it < r; it++) {
    const next = new Uint8Array(cur)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (cur[i]) continue
        if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) next[i] = 1
      }
    }
    cur = next
  }
  return cur
}

async function run(req: InpaintRequest, post: (r: InpaintResponse) => void): Promise<InpaintResponse> {
  const { w, h } = req
  const bmp = await createImageBitmap(req.image)
  const full = new OffscreenCanvas(w, h)
  const fctx = full.getContext('2d', { willReadFrequently: true })!
  fctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const fullImg = fctx.getImageData(0, 0, w, h)

  // قناع ثنائي + توسيع بسيط لتغطية حواف الفرشاة
  const m0 = new Uint8Array(w * h)
  for (let i = 0; i < m0.length; i++) m0[i] = req.mask[i] > 100 ? 1 : 0
  const mFull = dilate(m0, w, h, 2)

  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mFull[y * w + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { id: req.id, ok: false, error: 'لا يوجد تحديد' }

  const margin = Math.max(40, Math.min(360, Math.round(Math.max(maxX - minX, maxY - minY) * 0.7)))
  const rx0 = Math.max(0, minX - margin)
  const ry0 = Math.max(0, minY - margin)
  const rx1 = Math.min(w - 1, maxX + margin)
  const ry1 = Math.min(h - 1, maxY + margin)
  const rw = rx1 - rx0 + 1
  const rh = ry1 - ry0 + 1
  const n = rw * rh

  // بيانات المنطقة
  const px = new Uint8ClampedArray(n * 4)
  const hole = new Uint8Array(n)
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const si = (ry0 + y) * w + (rx0 + x)
      const di = y * rw + x
      px[di * 4] = fullImg.data[si * 4]
      px[di * 4 + 1] = fullImg.data[si * 4 + 1]
      px[di * 4 + 2] = fullImg.data[si * 4 + 2]
      px[di * 4 + 3] = fullImg.data[si * 4 + 3]
      hole[di] = mFull[si]
    }
  }

  // تكامل الفجوات: للتحقق أن رقعة المصدر كلها معروفة بـ O(1)
  const R = 3
  const stride = rw + 1
  const integ = new Int32Array(stride * (rh + 1))
  for (let y = 0; y < rh; y++) {
    let row = 0
    for (let x = 0; x < rw; x++) {
      row += hole[y * rw + x]
      integ[(y + 1) * stride + (x + 1)] = integ[y * stride + (x + 1)] + row
    }
  }
  const holesIn = (x0: number, y0: number, x1: number, y1: number) => integ[(y1 + 1) * stride + (x1 + 1)] - integ[y0 * stride + (x1 + 1)] - integ[(y1 + 1) * stride + x0] + integ[y0 * stride + x0]

  // مراكز مصدر صالحة (رقعة كاملة داخل المنطقة ومعروفة)
  const valid: number[] = []
  for (let y = R; y < rh - R; y++) {
    for (let x = R; x < rw - R; x++) {
      if (!hole[y * rw + x] && holesIn(x - R, y - R, x + R, y + R) === 0) valid.push(y * rw + x)
    }
  }
  if (!valid.length) return { id: req.id, ok: false, error: 'لا توجد منطقة مجاورة كافية لتعبئة التحديد — قلّل حجم التحديد' }

  // ترتيب الملء: طبقات من الحافة للداخل (BFS)
  const dist = new Int32Array(n).fill(-1)
  let frontier: number[] = []
  for (let i = 0; i < n; i++) {
    if (!hole[i]) continue
    const x = i % rw
    const y = (i - x) / rw
    if ((x > 0 && !hole[i - 1]) || (x < rw - 1 && !hole[i + 1]) || (y > 0 && !hole[i - rw]) || (y < rh - 1 && !hole[i + rw])) {
      dist[i] = 0
      frontier.push(i)
    }
  }
  const layers: number[][] = []
  while (frontier.length) {
    layers.push(frontier)
    const next: number[] = []
    for (const i of frontier) {
      const x = i % rw
      const y = (i - x) / rw
      const nb = [x > 0 ? i - 1 : -1, x < rw - 1 ? i + 1 : -1, y > 0 ? i - rw : -1, y < rh - 1 ? i + rw : -1]
      for (const j of nb) {
        if (j >= 0 && hole[j] && dist[j] < 0) {
          dist[j] = dist[i] + 1
          next.push(j)
        }
      }
    }
    frontier = next
  }
  const totalHole = layers.reduce((a, l) => a + l.length, 0)

  const rand = rng(req.seed ?? 5)
  const state = new Uint8Array(n) // 1 = معروف أو مملوء
  for (let i = 0; i < n; i++) state[i] = hole[i] ? 0 : 1
  const src = new Int32Array(n).fill(-1) // مصدر البكسل المملوء
  const K = totalHole > 60000 ? 28 : 56

  const cost = (p: number, q: number, best: number): number => {
    const pxp = p % rw
    const pyp = (p - pxp) / rw
    const qxp = q % rw
    const qyp = (q - qxp) / rw
    let s = 0
    for (let dy = -R; dy <= R; dy++) {
      const ty = pyp + dy
      if (ty < 0 || ty >= rh) continue
      for (let dx = -R; dx <= R; dx++) {
        const tx = pxp + dx
        if (tx < 0 || tx >= rw) continue
        const ti = ty * rw + tx
        if (!state[ti]) continue
        const si = (qyp + dy) * rw + (qxp + dx)
        const a = ti * 4
        const b = si * 4
        const d0 = px[a] - px[b]
        const d1 = px[a + 1] - px[b + 1]
        const d2 = px[a + 2] - px[b + 2]
        // بكسلات قريبة من المركز أثقل
        const wgt = 1 + (R - Math.max(Math.abs(dx), Math.abs(dy))) * 0.35
        s += (d0 * d0 + d1 * d1 + d2 * d2) * wgt
        if (s >= best) return s
      }
    }
    return s
  }

  const isValidCenter = (q: number) => {
    const qx = q % rw
    const qy = (q - qx) / rw
    return qx >= R && qx < rw - R && qy >= R && qy < rh - R && !hole[q] && holesIn(qx - R, qy - R, qx + R, qy + R) === 0
  }

  let done = 0
  let lastPost = 0
  for (const layer of layers) {
    const picks: { p: number; q: number }[] = []
    for (const p of layer) {
      const x = p % rw
      const y = (p - x) / rw
      let best = Infinity
      let bq = -1
      const consider = (q: number) => {
        if (q < 0 || q >= n || !isValidCenter(q)) return
        const c = cost(p, q, best)
        if (c < best) {
          best = c
          bq = q
        }
      }
      // انتشار من الجيران المملوءين
      const nbs = [x > 0 ? p - 1 : -1, x < rw - 1 ? p + 1 : -1, y > 0 ? p - rw : -1, y < rh - 1 ? p + rw : -1]
      const offs = [1, -1, rw, -rw]
      for (let k = 0; k < 4; k++) {
        const nb = nbs[k]
        if (nb >= 0 && src[nb] >= 0) consider(src[nb] + offs[k])
      }
      // بحث عشوائي: نصفه قريب من الموضع
      for (let k = 0; k < K; k++) {
        if (k % 2 === 0) consider(valid[Math.floor(rand() * valid.length)])
        else {
          const ang = rand() * Math.PI * 2
          const rr = 8 + rand() * Math.min(rw, rh) * 0.35
          const qx = Math.round(x + Math.cos(ang) * rr)
          const qy = Math.round(y + Math.sin(ang) * rr)
          if (qx >= 0 && qx < rw && qy >= 0 && qy < rh) consider(qy * rw + qx)
        }
      }
      if (bq < 0) bq = valid[Math.floor(rand() * valid.length)]
      picks.push({ p, q: bq })
    }
    for (const { p, q } of picks) {
      px[p * 4] = px[q * 4]
      px[p * 4 + 1] = px[q * 4 + 1]
      px[p * 4 + 2] = px[q * 4 + 2]
      px[p * 4 + 3] = 255
      src[p] = q
      state[p] = 1
    }
    done += layer.length
    const now = Date.now()
    if (now - lastPost > 120) {
      lastPost = now
      post({ id: req.id, ok: true, progress: done / totalHole })
    }
  }

  // تنعيم خفيف على الحدّ لإخفاء التماس
  const soft = new Uint8ClampedArray(px)
  for (let i = 0; i < n; i++) {
    if (!hole[i] || dist[i] > 1) continue
    const x = i % rw
    const y = (i - x) / rw
    if (x < 1 || y < 1 || x >= rw - 1 || y >= rh - 1) continue
    for (let c = 0; c < 3; c++) {
      let s = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += px[((y + dy) * rw + (x + dx)) * 4 + c]
      soft[i * 4 + c] = px[i * 4 + c] * 0.5 + (s / 9) * 0.5
    }
  }

  // كتابة النتيجة في الصورة الكاملة
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const di = y * rw + x
      if (!hole[di]) continue
      const si = (ry0 + y) * w + (rx0 + x)
      fullImg.data[si * 4] = soft[di * 4]
      fullImg.data[si * 4 + 1] = soft[di * 4 + 1]
      fullImg.data[si * 4 + 2] = soft[di * 4 + 2]
      fullImg.data[si * 4 + 3] = 255
    }
  }
  fctx.putImageData(fullImg, 0, 0)
  const hasAlpha = (() => {
    for (let i = 3; i < fullImg.data.length; i += 4 * 211) if (fullImg.data[i] < 250) return true
    return false
  })()
  const blob = await full.convertToBlob(hasAlpha ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.95 })
  return { id: req.id, ok: true, blob, done: true, progress: 1 }
}

self.onmessage = async (e: MessageEvent<InpaintRequest>) => {
  const post = (r: InpaintResponse) => (self as unknown as Worker).postMessage(r)
  try {
    post(await run(e.data, post))
  } catch (err) {
    post({ id: e.data.id, ok: false, error: String(err) })
  }
}

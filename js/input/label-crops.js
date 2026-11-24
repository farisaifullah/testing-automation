// Potongan gambar tambahan untuk AI: label sumbu X (ujung kiri dan kanan) dan header (nama lokasi).
// Label X pada banyak dashboard miring sekitar 40 derajat dan kecil: diluruskan, diperbesar, dan dikontraskan agar jam-menitnya terbaca.
const STRIP_TOP = 0.88
const END_FRAC = 0.18
const MAX_OUT = 1000
const ANGLE_LIMIT = 70

const stripRect = (hd, a, b) => {
  const x0 = Math.round(hd.width * a), x1 = Math.round(hd.width * b), y0 = Math.round(hd.height * STRIP_TOP)
  return { x0, y0, w: Math.max(1, x1 - x0), h: Math.max(1, hd.height - y0) }
}

const grab = (hd, r, k = 1) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(r.w * k)); c.height = Math.max(1, Math.round(r.h * k))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(hd, r.x0, r.y0, r.w, r.h, 0, 0, c.width, c.height)
  return c
}

const percentile = (hist, total, q) => {
  let acc = 0
  const target = total * q
  for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= target) return i }
  return hist.length - 1
}

/** Sudut garis dasar teks pada strip label (derajat searah jarum jam dari sumbu x; negatif = naik ke kanan). 0 = datar. */
export const detectTilt = hd => {
  const r = stripRect(hd, 0, 0.5)
  const c = grab(hd, r, Math.min(1, 640 / r.w))
  const w = c.width, h = c.height
  const d = c.getContext('2d').getImageData(0, 0, w, h).data
  const n = w * h, g = new Float32Array(n), sat = new Uint8Array(n), hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    const R = d[i * 4], G = d[i * 4 + 1], B = d[i * 4 + 2]
    g[i] = 0.299 * R + 0.587 * G + 0.114 * B
    sat[i] = Math.max(R, G, B) - Math.min(R, G, B)
    hist[g[i] | 0]++
  }
  const med = percentile(hist, n, 0.5)
  const ih = new Uint32Array(256)
  for (let i = 0; i < n; i++) ih[Math.min(255, Math.abs(g[i] - med) | 0)]++
  const thr = Math.max(12, 5 * percentile(ih, n, 0.5))
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = Math.abs(g[i] - med) > thr && sat[i] < 45 ? 1 : 0
  // Buang baris/kolom yang memuat garis lurus panjang (grid putus-putus, slider, bingkai): deretan piksel yang menyambung (celah <= 4 px) lebih dari 40 px.
  const killLines = (len, cross, idx) => {
    const bad = new Uint8Array(len)
    for (let a = 0; a < len; a++) {
      let start = -1, last = -1
      for (let c = 0; c < cross; c++) {
        if (!mask[idx(a, c)]) continue
        if (start < 0 || c - last > 4) start = c
        last = c
        if (last - start > 40) { bad[a] = 1; break }
      }
    }
    for (let a = 0; a < len; a++) if (bad[a]) for (let k = Math.max(0, a - 2); k <= Math.min(len - 1, a + 2); k++) for (let c = 0; c < cross; c++) mask[idx(k, c)] = 0
  }
  killLines(h, w, (y, x) => y * w + x)
  killLines(w, h, (x, y) => y * w + x)
  const xs = [], ys = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { xs.push(x); ys.push(y) }
  if (xs.length < 60) return 0
  // Teks lurus sepanjang garis dasarnya: piksel tinta berulang pada jarak 6, 10, 14 px searah teks. Arah yang benar memberi pengulangan terbanyak.
  const score = deg => {
    const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a)
    let hit = 0
    for (let i = 0; i < xs.length; i++) {
      for (const L of [6, 10, 14]) {
        const x = Math.round(xs[i] + L * cs), y = Math.round(ys[i] + L * sn)
        if (x >= 0 && x < w && y >= 0 && y < h && mask[y * w + x]) hit++
      }
    }
    return hit
  }
  const flat = score(0)
  let best = 0, bs = flat
  for (let deg = -ANGLE_LIMIT; deg <= ANGLE_LIMIT; deg += 2) { const s = score(deg); if (s > bs) { bs = s; best = deg } }
  for (let deg = best - 1; deg <= best + 1; deg++) { const s = score(deg); if (s > bs) { bs = s; best = deg } }
  return Math.abs(best) >= 8 && bs > flat * 1.25 ? best : 0
}

/** Teks terang di latar gelap dengan kontras penuh (tema gelap maupun terang). */
const stretch = canvas => {
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const im = ctx.getImageData(0, 0, w, h), d = im.data, n = w * h
  const g = new Float32Array(n), hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) { g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; hist[g[i] | 0]++ }
  const med = percentile(hist, n, 0.5), hi = percentile(hist, n, 0.995), lo = percentile(hist, n, 0.005)
  const sign = hi - med >= med - lo ? 1 : -1
  const ih = new Uint32Array(256)
  for (let i = 0; i < n; i++) ih[Math.min(255, Math.max(0, (g[i] - med) * sign) | 0)]++
  const top = Math.max(24, percentile(ih, n, 0.995))
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, ((g[i] - med) * sign) / top * 255))
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255
  }
  ctx.putImageData(im, 0, 0)
}

const deskewed = (hd, name, p, q, deg) => {
  const r = stripRect(hd, p, q)
  const src = grab(hd, r)
  stretch(src)
  const a = -deg * Math.PI / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a))
  const rw = r.w * cs + r.h * sn, rh = r.w * sn + r.h * cs
  const k = Math.min(2.5, MAX_OUT / Math.max(rw, rh))
  const out = document.createElement('canvas')
  out.width = Math.round(rw * k); out.height = Math.round(rh * k)
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, out.width, out.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate(a)
  ctx.drawImage(src, -r.w * k / 2, -r.h * k / 2, r.w * k, r.h * k)
  return { name, xFrom: Math.round(p * 100), xTo: Math.round(q * 100), yFrom: Math.round(STRIP_TOP * 100), base64: out.toDataURL('image/png').split(',')[1], mediaType: 'image/png', deskew: deg }
}

/** Label miring: dua potongan ujung (pertama dan terakhir) yang diluruskan. Label datar: potongan biasa (legacy). */
export const smartLabelCrops = (hd, legacy) => {
  let deg = 0
  try { deg = detectTilt(hd) } catch (e) { deg = 0 }
  if (!deg) return legacy(hd)
  return [deskewed(hd, 'kiri', 0, END_FRAC, deg), deskewed(hd, 'kanan', 1 - END_FRAC, 1, deg)]
}

/** Potongan header kiri atas (dropdown nama lokasi), dipakai hanya bila AI tidak membaca nama. */
export const headerCrop = hd => {
  const w = Math.round(hd.width * 0.4), h = Math.max(24, Math.round(hd.height * 0.07))
  const k = Math.min(2, 1568 / w)
  const out = document.createElement('canvas')
  out.width = Math.round(w * k); out.height = Math.round(h * k)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(hd, 0, 0, w, h, 0, 0, out.width, out.height)
  return { base64: out.toDataURL('image/png').split(',')[1], mediaType: 'image/png' }
}

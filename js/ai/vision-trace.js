// Pelacakan kurva langsung dari piksel (tanpa AI): garis grid, warna seri, titik kurva.
const lumOf = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
const satOf = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])
const median = arr => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }

export const loadPixels = image => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height)
    resolve({ data: d.data, width: c.width, height: c.height })
  }
  img.onerror = () => reject(new Error('Gagal memuat piksel gambar.'))
  img.src = image.dataUrl
})

export const plotBox = (img, plot) => ({
  x0: Math.max(0, Math.floor(plot.left)), x1: Math.min(img.width - 1, Math.ceil(plot.right)),
  y0: Math.max(0, Math.floor(plot.top)), y1: Math.min(img.height - 1, Math.ceil(plot.bottom))
})

const paddedBox = (img, plot) => {
  const b = plotBox(img, plot), px = Math.max(6, Math.round(img.width * 0.012)), py = Math.max(6, Math.round(img.height * 0.012))
  return { x0: Math.max(0, b.x0 - px), x1: Math.min(img.width - 1, b.x1 + px), y0: Math.max(0, b.y0 - py), y1: Math.min(img.height - 1, b.y1 + py) }
}

const backgroundLum = (img, b) => {
  const vals = []
  const stepX = Math.max(1, Math.floor((b.x1 - b.x0) / 40)), stepY = Math.max(1, Math.floor((b.y1 - b.y0) / 40))
  for (let y = b.y0; y <= b.y1; y += stepY) for (let x = b.x0; x <= b.x1; x += stepX) vals.push(lumOf(img.data, (y * img.width + x) * 4))
  return median(vals)
}

const backgroundRgb = (img, b) => {
  const ch = [[], [], []]
  const stepX = Math.max(1, Math.floor((b.x1 - b.x0) / 40)), stepY = Math.max(1, Math.floor((b.y1 - b.y0) / 40))
  for (let y = b.y0; y <= b.y1; y += stepY) {
    for (let x = b.x0; x <= b.x1; x += stepX) { const k = (y * img.width + x) * 4; ch[0].push(img.data[k]); ch[1].push(img.data[k + 1]); ch[2].push(img.data[k + 2]) }
  }
  return ch.map(median)
}

/** Garis grid tipis (vertikal 'v' atau horizontal 'h') di dalam area plot: [{ pos, strength }]. */
export const findLines = (img, plot, dir) => {
  const inner = plotBox(img, plot), vertical = dir === 'v', bg = backgroundLum(img, inner)
  const padX = vertical ? Math.max(6, Math.round(img.width * 0.012)) : 0, padY = vertical ? 0 : Math.max(6, Math.round(img.height * 0.012))
  const b = { x0: Math.max(0, inner.x0 - padX), x1: Math.min(img.width - 1, inner.x1 + padX), y0: Math.max(0, inner.y0 - padY), y1: Math.min(img.height - 1, inner.y1 + padY) }
  const len = vertical ? b.x1 - b.x0 + 1 : b.y1 - b.y0 + 1
  const span = vertical ? b.y1 - b.y0 + 1 : b.x1 - b.x0 + 1
  const frac = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let n = 0
    for (let j = 0; j < span; j++) {
      const x = vertical ? b.x0 + i : b.x0 + j, y = vertical ? b.y0 + j : b.y0 + i
      const k = (y * img.width + x) * 4
      if (satOf(img.data, k) < 45 && Math.abs(lumOf(img.data, k) - bg) >= 16) n++
    }
    frac[i] = n / span
  }
  const lines = []
  for (let i = 0; i < len;) {
    if (frac[i] < 0.35) { i++; continue }
    let j = i, sw = 0, sp = 0
    while (j < len && frac[j] >= 0.35) { sw += frac[j]; sp += frac[j] * j; j++ }
    if (j - i <= 6) lines.push({ pos: (vertical ? b.x0 : b.y0) + sp / sw, strength: sw / (j - i) })
    i = j
  }
  return lines
}

const hexToRgb = hex => {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [n >> 16 & 255, n >> 8 & 255, n & 255]
}

const hueOf = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d === 0) return 0
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

/** Puncak-puncak rona (derajat) dari piksel jenuh di area plot: tiap kurva berwarna membentuk satu puncak. */
const huePeaks = (img, b, bgl) => {
  const hist = new Float32Array(36)
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      const k = (y * img.width + x) * 4, d = img.data
      if (satOf(d, k) < 30 || Math.abs(lumOf(d, k) - bgl) < 20) continue
      hist[Math.floor(hueOf(d[k], d[k + 1], d[k + 2]) / 10) % 36]++
    }
  }
  const max = Math.max(...hist)
  const peaks = []
  for (let i = 0; i < 36; i++) {
    const a = hist[(i + 35) % 36], c = hist[(i + 1) % 36]
    if (hist[i] >= Math.max(150, 0.015 * max) && hist[i] >= a && hist[i] >= c) {
      const w = a + hist[i] + c
      const ang = [-10, 0, 10].map((o, j) => ({ h: i * 10 + 5 + o, w: [a, hist[i], c][j] }))
      peaks.push({ hue: ((ang.reduce((s, q) => s + q.h * q.w, 0) / w) + 360) % 360, n: hist[i] })
    }
  }
  return peaks
}

/** Warna kurva sebenarnya: puncak rona terdekat dengan petunjuk AI (petunjuk sering meleset dari warna yang tampak). */
const HUE_PRIOR = { disp: 115, vel: 235, accel: 65 } // warna bawaan dashboard: disp hijau, speed biru, accel kuning

export const refineColor = (img, plot, hint, kind) => {
  const b = plotBox(img, plot), base = hexToRgb(hint), bgl = backgroundLum(img, b)
  const hintSat = base ? Math.max(...base) - Math.min(...base) : 0
  let target = null
  if (base && hintSat >= 30) {
    const hh = hueOf(base[0], base[1], base[2])
    let best = null
    const prior = HUE_PRIOR[kind]
    huePeaks(img, b, bgl).forEach(p => {
      const g = hueGap(p.hue, hh), score = g + (prior === undefined ? 0 : 0.35 * hueGap(p.hue, prior))
      if (!best || score < best.score) best = { g, score, hue: p.hue }
    })
    if (best && best.g <= 50) target = best.hue
  }
  // piksel kandidat (rona sama), lalu hanya inti garis: jarak dari latar di persentil atas (tepi pudar anti-alias dibuang)
  const bgc = backgroundRgb(img, b), cand = []
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      const k = (y * img.width + x) * 4, d = img.data
      if (satOf(d, k) < 30 || Math.abs(lumOf(d, k) - bgl) < 20) continue
      if (target !== null && hueGap(hueOf(d[k], d[k + 1], d[k + 2]), target) > 18) continue
      cand.push([k, Math.hypot(d[k] - bgc[0], d[k + 1] - bgc[1], d[k + 2] - bgc[2])])
    }
  }
  if (cand.length < 12) return null
  const dists = cand.map(c => c[1]).sort((a, b2) => a - b2)
  const cut = dists[Math.floor(dists.length * 0.6)]
  const bins = new Map()
  cand.forEach(([k, dist]) => {
    if (dist < cut) return
    const d = img.data, key = (d[k] >> 4) << 8 | (d[k + 1] >> 4) << 4 | (d[k + 2] >> 4)
    const e = bins.get(key) || { c: 0, r: 0, g: 0, b: 0 }
    e.c++; e.r += d[k]; e.g += d[k + 1]; e.b += d[k + 2]
    bins.set(key, e)
  })
  let best = null
  bins.forEach(e => { if (!best || e.c > best.c) best = e })
  if (!best || best.c < 12) return null
  return [best.r / best.c, best.g / best.c, best.b / best.c]
}

/** Porsi warna garis pada piksel (campuran garis + latar akibat anti-alias/JPEG); 0 bila bukan garis. */
const lineShare = (d, k, c, bg) => {
  const vx = c[0] - bg[0], vy = c[1] - bg[1], vz = c[2] - bg[2]
  const len2 = vx * vx + vy * vy + vz * vz
  if (len2 < 900) return 0
  const px = d[k] - bg[0], py = d[k + 1] - bg[1], pz = d[k + 2] - bg[2]
  const a = (px * vx + py * vy + pz * vz) / len2
  // Jauh lebih terang dari inti garis (a > 1.8) = grid putus-putus atau teks berwarna senada, bukan kurva.
  if (a < 0.3 || a > 1.8) return 0
  const res = Math.hypot(px - a * vx, py - a * vy, pz - a * vz)
  return res <= Math.max(45, 0.35 * Math.hypot(px, py, pz)) ? Math.min(a, 1) : 0
}

const candidatesAt = (img, x, b, color, bg, maxThick, hue, grid) => {
  const out = []
  let run = null
  const flush = () => {
    if (run && run.last - run.first + 1 <= maxThick && run.w >= 0.6) out.push({ y: run.sy / run.w, dev: run.dev })
    run = null
  }
  for (let y = b.y0; y <= b.y1; y++) {
    const k = (y * img.width + x) * 4, d = img.data
    let w = lineShare(d, k, color, bg)
    if (w > 0 && hue !== null && satOf(d, k) >= 25 && hueGap(hueOf(d[k], d[k + 1], d[k + 2]), hue) > 40) w = 0
    // Pada baris grid horizontal, hanya warna yang benar-benar mirip inti garis (bukan abu-abu kebiruan grid) yang dihitung:
    // grid yang lurus dan menerus kalau tidak akan menang atas kurva yang bergerigi saat pelacakan.
    if (w > 0 && grid.length && grid.some(g => Math.abs(y - g) <= 1.6) && Math.hypot(d[k] - color[0], d[k + 1] - color[1], d[k + 2] - color[2]) > 0.35 * Math.hypot(color[0] - bg[0], color[1] - bg[1], color[2] - bg[2])) w = 0
    if (w > 0) {
      if (!run) run = { first: y, last: y, w: 0, sy: 0, dev: 0, top: 0 }
      run.last = y; run.w += w; run.sy += w * y
      if (w > run.top) { run.top = w; run.dev = Math.hypot(d[k] - color[0], d[k + 1] - color[1], d[k + 2] - color[2]) }
    } else flush()
  }
  flush()
  return out
}

const GAP_COST = 5

/** Satu nilai y (piksel, sub-piksel) per kolom: lintasan paling kontinu (DP); NaN bila kurva tidak ada. */
export const traceColumns = (img, plot, color) => {
  const b = paddedBox(img, plot), n = b.x1 - b.x0 + 1, bg = backgroundRgb(img, plotBox(img, plot))
  const hue = satOf(color, 0) >= 30 ? hueOf(color[0], color[1], color[2]) : null
  const grid = findLines(img, plot, 'h').map(l => l.pos)
  const maxThick = Math.max(8, (b.y1 - b.y0) * 0.25), look = Math.max(60, Math.round(n * 0.15))
  const nodes = []
  for (let i = 0; i < n; i++) {
    nodes.push(candidatesAt(img, b.x0 + i, b, color, bg, maxThick, hue, grid).map(({ y, dev: dv }) => {
      const dev = Math.min(4, Math.max(0, dv - 25) * 0.1)
      let best = { cost: GAP_COST * i, from: null }
      for (let d = 1; d <= look && i - d >= 0; d++) {
        nodes[i - d].forEach(q => {
          const c = q.cost + Math.abs(y - q.y) * (d > 1 ? 0.4 : 1) + GAP_COST * (d - 1) + dev
          if (c < best.cost) best = { cost: c, from: q }
        })
      }
      return { i, y, cost: best.cost + (best.from ? 0 : dev), from: best.from }
    }))
  }
  const ys = new Float32Array(n).fill(NaN)
  let last = null, lastTotal = Infinity
  nodes.forEach((list, i) => list.forEach(q => { const t = q.cost + GAP_COST * (n - 1 - i); if (t < lastTotal) { lastTotal = t; last = q } }))
  for (let q = last; q; q = q.from) ys[q.i] = q.y
  return { x0: b.x0, ys: dropBlips(ys) }
}

const dropBlips = ys => {
  for (let i = 0; i < ys.length;) {
    if (isNaN(ys[i])) { i++; continue }
    let j = i
    while (j < ys.length && !isNaN(ys[j])) j++
    if (j - i < 3) for (let k = i; k < j; k++) ys[k] = NaN
    i = j
  }
  return ys
}

/** Nilai y pada posisi kolom pecahan p; interpolasi hanya antar kolom yang terdeteksi. */
export const sampleY = (trace, p, maxGap = 4) => {
  const f = p - trace.x0, i0 = Math.floor(f), i1 = Math.ceil(f), ys = trace.ys
  if (i0 < 0 || i1 >= ys.length) return NaN
  const a = ys[i0], c = ys[i1]
  if (!isNaN(a) && !isNaN(c)) return a + (c - a) * (f - i0)
  let l = i0, r = i1
  while (l >= 0 && isNaN(ys[l])) l--
  while (r < ys.length && isNaN(ys[r])) r++
  if (l < 0 || r >= ys.length || r - l > maxGap) return NaN
  return ys[l] + (ys[r] - ys[l]) * ((f - l) / (r - l))
}

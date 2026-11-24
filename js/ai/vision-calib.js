import { parseTimestamp } from '../data/parse.js'
import { findLines } from './vision-trace.js'
import { makeDateCtx } from './vision-date.js'

const KINDS = ['disp', 'vel', 'accel']
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null }

/** Respons AI -> objek kalibrasi yang bisa diedit. Tidak ada data titik di sini. */

const TOD = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/
const normTod = t => { const m = String(t).match(TOD); return m ? String(m[1]).padStart(2, '0') + ':' + m[2] + ':' + (m[3] || '00') : t }
const todSec = t => { const m = String(t).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : null }
const FULL = /^(\d{4})-(\d{1,2})-(\d{1,2})/
const ymd = ms => new Date(ms).toISOString().slice(0, 10)
const dayMs = s => { const m = s.match(FULL); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null }

/**
 * Tick X berisi jam saja (tanggal tengah tidak tercetak atau tertutup): tanggal diturunkan dari tick berlabel tanggal lengkap
 * (biasanya paling kiri dan kanan) dengan aturan "jam turun = hari berikutnya". Tanpa jangkar, tanggal diambil dari
 * waktu pertama rentang data bila ada; bila tidak, tanggal dibiarkan kosong dan pengguna mengisinya.
 */
export const resolveXDates = (ticks, rangeFirst) => {
  const warn = [], info = []
  const list = ticks.map(t => ({ ...t })).sort((a, b) => a.px - b.px)
  const withDate = t => FULL.test(t.text)
  let seed = list.findIndex(withDate)
  if (seed < 0) {
    const first = list.findIndex(t => todSec(t.text) !== null)
    if (first >= 0 && rangeFirst) {
      let day = Date.UTC(rangeFirst.getFullYear(), rangeFirst.getMonth(), rangeFirst.getDate())
      const rt = rangeFirst.getHours() * 3600 + rangeFirst.getMinutes() * 60 + rangeFirst.getSeconds()
      if (todSec(list[first].text) < rt - 1800) day += 86400000
      list[first].text = ymd(day) + ' ' + normTod(list[first].text)
      seed = first
      info.push('Tanggal tick X diambil dari waktu pertama rentang data.')
    } else {
      if (list.length) warn.push('Tanggal pada sumbu X tidak terbaca: isi tanggal pada tick X di tabel kalibrasi (jam sudah terbaca).')
      return { ticks: list, warn, info }
    }
  }
  const step = (i, dir, day) => {
    const a = todSec(list[i].text), b = todSec(list[i - dir].text)
    return a !== null && b !== null && (dir > 0 ? a < b : a > b) ? day + dir * 86400000 : day
  }
  let day = dayMs(list[seed].text), derived = 0, fixed = 0
  list[seed].text = ymd(day) + ' ' + normTod(list[seed].text.replace(/^\d{4}-\d{1,2}-\d{1,2}\s*/, ''))
  for (let i = seed + 1; i < list.length; i++) {
    if (withDate(list[i])) {
      const d = dayMs(list[i].text)
      const nd = step(i, 1, day)
      if (d < day || (d === day && nd > day)) { warn.push('Tanggal tick X ke-' + (i + 1) + ' (' + ymd(d) + ') berbeda dari urutan jam (' + ymd(nd) + '): periksa tanggal atau ada hari terlewat.'); fixed++ }
      day = d
      list[i].text = ymd(day) + ' ' + normTod(list[i].text.replace(FULL, '').trim())
    } else {
      day = step(i, 1, day)
      const tod = todSec(list[i].text)
      if (tod !== null) { list[i].text = ymd(day) + ' ' + normTod(list[i].text); derived++ }
    }
  }
  day = dayMs(list[seed].text)
  for (let i = seed - 1; i >= 0; i--) {
    day = step(i, -1, day)
    if (todSec(list[i].text) !== null && !withDate(list[i])) { list[i].text = ymd(day) + ' ' + normTod(list[i].text); derived++ }
  }
  if (derived) info.push('Tanggal ' + derived + ' tick X diturunkan dari urutan jam (label tengah tanpa tanggal atau tertutup).')
  return { ticks: list, warn, info }
}

export const normalizeCal = (obj, img) => {
  const p = obj.plot_area || {}
  const plot = {
    left: num(p.left) ?? 0, top: num(p.top) ?? 0,
    right: num(p.right) ?? img.width - 1, bottom: num(p.bottom) ?? img.height - 1
  }
  const x = obj.x_axis || {}
  const dctx = makeDateCtx(obj)
  const xRaw = (Array.isArray(x.ticks) ? x.ticks : []).map(t => {
    const time = dctx.fix(String(t.time || '').trim()), date = dctx.iso(String(t.date || '').trim())
    const full = /\d{4}-\d{1,2}-\d{1,2}/.test(time)
    return { px: num(t.px), text: full ? time : (/^\d{4}-\d{2}-\d{2}$/.test(date) && time ? date + ' ' + normTod(time) : time) }
  }).filter(t => t.px !== null)
  const yAxes = {}
  ;(Array.isArray(obj.y_axes) ? obj.y_axes : []).forEach(a => {
    const id = a.id === 'right' ? 'right' : 'left'
    yAxes[id] = { unit: String(a.unit || ''), ticks: (Array.isArray(a.ticks) ? a.ticks : []).map(t => ({ px: num(t.py), text: String(t.value ?? '') })).filter(t => t.px !== null) }
  })
  const series = (Array.isArray(obj.series) ? obj.series : [])
    .map(s => ({ name: String(s.name || ''), kind: KINDS.includes(s.kind) ? s.kind : null, color: String(s.color || ''), axis: s.axis === 'right' ? 'right' : 'left' }))
    .filter(s => s.kind)
  const r = obj.data_range || {}
  const t0 = parseTimestamp(dctx.fix(String(r.first_time || ''))), t1 = parseTimestamp(dctx.fix(String(r.last_time || ''))), cnt = Math.round(num(r.point_count) || 0)
  // Mode rentang: seluruh data terlihat (full_range), jumlah titik dan waktu pertama/terakhir terbaca -> waktu tiap titik dihitung merata.
  const range = r.full_range === true && t0 && t1 && t1 > t0 && cnt >= 20 && cnt <= 5000 ? { first: t0.getTime(), last: t1.getTime(), count: cnt } : null
  const { ticks: xTicks, warn: xWarn, info: xInfo } = resolveXDates(xRaw, range && t0)
  if (dctx.note) xWarn.push(dctx.note)
  return { plot, xTicks, xWarn, xInfo, yAxes, series, range, timeBasis: x.time_basis === 'label' && !dctx.noYear ? 'label' : 'assumed', readable: obj.readable !== false, reason: obj.reason || '' }
}

/** Buang garis bingkai: grid asli membentuk kisi dengan jarak teratur, bingkai tidak. */
const gridOnly = lines => {
  const pos = lines.map(l => l.pos).sort((a, b) => a - b)
  if (pos.length < 4) return pos
  const gaps = []
  for (let i = 1; i < pos.length; i++) gaps.push(pos[i] - pos[i - 1])
  const sp = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
  if (!(sp > 0)) return pos
  const score = p => pos.filter(q => {
    const k = Math.round(Math.abs(p - q) / sp)
    return k >= 1 && Math.abs(Math.abs(p - q) - k * sp) <= 1.5
  }).length
  const sc = pos.map(score), top = Math.max(...sc)
  return pos.filter((_, i) => sc[i] >= top * 0.5)
}

const snap = (ticks, lines, dim) => {
  const pos = gridOnly(lines)
  const gaps = []
  for (let i = 1; i < pos.length; i++) gaps.push(pos[i] - pos[i - 1])
  const spacing = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : Infinity
  const tol = Math.min(Math.max(5, dim * 0.03), spacing * 0.4)
  const used = new Set()
  return ticks.map(t => {
    let best = -1, bd = tol
    pos.forEach((p, i) => { const d = Math.abs(p - t.px); if (d <= bd && !used.has(i)) { bd = d; best = i } })
    if (best < 0) return { ...t, snapped: false, at: t.px }
    used.add(best)
    return { ...t, snapped: true, at: pos[best] }
  })
}

/** Regresi linear posisi -> nilai; satu tick pencilan (>4 px) dibuang bila tick >= 4. */
export const fitLine = pairs => {
  const run = list => {
    const n = list.length
    const mp = list.reduce((s, q) => s + q.p, 0) / n, mv = list.reduce((s, q) => s + q.v, 0) / n
    const sxx = list.reduce((s, q) => s + (q.p - mp) ** 2, 0)
    if (sxx === 0) return null
    const a = list.reduce((s, q) => s + (q.p - mp) * (q.v - mv), 0) / sxx, b = mv - a * mp
    const resid = list.map(q => Math.abs(a * q.p + b - q.v) / Math.abs(a || 1e-12))
    return { a, b, n, maxPx: Math.max(...resid), resid }
  }
  let fit = pairs.length >= 2 ? run(pairs) : null
  let dropped = 0
  if (fit && pairs.length >= 4 && fit.maxPx > 4) {
    const k = fit.resid.indexOf(fit.maxPx)
    const again = run(pairs.filter((_, i) => i !== k))
    if (again && again.maxPx < fit.maxPx / 2) { fit = again; dropped = 1 }
  }
  return fit && { ...fit, dropped }
}

const axisFit = (ticks, parse) => {
  const pairs = ticks.map(t => ({ p: t.at, v: parse(t.text) })).filter(q => q.v !== null && q.v !== undefined)
  return fitLine(pairs)
}

const timeMs = text => { const d = parseTimestamp(text); return d ? d.getTime() : null }

/** Snap tick ke garis grid terdekat, lalu fit kalibrasi X dan tiap sumbu Y. */
export const buildCalibration = (pixels, cal) => {
  const warnings = (cal.xWarn || []).slice(), info = (cal.xInfo || []).slice()
  const vLines = findLines(pixels, cal.plot, 'v'), hLines = findLines(pixels, cal.plot, 'h')
  const xt = snap(cal.xTicks, vLines, pixels.width)
  const fitX = axisFit(xt, timeMs)
  const ticksOut = xt.map(t => ({ axis: 'X', ...t }))
  const fitY = {}, yt = {}
  Object.keys(cal.yAxes).forEach(id => {
    const raw = cal.yAxes[id].ticks.map(t => ({ ...t, snapped: false, at: t.px }))
    const snappedT = snap(cal.yAxes[id].ticks, hLines, pixels.height)
    const fs = axisFit(snappedT, num), fr = axisFit(raw, num)
    // Sumbu yang skalanya berbeda dari grid (mis. sumbu kanan) tidak boleh ditempelkan ke garis grid sumbu lain.
    // Tick AI sering "terlalu rapi" (hasil interpolasi), sedangkan garis grid terukur per piksel: bila grid konsisten (<= 2 px)
    // dan tick AI hanya meleset beberapa piksel dari grid, grid dipakai sebagai posisi sebenarnya.
    const shifts = snappedT.filter(t => t.snapped).map((t, i) => Math.abs(t.at - t.px))
    const meanShift = shifts.length ? shifts.reduce((a, b) => a + b, 0) / shifts.length : Infinity
    const useSnap = fs && snappedT.some(t => t.snapped) && fs.maxPx <= 2 && (meanShift <= 4 || !fr || fs.maxPx <= fr.maxPx + 0.5 || raw.length < 3)
    yt[id] = useSnap ? snappedT : raw
    fitY[id] = useSnap ? fs : fr
    yt[id].forEach(t => ticksOut.push({ axis: id === 'left' ? 'Y-left' : 'Y-right', ...t }))
  })
  if (cal.range) info.push('Waktu tiap titik dihitung dari waktu pertama dan terakhir data serta jumlah titik (' + cal.range.count + ').')
  if (!cal.range && (!fitX || fitX.n < 2)) warnings.push('Tick sumbu X kurang dari 2 atau tidak valid: waktu tidak bisa dihitung.')
  else if (fitX && fitX.n >= 2 && !cal.range) {
    if (fitX.a <= 0) warnings.push('Waktu tidak naik ke kanan menurut tick: periksa nilai tick X.')
    if (fitX.n >= 3 && fitX.maxPx > 3) warnings.push('Tick sumbu X tidak linear (selisih ' + fitX.maxPx.toFixed(1) + ' px): kemungkinan ada label waktu yang salah baca.')
    if (!xt.some(t => t.snapped)) warnings.push('Tick X tidak menempel pada garis grid: posisi waktu hanya perkiraan AI (±beberapa piksel).')
    if (fitX.dropped) info.push('Satu tick X pencilan diabaikan.')
  }
  Object.keys(fitY).forEach(id => {
    const f = fitY[id]
    if (!f) return warnings.push('Tick sumbu Y ' + id + ' kurang dari 2 atau tidak valid.')
    if (f.n >= 3 && f.maxPx > 3) warnings.push('Tick sumbu Y ' + id + ' tidak linear (selisih ' + f.maxPx.toFixed(1) + ' px).')
    if (!yt[id].some(t => t.snapped)) {
      // Garis grid umumnya milik sumbu kiri: sumbu lain yang tidak menempel, atau chart tanpa grid, bukan peringatan.
      const otherSnapped = Object.keys(yt).some(o => o !== id && yt[o].some(t => t.snapped))
      if (gridOnly(hLines).length >= 3 && !otherSnapped) warnings.push('Tick Y ' + id + ' tidak menempel pada garis grid: nilai hanya perkiraan AI.')
      else info.push('Sumbu Y ' + id + ' tidak memakai garis grid: posisi tick dari pembacaan AI.')
    }
    info.push('Resolusi vertikal sumbu ' + id + ': ±' + Math.abs(f.a).toPrecision(2) + ' satuan per piksel')
  })
  if (cal.timeBasis === 'assumed' && !cal.range) warnings.push('Tanggal/tahun pada sumbu X diasumsikan (tidak tercetak jelas): pastikan nilai tick waktu benar.')
  return { fitX, fitY, ticks: ticksOut, warnings, info }
}

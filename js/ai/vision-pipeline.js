import { refineColor, traceColumns, sampleY } from './vision-trace.js'
import { buildCalibration } from './vision-calib.js'
import { classifyTrend } from './vision-trend.js'
import { diagnoseVel, intervalWarn, spanInfo } from './vision-verify.js'

const pad = n => String(n).padStart(2, '0')
const fmtTime = ms => {
  const d = new Date(Math.round(ms / 1000) * 1000)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}
const round = (v, d) => (v === null || !isFinite(v) ? null : +v.toFixed(d))

/** Kemiringan regresi lokal (jendela jam) — meredam kuantisasi piksel saat menurunkan vel/accel. */
const slopes = (tH, vals, windowH) => {
  const ok = tH.filter((_, i) => vals[i] !== null)
  if (ok.length < 4) return tH.map(() => null)
  const tMin = ok[0], tMax = ok[ok.length - 1]
  return tH.map((t, i) => {
    if (vals[i] === null) return null
    // jendela selebar windowH; di tepi data digeser ke dalam (bukan dipersempit) agar tidak bising
    const lo = Math.max(tMin, Math.min(t - windowH / 2, tMax - windowH)), hi = lo + windowH
    let n = 0, st = 0, sv = 0, stt = 0, stv = 0
    for (let j = 0; j < tH.length; j++) {
      if (vals[j] === null || tH[j] < lo || tH[j] > hi) continue
      n++; st += tH[j]; sv += vals[j]; stt += tH[j] * tH[j]; stv += tH[j] * vals[j]
    }
    const den = n * stt - st * st
    return n >= 4 && den > 0 ? (n * stv - st * sv) / den : null
  })
}

/** Isi nilai null di dalam rentang dengan interpolasi linear (indeks); tepi tidak diekstrapolasi. */
const fillGaps = vals => {
  const filled = vals.map(() => false)
  let i = 0
  while (i < vals.length) {
    if (vals[i] !== null) { i++; continue }
    let j = i
    while (j < vals.length && vals[j] === null) j++
    if (i > 0 && j < vals.length) {
      for (let k = i; k < j; k++) { vals[k] = vals[i - 1] + (vals[j] - vals[i - 1]) * ((k - (i - 1)) / (j - (i - 1))); filled[k] = true }
    }
    i = j
  }
  return filled
}

const mapSeries = (pixels, cal, calib) => {
  const out = [], warnings = []
  cal.series.forEach(s => {
    const fit = calib.fitY[s.axis]
    if (!fit) return warnings.push('Seri ' + (s.name || s.kind) + ' dilewati: sumbu Y ' + s.axis + ' belum terkalibrasi.')
    const color = refineColor(pixels, cal.plot, s.color, s.kind)
    if (!color) return warnings.push('Warna seri ' + (s.name || s.kind) + ' tidak ditemukan di area plot.')
    const trace = traceColumns(pixels, cal.plot, color)
    const found = trace.ys.filter(v => !isNaN(v)).length
    if (found < trace.ys.length * 0.4) warnings.push('Seri ' + (s.name || s.kind) + ': kurva hanya terdeteksi di ' + Math.round(found / trace.ys.length * 100) + '% lebar plot.')
    out.push({ ...s, fit, color, trace })
  })
  return { series: out, warnings }
}

/** Seluruh proses lokal: kalibrasi -> lacak kurva -> baris waktu/disp/vel/accel. */
export const traceAll = (pixels, cal, velWindowH = 1) => {
  const calib = buildCalibration(pixels, cal)
  const { series, warnings } = mapSeries(pixels, cal, calib)
  const w = calib.warnings.concat(warnings), info = calib.info.slice()
  if (!calib.fitX && !cal.range) throw new Error(w[0] || 'Kalibrasi sumbu waktu gagal.')
  const primary = series.find(s => s.kind === 'disp') || series[0]
  if (!primary) throw new Error('Tidak ada seri yang bisa dilacak. ' + (w[0] || ''))
  const valid = []
  primary.trace.ys.forEach((v, i) => { if (!isNaN(v)) valid.push(primary.trace.x0 + i) })
  if (valid.length < 10) throw new Error('Kurva tidak terdeteksi pada warna seri. Periksa warna/legenda gambar.')
  const pStart = valid[0], pEnd = valid[valid.length - 1]
  const n = cal.range ? cal.range.count : Math.max(40, Math.min(300, Math.round((pEnd - pStart) / 3)))
  const times = [], cols = { disp: [], vel: [], accel: [] }
  for (let k = 0; k < n; k++) {
    const p = pStart + (pEnd - pStart) * k / (n - 1)
    times.push(cal.range ? cal.range.first + (cal.range.last - cal.range.first) * k / (n - 1) : calib.fitX.a * p + calib.fitX.b)
    ;['disp', 'vel', 'accel'].forEach(kind => {
      const s = series.find(q => q.kind === kind)
      const y = s ? sampleY(s.trace, p) : NaN
      cols[kind].push(isNaN(y) ? null : s.fit.a * y + s.fit.b)
    })
  }
  const nulls = cols.disp.filter(v => v === null).length
  const flags = fillGaps(cols.disp)
  if (cols.vel.some(v => v !== null)) fillGaps(cols.vel)
  const tH = times.map(t => (t - times[0]) / 3600000)
  info.push(spanInfo(times))
  const iw = intervalWarn(times)
  if (iw) w.push(iw)
  const nFilled = flags.filter(Boolean).length
  if (nFilled) {
    let longest = 0, run = 0
    flags.forEach(f => { run = f ? run + 1 : 0; if (run > longest) longest = run })
    const longMin = Math.round(longest * (times[times.length - 1] - times[0]) / (times.length - 1) / 60000)
    const pct = Math.round(nFilled / n * 100)
    const msg = nFilled + ' dari ' + n + ' titik (' + pct + '%) diisi interpolasi karena kurva tak terdeteksi; celah terpanjang ' + longMin + ' menit.'
    if (pct > 5 || longest > n * 0.05) w.push(msg + ' Periksa overlay.')
    else info.push(msg)
  }
  const derived = []
  if (cols.disp.some(v => v !== null) && cols.vel.some(v => v !== null)) {
    const ref = slopes(tH, cols.disp, velWindowH), errs = []
    cols.vel.forEach((v, i) => { if (v !== null && ref[i] !== null) errs.push(Math.abs(v - ref[i]) / Math.max(Math.abs(v), 0.5)) })
    if (errs.length >= 10) {
      const med = errs.sort((a, b) => a - b)[Math.floor(errs.length / 2)]
      const msg = 'Velocity dari kurva vs turunan displacement: selisih median ' + Math.round(med * 100) + '%'
      if (med > 0.35) w.push(msg + diagnoseVel(cols.vel, ref))
      else info.push(msg + ' (konsisten).')
    }
  }
  if (cols.disp.some(v => v !== null) && !cols.vel.some(v => v !== null)) { cols.vel = slopes(tH, cols.disp, velWindowH); derived.push('vel') }
  if (cols.vel.some(v => v !== null) && !cols.accel.some(v => v !== null)) { cols.accel = slopes(tH, cols.vel, velWindowH * 2); derived.push('accel') }
  if (derived.length) info.push(derived.join(' dan ') + ' diturunkan dari kurva yang terbaca (regresi lokal ' + velWindowH + ' jam untuk vel, ' + velWindowH * 2 + ' jam untuk accel).')
  const rows = times.map((t, i) => ({ time: fmtTime(t), disp: round(cols.disp[i], 3), vel: round(cols.vel[i], 3), accel: round(cols.accel[i], 4), filled: flags[i] }))
  const velRef = slopes(tH, cols.disp, velWindowH)
  const trend = classifyTrend(tH, cols.disp, velRef)
  if (trend) info.push('Indikasi kondisi: ' + trend.label + ' — ' + trend.reason + ' (indikatif, bukan keputusan operasional).')
  info.push(rows.length + ' titik diambil dari piksel kurva, bukan ditebak AI.')
  return { rows, warnings: w, info, calib, series, trend, filledCount: nFilled }
}

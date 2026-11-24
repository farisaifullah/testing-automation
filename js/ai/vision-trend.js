// Indikasi kondisi pergerakan dari kurva displacement hasil ekstraksi (indikatif, bukan keputusan operasional).
// Ambang dikumpulkan di TREND agar mudah disetel ulang setelah ada lebih banyak contoh berlabel.
export const TREND = {
  STEADY_V: 0.05,       // mm/h: di bawah ini dianggap tidak bergerak
  LINEAR_R2: 0.985,     // R2 regresi linear displacement pada fase aktif
  REGR_RATIO: 0.6,      // v akhir / v puncak di bawah ini = regressive
  PEAK_END_FRAC: 0.9,   // puncak kecepatan setelah porsi waktu ini = masih naik di ujung
  SMOOTH_H: 2           // jam, penghalusan kecepatan sebelum mencari puncak
}

const lsq = (xs, ys) => {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n
  let sxx = 0, sxy = 0, syy = 0
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2 }
  if (sxx === 0) return null
  return { slope: sxy / sxx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) }
}

const smooth = (t, v, w) => t.map((ti, i) => {
  let s = 0, n = 0
  for (let j = 0; j < t.length; j++) if (Math.abs(t[j] - ti) <= w / 2 && v[j] !== null) { s += v[j]; n++ }
  return n ? s / n : null
})

/** rows: [{ time:'YYYY-MM-DD HH:MM:SS', disp }]; vel: kecepatan (mm/h) yang diturunkan dari disp. */
export const classifyTrend = (tH, disp, vel) => {
  const n = tH.length
  if (n < 30) return null
  const T = tH[n - 1] - tH[0]
  const vs = smooth(tH, vel, TREND.SMOOTH_H)
  let peak = -Infinity, iPeak = 0
  vs.forEach((v, i) => { if (v !== null && v > peak) { peak = v; iPeak = i } })
  const tail = vs.filter((v, i) => v !== null && tH[i] >= tH[n - 1] - T * 0.1)
  const vEnd = tail.length ? tail.reduce((s, v) => s + v, 0) / tail.length : null
  const peakFrac = (tH[iPeak] - tH[0]) / T
  // fase aktif: sejak kecepatan melewati 25% puncak dan bertahan minimal 10% rentang waktu (lonjakan awal singkat diabaikan)
  let iOn = 0
  for (let i = 0; i < n; i++) {
    if (vs[i] === null || vs[i] < 0.25 * peak) continue
    let j = i
    while (j < n && vs[j] !== null && vs[j] >= 0.25 * peak) j++
    if (tH[Math.min(j, n - 1)] - tH[i] >= 0.1 * T) { iOn = i; break }
    i = j
  }
  const act = lsq(tH.slice(iOn), disp.slice(iOn))
  const metrics = { vPeak: peak, vEnd, peakFrac, r2: act ? act.r2 : null }
  if (peak < TREND.STEADY_V) return { label: 'steady', reason: 'Kecepatan di bawah ' + TREND.STEADY_V + ' mm/h sepanjang data.', metrics }
  if (act && act.r2 >= TREND.LINEAR_R2 && peakFrac < TREND.PEAK_END_FRAC) return { label: 'linear', reason: 'Displacement mendekati garis lurus pada fase aktif (R² ' + act.r2.toFixed(3) + ').', metrics }
  if (vEnd !== null && vEnd < TREND.REGR_RATIO * peak && peakFrac < TREND.PEAK_END_FRAC) return { label: 'regressive', reason: 'Kecepatan memuncak ' + peak.toFixed(2) + ' mm/h pada ' + Math.round(peakFrac * 100) + '% rentang waktu lalu turun ke ' + vEnd.toFixed(2) + ' mm/h di ujung.', metrics }
  return { label: 'progressive', reason: 'Kecepatan masih naik atau dekat puncak (' + (vEnd === null ? '-' : vEnd.toFixed(2)) + ' dari puncak ' + peak.toFixed(2) + ' mm/h) di ujung data.', metrics }
}

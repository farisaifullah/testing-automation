// Pemeriksaan konsistensi lokal (tanpa API) atas hasil pelacakan. Tujuannya: kesalahan tanda, skala, atau waktu tidak lolos diam-diam.
const pearson = (a, b) => {
  const n = a.length
  if (n < 10) return null
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null
}
const median = arr => { const s = arr.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)] }

/** Velocity dari kurva vs turunan displacement: bila tidak cocok, jelaskan jenis ketidakcocokannya (tanda, skala, atau pemetaan). */
export const diagnoseVel = (vel, ref) => {
  const a = [], b = []
  vel.forEach((v, i) => { if (v !== null && ref[i] !== null) { a.push(v); b.push(ref[i]) } })
  const r = pearson(a, b)
  const big = Math.max(...b.map(Math.abs), 1e-9)
  const ratios = a.map((v, i) => (Math.abs(b[i]) > big * 0.1 ? v / b[i] : null)).filter(v => v !== null)
  const ratio = ratios.length >= 5 ? median(ratios) : null
  if (r !== null && r < -0.5) return ' — arah terbalik: velocity kurva berlawanan dengan turunan displacement (r=' + r.toFixed(2) + '); periksa tanda tick sumbu displacement dan velocity.'
  if (r !== null && r >= 0.5 && ratio !== null && (ratio > 1.5 || ratio < 0.65)) return ' — arah cocok (r=' + r.toFixed(2) + ') tetapi skala berbeda ' + ratio.toFixed(1) + '×: periksa skala sumbu velocity atau jarak waktu antar titik.'
  return ' — periksa kalibrasi sumbu waktu/kanan atau pemetaan seri.'
}

/** Jarak waktu antar titik yang tidak lazim untuk data radar lereng (< 20 detik) biasanya tanda label waktu salah baca. */
export const intervalWarn = times => {
  if (times.length < 2) return ''
  const sec = (times[times.length - 1] - times[0]) / (times.length - 1) / 1000
  return sec < 20 ? 'Jarak waktu antar titik hanya ' + sec.toFixed(1) + ' detik: tidak lazim untuk data radar lereng, kemungkinan label waktu salah baca. Periksa waktu awal dan akhir pada tabel kalibrasi.' : ''
}

const fmt = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) }

/** Ringkasan rentang waktu hasil, supaya pengguna bisa mencocokkannya dengan label chart sekilas. */
export const spanInfo = times => {
  if (times.length < 2) return ''
  const t0 = times[0], t1 = times[times.length - 1], hours = (t1 - t0) / 3600000, step = (t1 - t0) / (times.length - 1) / 60000
  return 'Rentang waktu hasil: ' + fmt(t0) + ' sampai ' + fmt(t1) + ' (' + hours.toFixed(1) + ' jam, sekitar ' + step.toFixed(1) + ' menit per titik).'
}

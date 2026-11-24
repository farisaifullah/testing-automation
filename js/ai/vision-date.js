// Tanggal pada label sumbu X dibaca AI persis seperti tercetak; konversi ke YYYY-MM-DD dilakukan di sini (deterministik, tanpa API).
// Urutan bulan/hari disimpulkan dari semua label chart (angka > 12 menentukan); tahun yang tidak tercetak diasumsikan dan DITANDAI.
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 }
const TOD = /(\d{1,2}:\d{2}(?::\d{2})?)\s*$/
const pad = n => String(n).padStart(2, '0')

const parseRaw = raw => {
  const t = String(raw || '').trim().replace(/,/g, ' ').replace(/\s+/g, ' ')
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return { y: +m[1], m: +m[2], d: +m[3] }
  m = t.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})(?:[-/. ](\d{2,4}))?$/)
  if (m && MON[m[2].slice(0, 3).toLowerCase()]) return { y: m[3] ? yr(m[3]) : null, m: MON[m[2].slice(0, 3).toLowerCase()], d: +m[1] }
  m = t.match(/^([A-Za-z]{3,9})[-/. ](\d{1,2})(?:[-/. ](\d{2,4}))?$/)
  if (m && MON[m[1].slice(0, 3).toLowerCase()]) return { y: m[3] ? yr(m[3]) : null, m: MON[m[1].slice(0, 3).toLowerCase()], d: +m[2] }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (m) return { y: yr(m[3]), pair: [+m[1], +m[2]] }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/)
  if (m) return { y: null, pair: [+m[1], +m[2]], short: true }
  return null
}
const yr = s => (s.length === 2 ? 2000 + +s : +s)

/** Pisahkan "TANGGAL JAM" menjadi { date, tod }; hanya jam -> date kosong. */
const splitDateTime = str => {
  const s = String(str || '').trim()
  const m = s.match(TOD)
  if (!m) return { date: s, tod: '' }
  return { date: s.slice(0, m.index).trim().replace(/[T]$/, '').trim(), tod: m[1] }
}

export const makeDateCtx = (obj, now = new Date()) => {
  const x = (obj && obj.x_axis) || {}, r = (obj && obj.data_range) || {}
  const raws = []
  ;(Array.isArray(x.ticks) ? x.ticks : []).forEach(t => {
    if (t && t.date) raws.push(String(t.date))
    if (t && t.time) { const sp = splitDateTime(t.time); if (sp.date) raws.push(sp.date) }
  })
  ;[r.first_time, r.last_time].forEach(v => { if (v) { const sp = splitDateTime(v); if (sp.date) raws.push(sp.date) } })
  const parsed = raws.map(parseRaw).filter(Boolean)
  const pairs = parsed.filter(p => p.pair)
  const hasDM = pairs.some(p => p.pair[0] > 12), hasMD = pairs.some(p => p.pair[1] > 12)
  // Bukti urutan: angka pertama > 12 = hari-bulan; angka kedua > 12 = bulan-hari. Tanpa bukti: bulan-hari bila tanpa tahun (gaya dashboard ini), selain itu hari-bulan.
  const order = hasDM && !hasMD ? 'dm' : hasMD && !hasDM ? 'md' : (pairs.some(p => p.short) ? 'md' : 'dm')
  const ambiguous = pairs.length > 0 && !hasDM && !hasMD
  const today = now.getTime()
  let noYear = false, assumedYear = null, sample = ''
  const resolve = raw => {
    const p = parseRaw(raw)
    if (!p) return ''
    let y = p.y, mo = p.m, d = p.d
    if (p.pair) { mo = order === 'md' ? p.pair[0] : p.pair[1]; d = order === 'md' ? p.pair[1] : p.pair[0] }
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return ''
    if (y === null) {
      noYear = true
      y = now.getFullYear()
      if (Date.UTC(y, mo - 1, d) > today + 2 * 86400000) y -= 1
      assumedYear = y
      if (!sample) sample = String(raw).trim()
    }
    return y + '-' + pad(mo) + '-' + pad(d)
  }
  const iso = raw => resolve(raw)
  /** "11-16 14:23" -> "2026-11-16 14:23"; hanya jam atau teks lain dibiarkan. */
  const fix = str => {
    const sp = splitDateTime(str)
    if (!sp.tod) return String(str || '').trim()
    if (!sp.date) return sp.tod
    const d = resolve(sp.date)
    return d ? d + ' ' + sp.tod : String(str || '').trim()
  }
  // Panggil resolve sekali untuk semua label agar noYear/assumedYear/sample terisi sebelum note dibaca.
  raws.forEach(resolve)
  const note = noYear
    ? 'Tanggal pada chart ("' + sample + '") tidak mencantumkan tahun: dianggap tahun ' + assumedYear + (ambiguous ? ' dan urutannya dibaca ' + (order === 'md' ? 'bulan-hari' : 'hari-bulan') + ' (tidak ada angka > 12 sebagai bukti)' : '') + '. Periksa tanggal pada tabel kalibrasi dan koreksi bila berbeda.'
    : (ambiguous ? 'Urutan tanggal pada chart ambigu: dibaca ' + (order === 'md' ? 'bulan-hari' : 'hari-bulan') + '. Periksa tanggal pada tabel kalibrasi.' : '')
  return { iso, fix, noYear, ambiguous, order, note }
}

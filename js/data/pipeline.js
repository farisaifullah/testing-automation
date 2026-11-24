import { CONFIG } from '../core/config.js'
import { isTimeValue } from './parse.js'
import { detectAllColumns, mappingSummary } from './columns.js'
import { buildDataFromRows } from './build.js'
import { medianArr } from '../core/math.js'
import { loadIntoDashboard } from '../dashboard/dashboard.js'

const resplitSingleColumn = rows => {
  if (rows.length <= 1 || rows[0].length !== 1) return rows
  const first = String(rows[0][0])
  if (!/[,;\t\uFF0C]/.test(first)) return rows
  const text = rows.map(r => String(r[0]).replace(/\uFF0C/g, ',')).join('\n')
  const reparsed = Papa.parse(text, { skipEmptyLines: true })
  return reparsed.data && reparsed.data.length && reparsed.data[0].length > 1 ? reparsed.data : rows
}

const rescueSerialPairs = grid => {
  const pairRe = /^(\d{4,5}\.\d+)\s*;\s*([+-]?\d+(?:\.\d+)?)\s*$/
  const rows = []
  for (const row of grid) {
    const c0 = String(row[0] || '').trim()
    const m = c0.match(pairRe)
    if (m) { rows.push([m[1], m[2]]); continue }
    if (/^\d{4,5}\.\d+$/.test(c0)) {
      const c1 = String(row[1] === undefined || row[1] === null ? '' : row[1]).trim()
      if (/^[+-]?\d+(?:\.\d+)?$/.test(c1)) rows.push([c0, c1])
    }
  }
  return rows
}

export const ingestRows = (rawRows, fileName) => {
  const grid = resplitSingleColumn(rawRows)
  const headerRow = grid[0].map(v => (v === null ? '' : v))
  const det = detectAllColumns(headerRow, grid.slice(1))
  const colMap = det.map
  let bodyStart = 1
  if (det.timeFromContent && isTimeValue(grid[0][colMap.time])) bodyStart = 0
  if (colMap.time === undefined) return { ok: false, message: 'Kolom waktu tidak ditemukan.' }

  let result = buildDataFromRows(grid.slice(bodyStart), colMap)
  let serialRescue = false
  if (result.points.length === 0) {
    const rescued = rescueSerialPairs(grid)
    if (rescued.length >= CONFIG.MIN_POINTS) {
      const res2 = buildDataFromRows(rescued, { time: 0, disp: 1 })
      if (res2.points.length >= CONFIG.MIN_POINTS) { result = res2; serialRescue = true }
    }
  }
  if (result.points.length === 0 && result.skipped > 0) return { ok: false, message: 'Format waktu tidak terbaca.' }
  if (result.points.length < CONFIG.MIN_POINTS)
    return { ok: false, message: 'Minimal ' + CONFIG.MIN_POINTS + ' titik, didapat ' + result.points.length + '.' }

  const ints = []
  for (let i = 1; i < result.points.length; i++)
    ints.push((result.points[i].time.getTime() - result.points[i - 1].time.getTime()) / 60000)
  const medInt = ints.length ? medianArr(ints) : 0
  if (!det.headerKinematic && medInt > 360)
    return { ok: false, message: 'Interval data terlalu jarang untuk data radar lereng (median ' + fmtMin(medInt) + ').' }

  const summary = mappingSummary(
    serialRescue ? ['Time', 'Disp'] : headerRow,
    serialRescue ? { time: 0, disp: 1 } : colMap,
    serialRescue ? ['disp'] : det.assumed
  )
  loadIntoDashboard(result.points, fileName)
  return {
    ok: true,
    message: result.points.length + ' titik dimuat dari ' + fileName +
      (result.skipped > 0 ? ' (' + result.skipped + ' baris dilewati)' : '') +
      ' · ' + summary
  }
}

function fmtMin (m) {
  return m >= 60 ? (m / 60).toFixed(1) + ' jam' : Math.round(m) + ' mnt'
}

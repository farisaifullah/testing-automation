import { CONFIG } from '../core/config.js'
import { parseTimestamp } from '../data/parse.js'
import { medianArr } from '../core/math.js'
import { fmtNum } from '../core/format.js'
import { rowsToPoints } from './vision-data.js'

const TOLERANCE = { disp: 0.05, vel: 0.1 }
const MAX_INTERVAL_MIN = 360
const MAX_MEDIAN_VEL = 500

const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length
const relDiff = (m, ref) => Math.abs(m - ref) / Math.max(Math.abs(ref), 1e-9)

const timeIssues = rows => {
  const issues = []
  const times = rows.map(r => parseTimestamp(r.time))
  const bad = times.filter(t => !t).length
  if (bad) issues.push(bad + ' baris timestamp tidak terbaca')
  for (let i = 1; i < times.length; i++) {
    if (times[i] && times[i - 1] && times[i] <= times[i - 1]) {
      issues.push('Urutan waktu tidak naik di baris ' + (i + 1))
      break
    }
  }
  return issues
}

const statLine = (pts, key, label, avgFromImage, tolerance, issues) => {
  const values = pts.filter(p => p[key] !== null).map(p => p[key])
  if (avgFromImage == null || !values.length) return null
  const m = mean(values), rel = relDiff(m, avgFromImage)
  // bar statistik dashboard berupa selisih dari titik awal pada seluruh rentang: bukan dasar peringatan
  return 'Rata-rata ' + (key === 'disp' ? 'disp' : 'vel') + ': ' + fmtNum(m, 3) + ' vs gambar ' + fmtNum(avgFromImage, 3) + ' (selisih ' + (rel * 100).toFixed(1) + '%, hanya informasi)'
}

const plausibilityIssues = pts => {
  const issues = []
  const gaps = []
  for (let i = 1; i < pts.length; i++) gaps.push((pts[i].time.getTime() - pts[i - 1].time.getTime()) / 60000)
  if (gaps.length && medianArr(gaps) > MAX_INTERVAL_MIN) issues.push('Interval antar titik > 6 jam: tidak khas data radar lereng')
  const speeds = pts.filter(p => p.vel !== null).map(p => Math.abs(p.vel))
  if (speeds.length && medianArr(speeds) > MAX_MEDIAN_VEL) issues.push('Skala velocity tidak wajar untuk radar lereng (median |vel| > 500 mm/h)')
  return issues
}

/** Hasil: { issues: string[], info: string[] } — dirender oleh vision.js. */
export const checkVisionData = (rows, stats) => {
  const issues = timeIssues(rows)
  const pts = rowsToPoints(rows)
  if (pts.length < CONFIG.MIN_POINTS) issues.push('Titik valid kurang dari ' + CONFIG.MIN_POINTS)
  const info = ['✓ ' + pts.length + ' titik valid dari ' + rows.length + ' baris']
  const st = stats || {}
  ;[statLine(pts, 'disp', 'displacement', st.disp_avg, TOLERANCE.disp, issues), statLine(pts, 'vel', 'velocity', st.vel_avg, TOLERANCE.vel, issues)].forEach(l => { if (l) info.push(l) })
  return { issues: issues.concat(plausibilityIssues(pts)), info }
}

import { CONFIG } from '../core/config.js'
import { studentTQuantile } from '../core/math.js'
import { selectWindowPts } from './common.js'

export const computeFukuzono = (data, windowMin, minR2, startTime) => {
  const latestTime = data[data.length - 1].time
  const pts = selectWindowPts(data, windowMin)
  const res = { valid: false, points: pts.length, reason: 'INSUFFICIENT' }
  if (pts.length < CONFIG.MIN_POINTS) return res
  const x0 = pts[0].time.getTime(), xs = [], ys = []
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (let i = 0; i < pts.length; i++) {
    const x = (pts[i].time.getTime() - x0) / 3600000, y = pts[i].inv
    xs.push(x); ys.push(y)
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x
  }
  const n = pts.length, Sxx = sumXX - (sumX * sumX) / n
  if (Sxx <= 0) { res.reason = 'DEGENERATE'; return res }
  const slope = (sumXY - (sumX * sumY) / n) / Sxx, intercept = (sumY - slope * sumX) / n
  let SSres = 0, SStot = 0
  const meanY = sumY / n
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept
    SSres += (ys[i] - pred) * (ys[i] - pred)
    SStot += (ys[i] - meanY) * (ys[i] - meanY)
  }
  const r2 = SStot > 0 ? 1 - SSres / SStot : 0
  Object.assign(res, { slope, intercept, r2, x0, xs, ys })
  if (slope >= 0) { res.reason = 'NO ACCEL'; return res }
  if (r2 < minR2) { res.reason = 'LOW FIT'; return res }
  const tofHours = -intercept / slope
  if (!isFinite(tofHours) || tofHours <= 0) { res.reason = 'STABLE'; return res }
  const failTime = new Date(x0 + tofHours * 3600000)
  if (failTime <= latestTime) { res.reason = 'PAST'; return res }
  const s2 = SSres / (n - 2), varSlope = s2 / Sxx, meanX = sumX / n
  const varIntercept = s2 * (1 / n + (meanX * meanX) / Sxx), covIntSlope = (-s2 * meanX) / Sxx
  const varTf = varIntercept / (slope * slope) +
    (intercept * intercept * varSlope) / Math.pow(slope, 4) -
    (2 * intercept * covIntSlope) / Math.pow(slope, 3)
  const seTf = varTf > 0 && isFinite(varTf) ? Math.sqrt(varTf) : null
  const nu = n - 2, tCrit = nu > 0 ? studentTQuantile(0.975, nu) : null
  if (seTf !== null && tCrit !== null) {
    const base = (x0 - startTime) / 3600000
    res.ciLowHours = base + tofHours - tCrit * seTf
    res.ciHighHours = base + tofHours + tCrit * seTf
    res.ciLowTime = new Date(startTime + res.ciLowHours * 3600000)
    res.ciHighTime = new Date(startTime + res.ciHighHours * 3600000)
  }
  res.valid = true
  res.reason = 'ACTIVE'
  res.tofHours = tofHours
  res.failTime = failTime
  res.seTf = seTf
  return res
}

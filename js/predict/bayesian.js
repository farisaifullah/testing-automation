import { CONFIG } from '../core/config.js'
import { studentTQuantile } from '../core/math.js'
import { selectWindowPts } from './common.js'

export const computeBayesian = (data, windowMin, minR2, startTime) => {
  const latestTime = data[data.length - 1].time
  const pts = selectWindowPts(data, windowMin)
  const res = { valid: false, points: pts.length, reason: 'INSUFFICIENT' }
  if (pts.length < CONFIG.MIN_POINTS) return res
  let sR = 0, sy = 0, sRy = 0, sRR = 0
  const Rs = [], ys = [], Rts = []
  for (let i = 0; i < pts.length; i++) {
    const R = pts[i].inv, y = (pts[i].time.getTime() - startTime) / 3600000
    Rs.push(R); ys.push(y); Rts.push(pts[i].time.getTime())
    sR += R; sy += y; sRy += R * y; sRR += R * R
  }
  const n = pts.length, denominator = n * sRR - sR * sR
  if (denominator <= 0 || !isFinite(denominator)) { res.reason = 'DEGENERATE'; return res }
  const beta1 = (n * sRy - sR * sy) / denominator, beta0 = (sy - beta1 * sR) / n, B = -beta1
  let SSres = 0, SStot = 0
  const meanY = sy / n
  for (let i = 0; i < n; i++) {
    const pred = beta0 + beta1 * Rs[i]
    SSres += (ys[i] - pred) * (ys[i] - pred)
    SStot += (ys[i] - meanY) * (ys[i] - meanY)
  }
  const r2 = SStot > 0 ? 1 - SSres / SStot : 0
  Object.assign(res, { beta0, beta1, B, r2, Rs, ys, Rts })
  if (B <= 0) { res.reason = 'NO ACCEL'; return res }
  if (r2 < minR2) { res.reason = 'LOW FIT'; return res }
  const lastHours = (latestTime.getTime() - startTime) / 3600000
  if (beta0 <= lastHours) { res.reason = 'PAST'; return res }
  const nu = n - 2, s2 = SSres / nu, varTf = s2 * (sRR / denominator)
  const seTf = varTf > 0 && isFinite(varTf) ? Math.sqrt(varTf) : null
  const tCrit = nu > 0 ? studentTQuantile(0.975, nu) : null
  let ciLowHours = null, ciHighHours = null
  if (seTf !== null && tCrit !== null) {
    ciLowHours = beta0 - tCrit * seTf
    ciHighHours = beta0 + tCrit * seTf
  }
  res.valid = true
  res.reason = 'ACTIVE'
  res.tfHours = beta0
  res.failTime = new Date(startTime + beta0 * 3600000)
  res.seTf = seTf
  res.nu = nu
  res.tCrit = tCrit
  res.ciLowHours = ciLowHours
  res.ciHighHours = ciHighHours
  res.ciLowTime = ciLowHours !== null ? new Date(startTime + ciLowHours * 3600000) : null
  res.ciHighTime = ciHighHours !== null ? new Date(startTime + ciHighHours * 3600000) : null
  res.s2 = s2
  res.rbar = sR / n
  res.SxxR = denominator / n
  return res
}

import { CONFIG } from '../core/config.js'
import { parseTimestamp } from '../data/parse.js'
import { clampInv } from '../data/build.js'
import { DOMAIN_KEYWORDS } from './vision-prompt.js'

export const toNum = v => {
  if (v === null || v === undefined || v === '') return null
  const n = +v
  return isNaN(n) || !isFinite(n) ? null : n
}

export const domainOkBySeries = found => {
  if (!Array.isArray(found) || !found.length) return true
  const names = found.map(s => String(s).toLowerCase())
  return names.some(n => DOMAIN_KEYWORDS.some(k => n.includes(k)))
}

export const parseVisionJson = text => {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch (err) { return null }
}

const hoursBetween = (a, b) => (a.time.getTime() - b.time.getTime()) / 3600000
const invOf = vel => (vel !== null && Math.abs(vel) >= CONFIG.VEL_FLOOR ? clampInv(1 / Math.abs(vel)) : null)

const fillVelocity = pts => {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].vel !== null || pts[i].disp === null || pts[i - 1].disp === null) continue
    const dt = hoursBetween(pts[i], pts[i - 1])
    if (dt > 0) pts[i].vel = (pts[i].disp - pts[i - 1].disp) / dt
  }
}

const fillAccel = pts => {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].accel !== null || pts[i - 1].vel === null || pts[i].vel === null) continue
    const dt = hoursBetween(pts[i], pts[i - 1])
    if (dt > 0) pts[i].accel = (pts[i].vel - pts[i - 1].vel) / dt
  }
}

const fillRegInverse = pts => {
  const buffer = []
  pts.forEach(p => {
    if (p.vel !== null && isFinite(p.vel)) {
      buffer.push(Math.abs(p.vel))
      if (buffer.length > CONFIG.VEL_SMA_PERIOD) buffer.shift()
    }
    const avg = buffer.length ? buffer.reduce((s, v) => s + v, 0) / buffer.length : null
    p.invReg = avg !== null && avg >= CONFIG.VEL_FLOOR ? clampInv(1 / avg) : p.inv
  })
}

export const rowsToPoints = rows => {
  const pts = []
  rows.forEach(row => {
    const time = parseTimestamp(row.time)
    if (!time) return
    const disp = toNum(row.disp), vel = toNum(row.vel), accel = toNum(row.accel)
    if (disp === null && vel === null) return
    pts.push({ time, disp, vel, inv: invOf(vel), accel })
  })
  pts.sort((a, b) => a.time.getTime() - b.time.getTime())
  fillVelocity(pts)
  fillAccel(pts)
  pts.forEach(p => { if (p.inv === null) p.inv = invOf(p.vel) })
  fillRegInverse(pts)
  return pts
}

import { CONFIG } from '../core/config.js'
import { parseTimestamp, parseNum } from './parse.js'

export const clampInv = inv => {
  if (inv === null || isNaN(inv) || !isFinite(inv)) return null
  if (inv > CONFIG.MAX_INV_DISPLAY) return CONFIG.MAX_INV_DISPLAY
  return inv < 0 ? 0 : inv
}

export const buildDataFromRows = (rows, colMap) => {
  let skipped = 0
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.length) continue
    const tms = colMap.time !== undefined ? parseTimestamp(row[colMap.time]) : null
    if (!tms) { skipped++; continue }
    let disp = colMap.disp !== undefined ? parseNum(row[colMap.disp]) : NaN
    let vel = colMap.vel !== undefined ? parseNum(row[colMap.vel]) : NaN
    let invRaw = colMap.inv !== undefined ? parseNum(row[colMap.inv]) : NaN
    const accelRaw = colMap.accel !== undefined ? parseNum(row[colMap.accel]) : NaN
    if (isNaN(disp)) disp = null
    if (isNaN(vel)) vel = null
    if (isNaN(invRaw)) invRaw = null
    if (disp === null && vel === null && invRaw === null) { skipped++; continue }
    out.push({ time: tms, disp, vel, inv: null, invRaw, accel: isNaN(accelRaw) ? null : accelRaw })
  }
  out.sort((a, b) => a.time.getTime() - b.time.getTime())
  const deduped = [], seen = {}
  for (let j = 0; j < out.length; j++) {
    const key = out[j].time.getTime()
    if (seen[key]) continue
    seen[key] = true
    deduped.push(out[j])
  }
  for (let k = 0; k < deduped.length; k++) {
    const cur = deduped[k], prev = k > 0 ? deduped[k - 1] : null
    if (cur.vel === null && cur.invRaw !== null && cur.invRaw > 0) cur.vel = 1 / cur.invRaw
    if (cur.vel === null && prev && cur.disp !== null && prev.disp !== null) {
      const dtH = (cur.time.getTime() - prev.time.getTime()) / 3600000
      if (dtH > 0) cur.vel = (cur.disp - prev.disp) / dtH
    }
    if (CONFIG.VEL_FROM_DISP && prev && cur.disp !== null && prev.disp !== null) {
      const dtH2 = (cur.time.getTime() - prev.time.getTime()) / 3600000
      if (dtH2 > 0) cur.vel = (cur.disp - prev.disp) / dtH2
    }
    if (cur.vel !== null && isFinite(cur.vel) && Math.abs(cur.vel) >= CONFIG.VEL_FLOOR)
      cur.inv = clampInv(1 / Math.abs(cur.vel))
    else if (cur.invRaw !== null && isFinite(cur.invRaw) && cur.invRaw > 0)
      cur.inv = clampInv(cur.invRaw)
    else cur.inv = null
    if (cur.accel === null && prev && prev.vel !== null && cur.vel !== null) {
      const dtH = (cur.time.getTime() - prev.time.getTime()) / 3600000
      if (dtH > 0) cur.accel = (cur.vel - prev.vel) / dtH
    }
  }
  const absBuf = []
  for (let i = 0; i < deduped.length; i++) {
    const v = deduped[i].vel
    if (v !== null && isFinite(v)) {
      absBuf.push(Math.abs(v))
      if (absBuf.length > CONFIG.VEL_SMA_PERIOD) absBuf.shift()
    }
    let s2 = 0
    for (let b = 0; b < absBuf.length; b++) s2 += absBuf[b]
    const smaAbs = absBuf.length ? s2 / absBuf.length : null
    deduped[i].invReg = smaAbs !== null && smaAbs >= CONFIG.VEL_FLOOR ? clampInv(1 / smaAbs) : deduped[i].inv
  }
  const points = deduped.map(d => ({ time: d.time, disp: d.disp, vel: d.vel, inv: d.inv, invReg: d.invReg, accel: d.accel }))
  return { points, skipped }
}

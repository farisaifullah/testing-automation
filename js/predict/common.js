import { CONFIG } from '../core/config.js'
import { medianArr } from '../core/math.js'

const invForReg = d => (d.invReg != null ? d.invReg : d.inv)

export const selectWindowPts = (data, windowMin) => {
  const latestTime = data[data.length - 1].time
  let pts = []
  for (let m = 1; m <= CONFIG.WIN_EXPAND_MAX && pts.length < CONFIG.MIN_POINTS; m++) {
    const windowStart = new Date(latestTime.getTime() - windowMin * m * 60000)
    pts = []
    for (let i = 0; i < data.length; i++) {
      const v = invForReg(data[i])
      if (data[i].time >= windowStart && v !== null && isFinite(v)) pts.push({ time: data[i].time, inv: v })
    }
  }
  while (pts.length > CONFIG.MIN_POINTS && pts[0].inv > CONFIG.ONSET_TRIM_RATIO * medianArr(pts.map(p => p.inv)))
    pts.shift()
  return pts
}

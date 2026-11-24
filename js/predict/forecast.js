export const computeForecast = (src, limit) => {
  const pts = []
  for (let i = 0; i < src.length; i++) {
    const d = src[i]
    if (d.inv !== null && isFinite(d.inv) && d.inv > 0) pts.push({ t: d.time.getTime(), y: d.inv })
  }
  const last = pts.slice(-(limit || 10))
  if (last.length < 4) return null
  const t0 = last[0].t
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (let i = 0; i < last.length; i++) {
    const x = (last[i].t - t0) / 36e5
    sx += x; sy += last[i].y; sxy += x * last[i].y; sxx += x * x
  }
  const n = last.length, den = n * sxx - sx * sx
  if (den === 0) return null
  const sl = (n * sxy - sx * sy) / den, ic = (sy - sl * sx) / n
  let tof = null
  if (sl < 0) {
    const h = -ic / sl
    if (h > 0 && h < 24 * 60) tof = t0 + h * 36e5
  }
  return { t0, pts: last, slope: sl, ic, tof }
}

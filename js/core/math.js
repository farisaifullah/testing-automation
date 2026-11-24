const logGamma = x => {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ]
  let y = x, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

const betacf = (a, b, x) => {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

const regIncBeta = (x, a, b) => {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  )
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b
}

export const studentTCdf = (t, df) => {
  const xb = df / (df + t * t), p = 0.5 * regIncBeta(xb, df / 2, 0.5)
  return t >= 0 ? 1 - p : p
}

export const studentTQuantile = (p, df) => {
  let lo = -100, hi = 100, mid = 0
  for (let i = 0; i < 90; i++) {
    mid = (lo + hi) / 2
    if (studentTCdf(mid, df) < p) lo = mid
    else hi = mid
  }
  return mid
}

const erfApprox = x => {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

export const normCdf = z => 0.5 * (1 + erfApprox(z / Math.SQRT2))

export const medianArr = a => {
  if (!a.length) return 0
  const b = a.slice().sort((x, y) => x - y), m = Math.floor(b.length / 2)
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2
}

export const computeSma = (values, period) => {
  const out = [], buf = []
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null || isNaN(values[i])) { out.push(null); continue }
    buf.push(values[i])
    if (buf.length > period) buf.shift()
    let s = 0
    for (let b = 0; b < buf.length; b++) s += buf[b]
    out.push(s / buf.length)
  }
  return out
}

export const fukProb = (fuk, latestMs, H) => {
  if (!fuk || !fuk.valid) return null
  const remain = (fuk.failTime.getTime() - latestMs) / 3600000
  return fuk.seTf !== null && fuk.seTf > 0 ? normCdf((H - remain) / fuk.seTf) : remain <= H ? 1 : 0
}

export const bayProb = (bay, latestHours, H) => {
  if (!bay || !bay.valid) return null
  return bay.seTf !== null && bay.seTf > 0 && bay.nu > 0
    ? studentTCdf((latestHours + H - bay.beta0) / bay.seTf, bay.nu)
    : bay.beta0 <= latestHours + H ? 1 : 0
}

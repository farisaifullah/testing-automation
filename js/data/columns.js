import { CONFIG, HEADER_KEYWORDS, KEYWORD_ORDER } from '../core/config.js'
import { parseNum, isTimeValue } from './parse.js'

const normalizeHeader = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const detectColumns = headerRow => {
  const map = {}
  if (!headerRow || !headerRow.length) return map
  const norm = headerRow.map(normalizeHeader)
  Object.keys(CONFIG.HEADER_MAP).forEach(key => {
    for (let i = 0; i < norm.length; i++) {
      if (CONFIG.HEADER_MAP[key].indexOf(norm[i]) !== -1) { map[key] = i; break }
    }
  })
  return map
}

const detectColumnsByKeyword = (headerRow, used) => {
  const map = {}
  if (!headerRow || !headerRow.length) return map
  const norm = headerRow.map(normalizeHeader)
  for (let o = 0; o < KEYWORD_ORDER.length; o++) {
    const key = KEYWORD_ORDER[o]
    for (let i = 0; i < norm.length; i++) {
      if (used[i] || map[key] !== undefined || !norm[i]) continue
      const kws = HEADER_KEYWORDS[key]
      for (let k = 0; k < kws.length; k++) {
        if (norm[i].indexOf(kws[k]) !== -1) { map[key] = i; used[i] = true; break }
      }
    }
  }
  return map
}

const colStats = (rows, c) => {
  const vals = []
  for (let r = 0; r < rows.length; r++) {
    const v = rows[r] ? parseNum(rows[r][c]) : NaN
    if (!isNaN(v)) vals.push(v)
  }
  const n = vals.length
  if (n < 4) return null
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (let i = 0; i < n; i++) { sx += i; sy += vals[i]; sxy += i * vals[i]; sxx += i * i }
  const den = n * sxx - sx * sx
  const slope = den ? (n * sxy - sx * sy) / den : 0
  const ic = (sy - slope * sx) / n, meanY = sy / n
  let ssres = 0, sstot = 0
  for (let i = 0; i < n; i++) {
    const p = slope * i + ic
    ssres += (vals[i] - p) * (vals[i] - p)
    sstot += (vals[i] - meanY) * (vals[i] - meanY)
  }
  let flips = 0
  for (let i = 2; i < n; i++)
    if ((vals[i - 1] - vals[i - 2]) * (vals[i] - vals[i - 1]) < 0) flips++
  return { r2: sstot > 0 ? 1 - ssres / sstot : 0, flipRate: flips / (n - 2) }
}

const isReciprocalPair = (rows, ca, cb) => {
  let hit = 0, tot = 0
  for (let r = 0; r < rows.length; r++) {
    const a = parseNum(rows[r][ca]), b = parseNum(rows[r][cb])
    if (isNaN(a) || isNaN(b) || Math.abs(a) < 1e-6 || Math.abs(b) < 1e-6) continue
    tot++
    if (Math.abs(a * b - 1) < 0.05) hit++
  }
  return tot >= 5 && hit / tot > 0.7
}

const assignByHeuristic = (sample, cols, map, assumed) => {
  let pool = cols.slice(), invCol = -1, velCol = -1
  for (let i = 0; i < pool.length && invCol < 0; i++) {
    for (let j = 0; j < pool.length; j++) {
      if (i === j) continue
      if (isReciprocalPair(sample, pool[i], pool[j])) { invCol = pool[i]; velCol = pool[j]; break }
    }
  }
  if (invCol >= 0) {
    map.inv = invCol; map.vel = velCol; assumed.push('inv', 'vel')
    pool = pool.filter(c => c !== invCol && c !== velCol)
  }
  if (!pool.length) return
  const stats = pool.map(c => ({ c, s: colStats(sample, c) })).filter(o => o.s)
  if (!stats.length) return
  stats.sort((a, b) => b.s.r2 - a.s.r2)
  map.disp = stats[0].c
  assumed.push('disp')
  const rest = stats.slice(1)
  if (map.vel === undefined && rest.length) {
    rest.sort((a, b) => b.s.flipRate - a.s.flipRate)
    map.vel = rest[0].c
    assumed.push('vel')
    if (rest.length > 1) { map.accel = rest[1].c; assumed.push('accel') }
  } else if (rest.length > 1) {
    map.accel = rest[rest.length - 1].c
    assumed.push('accel')
  }
}

const detectColumnsByContent = (bodyRows, ncols, used) => {
  const sample = bodyRows.slice(0, 40), map = {}, assumed = []
  if (!sample.length) return { map, assumed }
  let bestTime = -1, bestScore = 0
  for (let c = 0; c < ncols; c++) {
    if (used[c]) continue
    let hit = 0, tot = 0
    for (let r = 0; r < sample.length; r++) {
      const v = sample[r] ? sample[r][c] : null
      if (v === null || v === undefined || v === '') continue
      tot++
      if (isTimeValue(v)) hit++
    }
    const score = tot ? hit / tot : 0
    if (score > bestScore) { bestScore = score; bestTime = c }
  }
  if (bestScore < 0.8 || bestTime < 0) return { map, assumed }
  map.time = bestTime
  used[bestTime] = true
  const nums = []
  for (let c = 0; c < ncols; c++) {
    if (used[c]) continue
    let hit = 0, tot = 0
    for (let r = 0; r < sample.length; r++) {
      const v = sample[r] ? sample[r][c] : null
      if (v === null || v === undefined || v === '') continue
      tot++
      if (!isNaN(parseNum(v))) hit++
    }
    if (tot && hit / tot > 0.8) nums.push(c)
  }
  if (nums.length === 1) { map.disp = nums[0]; assumed.push('disp') }
  else if (nums.length >= 2) assignByHeuristic(sample, nums, map, assumed)
  return { map, assumed }
}

export const detectAllColumns = (headerRow, bodyRows) => {
  const map = detectColumns(headerRow), used = {}
  Object.keys(map).forEach(k => { used[map[k]] = true })
  const kw = detectColumnsByKeyword(headerRow, used)
  Object.keys(kw).forEach(k => {
    if (map[k] === undefined) { map[k] = kw[k]; used[map[k]] = true }
  })
  const headerKinematic = map.disp !== undefined || map.vel !== undefined || map.inv !== undefined
  const assumed = []
  let timeFromContent = false
  const needKinematic = map.disp === undefined && map.vel === undefined && map.inv === undefined
  if (map.time === undefined || needKinematic) {
    let ncols = 0
    for (let i = 0; i < bodyRows.length && i < 50; i++)
      if (bodyRows[i] && bodyRows[i].length > ncols) ncols = bodyRows[i].length
    if (headerRow && headerRow.length > ncols) ncols = headerRow.length
    const res = detectColumnsByContent(bodyRows, ncols, used)
    Object.keys(res.map).forEach(k => {
      if (map[k] === undefined) {
        map[k] = res.map[k]
        if (k === 'time') timeFromContent = true
        if (res.assumed.indexOf(k) !== -1) assumed.push(k)
      }
    })
  }
  return { map, assumed, timeFromContent, headerKinematic }
}

export const mappingSummary = (headerRow, map, assumed) => {
  const names = { time: 'Time', disp: 'Disp', vel: 'Vel', inv: 'Inv', accel: 'Accel' }
  const parts = []
  Object.keys(names).forEach(k => {
    if (map[k] === undefined) return
    const rawName = headerRow && headerRow[map[k]] !== undefined && headerRow[map[k]] !== null && String(headerRow[map[k]]) !== ''
      ? String(headerRow[map[k]])
      : 'kol ' + (map[k] + 1)
    parts.push(names[k] + '←"' + rawName + '"' + (assumed.indexOf(k) !== -1 ? ' (asumsi)' : ''))
  })
  return parts.join(' · ')
}

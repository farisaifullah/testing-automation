export const parseTimestamp = raw => {
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw
  if (typeof raw === 'number' && isFinite(raw)) {
    if (raw > 20000 && raw < 80000) {
      const ms = Math.round((raw - 25569) * 86400000), ud = new Date(ms)
      return new Date(ud.getUTCFullYear(), ud.getUTCMonth(), ud.getUTCDate(), ud.getUTCHours(), ud.getUTCMinutes(), ud.getUTCSeconds())
    }
    if (raw > 1e9 && raw < 4e9) return new Date(Math.round(raw * 1000))
    if (raw > 1e12 && raw < 4e12) return new Date(Math.round(raw))
  }
  const s = String(raw).replace(/[\uFEFF\u0000"']/g, '').trim()
  if (/^\d{9,10}(\.\d+)?$/.test(s)) return new Date(Math.round(parseFloat(s) * 1000))
  if (/^\d{12,13}(\.\d+)?$/.test(s)) return new Date(Math.round(parseFloat(s)))
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const x = parseFloat(s)
    if (x > 20000 && x < 80000) {
      const ms2 = Math.round((x - 25569) * 86400000), ud2 = new Date(ms2)
      return new Date(ud2.getUTCFullYear(), ud2.getUTCMonth(), ud2.getUTCDate(), ud2.getUTCHours(), ud2.getUTCMinutes(), ud2.getUTCSeconds())
    }
  }
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const dt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0)
    if (!isNaN(dt.getTime())) return dt
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const a = +m[1], b = +m[2], euStyle = a > 12 && b <= 12
    const month = euStyle ? b : a, day = euStyle ? a : b
    const dt2 = new Date(+m[3], month - 1, day, +m[4], +m[5], m[6] ? +m[6] : 0)
    if (!isNaN(dt2.getTime())) return dt2
  }
  const fb = new Date(s)
  return isNaN(fb.getTime()) ? null : fb
}

export const parseNum = raw => {
  if (raw === undefined || raw === null) return NaN
  if (typeof raw === 'number') return isFinite(raw) ? raw : NaN
  let s = String(raw).trim()
  if (!s) return NaN
  if (/^[+-]?\d+,\d+$/.test(s)) s = s.replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

export const isTimeValue = v => {
  if (v === null || v === undefined || v === '') return false
  if (v instanceof Date) return !isNaN(v.getTime())
  if (typeof v === 'number' && isFinite(v))
    return (v > 20000 && v < 80000) || (v > 1e9 && v < 4e9) || (v > 1e12 && v < 4e12)
  const s = String(v).trim()
  if (/^\d{9,10}(\.\d+)?$/.test(s)) return true
  if (/^\d{12,13}(\.\d+)?$/.test(s)) return true
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const x = parseFloat(s)
    if (x > 20000 && x < 80000) return true
  }
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s)) return true
  return false
}

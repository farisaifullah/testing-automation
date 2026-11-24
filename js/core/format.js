const pad2 = n => String(n).padStart(2, '0')

export const fmtNum = (n, dec = 2) =>
  n === null || n === undefined || isNaN(n) ? '--' : n.toFixed(dec)

export const fmtDateTime = t =>
  t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) +
  ' ' + pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ':' + pad2(t.getSeconds())

export const fmtHM = t => (t ? pad2(t.getHours()) + ':' + pad2(t.getMinutes()) : '--')

export const fmtCountdown = h => {
  if (h === null || isNaN(h) || h < 0) return '--'
  const m = Math.round(h * 60)
  return pad2(Math.floor(m / 60)) + 'h ' + pad2(m % 60) + 'm'
}

export const fmtMDH = t => pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) + ' ' + pad2(t.getHours())

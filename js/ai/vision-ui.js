import { $, esc } from '../core/dom.js'

const COLORS = { X: '#16a34a', left: '#f59e0b', right: '#ec4899' }
const dot = ['#ef4444', '#a855f7', '#06b6d4']

export const renderCalTable = (cal, ticks) => {
  const rows = []
  const add = (axis, kind, idx, t) => rows.push('<tr><td>' + axis + '</td><td>' + Math.round(t.at) + '</td><td>' + (t.snapped ? '✓' : '–') +
    '</td><td><input type="text" value="' + esc(t.text) + '" data-kind="' + kind + '" data-idx="' + idx + '" aria-label="Tick ' + axis + ' ' + (idx + 1) + '"></td></tr>')
  ticks.filter(t => t.axis === 'X').forEach((t, i) => add('X', 'x', i, t))
  ;['left', 'right'].forEach(id => ticks.filter(t => t.axis === (id === 'left' ? 'Y-left' : 'Y-right')).forEach((t, i) => add(id === 'left' ? 'Y-left' : 'Y-right', id, i, t)))
  $('visionCalBody').innerHTML = rows.join('')
}

const paintOverlay = (canvas, img, result, k, dotSize) => {
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  if (!result) return
  ctx.lineWidth = 1
  result.calib.ticks.forEach(t => {
    ctx.strokeStyle = t.axis === 'X' ? COLORS.X : t.axis === 'Y-right' ? COLORS.right : COLORS.left
    ctx.setLineDash(t.snapped ? [] : [3, 3])
    ctx.beginPath()
    if (t.axis === 'X') { ctx.moveTo(t.at * k, 0); ctx.lineTo(t.at * k, canvas.height) } else { ctx.moveTo(0, t.at * k); ctx.lineTo(canvas.width, t.at * k) }
    ctx.globalAlpha = 0.55
    ctx.stroke()
  })
  ctx.globalAlpha = 1
  ctx.setLineDash([])
  result.series.forEach((s, si) => {
    ctx.fillStyle = dot[si % dot.length]
    s.trace.ys.forEach((y, i) => { if (!isNaN(y)) ctx.fillRect((s.trace.x0 + i) * k - dotSize / 2, y * k - dotSize / 2, dotSize, dotSize) })
  })
}

/** Gambar asli + garis tick yang dipakai + titik hasil pelacakan: untuk verifikasi visual. */
export const drawOverlay = (image, result) => {
  const canvas = $('visionTrace'), box = canvas.parentElement
  const img = new Image()
  img.onload = () => {
    const w = Math.max(300, box.clientWidth), k = w / image.width
    canvas.width = w
    canvas.height = Math.round(image.height * k)
    paintOverlay(canvas, img, result, k, 2)
  }
  img.src = image.dataUrl
}

const stamp = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

export const saveCsv = (rows, label) => {
  const cell = v => (v === null || v === undefined ? '' : v)
  const body = rows.map(r => [cell(r.time), cell(r.disp), cell(r.vel), cell(r.accel)].join(','))
  const csv = ['Time,Disp (mm),Vel (mm/h),Accel (mm/h2)'].concat(body).join('\n') + '\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = label + '_extracted.csv'
  link.click()
  URL.revokeObjectURL(url)
}

/** Excel: sheet Data (siap diimpor ulang) + sheet Calibration (jejak audit: tick, resolusi, peringatan). */
export const saveXlsx = (rows, label, meta) => {
  if (typeof XLSX === 'undefined') return false
  const data = [['Time', 'Disp (mm)', 'Vel (mm/h)', 'Accel (mm/h2)']].concat(rows.map(r => [r.time, r.disp, r.vel, r.accel]))
  const info = [['Item', 'Value'], ['Source image', meta.image], ['Location', meta.location || ''], ['Extracted on', stamp()], ['Method', 'Axis calibration by AI; curve points traced from image pixels'],
    ['Confidence (AI)', meta.confidence || ''], ['Points', rows.length], [], ['Axis', 'Position (px)', 'Snapped to grid', 'Value']]
    .concat(meta.ticks.map(t => [t.axis, Math.round(t.at * 10) / 10, t.snapped ? 'yes' : 'no', t.text]))
    .concat([[], ['Warnings']], meta.warnings.map(w => [w]), [[], ['Notes']], meta.info.map(w => [w]), meta.filled && meta.filled.length ? [[], ['Interpolated timestamps (curve not detected at these points)']].concat(meta.filled.map(t => [t])) : [])
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const wi = XLSX.utils.aoa_to_sheet(info)
  wi['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 16 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, wi, 'Calibration')
  XLSX.writeFile(wb, label + '_extracted.xlsx')
  return true
}

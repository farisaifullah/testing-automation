import { $ } from '../core/dom.js'
import { state } from '../core/state.js'
import { fmtDateTime, fmtHM, fmtNum, fmtCountdown } from '../core/format.js'
import { analysisView } from './filter.js'
import { tarpLabel } from './event-log.js'
import { enableButton } from './modal.js'

const remainingOf = (cons, latest) => (cons.failTime.getTime() - latest.time.getTime()) / 3600000

const fukuzonoLines = r => r.fukCons && r.fukCons.valid
  ? ['ToF: ' + fmtDateTime(r.fukCons.failTime) + ' | Sisa: ' + fmtCountdown(remainingOf(r.fukCons, r.latest)) +
     ' | R2=' + fmtNum(r.fukCons.r2, 3) + ' | SE=' + fmtNum(r.fukCons.seTf, 2) + 'h']
  : ['ToF: tidak ada prediksi aktif.']

const bayesianLines = r => r.bayCons && r.bayCons.valid
  ? ['ToF: ' + fmtDateTime(r.bayCons.failTime) + ' | 95% CrI: [' + fmtHM(r.bayCons.ciLowTime) + ', ' + fmtHM(r.bayCons.ciHighTime) +
     '] | B=' + fmtNum(r.bayCons.B, 4) + ' | R2=' + fmtNum(r.bayCons.r2, 3)]
  : ['ToF: tidak ada prediksi aktif.']

const deltaLines = r => r.fukCons && r.fukCons.valid && r.bayCons && r.bayCons.valid
  ? ['', 'Δ antar metode: ' + fmtNum(Math.abs((r.fukCons.failTime.getTime() - r.bayCons.failTime.getTime()) / 3600000), 2) + ' jam']
  : []

const eventLines = () => {
  const events = state.eventLogItems.slice(0, 5)
  return events.length
    ? events.map(e => '- ' + fmtDateTime(e.time) + ' [' + tarpLabel(e.level) + '] ' + e.message)
    : ['- (tidak ada event)']
}

export const buildReportText = () => {
  const r = state.lastResults
  if (!r) return ''
  const l = r.latest
  return [
    'LAPORAN PREDIKSI LONGSOR - DUAL METHOD (FUKUZONO + BAYESIAN)',
    'File: ' + state.fileName + (state.edited ? ' (edited)' : ''),
    'Waktu laporan: ' + fmtDateTime(new Date()),
    'Data terakhir: ' + fmtDateTime(l.time) + ' (' + (analysisView().length || state.data.length) + ' titik)' + (r.filterTag ? ' | ' + r.filterTag : ''),
    'Status alert: ' + r.status,
    '',
    '=== FUKUZONO ===', ...fukuzonoLines(r),
    '',
    '=== BAYESIAN ===', ...bayesianLines(r),
    ...deltaLines(r),
    '',
    'Kinematik: Disp=' + fmtNum(l.disp, 2) + 'mm | Vel=' + fmtNum(l.vel, 3) + 'mm/h | Inv=' + fmtNum(l.inv, 3) + 'h/mm | Accel=' + fmtNum(l.accel, 3) + 'mm/h2',
    '',
    'Event log terbaru:', ...eventLines(),
    '',
    'Prototype R&D. Wajib divalidasi engineer geoteknik.'
  ].join('\n')
}

const flash = (btn, label) => {
  const idle = btn.dataset.idle || btn.textContent
  btn.textContent = label
  setTimeout(() => { btn.textContent = idle }, 1500)
}

const legacyCopy = text => {
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try { document.execCommand('copy') } catch (e) { /* abaikan */ }
  document.body.removeChild(area)
}

export const copyText = (text, btn, label) => {
  const done = () => flash(btn, label)
  const fallback = () => { legacyCopy(text); done() }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback)
  else fallback()
}

export function initReport () {
  enableButton('btnCopyReport')
  $('btnCopyReport').dataset.idle = $('btnCopyReport').textContent
  $('btnCopyReport').addEventListener('click', () => {
    const text = buildReportText()
    if (text) copyText(text, $('btnCopyReport'), 'Tersalin ✓')
  })
}

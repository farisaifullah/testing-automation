import { $ } from '../core/dom.js'
import { state } from '../core/state.js'
import { TARP } from '../core/config.js'
import { fmtDateTime, fmtNum } from '../core/format.js'
import { openModal, bindModal, enableButton } from './modal.js'

const MAX_EVENTS = 50

const tarpText = level => TARP[level].name + ' (' + TARP[level].desc + ')'

export const tarpLabel = level => {
  const n = +String(level).replace('TARP', '')
  return TARP[n] ? TARP[n].name : String(level)
}

const levelOf = (d, th) => {
  const accel = d.accel === null || isNaN(d.accel) ? 0 : d.accel
  if (d.vel === null) return 1
  if (d.vel > th.velDanger) return accel > 0 ? 4 : 3
  if (d.vel > th.velWarn) return accel > 0 ? 3 : 2
  return accel > th.accelCrit ? 2 : 1
}

export const buildEventLog = (data, th) => {
  const items = []
  let prevLevel = null, lastDisp = null
  data.forEach(d => {
    const level = levelOf(d, th)
    if (lastDisp !== null && d.disp !== null && d.disp - lastDisp > th.dispJump)
      items.push({ time: d.time, level: 'TARP4', message: tarpText(4) + ': lonjakan disp ' + fmtNum(d.disp - lastDisp, 2) + ' mm' })
    if (d.disp !== null) lastDisp = d.disp
    if (level >= 2 && level !== prevLevel)
      items.push({ time: d.time, level: 'TARP' + level, message: tarpText(level) + ': vel ' + fmtNum(d.vel, 3) + ' mm/h' })
    prevLevel = level
  })
  state.eventLogItems = items.reverse().slice(0, MAX_EVENTS)
}

const itemHtml = it =>
  '<div class="log-item log-' + it.level + '"><span class="log-time">' + fmtDateTime(it.time) +
  '</span><span class="log-level">' + tarpLabel(it.level) + '</span><span class="log-msg">' + it.message + '</span></div>'

export const renderLog = () => {
  const items = state.eventLogItems
  $('evCount').textContent = items.length + ' event (terbaru di atas, maks ' + MAX_EVENTS + ')'
  $('eventLog').innerHTML = items.length ? items.map(itemHtml).join('') : '<div class="log-empty">Belum ada event.</div>'
}

export function initEventLog () {
  enableButton('btnEventLog')
  $('btnEventLog').addEventListener('click', () => {
    renderLog()
    openModal('evModal')
  })
  bindModal('evModal', 'btnEvClose')
}

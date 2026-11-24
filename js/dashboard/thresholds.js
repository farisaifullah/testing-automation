import { $ } from '../core/dom.js'
import { CONFIG } from '../core/config.js'
import { emit } from '../core/bus.js'
import { openModal, bindModal, enableButton } from './modal.js'

const num = id => parseFloat($(id).value)

export const getThresholds = () => ({
  velWarn: Math.max(0, num('thVelWarn') || 0),
  velDanger: Math.max(0, num('thVelDanger') || 0),
  invCrit: Math.max(0.01, num('thInvCrit') || 0),
  dispJump: Math.max(0.1, num('thDispJump') || 0),
  minR2: Math.min(1, Math.max(0, num('thMinR2') || 0)),
  horizon: Math.max(1, Math.min(num('thHorizon') || CONFIG.HORIZON_DEFAULT, CONFIG.HORIZON_MAX)),
  win1: Math.max(5, num('thWin1') || 30),
  win2: Math.max(5, num('thWin2') || 60),
  win3: Math.max(5, num('thWin3') || 120),
  accelCrit: num('thAccelCrit') || 0.1
})

const validate = () => {
  const warn = num('thVelWarn') || 0, danger = num('thVelDanger') || 0
  const bad = danger > 0 && warn >= danger
  const el = $('thMsg')
  el.textContent = bad ? 'Velocity Warning harus lebih kecil dari Velocity Danger.' : ''
  el.classList.toggle('error', bad)
}

export function initThresholds () {
  enableButton('btnThresholds')
  $('btnThresholds').addEventListener('click', () => openModal('thModal'))
  bindModal('thModal', 'btnThClose')
  $('thModal').querySelectorAll('.th-grid input').forEach(input =>
    input.addEventListener('input', () => {
      validate()
      emit('analysis:changed')
    })
  )
}

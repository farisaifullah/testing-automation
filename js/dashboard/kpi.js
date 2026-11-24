import { $ } from '../core/dom.js'
import { fmtNum, fmtCountdown, fmtDateTime } from '../core/format.js'

export const renderKpis = (latest, th, cons) => {
  $('kpiDisp').innerHTML = fmtNum(latest.disp, 2) + '<span class="unit">mm</span>'
  $('kpiVel').innerHTML = fmtNum(latest.vel, 3) + '<span class="unit">mm/h</span>'
  $('kpiInv').innerHTML = fmtNum(latest.inv, 3) + '<span class="unit">h/mm</span>'
  $('kpiAccel').innerHTML = fmtNum(latest.accel, 3) + '<span class="unit">mm/h²</span>'
  $('kpiDispSub').textContent = fmtDateTime(latest.time)
  $('kpiVelSub').textContent = latest.vel === null ? 'N/A'
    : latest.vel > th.velDanger ? 'BAHAYA'
    : latest.vel > th.velWarn ? 'WASPADA' : 'AMAN'
  $('kpiInvSub').textContent = latest.inv === null ? 'N/A' : latest.inv < th.invCrit ? 'KRITIS' : 'AMAN'
  $('kpiAccelSub').textContent = latest.accel === null ? 'N/A' : latest.accel > 0 ? 'NAIK' : 'TURUN'
  if (cons && cons.valid) {
    const rem = (cons.failTime.getTime() - latest.time.getTime()) / 3600000
    $('kpiTof').textContent = fmtCountdown(rem)
    $('kpiTofSub').textContent = fmtDateTime(cons.failTime)
  } else {
    $('kpiTof').textContent = 'STABIL'
    $('kpiTofSub').textContent = 'Tidak ada konsensus'
  }
}

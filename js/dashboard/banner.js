import { $ } from '../core/dom.js'
import { fmtDateTime, fmtCountdown, fmtNum, fmtHM } from '../core/format.js'

export const renderBanner = res => {
  const el = $('tofBanner')
  if (!el) return
  el.className = 'tof-banner tb-' + res.status
  if (res.overall && res.overall.valid) {
    $('tbTime').textContent = fmtDateTime(res.overall.failTime)
    $('tbCountdown').textContent = 'Sisa waktu: ' + fmtCountdown(
      (res.overall.failTime.getTime() - res.latest.time.getTime()) / 3600000
    )
    let meta = res.tag + ' | R²=' + fmtNum(res.overall.r2, 3)
    if (res.overall.seTf !== null) meta += ' | SE=' + fmtNum(res.overall.seTf, 2) + 'h'
    if (res.tag === 'Bayesian' && res.overall.ciLowHours !== null)
      meta += ' | 95% CrI=[' + fmtHM(res.overall.ciLowTime) + ',' + fmtHM(res.overall.ciHighTime) + ']'
    if (res.filterTag) meta += ' | ' + res.filterTag
    if (res.viewEndStr) meta += ' | s.d. ' + res.viewEndStr
    $('tbMeta').textContent = meta
  } else {
    $('tbTime').textContent = 'Belum ada prediksi aktif'
    $('tbCountdown').textContent = 'Sisa waktu: --'
    $('tbMeta').textContent = 'Tidak ada tren signifikan'
  }
  $('tbLatest').textContent = res.latest
    ? 'Terakhir: ' + fmtDateTime(res.latest.time) + ' | v=' + fmtNum(res.latest.vel, 3) + ' mm/h | inv=' + fmtNum(res.latest.inv, 3) + ' h/mm'
    : '--'
}

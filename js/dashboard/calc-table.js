import { $ } from '../core/dom.js'
import { state } from '../core/state.js'
import { fmtNum, fmtDateTime, fmtHM, fmtCountdown } from '../core/format.js'
import { fukProb, bayProb } from '../core/math.js'

const REASON = {
  ACTIVE: 'ACTIVE', INSUFFICIENT: 'INSUFF.', DEGENERATE: 'INSUFF.',
  'NO ACCEL': 'NO ACCEL', 'LOW FIT': 'LOW FIT', PAST: 'PAST', STABLE: 'NO ACCEL'
}
const CLS = {
  ACTIVE: 'active', INSUFFICIENT: 'insufficient', DEGENERATE: 'insufficient',
  'NO ACCEL': 'noaccel', 'LOW FIT': 'lowfit', PAST: 'past', STABLE: 'noaccel'
}

const statusTag = reason =>
  '<span class="status-tag status-' + (CLS[reason] || 'insufficient') + '">' + (REASON[reason] || reason) + '</span>'

const ciStr = o => (o && o.ciLowTime ? fmtHM(o.ciLowTime) + ' – ' + fmtHM(o.ciHighTime) : '--')

const probCls = p => (p === null ? '' : p >= 0.8 ? 'prob-crit' : p >= 0.5 ? 'prob-warn' : 'prob-ok')

const probCell = p => '<td class="' + probCls(p) + '">' + (p !== null ? (p * 100).toFixed(1) + '%' : '--') + '</td>'

const cells = values => values.map(v => '<td>' + v + '</td>').join('')

const failCells = (r, latestMs) => [
  r.valid ? fmtDateTime(r.failTime) : '--',
  r.valid ? fmtCountdown((r.failTime.getTime() - latestMs) / 3600000) : '--'
]

const fukRow = (head, r, latestMs, horizon, last) =>
  '<tr>' + head + cells([fmtNum(r.slope, 5), fmtNum(r.intercept, 4), fmtNum(r.r2, 3), fmtNum(r.seTf, 2), ...failCells(r, latestMs), ciStr(r)]) +
  probCell(fukProb(r, latestMs, horizon)) + '<td>' + last + '</td></tr>'

const bayRow = (head, r, latestHours, horizon, last) =>
  '<tr>' + head + cells([fmtNum(r.B, 4), fmtNum(r.r2, 3), r.valid ? fmtDateTime(r.failTime) : '--', ciStr(r)]) +
  probCell(bayProb(r, latestHours, horizon)) + '<td>' + last + '</td></tr>'

const winHead = (i, th, r) => '<td>W' + (i + 1) + ' (' + [th.win1, th.win2, th.win3][i] + ' min)</td><td>' + r.points + '</td>'
const consHead = '<td colspan="2">KONSENSUS</td>'

export const renderCalcTables = (fukRes, bayRes, fukCons, bayCons, latest, th) => {
  const latestMs = latest.time.getTime()
  const latestHours = (latestMs - state.startTime) / 3600000
  $('fukTbody').innerHTML = fukRes.map((r, i) => fukRow(winHead(i, th, r), r, latestMs, th.horizon, statusTag(r.reason))).join('')
  $('bayTbody').innerHTML = bayRes.map((r, i) => bayRow(winHead(i, th, r), r, latestHours, th.horizon, statusTag(r.reason))).join('')
  $('fukTfoot').innerHTML = fukCons && fukCons.valid ? fukRow(consHead, fukCons, latestMs, th.horizon, 'Fukuzono') : ''
  $('bayTfoot').innerHTML = bayCons && bayCons.valid ? bayRow(consHead, bayCons, latestHours, th.horizon, 'Bayesian') : ''
}

export const renderAgreeLine = (fukCons, bayCons) => {
  const el = $('agreeLine')
  if (fukCons && fukCons.valid && bayCons && bayCons.valid) {
    const diff = Math.abs((fukCons.failTime.getTime() - bayCons.failTime.getTime()) / 3600000)
    el.textContent = 'Selisih ToF Fukuzono vs Bayesian: Δ ' + fmtNum(diff, 2) + ' jam'
    el.className = 'agree-line ' + (diff <= 2 ? 'good' : 'warn')
  } else {
    el.textContent = 'Selisih ToF Fukuzono vs Bayesian: --'
    el.className = 'agree-line'
  }
}

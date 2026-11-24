import { state } from '../core/state.js'
import { getThresholds } from './thresholds.js'
import { analysisView, filterTagFor, viewEndStr, syncFilterUi } from './filter.js'
import { buildEventLog, renderLog } from './event-log.js'
import { computeFukuzono } from '../predict/fukuzono.js'
import { computeBayesian } from '../predict/bayesian.js'
import { renderBadge } from './badge.js'
import { renderBanner } from './banner.js'
import { renderKpis } from './kpi.js'
import { renderCalcTables, renderAgreeLine } from './calc-table.js'
import { updateCharts } from './charts.js'
import { drawReferenceCharts } from './reference-charts.js'

const earliest = results => results.reduce(
  (best, r) => (r.valid && (!best || r.failTime.getTime() < best.failTime.getTime()) ? r : best), null)

const pickOverall = (fukCons, bayCons) => {
  if (fukCons && bayCons) return fukCons.failTime.getTime() <= bayCons.failTime.getTime() ? [fukCons, 'Fukuzono'] : [bayCons, 'Bayesian']
  if (fukCons) return [fukCons, 'Fukuzono']
  if (bayCons) return [bayCons, 'Bayesian']
  return [null, '']
}

const statusOf = (overall, latest, latestMs, th) => {
  const lowVel = latest.vel !== null && latest.vel > th.velWarn
  const lowInv = latest.inv !== null && latest.inv < th.invCrit
  if (overall) {
    const rem = (overall.failTime.getTime() - latestMs) / 3600000
    if (rem < 6) return 'AWAS'
    if (rem < 24) return 'SIAGA'
  }
  return lowVel || lowInv ? 'WASPADA' : 'NORMAL'
}

const filterTagOf = (viewRaw, view) =>
  viewRaw.length ? filterTagFor(view) : state.filter.mode !== 'none' ? 'Filter kosong: analisis semua data' : null

export const recompute = () => {
  if (!state.loaded || !state.data.length) return
  const th = getThresholds()
  const data = state.data
  const latest = data[data.length - 1]
  const latestMs = latest.time.getTime()
  const latestHours = (latestMs - state.startTime) / 3600000
  const viewRaw = analysisView()
  const view = viewRaw.length ? viewRaw : data
  const wins = [th.win1, th.win2, th.win3]
  const fukRes = wins.map(w => computeFukuzono(view, w, th.minR2, state.startTime))
  const bayRes = wins.map(w => computeBayesian(view, w, th.minR2, state.startTime))
  const fukCons = earliest(fukRes)
  const bayCons = earliest(bayRes)
  const [overall, tag] = pickOverall(fukCons, bayCons)
  const status = statusOf(overall, latest, latestMs, th)

  state.lastResults = {
    fukRes, bayRes, fukCons, bayCons, overall, tag, status, latest,
    filterTag: filterTagOf(viewRaw, view),
    viewEndStr: viewEndStr(view, latestMs)
  }

  renderBadge(status)
  renderBanner(state.lastResults)
  renderKpis(latest, th, overall)
  renderCalcTables(fukRes, bayRes, fukCons, bayCons, latest, th)
  renderAgreeLine(fukCons, bayCons)
  buildEventLog(data, th)
  renderLog()
  updateCharts(data, fukRes, bayRes, fukCons, bayCons, th, latestHours)
  drawReferenceCharts()
  syncFilterUi()
}

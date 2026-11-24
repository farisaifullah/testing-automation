import { $ } from '../core/dom.js'
import { state, cloneRow } from '../core/state.js'
import { closeAllModals } from './modal.js'
import { emit } from '../core/bus.js'
import { recompute } from './recompute.js'
import { renderBadge } from './badge.js'
import { buildCharts, destroyCharts } from './charts.js'
import { destroyReferenceCharts } from './reference-charts.js'

const setVisible = on => {
  const empty = $('dashboardEmpty'), results = $('dashboardResults')
  if (empty) empty.hidden = on
  if (results) results.hidden = !on
}

export const loadIntoDashboard = (points, fileName) => {
  destroyCharts()
  destroyReferenceCharts()
  state.loaded = true
  state.data = points
  state.fileName = fileName
  state.originalData = points.map(cloneRow)
  state.edited = false
  state.eventLogItems = []
  closeAllModals()
  state.startTime = points[0].time.getTime()
  state.lastResults = null
  $('dashFile').textContent = fileName + ' · ' + points.length + ' titik'
  setVisible(true)
  buildCharts()
  recompute()
  emit('dashboard:loaded')
  $('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export const setEmptyState = () => {
  destroyCharts()
  destroyReferenceCharts()
  state.loaded = false
  state.data = []
  state.originalData = []
  state.edited = false
  state.eventLogItems = []
  closeAllModals()
  state.lastResults = null
  renderBadge('NODATA')
  setVisible(false)
}

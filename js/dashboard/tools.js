import { state } from '../core/state.js'
import { on } from '../core/bus.js'
import { recompute } from './recompute.js'
import { initFilter } from './filter.js'
import { initThresholds } from './thresholds.js'
import { initEventLog } from './event-log.js'
import { initEditData } from './edit-data.js'
import { initReport } from './report.js'
import { initChartPng } from '../export/chart-png.js'
import { initPdf } from '../export/pdf-report.js'

export function initDashboardTools () {
  initFilter()
  initThresholds()
  initEventLog()
  initEditData()
  initReport()
  initChartPng()
  initPdf()
  on('analysis:changed', () => { if (state.loaded) recompute() })
}

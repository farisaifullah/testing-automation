import { analysisView } from './filter.js'
import { $ } from '../core/dom.js'
import { state } from '../core/state.js'
import { computeForecast } from '../predict/forecast.js'
import { fmtDateTime } from '../core/format.js'

const REF_GRID = { color: 'rgba(0,0,0,0.08)' }
const REF_BORDER = { display: true, color: '#475569', dash: [4, 4] }
const REF_FONT = 'Poppins, sans-serif'

const refTitle = text => ({ display: true, text, color: '#1e293b', font: { size: 13, weight: 500, family: REF_FONT }, padding: { bottom: 8 } })
const refTicks = color => ({ color: color || '#475569', font: { size: 10.5, family: REF_FONT }, maxTicksLimit: 9, autoSkip: true })
const refAxisTitle = (text, color) => ({ display: true, text, color: color || '#475569', font: { size: 11, weight: 400, family: REF_FONT } })
const fmtMDH = t => String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') + ' ' + String(t.getHours()).padStart(2, '0')
const fmtDHM = t => String(t.getDate()).padStart(2, '0') + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0')

export const destroyReferenceCharts = () => {
  if (state.refChartA) { state.refChartA.destroy(); state.refChartA = null }
  if (state.refChartC) { state.refChartC.destroy(); state.refChartC = null }
}

export const drawReferenceCharts = () => {
  destroyReferenceCharts()
  if (!state.data || !state.data.length) return
  const view = analysisView(), data = view.length ? view : state.data, labels = data.map(d => fmtMDH(d.time))

  state.refChartA = new Chart($('refChartA').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Displacement', data: data.map(d => d.disp), borderColor: '#4f46e5', borderWidth: 1.3, pointRadius: 0, tension: 0, yAxisID: 'y' },
        { label: 'Velocity', data: data.map(d => d.vel), borderColor: '#f97316', borderWidth: 1.1, pointRadius: 0, tension: 0, yAxisID: 'y1' }
      ]
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, title: refTitle('Overlay: Displacement & Velocity vs Waktu (' + state.fileName + ')') },
      scales: {
        x: { grid: REF_GRID, border: REF_BORDER, ticks: refTicks('#475569'), title: refAxisTitle('Waktu (Time)') },
        y: { position: 'left', grid: REF_GRID, border: REF_BORDER, ticks: refTicks('#4f46e5'), title: refAxisTitle('Displacement (mm)', '#4f46e5') },
        y1: { position: 'right', grid: { display: false }, border: REF_BORDER, ticks: refTicks('#f97316'), title: refAxisTitle('Velocity (mm/h)', '#f97316') }
      }
    }
  })

  const F = computeForecast(data, state.filter.mode === 'none' ? 10 : data.length), dsC = []
  if (F) {
    dsC.push({ type: 'scatter', label: 'Actual Inv_Vel (' + (state.filter.mode === 'none' ? 'Last 10 pts' : 'Filter: ' + data.length + ' pts') + ')', data: F.pts.map(p => ({ x: p.t, y: p.y })), backgroundColor: '#16a34a', borderColor: '#16a34a', pointRadius: 4.5, pointStyle: 'circle', pointBorderWidth: 0 })
    const xEnd = F.tof ? F.tof : F.pts[F.pts.length - 1].t
    dsC.push({ type: 'line', label: 'Linear Regression / Forecast', data: [{ x: F.t0, y: F.ic }, { x: xEnd, y: (F.slope * (xEnd - F.t0)) / 36e5 + F.ic }], borderColor: '#dc2626', borderDash: [6, 4], borderWidth: 1.4, pointRadius: 0, pointStyle: 'line', showLine: true, fill: false })
    if (F.tof) {
      let maxY = 0
      for (let i = 0; i < F.pts.length; i++) if (F.pts[i].y > maxY) maxY = F.pts[i].y
      maxY = Math.max(maxY, F.ic) * 1.15
      dsC.push({ type: 'line', label: 'ToF: ' + fmtDateTime(new Date(F.tof)), data: [{ x: F.tof, y: 0 }, { x: F.tof, y: maxY }], borderColor: '#1e293b', borderDash: [2, 3], borderWidth: 1.2, pointRadius: 0, pointStyle: 'line', showLine: true, fill: false })
    }
  }
  state.refChartC = new Chart($('refChartC').getContext('2d'), {
    data: { datasets: dsC },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      plugins: {
        title: refTitle('Prediksi Kelongsoran (Inverse Velocity Forecast) - ' + state.fileName),
        legend: { position: 'top', align: 'start', labels: { usePointStyle: true, boxWidth: 24, boxHeight: 8, color: '#1e293b', font: { size: 10.5, family: REF_FONT }, padding: 6 } }
      },
      scales: {
        x: { type: 'linear', grid: REF_GRID, border: REF_BORDER, ticks: { color: '#475569', font: { size: 10.5, family: REF_FONT }, maxTicksLimit: 9, callback: v => fmtDHM(new Date(v)) }, title: refAxisTitle('Time') },
        y: { min: 0, grid: REF_GRID, border: REF_BORDER, ticks: refTicks('#475569'), title: refAxisTitle('Inverse Velocity (h/mm)') }
      }
    }
  })
}

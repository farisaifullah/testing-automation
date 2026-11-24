import { state } from '../core/state.js'
import { $ } from '../core/dom.js'

const CHARTS = {
  inv: { name: 'Fukuzono Inverse Velocity (α=2)', canvas: 'invChart' },
  bay: { name: 'Bayesian Adaptation (Radar Inverse Velocity)', canvas: 'bayChart' },
  disp: { name: 'Displacement, Velocity & Acceleration', canvas: 'dispChart' },
  prob: { name: 'Probability of Failure (Horizon)', canvas: 'probChart' }
}

const sanitizeFile = text => String(text).replace(/[\\/:*?"<>|]+/g, '_').trim()

const locationName = () => {
  if (state.locationLabel) return sanitizeFile(state.locationLabel)
  if (state.fileName) return sanitizeFile(state.fileName.replace(/\.[^.]+$/, '').replace(/_curve_.*$/i, ''))
  return 'Unknown'
}

export const chartToImage = (chart, background = '#ffffff') => {
  if (!chart || !chart.canvas) return null
  const out = document.createElement('canvas')
  out.width = chart.canvas.width
  out.height = chart.canvas.height
  const ctx = out.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(chart.canvas, 0, 0)
  return { url: out.toDataURL('image/png'), w: out.width, h: out.height }
}

const saveChart = key => {
  const img = chartToImage(state.charts[key])
  if (!img || !state.data.length) return
  const link = document.createElement('a')
  link.href = img.url
  link.download = sanitizeFile(CHARTS[key].name) + '_' + locationName() + '.png'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function initChartPng () {
  Object.keys(CHARTS).forEach(key => {
    const card = $(CHARTS[key].canvas).closest('.chart-card')
    if (!card) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'btn-mini chart-save'
    btn.textContent = 'Export PNG'
    btn.addEventListener('click', () => saveChart(key))
    card.appendChild(btn)
  })
}

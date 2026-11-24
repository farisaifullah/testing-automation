import { $ } from '../core/dom.js'
import { state } from '../core/state.js'
import { CONFIG } from '../core/config.js'
import { fmtNum, fmtDateTime } from '../core/format.js'
import { computeSma, normCdf, studentTCdf } from '../core/math.js'

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw: chart => {
    const tt = chart.tooltip
    if (!tt || !tt.getActiveElements || !tt.getActiveElements().length) return
    const x = tt.caretX, area = chart.chartArea, ctx = chart.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(71,85,105,0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, area.top)
    ctx.lineTo(x, area.bottom)
    ctx.stroke()
    ctx.restore()
  }
}

// ToF-LABEL-FIX: garis digambar dulu, kotak label di atasnya agar teks tidak tertembus garis
const tofLabelPlugin = {
  id: 'tofLabels',
  afterDatasetsDraw: chart => {
    const markers = chart.$tofMarkers
    if (!markers || !markers.length) return
    const ctx = chart.ctx, area = chart.chartArea, xScale = chart.scales.x
    const vis = []
    for (let i = 0; i < markers.length; i++) {
      const mk = markers[i], x = xScale.getPixelForValue(mk.x)
      if (x < area.left - 1 || x > area.right + 1) continue
      if (mk.ds !== undefined && !chart.isDatasetVisible(mk.ds)) continue
      vis.push({ mk, x })
    }
    // Lapis 1: semua garis ToF
    for (let i = 0; i < vis.length; i++) {
      ctx.save()
      ctx.strokeStyle = vis[i].mk.color
      ctx.lineWidth = 1.6
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(vis[i].x, area.top)
      ctx.lineTo(vis[i].x, area.bottom)
      ctx.stroke()
      ctx.restore()
    }
    // Lapis 2: semua kotak label (opak) di atas garis
    let row = 0
    for (let i = 0; i < vis.length; i++) {
      const mk = vis[i].mk, x = vis[i].x
      ctx.save()
      ctx.font = '700 11px Poppins, sans-serif'
      const tw = ctx.measureText(mk.label).width, bw = tw + 12, bh = 20
      let bx = Math.min(x + 6, area.right - bw - 2)
      if (bx < area.left + 2) bx = area.left + 2
      const by = area.top + 6 + row++ * (bh + 6)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = mk.color
      ctx.lineWidth = 1.4
      ctx.setLineDash([])
      ctx.strokeRect(bx, by, bw, bh)
      ctx.fillStyle = mk.color
      ctx.textBaseline = 'middle'
      ctx.fillText(mk.label, bx + 6, by + bh / 2)
      ctx.restore()
    }
  }
}

const axisTitle = (text, color) => ({ display: true, text, color: color || CONFIG.COLORS.text, font: { size: 12, weight: 700 } })
const axisTicks = () => ({ color: CONFIG.COLORS.text, font: { size: 11, weight: 600 } })
const gridColor = () => ({ color: CONFIG.COLORS.grid })

export const destroyCharts = () => {
  const keys = ['inv', 'bay', 'disp', 'prob']
  for (let i = 0; i < keys.length; i++) {
    if (state.charts && state.charts[keys[i]]) { state.charts[keys[i]].destroy(); state.charts[keys[i]] = null }
  }
}

export const buildCharts = () => {
  state.charts = state.charts || {}
  state.charts.inv = new Chart($('invChart').getContext('2d'), {
    type: 'scatter',
    plugins: [tofLabelPlugin, crosshairPlugin],
    data: {
      datasets: [
        { label: 'Raw Inv. Vel.', data: [], backgroundColor: CONFIG.COLORS.raw, pointRadius: 1.8, showLine: false },
        { label: 'SMA-7 Inv.', data: [], borderColor: CONFIG.COLORS.sma, borderWidth: 2.2, pointRadius: 0, showLine: true, tension: 0, fill: false },
        { label: 'Reg W1', data: [], borderColor: CONFIG.WINDOW_COLORS[0], borderWidth: 1.8, borderDash: [6, 4], pointRadius: 0, showLine: true, fill: false },
        { label: 'Reg W2', data: [], borderColor: CONFIG.WINDOW_COLORS[1], borderWidth: 1.8, borderDash: [6, 4], pointRadius: 0, showLine: true, fill: false },
        { label: 'Reg W3', data: [], borderColor: CONFIG.WINDOW_COLORS[2], borderWidth: 1.8, borderDash: [6, 4], pointRadius: 0, showLine: true, fill: false }
      ]
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', title: axisTitle('Time (hours from start)'), grid: gridColor(), ticks: axisTicks() },
        y: { min: 0, title: axisTitle('Inverse Velocity [h/mm]'), grid: gridColor(), ticks: axisTicks() }
      },
      plugins: {
        legend: { labels: { color: CONFIG.COLORS.text, font: { size: 11, weight: 700 } } },
        tooltip: { callbacks: { title: items => items.length && items[0].chart.$startTime ? fmtDateTime(new Date(items[0].chart.$startTime + items[0].parsed.x * 3600000)) : '' } }
      }
    }
  })

  state.charts.bay = new Chart($('bayChart').getContext('2d'), {
    type: 'scatter',
    plugins: [tofLabelPlugin, crosshairPlugin],
    data: {
      datasets: [
        { label: 'Observed (R, t)', data: [], backgroundColor: CONFIG.COLORS.raw, pointRadius: 2, showLine: false },
        { label: 'Posterior Mean Fit', data: [], borderColor: CONFIG.COLORS.bayesian, borderWidth: 2, pointRadius: 0, showLine: true, fill: false },
        { label: '95% CrI Upper', data: [], borderColor: 'rgba(8,145,178,0.4)', borderWidth: 1, pointRadius: 0, showLine: true, fill: { target: 3 }, backgroundColor: 'rgba(8,145,178,0.12)' },
        { label: '95% CrI Lower', data: [], borderColor: 'rgba(8,145,178,0.4)', borderWidth: 1, pointRadius: 0, showLine: true, fill: false },
        { label: 'Predicted ToF (tf)', data: [], borderColor: CONFIG.COLORS.danger, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, showLine: true, fill: false }
      ]
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { min: 0, title: axisTitle('Inverse Velocity R (h/mm)'), grid: gridColor(), ticks: axisTicks() },
        y: {
          title: axisTitle('Time'), grid: gridColor(),
          ticks: Object.assign({}, axisTicks(), {
            callback: function (v) { const st = this.chart.$startTime; return st ? fmtDateTime(new Date(st + v * 3600000)).slice(5, 16) : v }
          })
        }
      },
      plugins: {
        legend: { labels: { color: CONFIG.COLORS.text, font: { size: 11, weight: 700 }, filter: item => item.datasetIndex !== 2 && item.datasetIndex !== 3 } },
        tooltip: {
          callbacks: {
            title: items => { const raw = items.length && items[0].raw; return raw && raw.tMs ? fmtDateTime(new Date(raw.tMs)) : 'Bayesian Adaptation' },
            label: ctx => ctx.dataset.label + ': R=' + fmtNum(ctx.parsed.x, 3) + ', t=' + fmtDateTime(new Date(ctx.chart.$startTime + ctx.parsed.y * 3600000))
          }
        }
      }
    }
  })

  state.charts.disp = new Chart($('dispChart').getContext('2d'), {
    type: 'line',
    plugins: [crosshairPlugin],
    data: {
      datasets: [
        { label: 'Disp (mm)', data: [], borderColor: CONFIG.COLORS.disp, borderWidth: 2, pointRadius: 0, yAxisID: 'y', tension: 0 },
        { label: 'Vel (mm/h)', data: [], borderColor: CONFIG.COLORS.vel, borderWidth: 1.8, pointRadius: 0, yAxisID: 'y1', tension: 0 },
        { label: 'Accel (mm/h2)', data: [], borderColor: CONFIG.COLORS.accel, borderWidth: 1, pointRadius: 0, yAxisID: 'y2', tension: 0 },
        { label: 'Accel SMA-5', data: [], borderColor: CONFIG.COLORS.accelSma, borderWidth: 1.8, pointRadius: 0, yAxisID: 'y2', tension: 0 }
      ]
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { type: 'linear', title: axisTitle('Time (hours)'), grid: gridColor(), ticks: axisTicks() },
        y: { position: 'left', title: axisTitle('mm', CONFIG.COLORS.disp), grid: gridColor(), ticks: axisTicks() },
        y1: { position: 'right', title: axisTitle('mm/h', CONFIG.COLORS.vel), grid: { display: false }, ticks: axisTicks() },
        y2: { position: 'right', title: axisTitle('mm/h2', CONFIG.COLORS.accelSma), grid: { display: false }, ticks: axisTicks() }
      },
      plugins: {
        legend: { labels: { color: CONFIG.COLORS.text, font: { size: 11, weight: 700 } } },
        tooltip: { callbacks: { title: items => items.length && items[0].chart.$startTime ? fmtDateTime(new Date(items[0].chart.$startTime + items[0].parsed.x * 3600000)) : '' } }
      }
    }
  })

  state.charts.prob = new Chart($('probChart').getContext('2d'), {
    type: 'line',
    plugins: [crosshairPlugin],
    data: {
      datasets: [
        { label: 'Fukuzono (Normal CDF)', data: [], borderColor: CONFIG.COLORS.sma, borderWidth: 2, pointRadius: 0, tension: 0.2, showLine: true, spanGaps: true },
        { label: 'Bayesian (Student-t CDF)', data: [], borderColor: CONFIG.COLORS.bayesian, borderWidth: 2, pointRadius: 0, tension: 0.2, showLine: true, spanGaps: true },
        { label: 'Horizon', data: [], borderColor: CONFIG.COLORS.text, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, showLine: true, fill: false, spanGaps: true }
      ]
    },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { type: 'linear', min: 0, max: CONFIG.HORIZON_MAX, title: axisTitle('Horizon from now (hours)'), grid: gridColor(), ticks: { color: CONFIG.COLORS.text, font: { size: 11, weight: 600 }, stepSize: 6 } },
        y: { min: 0, max: 100, title: axisTitle('Probability of Failure (%)'), grid: gridColor(), ticks: { color: CONFIG.COLORS.text, font: { size: 11, weight: 600 }, stepSize: 10 } }
      },
      plugins: {
        legend: { labels: { color: CONFIG.COLORS.text, font: { size: 11, weight: 700 } } },
        tooltip: { callbacks: { title: items => items.length && items[0].chart.$latestMs ? fmtDateTime(new Date(items[0].chart.$latestMs + items[0].parsed.x * 3600000)) : '', label: ctx => ctx.dataset.label + ': ' + fmtNum(ctx.parsed.y, 1) + '% @ +' + fmtNum(ctx.parsed.x, 0) + 'h' } }
      }
    }
  })
}

export const updateCharts = (data, fukRes, bayRes, fukCons, bayCons, th, latestHours) => {
  if (!state.charts || !state.charts.inv) return
  const startTime = state.startTime, lastTime = data[data.length - 1].time, lastX = (lastTime.getTime() - startTime) / 3600000
  state.charts.inv.$startTime = startTime
  state.charts.bay.$startTime = startTime
  state.charts.disp.$startTime = startTime

  const invSma = computeSma(data.map(d => d.inv), 7), invPts = [], invSmPts = []
  for (let i = 0; i < data.length; i++) {
    const hx = (data[i].time.getTime() - startTime) / 3600000
    if (data[i].inv !== null) invPts.push({ x: hx, y: data[i].inv })
    if (invSma[i] !== null) invSmPts.push({ x: hx, y: invSma[i] })
  }
  state.charts.inv.data.datasets[0].data = invPts
  state.charts.inv.data.datasets[1].data = invSmPts

  const markers = []
  let xMax = lastX
  for (let w = 0; w < 3; w++) {
    const f = fukRes[w], reg = []
    if (f && f.slope !== undefined && f.x0 !== undefined) {
      const xStart = (f.x0 - startTime) / 3600000, xEnd = f.valid ? (f.failTime.getTime() - startTime) / 3600000 : lastX
      if (xEnd > xStart) {
        for (let j = 0; j <= 60; j++) {
          const x = xStart + (xEnd - xStart) * (j / 60)
          const y = Math.max(0, f.slope * (x - (f.x0 - startTime) / 3600000) + f.intercept)
          reg.push({ x, y })
        }
      }
      if (f.valid) {
        const xf = (f.failTime.getTime() - startTime) / 3600000
        if (xf > xMax) xMax = xf
        markers.push({ x: xf, ds: 2 + w, color: CONFIG.WINDOW_COLORS[w], label: 'ToF Fukuzono W' + (w + 1) + ': ' + fmtDateTime(f.failTime) })
      }
    }
    state.charts.inv.data.datasets[2 + w].data = reg
    state.charts.inv.data.datasets[2 + w].label = 'Reg W' + (w + 1) + ' (' + [th.win1, th.win2, th.win3][w] + ' min, R²=' + (f ? fmtNum(f.r2, 3) : '--') + ')'
  }
  state.charts.inv.$tofMarkers = markers
  state.charts.inv.options.scales.x.max = xMax * 1.02
  let yMaxData = 0
  for (let ds = 0; ds < state.charts.inv.data.datasets.length; ds++) {
    const dArr = state.charts.inv.data.datasets[ds].data
    for (let q = 0; q < dArr.length; q++) { const yy = dArr[q].y; if (isFinite(yy) && yy > yMaxData) yMaxData = yy }
  }
  state.charts.inv.options.scales.y.max = Math.max(1, yMaxData * 1.1)
  state.charts.inv.update('none')

  const bayObs = [], bayFit = [], bayUp = [], bayLo = [], bayTfLine = []
  let bayXMax = 0
  for (let w = 0; w < 3; w++) {
    const b = bayRes[w]
    if (b && b.valid && b.Rs && b.Rs.length > 0) {
      let rMin = Infinity, rMax = -Infinity
      for (let i = 0; i < b.Rs.length; i++) { if (b.Rs[i] < rMin) rMin = b.Rs[i]; if (b.Rs[i] > rMax) rMax = b.Rs[i] }
      if (rMax > bayXMax) bayXMax = rMax
      for (let i = 0; i < b.Rs.length; i++) bayObs.push({ x: b.Rs[i], y: b.ys[i], tMs: b.Rts ? b.Rts[i] : null })
      for (let j = 0; j <= 25; j++) {
        const R = rMin + (rMax - rMin) * (j / 25), fitY = b.beta0 + b.beta1 * R
        const seMean = Math.sqrt(b.s2 * (1 / b.points + Math.pow(R - b.rbar, 2) / b.SxxR))
        bayFit.push({ x: R, y: fitY })
        if (b.tCrit !== null) { bayUp.push({ x: R, y: fitY + b.tCrit * seMean }); bayLo.push({ x: R, y: fitY - b.tCrit * seMean }) }
      }
      bayTfLine.push({ x: 0, y: b.beta0 }, { x: rMax, y: b.beta0 })
      break
    }
  }
  state.charts.bay.data.datasets[0].data = bayObs
  state.charts.bay.data.datasets[1].data = bayFit
  state.charts.bay.data.datasets[2].data = bayUp
  state.charts.bay.data.datasets[3].data = bayLo
  state.charts.bay.data.datasets[4].data = bayTfLine
  state.charts.bay.options.scales.x.max = bayXMax * 1.1 || 10
  state.charts.bay.update('none')

  const rawAcc = data.map(d => d.accel), accSma = computeSma(rawAcc, 5), dPts = [], vPts = [], aPts = [], asPts = []
  for (let i = 0; i < data.length; i++) {
    const hx2 = (data[i].time.getTime() - startTime) / 3600000
    dPts.push({ x: hx2, y: data[i].disp })
    vPts.push({ x: hx2, y: data[i].vel })
    aPts.push({ x: hx2, y: rawAcc[i] })
    asPts.push({ x: hx2, y: accSma[i] })
  }
  state.charts.disp.data.datasets[0].data = dPts
  state.charts.disp.data.datasets[1].data = vPts
  state.charts.disp.data.datasets[2].data = aPts
  state.charts.disp.data.datasets[3].data = asPts
  state.charts.disp.update('none')

  const latestMs = lastTime.getTime()
  const fukOk = !!(fukCons && fukCons.valid), bayOk = !!(bayCons && bayCons.valid)
  const remF = fukOk ? (fukCons.failTime.getTime() - latestMs) / 3600000 : 0
  const seF = fukOk && fukCons.seTf !== null && fukCons.seTf > 0 ? fukCons.seTf : null
  const seB = bayOk && bayCons.seTf !== null && bayCons.seTf > 0 ? bayCons.seTf : null
  const fukCurve = [], bayCurve = []
  for (let h = 0; h <= CONFIG.HORIZON_MAX; h++) {
    fukCurve.push({ x: h, y: fukOk ? (seF ? normCdf((h - remF) / seF) * 100 : remF <= h ? 100 : 0) : 0 })
    bayCurve.push({ x: h, y: bayOk ? (seB && bayCons.nu > 0 ? studentTCdf((latestHours + h - bayCons.beta0) / seB, bayCons.nu) * 100 : bayCons.beta0 <= latestHours + h ? 100 : 0) : 0 })
  }
  state.charts.prob.data.datasets[0].data = fukCurve
  state.charts.prob.data.datasets[1].data = bayCurve
  state.charts.prob.data.datasets[0].label = fukOk ? 'Fukuzono (Normal CDF)' : 'Fukuzono (no active prediction)'
  state.charts.prob.data.datasets[1].label = bayOk ? 'Bayesian (Student-t CDF)' : 'Bayesian (no active prediction)'
  const hz = th.horizon
  state.charts.prob.data.datasets[2].data = [{ x: hz, y: 0 }, { x: hz, y: 100 }]
  state.charts.prob.$latestMs = latestMs
  state.charts.prob.update('none')
}

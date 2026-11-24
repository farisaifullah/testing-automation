import { $ } from '../core/dom.js'
import { state } from '../core/state.js'
import { fmtNum, fmtDateTime, fmtHM, fmtCountdown } from '../core/format.js'
import { fukProb, bayProb } from '../core/math.js'
import { getThresholds } from '../dashboard/thresholds.js'
import { analysisView } from '../dashboard/filter.js'
import { enableButton } from '../dashboard/modal.js'
import { chartToImage } from './chart-png.js'
import { PAGE, imgH, tableH, sanitize, ensure, section, subTitle, addImage, addTable } from './pdf-kit.js'

const INK = [17, 17, 17]
const GREY = [70, 70, 70]
const SOFT = [90, 90, 90]

const setText = (pdf, font, size, color) => {
  pdf.setFont('helvetica', font)
  pdf.setFontSize(size)
  pdf.setTextColor(color[0], color[1], color[2])
}

const remaining = (cons, latestMs) => fmtCountdown((cons.failTime.getTime() - latestMs) / 3600000)
const ciRange = o => (o && o.ciLowTime ? fmtHM(o.ciLowTime) + '-' + fmtHM(o.ciHighTime) : '--')
const pct = p => (p !== null ? (p * 100).toFixed(1) + '%' : '--')

const drawHeader = (pdf, st, r) => {
  setText(pdf, 'bold', 16, INK)
  pdf.text('SLOPE RADAR MONITOR - LAPORAN ANALISIS LERENG', PAGE.m, st.y + 6)
  st.y += 11
  setText(pdf, 'normal', 9, GREY)
  pdf.text('File: ' + state.fileName + (state.edited ? ' (edited)' : '') + '   |   Dibuat: ' + fmtDateTime(new Date()), PAGE.m, st.y + 3)
  st.y += 6
  pdf.text('Metode: Fukuzono (1985) + Bayesian Adapted   |   Status alert: ' + r.status, PAGE.m, st.y + 3)
  st.y += 7
  pdf.setLineWidth(0.8)
  pdf.setDrawColor(INK[0], INK[1], INK[2])
  pdf.line(PAGE.m, st.y, PAGE.m + PAGE.cw, st.y)
  st.y += 7
}

const kpiCards = (r, th, latestMs) => {
  const l = r.latest
  const live = r.overall && r.overall.valid
  return [
    ['DISPLACEMENT', fmtNum(l.disp, 2) + ' mm', fmtDateTime(l.time)],
    ['VELOCITY', fmtNum(l.vel, 3) + ' mm/h', l.vel > th.velDanger ? 'DANGER' : l.vel > th.velWarn ? 'WARNING' : 'OK'],
    ['INVERSE VELOCITY', (l.inv === null ? '--' : fmtNum(l.inv, 3)) + ' h/mm', l.inv !== null && l.inv < th.invCrit ? 'CRITICAL' : 'OK'],
    ['ACCELERATION', fmtNum(l.accel, 3) + ' mm/h2', l.accel > 0 ? 'INCREASING' : 'DECREASING'],
    ['CONSENSUS ToF', live ? remaining(r.overall, latestMs) : 'STABLE', live ? fmtDateTime(r.overall.failTime) : 'no consensus']
  ]
}

const drawKpis = (pdf, st, r, th, latestMs) => {
  section(pdf, st, '1. KEY PERFORMANCE INDICATORS', 30)
  const w = (PAGE.cw - 4 * 3) / 5
  kpiCards(r, th, latestMs).forEach((card, i) => {
    const x = PAGE.m + i * (w + 3)
    pdf.setDrawColor(150, 150, 150)
    pdf.setLineWidth(0.3)
    pdf.rect(x, st.y, w, 22)
    setText(pdf, 'bold', 6.5, SOFT)
    pdf.text(card[0], x + 2, st.y + 5)
    setText(pdf, 'bold', 11, INK)
    pdf.text(card[1], x + 2, st.y + 12)
    setText(pdf, 'normal', 6.5, SOFT)
    pdf.text(card[2], x + 2, st.y + 18)
  })
  st.y += 28
}

const drawConsensus = (pdf, st, r, latestMs) => {
  const rightX = PAGE.m + 72, rightW = PAGE.cw - 76
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  const groups = ['tbMeta', 'tbLatest', 'agreeLine'].map(id => pdf.splitTextToSize(sanitize($(id).textContent), rightW))
  const lineCount = groups.reduce((n, g) => n + g.length, 0)
  const boxH = Math.max(20, 11 + lineCount * 4.0)
  const live = r.overall && r.overall.valid
  section(pdf, st, '2. CONSENSUS TIME OF FAILURE', boxH + 6)
  pdf.setLineWidth(0.6)
  pdf.setDrawColor(INK[0], INK[1], INK[2])
  pdf.rect(PAGE.m, st.y, PAGE.cw, boxH)
  setText(pdf, 'bold', 13, INK)
  pdf.text(live ? fmtDateTime(r.overall.failTime) : 'NO ACTIVE PREDICTION', PAGE.m + 3, st.y + 9)
  setText(pdf, 'normal', 8, GREY)
  pdf.text('Remaining: ' + (live ? remaining(r.overall, latestMs) : '--'), PAGE.m + 3, st.y + 15)
  setText(pdf, 'normal', 7.5, GREY)
  let y = st.y + 6
  groups.forEach(lines => {
    lines.forEach(line => {
      pdf.text(line, rightX, y)
      y += 4.0
    })
    y += 1.5
  })
  st.y += boxH + 6
}

const drawChartSections = (pdf, st, imgs) => {
  const items = [
    ['3. FUKUZONO INVERSE VELOCITY', imgs.inv, 'Raw inverse velocity, SMA-7, regresi 3 window + marker ToF', 5],
    ['4. BAYESIAN ADAPTATION', imgs.bay, 'Observed (R,t), posterior mean fit, 95% CrI, predicted ToF', 5],
    ['5. DISPLACEMENT, VELOCITY & ACCELERATION', imgs.disp, null, 0],
    ['6. PROBABILITY OF FAILURE (HORIZON)', imgs.prob, null, 0]
  ]
  items.forEach(([title, img, caption, extra]) => {
    section(pdf, st, title, extra + imgH(img) + 6)
    addImage(pdf, st, img, caption)
  })
}

const fukRows = (r, th, latestMs) => r.fukRes.map((f, i) => [
  'W' + (i + 1) + ' (' + [th.win1, th.win2, th.win3][i] + 'm)', f.points, fmtNum(f.slope, 5), fmtNum(f.intercept, 4), fmtNum(f.r2, 3), fmtNum(f.seTf, 2),
  f.valid ? fmtDateTime(f.failTime) : '--', f.valid ? remaining(f, latestMs) : '--', ciRange(f), pct(fukProb(f, latestMs, th.horizon)), f.reason
])

const bayRows = (r, th, latestH) => r.bayRes.map((b, i) => [
  'W' + (i + 1) + ' (' + [th.win1, th.win2, th.win3][i] + 'm)', b.points, fmtNum(b.B, 4), fmtNum(b.r2, 3),
  b.valid ? fmtDateTime(b.failTime) : '--', ciRange(b), pct(bayProb(b, latestH, th.horizon)), b.reason
])

const fukFoot = (c, th, latestMs) => c && c.valid
  ? ['CONSENSUS', '', fmtNum(c.slope, 5), fmtNum(c.intercept, 4), fmtNum(c.r2, 3), fmtNum(c.seTf, 2), fmtDateTime(c.failTime), remaining(c, latestMs), ciRange(c), pct(fukProb(c, latestMs, th.horizon)), 'Fukuzono']
  : null

const bayFoot = (c, th, latestH) => c && c.valid
  ? ['CONSENSUS', '', fmtNum(c.B, 4), fmtNum(c.r2, 3), fmtDateTime(c.failTime), ciRange(c), pct(bayProb(c, latestH, th.horizon)), 'Bayesian']
  : null

const drawTables = (pdf, st, r, th, latestMs, latestH) => {
  const fRows = fukRows(r, th, latestMs), fFoot = fukFoot(r.fukCons, th, latestMs)
  const bRows = bayRows(r, th, latestH), bFoot = bayFoot(r.bayCons, th, latestH)
  section(pdf, st, '7. CALCULATION TABLES', 5 + tableH(fRows, fFoot) + 4)
  subTitle(pdf, st, 'Fukuzono Inverse Velocity (a=2)')
  addTable(pdf, st, ['Window', 'Pts', 'Slope', 'Intercept', 'R2', 'SE(h)', 'Predicted ToF', 'Remaining', '95% CI', 'P(fail<=H)', 'Status'],
    fRows, [0.1, 0.04, 0.08, 0.08, 0.06, 0.06, 0.17, 0.09, 0.1, 0.09, 0.13], fFoot)
  ensure(pdf, st, 5 + tableH(bRows, bFoot) + 4)
  subTitle(pdf, st, 'Bayesian Regression (Adapted)')
  addTable(pdf, st, ['Window', 'n', 'B', 'R2', 'Predicted ToF', '95% CrI', 'P(fail<=H)', 'Status'],
    bRows, [0.13, 0.05, 0.09, 0.08, 0.24, 0.15, 0.12, 0.14], bFoot)
}

const drawReferences = (pdf, st, refA, refC) => {
  section(pdf, st, '8. REFERENCE CHARTS', 5 + imgH(refA) + 6)
  addImage(pdf, st, refA, 'Overlay displacement & velocity')
  section(pdf, st, '9. PREDIKSI KELONGSORAN (INVERSE VELOCITY FORECAST)', 5 + imgH(refC) + 6)
  const basis = state.filter.mode === 'none' ? '10 titik terakhir' : analysisView().length + ' titik hasil filter'
  addImage(pdf, st, refC, 'Regresi linier ' + basis + ' + garis ToF')
}

const drawFooter = (pdf, st) => {
  ensure(pdf, st, 12)
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(150, 150, 150)
  pdf.line(PAGE.m, st.y, PAGE.m + PAGE.cw, st.y)
  st.y += 5
  setText(pdf, 'normal', 7, SOFT)
  pdf.text('R&D prototype. AI Vision extraction + Dual-method ToF viewer. Not for operational use without geotechnical validation.', PAGE.m, st.y + 3)
}

const drawAiReport = pdf => {
  if (!state.aiReportText) return
  pdf.addPage()
  let y = 16
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('LAPORAN ANALISIS AI', 14, y)
  y += 8
  String(state.aiReportText).replace(/\*\*|\*|`/g, '').split('\n').forEach(line => {
    const isHead = /^#{1,6}\s/.test(line)
    const clean = line.replace(/^#{1,6}\s*/, '').trim()
    if (!clean) { y += 3; return }
    pdf.setFont('helvetica', isHead ? 'bold' : 'normal')
    pdf.setFontSize(isHead ? 11 : 9)
    pdf.splitTextToSize(clean, 180).forEach(wrapped => {
      if (y > 285) { pdf.addPage(); y = 16 }
      pdf.text(wrapped, 14, y)
      y += isHead ? 5.5 : 4.5
    })
    if (isHead) y += 1.5
  })
}

export const buildPdfDoc = () => {
  const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const st = { y: PAGE.m }
  const r = state.lastResults
  const th = getThresholds()
  const latestMs = r.latest.time.getTime()
  const latestH = (latestMs - state.startTime) / 3600000
  const imgs = {
    inv: chartToImage(state.charts.inv), bay: chartToImage(state.charts.bay),
    disp: chartToImage(state.charts.disp), prob: chartToImage(state.charts.prob)
  }
  drawHeader(pdf, st, r)
  drawKpis(pdf, st, r, th, latestMs)
  drawConsensus(pdf, st, r, latestMs)
  drawChartSections(pdf, st, imgs)
  drawTables(pdf, st, r, th, latestMs, latestH)
  drawReferences(pdf, st, chartToImage(state.refChartA), chartToImage(state.refChartC))
  drawFooter(pdf, st)
  drawAiReport(pdf)
  return pdf
}

const chartsReady = () => ['inv', 'bay', 'disp', 'prob'].every(k => state.charts[k])

export const savePdf = () => {
  if (!state.loaded || !state.lastResults) return
  if (!window.jspdf || !window.jspdf.jsPDF) return alert('Library jsPDF belum dimuat. Cek koneksi/CDN.')
  if (!chartsReady()) return
  try {
    const pdf = buildPdfDoc()
    pdf.save(state.fileName.replace(/\.(csv|tsv|txt|xls|xlsx)$/i, '') + '.pdf')
  } catch (err) {
    console.error('[PDF] ERROR:', err)
    alert('Gagal membuat PDF: ' + err.message)
  }
}

export function initPdf () {
  enableButton('btnSavePdf')
  $('btnSavePdf').addEventListener('click', savePdf)
}

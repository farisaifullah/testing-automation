import { $, setMessage, esc } from '../core/dom.js'
import { state } from '../core/state.js'
import { CONFIG } from '../core/config.js'
import { on } from '../core/bus.js'
import { loadIntoDashboard } from '../dashboard/dashboard.js'
import { askClaude, userMessage, VISION_MODEL } from './claude.js'
import { VISION_SYSTEM } from './vision-prompt.js'
import { readNameFallback } from './vision-name.js'
import { toNum, domainOkBySeries, parseVisionJson, rowsToPoints } from './vision-data.js'
import { checkVisionData } from './vision-check.js'
import { loadPixels } from './vision-trace.js'
import { normalizeCal, buildCalibration } from './vision-calib.js'
import { traceAll } from './vision-pipeline.js'
import { renderCalTable, drawOverlay, saveCsv, saveXlsx } from './vision-ui.js'

const MIN_WIDTH = 300
const MIN_HEIGHT = 200

const vision = { seq: 0, image: null, label: '', extracted: null, stats: null, notes: '', running: false, pixels: null, cal: null, result: null, confidence: '' }

const say = (text, isError) => setMessage('visionMsg', text, isError)


const renderCheck = () => {
  if (!vision.extracted) return []
  const check = checkVisionData(vision.extracted.data, vision.stats)
  const res = vision.result || { warnings: [], info: [] }
  const issues = check.issues.concat(res.warnings), info = check.info.concat(res.info)
  const lines = info.map(esc).concat(issues.map(x => '<span class="vc-issue">' + esc(x) + '</span>'))
  if (vision.notes) lines.push('Catatan AI: ' + esc(vision.notes))
  const box = $('visionCheck')
  box.className = 'vision-check ' + (issues.length ? 'warn' : 'good')
  box.innerHTML = lines.join('<br>')
  return issues
}

const cellInput = (type, value, i, col) =>
  '<td><input type="' + type + '"' + (type === 'number' ? ' step="0.0001"' : '') + ' value="' + esc(value === null ? '' : value) +
  '" data-idx="' + i + '" data-col="' + col + '" aria-label="' + col + ' baris ' + (i + 1) + '"></td>'

const renderTable = () => {
  const rows = vision.extracted.data
  $('visionTbody').innerHTML = rows.map((r, i) =>
    '<tr' + (r.filled ? ' class="row-filled" title="Diisi interpolasi (kurva tak terdeteksi di titik ini)"' : '') + '><td>' + (i + 1) + '</td>' + cellInput('text', r.time, i, 'time') + cellInput('number', r.disp, i, 'disp') +
    cellInput('number', r.vel, i, 'vel') + cellInput('number', r.accel, i, 'accel') +
    '<td><button type="button" class="btn-delete" data-idx="' + i + '">Hapus</button></td></tr>').join('')
  $('visionCount').textContent = rows.length + ' baris'
  $('visionResult').hidden = false
  return renderCheck()
}

const resetResult = () => {
  vision.seq++
  vision.pendingApply = false
  vision.running = false
  vision.extracted = null
  vision.stats = null
  vision.notes = ''
  vision.cal = null
  vision.result = null
  vision.pixels = null
  $('visionResult').hidden = true
  $('visionTbody').innerHTML = ''
  $('btnExtract').disabled = false
  say('')
}

const cleanLoc = s => String(s || '').trim().replace(/_\d{8}(_\d+)?$/, '').replace(/[\\/:*?"<>|]+/g, '_')

/** Nama wilayah hanya dari teks di gambar atau isian pengguna; nama file tidak dipakai. */
const syncLoc = () => {
  const inp = $('visionLoc')
  if (!inp) return
  inp.value = vision.label
  const missing = !vision.label
  $('visionLocBox').classList.toggle('missing', missing)
  $('visionLocHint').textContent = missing ? 'Tidak terbaca di gambar. Wajib diisi sebelum analisis.' : (vision.locFromImage ? 'Terbaca dari gambar (bisa diubah).' : 'Diisi manual.')
}

const needName = () => {
  syncLoc()
  say('Nama wilayah belum ada. Isi kolom Nama wilayah dulu, lalu analisis dijalankan.', true)
  const inp = $('visionLoc')
  if (inp) { inp.scrollIntoView({ block: 'center' }); inp.focus() }
}

const applyToDashboard = () => {
  const pts = rowsToPoints(vision.extracted.data)
  if (pts.length < CONFIG.MIN_POINTS) return false
  if (!vision.label) return false
  state.locationLabel = vision.label
  loadIntoDashboard(pts, vision.label + ' (AI)')
  return true
}

const validateResponse = obj => {
  if (!obj) throw new Error('Format respons AI tidak valid.')
  // Bila model sudah mengenali seri displacement/velocity/accel, chart dianggap valid (domain tidak diblokir oleh label chart_type).
  const hasSeries = Array.isArray(obj.series) && obj.series.some(s => s && ['disp', 'vel', 'accel'].includes(s.kind))
  if (hasSeries) return
  const wrongDomain = () => new Error('Gambar bukan chart monitoring radar lereng (domain tidak valid).' + (obj.reason ? ' — ' + obj.reason : ''))
  if (obj.chart_type && obj.chart_type !== 'slope_radar') throw wrongDomain()
  const blob = (Array.isArray(obj.series_found) ? obj.series_found.join(' ') : '') + ' ' + String(obj.chart_text || '') + ' ' + String(obj.location || '')
  if (!domainOkBySeries(obj.series_found) && !domainOkBySeries([blob])) throw wrongDomain()
}

const acceptResponse = obj => {
  vision.stats = obj.stats_read || {}
  vision.notes = obj.notes || ''
  vision.confidence = obj.confidence || ''
  vision.label = cleanLoc(obj.location)
  vision.locFromImage = !!vision.label
  syncLoc()
}

/** Lacak kurva dari piksel memakai kalibrasi yang ada (lokal, tanpa API). */
const runTrace = async () => {
  if (!vision.pixels) vision.pixels = await loadPixels(vision.image)
  const res = traceAll(vision.pixels, vision.cal)
  vision.result = res
  vision.extracted = { data: res.rows }
  const issues = renderTable()
  renderCalTable(vision.cal, res.calib.ticks)
  drawOverlay(vision.image, res)
  return issues
}

const unreadableMsg = obj => 'Label sumbu tidak terbaca jelas, jadi tidak ada data yang dibuat (tidak ditebak).' + (obj.reason ? ' ' + obj.reason : '') + ' Gunakan screenshot yang lebih besar/jelas dan pastikan label waktu serta displacement terlihat.'

/** Label waktu tidak terbaca: minta pengguna mengisi waktu awal dan akhir (dua baris X) di tabel kalibrasi. */
const askManualTime = async () => {
  const p = vision.cal.plot
  vision.cal.xTicks = [{ px: p.left, text: '' }, { px: p.right, text: '' }]
  if (!vision.pixels) vision.pixels = await loadPixels(vision.image)
  const calib = buildCalibration(vision.pixels, vision.cal)
  vision.result = null
  vision.extracted = null
  $('visionTbody').innerHTML = ''
  $('visionCount').textContent = ''
  const box = $('visionCheck')
  box.className = 'vision-check warn'
  box.textContent = 'Waktu pada sumbu X tidak terbaca jelas. Isi waktu awal dan waktu akhir kurva pada dua baris X di tabel kalibrasi (format YYYY-MM-DD HH:MM:SS); tabel data dihitung otomatis. Sumbu Y sudah terbaca dan bisa diperiksa pada overlay.'
  $('visionResult').hidden = false
  renderCalTable(vision.cal, calib.ticks)
  drawOverlay(vision.image, { calib, series: [] })
}

/** Koordinat dari AI mengacu pada salinan AI (maks 1568 px); petakan ke piksel versi HD yang dipakai pelacakan. */
const toHdCoords = (obj, img) => {
  const kx = img.aiWidth ? img.width / img.aiWidth : 1, ky = img.aiHeight ? img.height / img.aiHeight : 1
  if (Math.abs(kx - 1) < 1e-6 && Math.abs(ky - 1) < 1e-6) return obj
  const m = (v, k) => (typeof v === 'number' && isFinite(v) ? v * k : v)
  const out = JSON.parse(JSON.stringify(obj))
  if (out.plot_area) { out.plot_area.left = m(out.plot_area.left, kx); out.plot_area.right = m(out.plot_area.right, kx); out.plot_area.top = m(out.plot_area.top, ky); out.plot_area.bottom = m(out.plot_area.bottom, ky) }
  if (out.x_axis && Array.isArray(out.x_axis.ticks)) out.x_axis.ticks.forEach(t => { t.px = m(t.px, kx) })
  if (Array.isArray(out.y_axes)) out.y_axes.forEach(a => (a.ticks || []).forEach(t => { t.py = m(t.py, ky) }))
  return out
}

const extract = async () => {
  const img = vision.image
  if (vision.running) return
  if (!img) return say('Unggah screenshot terlebih dahulu.', true)
  if ((img.srcWidth || img.width) < MIN_WIDTH || (img.srcHeight || img.height) < MIN_HEIGHT) return say('Resolusi gambar terlalu kecil untuk dianalisis (minimal 300×200).', true)
  vision.running = true
  $('btnExtract').disabled = true
  const seq = vision.seq
  $('visionResult').hidden = true
  say('Membaca sumbu dan label gambar…')
  const content = [
    { type: 'image', source: { type: 'base64', media_type: img.aiMediaType || img.mediaType, data: img.aiBase64 || img.base64 } },
    ...((img.aiCrops || []).map(c => ({ type: 'image', source: { type: 'base64', media_type: c.mediaType, data: c.base64 } }))),
    { type: 'text', text: 'Ukuran gambar: ' + (img.aiWidth || img.width) + ' x ' + (img.aiHeight || img.height) + ' px (gambar 1, acuan semua posisi).' + ((img.aiCrops || []).length ? '\nGambar 2 dan 3 = potongan label sumbu X dari bagian bawah gambar 1 (' + img.aiCrops.map((c, i) => 'gambar ' + (i + 2) + ': x ' + c.xFrom + '-' + c.xTo + '%, y ' + c.yFrom + '-100%' + (c.deskew ? ', diluruskan dan dikontraskan, hanya ujung sumbu' : '')).join('; ') + ') hanya untuk membaca jam dan menit label sumbu X; jangan ambil posisi dari potongan.' : '') + '\nBaca KALIBRASI sumbu sesuai ATURAN. Output HANYA JSON.' }
  ]
  try {
    const text = await askClaude({ system: VISION_SYSTEM, messages: userMessage(content), temperature: null, maxTokens: 4000, model: VISION_MODEL })
    if (seq !== vision.seq) return
    const obj = parseVisionJson(text)
    validateResponse(obj)
    acceptResponse(obj)
    if (!vision.label) {
      say('Nama wilayah tidak terbaca, membaca ulang bagian header…')
      const nm = await readNameFallback(img)
      if (seq !== vision.seq) return
      if (nm) { vision.label = cleanLoc(nm); vision.locFromImage = true; syncLoc() }
    }
    vision.cal = normalizeCal(toHdCoords(obj, img), img)
    const hasY = Object.keys(vision.cal.yAxes).some(id => vision.cal.yAxes[id].ticks.length >= 2) && vision.cal.series.length > 0
    if (vision.cal.xTicks.length < 2 && !vision.cal.range && !hasY) throw new Error(unreadableMsg(obj))
    if (vision.cal.xTicks.length < 2 && !vision.cal.range) {
      await askManualTime()
      say('Sumbu waktu tidak terbaca. Isi waktu pada tabel kalibrasi.')
    } else {
      say('Melacak kurva dari piksel gambar…')
      const issues = await runTrace()
      if (seq !== vision.seq) return
      if (issues.length) say('Ekstraksi selesai dengan peringatan. Periksa overlay dan tabel kalibrasi, koreksi bila perlu, lalu klik Use This Data.')
      else {
        if (!vision.label) { vision.pendingApply = true; needName() } else {
          say('Ekstraksi selesai, data otomatis dianalisis.')
          applyToDashboard()
        }
      }
    }
  } catch (err) {
    if (seq === vision.seq) say('⚠ Ekstraksi gagal: ' + err.message, true)
  }
  if (seq === vision.seq) {
    vision.running = false
    $('btnExtract').disabled = false
  }
}

const onCalEdit = async e => {
  const { kind, idx } = e.target.dataset
  if (!vision.cal || idx === undefined) return
  const list = kind === 'x' ? vision.cal.xTicks : vision.cal.yAxes[kind] && vision.cal.yAxes[kind].ticks
  if (!list || !list[idx]) return
  list[idx].text = e.target.value
  try {
    await runTrace()
    say('Data dihitung ulang dari kalibrasi yang Anda koreksi.')
  } catch (err) { say('⚠ ' + err.message, true) }
}

const useData = () => {
  if (!vision.extracted) return
  renderCheck()
  if (!vision.label) return needName()
  if (!applyToDashboard()) say('Titik valid kurang dari ' + CONFIG.MIN_POINTS + '. Perbaiki tabel dulu.', true)
}

const metaOf = () => {
  const res = vision.result
  return { image: vision.image ? vision.image.name : '', location: vision.label, confidence: vision.confidence, ticks: res ? res.calib.ticks : [], warnings: res ? res.warnings : [], info: res ? res.info : [], filled: vision.extracted ? vision.extracted.data.filter(r => r.filled).map(r => r.time) : [] }
}

const exportCsv = () => { if (vision.extracted) saveCsv(vision.extracted.data, vision.label || 'extract') }
const exportXlsx = () => {
  if (!vision.extracted) return
  if (!saveXlsx(vision.extracted.data, vision.label || 'extract', metaOf())) say('Pustaka Excel belum termuat. Gunakan Export CSV.', true)
}

export function initVision () {
  $('btnExtract').addEventListener('click', extract)
  $('btnUseVision').addEventListener('click', useData)
  $('btnSaveCSV').addEventListener('click', exportCsv)
  $('btnSaveXLSX').addEventListener('click', exportXlsx)
  $('visionCalBody').addEventListener('change', onCalEdit)
  $('visionLoc').addEventListener('input', e => {
    vision.label = cleanLoc(e.target.value)
    vision.locFromImage = false
    $('visionLocBox').classList.toggle('missing', !vision.label)
    $('visionLocHint').textContent = vision.label ? 'Diisi manual.' : 'Tidak terbaca di gambar. Wajib diisi sebelum analisis.'
  })
  $('visionLoc').addEventListener('change', () => {
    if (vision.pendingApply && vision.label && vision.extracted) {
      vision.pendingApply = false
      if (applyToDashboard()) say('Nama wilayah diisi, data dianalisis.')
    }
  })
  $('visionTbody').addEventListener('change', e => {
    const { idx, col } = e.target.dataset
    if (!vision.extracted || !vision.extracted.data[idx]) return
    vision.extracted.data[idx][col] = col === 'time' ? e.target.value : toNum(e.target.value)
    renderCheck()
  })
  $('visionTbody').addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete')
    if (!btn || !vision.extracted) return
    vision.extracted.data.splice(+btn.dataset.idx, 1)
    renderTable()
  })
  on('image:ready', image => {
    resetResult()
    vision.image = image
    vision.label = ''
    vision.locFromImage = false
  })
  on('image:cleared', () => {
    resetResult()
    vision.image = null
  })
  on('table:loaded', () => {
    resetResult()
    state.locationLabel = ''
  })
}

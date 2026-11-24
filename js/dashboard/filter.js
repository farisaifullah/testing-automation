import { $ } from '../core/dom.js'
import { state, defaultFilter } from '../core/state.js'
import { CONFIG } from '../core/config.js'
import { fmtMDH } from '../core/format.js'
import { emit } from '../core/bus.js'
import { enableButton } from './modal.js'

const MODES = [
  ['none', 'tanpa filter (semua data)'],
  ['input', 'by input (N terakhir)'],
  ['date', 'by date (tgl 1-31)'],
  ['hour', 'by j,m,d (jam 1-24)']
]

const SUB_HTML =
  '<span class="fsub" id="subInput"><input type="number" id="filterN" min="0" step="1" value="0" aria-label="N titik terakhir"></span>' +
  '<span class="fsub" id="subDate"><input type="number" id="filterDFrom" min="1" max="31" value="1" aria-label="Tanggal dari">–<input type="number" id="filterDTo" min="1" max="31" value="31" aria-label="Tanggal sampai"></span>' +
  '<span class="fsub" id="subHour"><input type="number" id="filterHFrom" min="1" max="24" value="1" aria-label="Jam dari">–<input type="number" id="filterHTo" min="1" max="24" value="24" aria-label="Jam sampai"></span>' +
  '<button type="button" class="btn-mini" id="btnFilterOk">OK</button>'

const inWrap = (v, from, to) => (from <= to ? v >= from && v <= to : v >= from || v <= to)

export const analysisView = () => {
  const f = state.filter
  if (!state.loaded || !state.data.length) return []
  if (f.mode === 'none') return state.data
  if (f.mode === 'input') {
    const n = f.n > 0 ? Math.max(f.n, CONFIG.MIN_POINTS) : 0
    return n > 0 && state.data.length > n ? state.data.slice(-n) : state.data
  }
  if (f.mode === 'date') return state.data.filter(d => inWrap(d.time.getDate(), f.dFrom, f.dTo))
  return state.data.filter(d => inWrap(d.time.getHours(), f.hFrom % 24, f.hTo % 24))
}

export const filterTagFor = view => {
  const f = state.filter
  if (f.mode === 'none') return null
  if (f.mode === 'input') return f.n > 0 ? 'Filter input: ' + view.length + ' titik' : null
  if (f.mode === 'date') return 'Filter tgl ' + f.dFrom + '-' + f.dTo + ': ' + view.length + ' titik'
  return 'Filter jam ' + f.hFrom + '-' + f.hTo + ': ' + view.length + ' titik'
}

export const viewEndStr = (view, latestMs) =>
  view.length && view[view.length - 1].time.getTime() !== latestMs
    ? fmtMDH(view[view.length - 1].time)
    : null

const show = (id, on) => { $(id).style.display = on ? '' : 'none' }

export const syncFilterUi = () => {
  const f = state.filter
  $('filterMode').value = f.mode
  show('subInput', f.mode === 'input')
  show('subDate', f.mode === 'date')
  show('subHour', f.mode === 'hour')
  show('btnFilterOk', f.mode !== 'none')
  $('filterN').value = f.n
  $('filterDFrom').value = f.dFrom
  $('filterDTo').value = f.dTo
  $('filterHFrom').value = f.hFrom
  $('filterHTo').value = f.hTo
  const hint = $('filterHint')
  if (!state.loaded) {
    hint.textContent = '--'
    hint.classList.remove('error')
    return
  }
  const view = analysisView()
  hint.textContent = filterTagFor(view) || 'semua data'
  hint.classList.toggle('error', view.length < CONFIG.MIN_POINTS)
}

const flashHint = text => {
  const hint = $('filterHint')
  hint.textContent = text
  hint.classList.add('error')
  setTimeout(syncFilterUi, 2500)
}

const intOf = (id, fallback) => Math.floor(parseFloat($(id).value) || fallback)
const inRange = (v, max) => v >= 1 && v <= max

const readFilter = () => {
  const f = Object.assign(defaultFilter(), { mode: $('filterMode').value })
  if (f.mode === 'input') {
    const n = Math.max(0, intOf('filterN', 0))
    f.n = n > 0 && n < CONFIG.MIN_POINTS ? CONFIG.MIN_POINTS : n
  } else if (f.mode === 'date') {
    f.dFrom = intOf('filterDFrom', 1)
    f.dTo = intOf('filterDTo', 31)
    if (!inRange(f.dFrom, 31) || !inRange(f.dTo, 31)) return null
  } else if (f.mode === 'hour') {
    f.hFrom = intOf('filterHFrom', 1)
    f.hTo = intOf('filterHTo', 24)
    if (!inRange(f.hFrom, 24) || !inRange(f.hTo, 24)) return null
  }
  return f
}

const applyFilter = () => {
  const f = readFilter()
  if (!f) return flashHint('Nilai rentang tidak valid (tanggal 1-31, jam 1-24).')
  const prev = state.filter
  state.filter = f
  if (state.loaded && f.mode !== 'input' && analysisView().length === 0) {
    state.filter = prev
    return flashHint('Rentang filter tidak memuat titik data. Filter sebelumnya dipertahankan.')
  }
  syncFilterUi()
  emit('analysis:changed')
}

const resetFilter = () => {
  state.filter = defaultFilter()
  syncFilterUi()
  emit('analysis:changed')
}

export function initFilter () {
  const select = $('filterMode')
  select.innerHTML = MODES.map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join('')
  select.insertAdjacentHTML('afterend', SUB_HTML)
  select.disabled = false
  enableButton('btnFilterReset')
  $('btnFilterReset').addEventListener('click', resetFilter)
  select.addEventListener('change', applyFilter)
  $('btnFilterOk').addEventListener('click', applyFilter)
  select.parentElement.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilter() })
  syncFilterUi()
}

import { $ } from '../core/dom.js'
import { state, cloneRow } from '../core/state.js'
import { CONFIG } from '../core/config.js'
import { fmtDateTime, fmtNum } from '../core/format.js'
import { emit } from '../core/bus.js'
import { openModal, closeModal, bindModal, enableButton } from './modal.js'

let working = []

const say = text => { $('editMsg').textContent = text }

const rowHtml = (d, i) =>
  '<tr><td><input type="checkbox" class="rowchk" data-i="' + i + '" aria-label="Pilih baris ' + (i + 1) + '"></td><td>' +
  (i + 1) + '</td><td>' + fmtDateTime(d.time) + '</td><td>' + fmtNum(d.disp, 3) + '</td><td>' +
  fmtNum(d.vel, 4) + '</td><td>' + fmtNum(d.inv, 3) + '</td><td>' + fmtNum(d.accel, 4) + '</td></tr>'

const checkedBoxes = () => Array.from($('editTbody').querySelectorAll('.rowchk')).filter(b => b.checked)

const updateCount = () => {
  $('editCount').textContent =
    'Dipilih: ' + checkedBoxes().length + ' | Editor: ' + working.length + ' | Asli: ' + state.originalData.length
}

const renderTable = () => {
  $('editTbody').innerHTML = working.map(rowHtml).join('')
  $('chkSelectAll').checked = false
  updateCount()
}

const recomputeAccel = () => {
  state.data.forEach((cur, i) => {
    if (i === 0) { cur.accel = null; return }
    const prev = state.data[i - 1]
    if (prev.vel === null || cur.vel === null) { cur.accel = null; return }
    const dtH = (cur.time.getTime() - prev.time.getTime()) / 3600000
    cur.accel = dtH > 0 ? (cur.vel - prev.vel) / dtH : null
  })
}

const open = () => {
  if (!state.loaded || !state.data.length) return
  working = state.data.map(cloneRow)
  $('editFileName').textContent = '· ' + state.fileName
  say('Centang baris yang ingin dihapus, lalu klik Delete Selected.')
  renderTable()
  openModal('editModal')
}

const deleteSelected = () => {
  const remove = new Set(checkedBoxes().map(b => +b.dataset.i))
  if (!remove.size) return say('Belum ada baris yang dipilih.')
  working = working.filter((_, i) => !remove.has(i))
  renderTable()
  say(working.length + ' baris tersisa. Klik Apply untuk menyimpan.')
}

const restore = () => {
  if (!state.originalData.length) return
  working = state.originalData.map(cloneRow)
  renderTable()
  say('Data asli dikembalikan. Klik Apply untuk menyimpan.')
}

const apply = () => {
  if (working.length < CONFIG.MIN_POINTS) return say('Minimal ' + CONFIG.MIN_POINTS + ' baris diperlukan.')
  state.data = working.map(cloneRow)
  recomputeAccel()
  state.edited = true
  closeModal('editModal')
  $('dashFile').textContent = state.fileName + ' · ' + state.data.length + ' titik (diedit)'
  emit('analysis:changed')
  emit('data:edited')
}

export function initEditData () {
  enableButton('btnEditData')
  $('btnEditData').addEventListener('click', open)
  bindModal('editModal', 'btnModalClose')
  $('btnDeleteSelected').addEventListener('click', deleteSelected)
  $('btnRestoreOriginal').addEventListener('click', restore)
  $('btnOkApply').addEventListener('click', apply)
  $('editTbody').addEventListener('change', updateCount)
  $('chkSelectAll').addEventListener('change', e => {
    $('editTbody').querySelectorAll('.rowchk').forEach(b => { b.checked = e.target.checked })
    updateCount()
  })
}

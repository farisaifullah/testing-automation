import { $ } from '../core/dom.js'

const MIN_PX = 8
const TEXT = { hint: 'Seret pada gambar untuk memilih area.' }

const state = { source: null, rect: null, anchor: null, onConfirm: null }

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

const pointOnCanvas = e => {
  const canvas = $('cropCanvas')
  const box = canvas.getBoundingClientRect()
  const scale = canvas.width / box.width
  return {
    x: clamp((e.clientX - box.left) * scale, 0, canvas.width),
    y: clamp((e.clientY - box.top) * scale, 0, canvas.height)
  }
}

const render = () => {
  const el = $('cropRect')
  const canvas = $('cropCanvas')
  const r = state.rect
  $('btnCropOk').disabled = !r
  el.hidden = !r
  if (!r) {
    $('cropInfo').textContent = TEXT.hint
    return
  }
  const scale = canvas.getBoundingClientRect().width / canvas.width
  el.style.left = r.x * scale + 'px'
  el.style.top = r.y * scale + 'px'
  el.style.width = r.w * scale + 'px'
  el.style.height = r.h * scale + 'px'
  $('cropInfo').textContent = Math.round(r.w) + ' × ' + Math.round(r.h) + ' px'
}

const setOpen = open => $('cropOverlay').classList.toggle('open', open)

const close = () => {
  setOpen(false)
  state.source = null
  state.onConfirm = null
}

const resultCanvas = () => {
  const r = state.rect || { x: 0, y: 0, w: state.source.width, h: state.source.height }
  const out = document.createElement('canvas')
  out.width = Math.round(r.w)
  out.height = Math.round(r.h)
  out.getContext('2d').drawImage(state.source, r.x, r.y, r.w, r.h, 0, 0, out.width, out.height)
  return out
}

const confirm = useFullFrame => {
  if (useFullFrame) state.rect = null
  const canvas = resultCanvas()
  const onConfirm = state.onConfirm
  close()
  if (onConfirm) onConfirm(canvas)
}

const start = e => {
  state.anchor = pointOnCanvas(e)
  state.rect = null
  $('cropStage').setPointerCapture(e.pointerId)
  render()
}

const move = e => {
  if (!state.anchor) return
  const p = pointOnCanvas(e)
  state.rect = {
    x: Math.min(state.anchor.x, p.x),
    y: Math.min(state.anchor.y, p.y),
    w: Math.abs(p.x - state.anchor.x),
    h: Math.abs(p.y - state.anchor.y)
  }
  render()
}

const end = () => {
  state.anchor = null
  if (state.rect && (state.rect.w < MIN_PX || state.rect.h < MIN_PX)) state.rect = null
  render()
}

/**
 * Open the crop modal over a given canvas/image source. Calls
 * onConfirm(croppedCanvas) when the user confirms a selection,
 * and never calls it if they cancel.
 */
export function openCrop (source, onConfirm) {
  const canvas = $('cropCanvas')
  canvas.width = source.width
  canvas.height = source.height
  canvas.getContext('2d').drawImage(source, 0, 0)
  state.source = source
  state.rect = null
  state.anchor = null
  state.onConfirm = onConfirm
  setOpen(true)
  render()
  $('btnCropFull').focus()
}

export function initCrop () {
  const stage = $('cropStage')
  stage.addEventListener('pointerdown', start)
  stage.addEventListener('pointermove', move)
  stage.addEventListener('pointerup', end)
  stage.addEventListener('pointercancel', end)
  $('btnCropOk').addEventListener('click', () => confirm(false))
  $('btnCropFull').addEventListener('click', () => confirm(true))
  $('btnCropReset').addEventListener('click', () => { state.rect = null; render() })
  $('btnCropCancel').addEventListener('click', close)
  window.addEventListener('resize', () => { if (state.source) render() })
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.source) close()
  })
}

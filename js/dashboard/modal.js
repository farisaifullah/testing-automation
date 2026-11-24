import { $ } from '../core/dom.js'

export const openModal = id => $(id).classList.add('open')
export const closeModal = id => $(id).classList.remove('open')

export const closeAllModals = () =>
  document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'))

export const bindModal = (id, closeBtnId) => {
  $(closeBtnId).addEventListener('click', () => closeModal(id))
  $(id).addEventListener('click', e => { if (e.target === $(id)) closeModal(id) })
}

export const enableButton = id => {
  const el = $(id)
  el.disabled = false
  el.removeAttribute('title')
}

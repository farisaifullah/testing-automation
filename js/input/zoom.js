import { $ } from '../core/dom.js'
import { on } from '../core/bus.js'
import { openModal, bindModal } from '../dashboard/modal.js'

export function initImageZoom () {
  bindModal('imgModal', 'btnImgClose')
  on('image:zoom', image => {
    if (!image) return
    $('imgFull').src = image.dataUrl
    openModal('imgModal')
  })
}

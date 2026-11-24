import { $ } from '../core/dom.js'

const LABEL = { NORMAL: 'Aman', WASPADA: 'Waspada', SIAGA: 'Siaga', AWAS: 'Awas', NODATA: 'Belum ada data' }

export const renderBadge = status => {
  const el = $('alertBadge')
  if (!el) return
  el.className = 'badge badge-' + status
  el.textContent = LABEL[status] || status
}

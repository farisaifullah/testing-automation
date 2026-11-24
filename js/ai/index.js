import { $ } from '../core/dom.js'
import { EXTRACT_HTML, VISION_RESULT_HTML, AI_PANEL_HTML, CHAT_POPUP_HTML } from './templates.js'
import { initVision } from './vision.js'
import { initAiReport } from './report.js'
import { initChat } from './chat.js'

const mount = () => {
  $('imageSlot').insertAdjacentHTML('beforeend', EXTRACT_HTML)
  const host = $('imageSlot').closest('.input-section') || $('imageSlot').closest('section')
  host.insertAdjacentHTML('afterend', VISION_RESULT_HTML)
  $('dashboardResults').insertAdjacentHTML('beforeend', AI_PANEL_HTML)
  document.body.insertAdjacentHTML('beforeend', CHAT_POPUP_HTML)
}

export function initAi () {
  mount()
  initVision()
  initChat()
  initAiReport()
}

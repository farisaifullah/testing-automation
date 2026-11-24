import { initTheme } from './core/theme.js'
import { initI18n } from './core/i18n.js'
import { initImageInput } from './input/image.js'
import { initTableInput } from './input/table.js'
import { initCrop } from './input/crop.js'
import { initCapture } from './input/capture.js'
import { initOpenChrome } from './input/open-chrome.js'
import { setEmptyState } from './dashboard/dashboard.js'
import { initDashboardTools } from './dashboard/tools.js'
import { initAi } from './ai/index.js'
import { initImageZoom } from './input/zoom.js'

export { on } from './core/bus.js'

function init () {
  initTheme()
  initImageInput()
  initTableInput()
  initCrop()
  initCapture()
  initOpenChrome()
  initDashboardTools()
  initAi()
  initImageZoom()
  setEmptyState()
  initI18n()
}

document.addEventListener('DOMContentLoaded', init)

import { $, esc } from '../core/dom.js'
import { state } from '../core/state.js'
import { on } from '../core/bus.js'
import { copyText } from '../dashboard/report.js'
import { askClaude, userMessage } from './claude.js'
import { buildAiContext, buildAiPrompt } from './context.js'
import { renderMd } from './markdown.js'
import { announceChat, hideChat } from './chat.js'

const BADGE = { IDLE: 'IDLE', LOAD: 'LOADING', LIVE: 'LIVE', ERR: 'ERROR' }

const MSG = {
  empty: 'Klik "Generate AI Report" untuk analisis.',
  updated: 'Data diperbarui. Klik "Generate AI Report" untuk analisis ulang.',
  noData: 'Belum ada data untuk dianalisis. Upload CSV atau ekstrak screenshot dulu.',
  analyzing: 'Menganalisis…',
  fail: '⚠ Laporan AI gagal: '
}

const setBadge = mode => {
  const el = $('reportBadge')
  el.className = 'ai-badge ai-' + mode
  el.textContent = BADGE[mode]
}

const setBody = (cls, html) => { $('reportBody').innerHTML = '<div class="' + cls + '">' + html + '</div>' }

const resetReport = message => {
  state.aiReportText = ''
  setBadge('IDLE')
  setBody('ai-empty', esc(message))
  hideChat()
}

const generate = async () => {
  if (state.aiRunning) return
  if (!state.lastResults || !state.data.length) return setBody('ai-error', esc(MSG.noData))
  state.aiRunning = true
  setBadge('LOAD')
  setBody('ai-loading', esc(MSG.analyzing))
  try {
    const prompt = buildAiPrompt(buildAiContext())
    const text = await askClaude({ system: prompt.system, messages: userMessage(prompt.user), maxTokens: prompt.maxTokens, temperature: prompt.temperature })
    state.aiReportText = text
    $('reportBody').innerHTML = renderMd(text)
    setBadge('LIVE')
    announceChat()
  } catch (err) {
    setBody('ai-error', esc(MSG.fail + err.message))
    setBadge('ERR')
  }
  state.aiRunning = false
}

const copyReport = () => {
  if (state.aiReportText) copyText(state.aiReportText, $('btnCopyAi'), 'Tersalin ✓')
}

export function initAiReport () {
  $('btnCopyAi').dataset.idle = $('btnCopyAi').textContent
  $('btnGenAi').addEventListener('click', generate)
  $('btnCopyAi').addEventListener('click', copyReport)
  on('dashboard:loaded', () => resetReport(MSG.empty))
  on('data:edited', () => resetReport(MSG.updated))
}

import { $, esc } from '../core/dom.js'
import { state } from '../core/state.js'
import { askClaude } from './claude.js'
import { buildChatSystem, guardQuestion, refusalFor, CHAT_MAX_TOKENS } from './context.js'

const WINDOW = 16

const SUB_REPORT = 'Diskusi lanjutan atas laporan aktif'
const SUB_GENERAL = 'Tanya seputar sistem dan cara kerja'

const CHIPS_REPORT = [
  'Uraikan dasar penetapan status TARP',
  'Evaluasi ketidakpastian prediksi ToF',
  'Apa bukti akselerasinya?',
  'Rekomendasi tindak lanjut pemantauan'
]
const CHIPS_GENERAL = [
  'Apa tujuan aplikasi ini?',
  'Bagaimana alur kerjanya?',
  'Apa arti level TARP?',
  'Bagaimana cara memuat data?'
]

const hasReport = () => Boolean(state.aiReportText)

const greeting = () => {
  if (hasReport()) {
    const status = state.lastResults && state.lastResults.status ? state.lastResults.status : '-'
    return 'Laporan analisis telah selesai disusun (status operasional: ' + status + '). ' +
      'Silakan ajukan pertanyaan lanjutan mengenai dasar penetapan status, ketidakpastian prediksi, maupun rekomendasi tindak lanjut pemantauan.'
  }
  if (state.loaded) {
    return 'Data sudah dimuat, tetapi laporan AI belum dibuat. Saya dapat menjawab pertanyaan tentang sistem dan alur analisis; ' +
      'pembahasan hasil tersedia setelah Anda menekan Generate AI Report.'
  }
  return 'Anda belum melakukan analisis. Saat ini saya dapat menjawab pertanyaan tentang tujuan aplikasi, cara kerja, alur analisis, dan fungsi fiturnya. ' +
    'Pembahasan hasil tersedia setelah data dimuat dan laporan AI dibuat.'
}

const bubble = (cls, text) => '<div class="chat-msg ' + cls + '">' + esc(text).replace(/\n/g, '<br>') + '</div>'

const scrollDown = () => { $('chatLog').scrollTop = $('chatLog').scrollHeight }

const isOpen = () => !$('chatPanel').hidden

export const renderChat = () => {
  $('chatLog').innerHTML = bubble('ai', greeting()) +
    state.chatHistory.map(m => bubble(m.role === 'user' ? 'user' : 'ai', m.content)).join('')
  scrollDown()
}

const renderChips = () => {
  const list = hasReport() ? CHIPS_REPORT : CHIPS_GENERAL
  $('chatChips').innerHTML = list.map(t => '<button type="button" class="chat-chip">' + esc(t) + '</button>').join('')
  $('chatChips').scrollLeft = 0
  $('chatSub').textContent = hasReport() ? SUB_REPORT : SUB_GENERAL
}

const refresh = () => { renderChat(); renderChips() }

export const resetChat = () => {
  state.chatHistory = []
  state.chatRunning = false
  if (isOpen()) refresh()
}

const setDot = show => { $('chatDot').hidden = !show }

const openChat = focusInput => {
  $('chatPanel').hidden = false
  $('btnChat').setAttribute('aria-expanded', 'true')
  setDot(false)
  refresh()
  if (focusInput) $('chatInput').focus()
}

const closeChat = () => {
  $('chatPanel').hidden = true
  $('btnChat').setAttribute('aria-expanded', 'false')
}

const toggleChat = () => { if (isOpen()) closeChat(); else openChat(true) }

// Laporan terbaru siap: ikon tetap ada, popup terbuka otomatis dengan mode laporan.
export const announceChat = () => {
  $('btnChat').hidden = false
  state.chatHistory = []
  state.chatRunning = false
  openChat(false)
}

// Laporan dihapus (data baru/diedit): kembali ke mode umum. Ikon chat tetap tersedia.
export const hideChat = () => {
  setDot(false)
  resetChat()
}

const windowed = () => {
  const msgs = state.chatHistory.slice(-WINDOW)
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  return msgs
}

const showTyping = () => {
  $('chatLog').insertAdjacentHTML('beforeend', '<div class="chat-msg ai chat-typing" id="chatTyping">…</div>')
  scrollDown()
}

const hideTyping = () => { const el = $('chatTyping'); if (el) el.remove() }

export const sendChat = async text => {
  const question = String(text || '').trim()
  if (!question || state.chatRunning) return

  // Rumus dan kredensial ditolak lokal: pasti konsisten dan tidak memakai kredit API.
  const blocked = guardQuestion(question)
  if (blocked) {
    state.chatHistory.push({ role: 'user', content: question }, { role: 'assistant', content: refusalFor(blocked, hasReport()) })
    renderChat()
    return
  }

  state.chatRunning = true
  state.chatHistory.push({ role: 'user', content: question })
  renderChat()
  showTyping()
  try {
    const answer = await askClaude({ system: buildChatSystem(), messages: windowed(), maxTokens: CHAT_MAX_TOKENS, temperature: 0.5 })
    hideTyping()
    state.chatHistory.push({ role: 'assistant', content: answer })
    renderChat()
    if (!isOpen()) setDot(true)
  } catch (err) {
    hideTyping()
    state.chatHistory.pop()
    $('chatInput').value = question
    $('chatLog').insertAdjacentHTML('beforeend', bubble('ai chat-err', '⚠ Asisten gagal menjawab: ' + err.message))
    scrollDown()
  }
  state.chatRunning = false
}

const submitInput = () => {
  const value = $('chatInput').value
  $('chatInput').value = ''
  sendChat(value)
}

export function initChat () {
  $('btnChat').hidden = false
  $('btnChat').addEventListener('click', toggleChat)
  $('btnChatClose').addEventListener('click', closeChat)
  $('btnChatClear').addEventListener('click', () => { resetChat(); refresh() })
  $('btnChatSend').addEventListener('click', submitInput)
  $('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitInput()
    }
  })
  $('chatPanel').addEventListener('keydown', e => { if (e.key === 'Escape') closeChat() })
  $('chatChips').addEventListener('wheel', e => {
    const el = $('chatChips')
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }, { passive: false })
  $('chatChips').addEventListener('click', e => {
    const chip = e.target.closest('.chat-chip')
    if (chip) sendChat(chip.textContent)
  })
}

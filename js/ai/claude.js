import { CLAUDE_API_KEY, CLAUDE_MODEL } from '../core/secrets.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MAX_TOKENS = 4000

// Pembacaan gambar memakai model yang sama dengan chat dan laporan (CLAUDE_MODEL) agar hemat kredit.
export const VISION_MODEL = CLAUDE_MODEL

const emptyReason = json => {
  const why = json && json.stop_reason
  if (why === 'refusal') return 'model menolak memproses gambar ini (refusal)'
  if (why === 'max_tokens') return 'jawaban terpotong karena batas token (max_tokens)'
  return 'respons kosong dari Claude' + (why ? ' (stop_reason: ' + why + ')' : '')
}

export const userMessage = content => [{ role: 'user', content }]

// temperature: null = jangan kirim (model baru menolak parameter ini).
export const askClaude = async ({ system, messages, maxTokens = DEFAULT_MAX_TOKENS, temperature = 0.2, model }) => {
  if (!CLAUDE_API_KEY) throw new Error('API key Claude belum diisi (js/core/secrets.js).')
  const send = withTemperature => fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(Object.assign(
      { model: model || CLAUDE_MODEL, max_tokens: maxTokens, system, messages },
      withTemperature && temperature !== null && temperature !== undefined ? { temperature } : {}
    ))
  })
  let res = await send(true)
  let json = await res.json().catch(() => ({}))
  if (res.status === 400 && /temperature/i.test((json.error && json.error.message) || '')) {
    res = await send(false)
    json = await res.json().catch(() => ({}))
  }
  if (!res.ok) throw new Error(res.status + ' ' + ((json.error && json.error.message) || 'permintaan gagal'))
  // Model baru dapat mengirim blok "thinking" lebih dulu: ambil semua blok bertipe text.
  const blocks = Array.isArray(json.content) ? json.content : []
  const text = blocks.filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n').trim()
  if (!text) throw new Error(emptyReason(json))
  return text
}

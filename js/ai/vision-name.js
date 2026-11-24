import { askClaude, userMessage, VISION_MODEL } from './claude.js'

const SYSTEM = 'Kamu membaca satu potongan header dashboard chart radar lereng. Tugas: salin PERSIS nama lokasi/titik/area yang tertulis di kotak dropdown atau judul pada potongan ini (contoh bentuk: "L-SW East 8E1", "A-138", "L-IPD B4_ RL -4.05"). BUKAN lokasi: nama seri/filter (Cumulative Disp., Mean Disp., Vel-1h, Acc-1h, Speed-1h, Accel-1h, "+ 1"), tombol (Query, Export), tab (Chart, Detailed Data), Real-time, Delta, Start, End, dan angka statistik. Bila tidak ada teks nama yang jelas terbaca, location = null; jangan menebak. Output HANYA JSON: {"location":"string|null"}'
const NOT_A_NAME = /^(cumulative|mean|speed|vel|acc|accel|disp|query|export|chart|detailed|real-?time|delta|start|end|\+\s*\d+|null|none)\b/i

/** Cadangan murah: satu panggilan kecil (potongan header saja) hanya bila AI utama tidak mengembalikan nama. Gagal = nama kosong. */
export const readNameFallback = async img => {
  const c = img && img.aiHeader
  if (!c) return ''
  try {
    const text = await askClaude({
      system: SYSTEM,
      messages: userMessage([
        { type: 'image', source: { type: 'base64', media_type: c.mediaType, data: c.base64 } },
        { type: 'text', text: 'Baca nama lokasi. Output HANYA JSON.' }
      ]),
      temperature: null, maxTokens: 1500, model: VISION_MODEL
    })
    const m = text.match(/\{[\s\S]*\}/)
    const obj = m ? JSON.parse(m[0]) : null
    const name = obj && obj.location ? String(obj.location).trim() : ''
    return !name || name.length > 60 || NOT_A_NAME.test(name) ? '' : name
  } catch (e) {
    return ''
  }
}

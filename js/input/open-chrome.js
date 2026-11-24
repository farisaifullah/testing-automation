import { $, setMessage } from '../core/dom.js'

// Nama PC site seperti tampil di Chrome Remote Desktop (boleh kosong). Dipakai memilih tab bila ada beberapa sesi terbuka.
const DEVICE_NAME = ""
const WAIT_MS = 1500

const TEXT = {
  noHelper: 'Helper extension belum aktif di Chrome ini. Pasang dulu sesuai helper-extension/README.txt, lalu muat ulang halaman.',
  focused: 'Tab Remote Desktop PC site dibawa ke depan. Kembali ke sini, lalu klik Select Tab or Window.',
  listed: 'Tab Remote Desktop PC site tidak ditemukan. Halaman daftar perangkat dibuka; sambungkan ke PC site, lalu tekan tombol ini lagi.',
  fail: 'Gagal menghubungi helper extension. Muat ulang halaman lalu coba lagi.'
}

// Halaman web tidak boleh melihat tab lain; permintaan dikirim ke helper extension lewat pesan halaman (hanya status yang kembali).
const askHelper = () => new Promise(resolve => {
  const id = Math.random().toString(36).slice(2)
  const finish = (r) => { clearTimeout(timer); window.removeEventListener('message', onReply); resolve(r) }
  const onReply = (ev) => {
    const d = ev.data
    if (ev.source !== window || ev.origin !== location.origin || !d || d.source !== 'tof-helper' || d.id !== id) return
    finish(d.result || { status: 'error' })
  }
  const timer = setTimeout(() => finish(null), WAIT_MS)
  window.addEventListener('message', onReply)
  window.postMessage({ source: 'tof-app', type: 'find-remote', id, device: DEVICE_NAME }, location.origin)
})

const openRemote = async (btn) => {
  btn.disabled = true
  try {
    const r = await askHelper()
    if (!r) return setMessage('captureMsg', TEXT.noHelper, true)
    if (r.status === 'focused') return setMessage('captureMsg', TEXT.focused)
    if (r.status === 'opened-list') return setMessage('captureMsg', TEXT.listed)
    setMessage('captureMsg', TEXT.fail, true)
  } finally { btn.disabled = false }
}

export function initOpenChrome () {
  const btn = $('btnOpenChrome')
  if (btn) btn.addEventListener('click', () => openRemote(btn))
}

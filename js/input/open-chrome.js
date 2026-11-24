// Berdiri sendiri (tanpa import) dan memasang tombolnya sendiri saat dimuat; dimuat langsung dari index.html.

// Nama PC site seperti tampil di Chrome Remote Desktop (boleh kosong). Dipakai memilih tab bila ada beberapa sesi terbuka.
const DEVICE_NAME = ""
const WAIT_MS = 1500

const TEXT = {
  noHelper: 'Helper extension belum aktif di Chrome ini. Pasang dulu sesuai helper-extension/README.txt, lalu muat ulang halaman.',
  focused: 'Tab Remote Desktop PC site dibawa ke depan. Kembali ke sini, lalu klik Select Tab or Window.',
  listed: 'Tab Remote Desktop PC site tidak ditemukan. Halaman daftar perangkat dibuka; sambungkan ke PC site, lalu tekan tombol ini lagi.',
  fail: 'Gagal menghubungi helper extension. Muat ulang halaman lalu coba lagi.'
}

const say = (text, isError) => {
  const el = document.getElementById('captureMsg')
  if (!el) return
  el.textContent = text
  el.classList.toggle('error', !!isError)
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
    if (!r) return say(TEXT.noHelper, true)
    if (r.status === 'focused') return say(TEXT.focused)
    if (r.status === 'opened-list') return say(TEXT.listed)
    say(TEXT.fail, true)
  } catch (e) {
    say(TEXT.fail, true)
  } finally { btn.disabled = false }
}

export function initOpenChrome () {
  const btn = document.getElementById('btnOpenChrome')
  if (!btn || btn.dataset.remoteBound) return
  btn.dataset.remoteBound = '1'
  btn.addEventListener('click', () => openRemote(btn))
  console.info('[TOF] Tombol Open E-Survey siap')
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOpenChrome)
else initOpenChrome()

import { $, setMessage } from '../core/dom.js'

// Alamat dashboard e-survey yang dibuka tombol "Open E-Survey". Ganti di sini bila berubah.
const DASHBOARD_URL = ""

const TEXT = {
  noUrl: 'Alamat dashboard belum diatur. Isi DASHBOARD_URL di js/input/open-chrome.js.',
  blocked: 'Browser memblokir tab baru. Izinkan pop-up untuk situs ini, lalu coba lagi.',
  opened: 'Tab dashboard dibuka. Kembali ke sini, lalu klik Select Tab or Window.',
  focused: 'Tab dashboard yang dibuka sebelumnya dibawa ke depan. Kembali ke sini, lalu klik Select Tab or Window.'
}

let dashboardWin = null

// Halaman web tidak bisa mencari tab lain yang dibuka di luar halaman ini; yang bisa dilakukan adalah membuka tab baru
// dan memakai ulang tab yang dibuka tombol ini (nama jendela tetap) agar tidak menumpuk.
const openDashboard = () => {
  if (!/^https?:\/\//i.test(DASHBOARD_URL)) return setMessage('captureMsg', TEXT.noUrl, true)
  if (dashboardWin && !dashboardWin.closed) {
    dashboardWin.focus()
    return setMessage('captureMsg', TEXT.focused)
  }
  dashboardWin = window.open(DASHBOARD_URL, 'esurvey-dashboard')
  if (!dashboardWin) return setMessage('captureMsg', TEXT.blocked, true)
  dashboardWin.opener = null
  setMessage('captureMsg', TEXT.opened)
}

export function initOpenChrome () {
  const btn = $('btnOpenChrome')
  if (btn) btn.addEventListener('click', openDashboard)
}

import { $, setMessage } from '../core/dom.js'
import { openCrop } from './crop.js'
import { publishImage } from './image.js'

const TEXT = {
  unsupported: 'Browser ini tidak mendukung tangkap layar. Pakai Chrome, Edge, atau Firefox di komputer, lewat localhost atau HTTPS.',
  cancelled: 'Pemilihan tab atau jendela dibatalkan.',
  blank: 'Tangkapan layar kosong (hitam). Pastikan tab/jendela tidak diminimalkan, lalu coba lagi.',
  fail: 'Tangkap layar gagal.'
}

const MAX_TRIES = 30
const SAMPLE_W = 48
const SAMPLE_H = 27

const nextFrame = video => new Promise(resolve => {
  const timer = setTimeout(resolve, 150)
  const done = () => { clearTimeout(timer); resolve() }
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(done)
})

// Frame pertama dari stream sering hitam; hitam murni = belum ada gambar.
const isBlank = canvas => {
  const probe = document.createElement('canvas')
  probe.width = SAMPLE_W
  probe.height = SAMPLE_H
  const ctx = probe.getContext('2d')
  ctx.drawImage(canvas, 0, 0, SAMPLE_W, SAMPLE_H)
  const px = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] + px[i + 1] + px[i + 2] > 0) return false
  }
  return true
}

const drawVideo = video => {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)
  return canvas
}

const grabFrame = async () => {
  const media = navigator.mediaDevices
  if (!media || !media.getDisplayMedia) throw new Error('unsupported')

  const stream = await media.getDisplayMedia({ video: true, audio: false })
  const video = document.createElement('video')
  try {
    video.muted = true
    video.playsInline = true
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0'
    document.body.appendChild(video)
    video.srcObject = stream
    await video.play()
    for (let i = 0; i < MAX_TRIES; i++) {
      await nextFrame(video)
      if (!video.videoWidth || !video.videoHeight) continue
      const canvas = drawVideo(video)
      if (!isBlank(canvas)) return canvas
    }
    throw new Error('blank')
  } finally {
    stream.getTracks().forEach(track => track.stop())
    video.srcObject = null
    video.remove()
  }
}

// Alur: klik tombol -> pilih tab/jendela -> otomatis screenshot -> crop
// -> hasil crop dikirim ke kolom Gambar lewat publishImage.
const onCropConfirmed = canvas => {
  publishImage(canvas, 'capture-' + Date.now() + '.png', 'image/png')
  setMessage('captureMsg', '')
}

let busy = false

const startCapture = async () => {
  if (busy) return
  busy = true
  setMessage('captureMsg', '')
  try {
    const frame = await grabFrame()
    openCrop(frame, onCropConfirmed)
  } catch (err) {
    if (err.message === 'unsupported') setMessage('captureMsg', TEXT.unsupported, true)
    else if (err.name === 'NotAllowedError') setMessage('captureMsg', TEXT.cancelled)
    else if (err.message === 'blank') setMessage('captureMsg', TEXT.blank, true)
    else setMessage('captureMsg', TEXT.fail, true)
  } finally {
    busy = false
  }
}

export function initCapture () {
  $('btnCaptureTab').addEventListener('click', startCapture)
}

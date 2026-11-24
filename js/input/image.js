import { $, setMessage, bindDropzone } from '../core/dom.js'
import { emit } from '../core/bus.js'

import { smartLabelCrops, headerCrop } from './label-crops.js'
const CONFIG = {
  LOW_RES_SIDE: 900,
  HD_SIDE: 1920,
  MAX_SIDE_HD: 3000,
  AI_SIDE: 1568,
  AI_MAX_BYTES: 4500000,
  JPEG_QUALITY: 0.92
}

const TEXT = {
  idle: 'Belum ada gambar.',
  ok: name => 'Gambar siap: ' + name + '.',
  notImage: 'File bukan gambar.',
  decodeFail: 'Gagal membuka gambar.',
  cleared: 'Gambar dihapus.'
}

let current = null

/** Salin ke kanvas dengan sisi terpanjang = target (naik atau turun), interpolasi kualitas tinggi bertahap. */
const resizeTo = (source, target) => {
  let w = source.width, h = source.height
  const ratio = target / Math.max(w, h)
  const tw = Math.round(w * ratio), th = Math.round(h * ratio)
  let cur = source
  // turun: bagi dua bertahap agar garis tipis tidak hilang; naik: satu langkah (maks 3x)
  while (ratio < 1 && w / 2 > tw) {
    const c = document.createElement('canvas')
    w = Math.round(w / 2); h = Math.round(h / 2)
    c.width = w; c.height = h
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, w, h)
    cur = c
  }
  const canvas = document.createElement('canvas')
  canvas.width = tw; canvas.height = th
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, tw, th)
  return canvas
}

/** Versi HD untuk pelacakan: gambar kecil dinaikkan ke ~1920 px (maks 3x), gambar sangat besar diturunkan ke 3000 px. */
const toHd = source => {
  const longest = Math.max(source.width, source.height)
  if (longest >= CONFIG.HD_SIDE && longest <= CONFIG.MAX_SIDE_HD) return resizeTo(source, longest)
  const target = longest < CONFIG.HD_SIDE ? Math.min(CONFIG.HD_SIDE, longest * 3) : CONFIG.MAX_SIDE_HD
  return resizeTo(source, target)
}

/** Potongan bagian bawah (label sumbu X) kiri dan kanan, diperbesar, agar jam dan menit lebih terbaca oleh AI. */
const toLabelCrops = hd => {
  const y0 = Math.round(hd.height * 0.74), h = hd.height - y0
  const specs = [[0, 0.55, 'kiri'], [0.45, 1, 'kanan']]
  return specs.map(([a, b, name]) => {
    const x0 = Math.round(hd.width * a), w = Math.round(hd.width * b) - x0
    const src = document.createElement('canvas')
    src.width = w; src.height = h
    src.getContext('2d').drawImage(hd, x0, y0, w, h, 0, 0, w, h)
    const k = Math.min(CONFIG.AI_SIDE / w, 2)
    const out = document.createElement('canvas')
    out.width = Math.round(w * k); out.height = Math.round(h * k)
    const ctx = out.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, out.width, out.height)
    return { name, xFrom: Math.round(a * 100), xTo: Math.round(b * 100), yFrom: 74, base64: out.toDataURL('image/png').split(',')[1], mediaType: 'image/png' }
  })
}

/** Salinan untuk AI: sisi terpanjang 1568 px (batas model) agar koordinat yang dibaca AI bisa dipetakan balik ke versi HD. */
const toAiCopy = hd => {
  const canvas = resizeTo(hd, CONFIG.AI_SIDE)
  let mediaType = 'image/png'
  let dataUrl = canvas.toDataURL(mediaType)
  if (dataUrl.length > CONFIG.AI_MAX_BYTES) { mediaType = 'image/jpeg'; dataUrl = canvas.toDataURL(mediaType, CONFIG.JPEG_QUALITY) }
  return { canvas, mediaType, base64: dataUrl.split(',')[1] }
}

const decodeFile = file =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(TEXT.decodeFail)) }
    img.src = url
  })

/**
 * Publish any image source (file, canvas from a crop, etc.) as the
 * current image. This is the single entry point the capture flow
 * calls into, so there is exactly one place that owns image state.
 */
export function publishImage (source, name, mediaType) {
  const canvas = toHd(source)
  const ai = toAiCopy(canvas)
  const dataUrl = canvas.toDataURL('image/png')
  current = {
    name,
    mediaType: 'image/png',
    width: canvas.width,
    height: canvas.height,
    srcWidth: source.width,
    srcHeight: source.height,
    dataUrl,
    base64: dataUrl.split(',')[1],
    aiCrops: smartLabelCrops(canvas, toLabelCrops),
    aiHeader: headerCrop(canvas),
    aiMediaType: ai.mediaType,
    aiBase64: ai.base64,
    aiWidth: ai.canvas.width,
    aiHeight: ai.canvas.height
  }
  $('imagePreview').src = dataUrl
  $('imageMeta').textContent = name + ' (' + source.width + ' × ' + source.height + (canvas.width !== source.width ? ' → HD ' + canvas.width + ' × ' + canvas.height : '') + ' px)'
  $('imageSlot').hidden = false
  const low = Math.max(source.width, source.height) < CONFIG.LOW_RES_SIDE
  setMessage('imageMsg', low
    ? TEXT.ok(name) + ' ⚠ Resolusi rendah (' + source.width + ' × ' + source.height + ' px): garis tipis bisa hilang dan hasil kurang akurat. Pakai screenshot lebar minimal sekitar 1200 px.'
    : TEXT.ok(name), low)
  emit('image:ready', current)
}

const clearImage = () => {
  current = null
  $('imageSlot').hidden = true
  $('imagePreview').removeAttribute('src')
  setMessage('imageMsg', TEXT.cleared)
  emit('image:cleared')
}

const loadFile = async file => {
  if (!file.type.startsWith('image/')) return setMessage('imageMsg', TEXT.notImage, true)
  try {
    const img = await decodeFile(file)
    const mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    publishImage(img, file.name, mediaType)
  } catch (err) {
    setMessage('imageMsg', err.message, true)
  }
}

const onPaste = e => {
  const file = Array.from(e.clipboardData ? e.clipboardData.files : [])
    .find(f => f.type.startsWith('image/'))
  if (file) loadFile(file)
}

export function initImageInput () {
  bindDropzone($('imageDrop'), $('imageFile'), loadFile)
  $('btnImageClear').addEventListener('click', clearImage)
  $('imagePreview').addEventListener('click', () => emit('image:zoom', current))
  document.addEventListener('paste', onPaste)
  setMessage('imageMsg', TEXT.idle)
}

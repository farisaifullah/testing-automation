import { $, setMessage, bindDropzone } from '../core/dom.js'
import { ingestRows } from '../data/pipeline.js'

const TABLE_EXT = /\.(csv|tsv|txt|xls|xlsx)$/i

const TEXT = {
  idle: 'Belum ada file yang dimuat.',
  reading: name => 'Membaca ' + name + '...',
  empty: 'File tidak berisi data.',
  badFormat: 'Format file tidak didukung. Gunakan CSV, TSV, XLS, atau XLSX.',
  fail: reason => 'Gagal membaca file: ' + reason
}

const hasValue = cell => cell !== null && cell !== undefined && cell !== ''
const dropEmptyRows = rows => rows.filter(row => Array.isArray(row) && row.some(hasValue))

const readExcel = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('file tidak terbaca'))
    reader.onload = e => {
      try {
        const book = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const sheet = book.Sheets[book.SheetNames[0]]
        if (!sheet) return resolve([])
        resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }))
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })

const readText = file =>
  new Promise((resolve, reject) => {
    Papa.parse(file, { skipEmptyLines: true, complete: result => resolve(result.data), error: reject })
  })

const loadFile = async file => {
  if (!TABLE_EXT.test(file.name)) return setMessage('tableMsg', TEXT.badFormat, true)
  setMessage('tableMsg', TEXT.reading(file.name))
  try {
    const isExcel = /\.xlsx?$/i.test(file.name)
    const rows = dropEmptyRows(isExcel ? await readExcel(file) : await readText(file))
    if (!rows.length) return setMessage('tableMsg', TEXT.empty, true)
    const result = ingestRows(rows, file.name)
    setMessage('tableMsg', result.message, !result.ok)
  } catch (err) {
    setMessage('tableMsg', TEXT.fail(err.message || err), true)
  }
}

export function initTableInput () {
  bindDropzone($('tableDrop'), $('tableFile'), loadFile)
  setMessage('tableMsg', TEXT.idle)
}

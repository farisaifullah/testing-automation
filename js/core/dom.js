export const $ = id => document.getElementById(id)

export const setMessage = (id, text, isError) => {
  const el = $(id)
  el.textContent = text
  el.classList.toggle('error', !!isError)
}

export const bindDropzone = (zone, input, handleFile) => {
  const take = file => { if (file) handleFile(file) }
  input.addEventListener('change', () => {
    take(input.files[0])
    input.value = ''
  })
  zone.addEventListener('dragover', e => {
    e.preventDefault()
    zone.classList.add('dragover')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'))
  zone.addEventListener('drop', e => {
    e.preventDefault()
    zone.classList.remove('dragover')
    take(e.dataTransfer.files[0])
  })
}

export const esc = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

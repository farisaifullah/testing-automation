import { esc } from '../core/dom.js'

const inline = text =>
  esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')

export const renderMd = source => {
  let html = ''
  let inList = false
  const closeList = () => {
    if (inList) html += '</ul>'
    inList = false
  }
  String(source).split(/\r?\n/).forEach(line => {
    const h2 = line.match(/^##\s+(.*)$/)
    const h3 = line.match(/^###\s+(.*)$/)
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (h2) { closeList(); html += '<h2>' + inline(h2[1]) + '</h2>' }
    else if (h3) { closeList(); html += '<h3>' + inline(h3[1]) + '</h3>' }
    else if (li) {
      if (!inList) { html += '<ul>'; inList = true }
      html += '<li>' + inline(li[1]) + '</li>'
    } else if (/^\s*$/.test(line)) closeList()
    else { closeList(); html += '<p>' + inline(line) + '</p>' }
  })
  closeList()
  return html
}

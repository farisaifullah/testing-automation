import { $ } from './dom.js'
import { emit } from './bus.js'
import { EXACT, FULL, PARTS } from './i18n-dict.js'

const KEY = 'srm-lang'
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt']
const ATTR_SELECTOR = ATTRS.map(a => '[' + a + ']').join(',')
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT'])
const OBSERVE = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }

const textMeta = new WeakMap()
const attrMeta = new WeakMap()
let lang = 'id'
let observer = null

// Teks Indonesia -> Inggris, atau null kalau tidak ada padanannya.
export const translate = text => {
  const [, lead, core, tail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!core) return null
  let out = EXACT[core]
  if (out === undefined) {
    const hit = FULL.find(([pattern]) => pattern.test(core))
    out = hit ? core.replace(hit[0], hit[1]) : PARTS.reduce((s, [pattern, repl]) => s.replace(pattern, repl), core)
  }
  return out === core ? null : lead + out + tail
}

const processText = node => {
  const parent = node.parentNode
  if (!parent || SKIP_TAGS.has(parent.nodeName)) return
  const meta = textMeta.get(node)
  if (meta && node.data === meta.shown) return
  const out = translate(node.data)
  if (out === null) return void textMeta.delete(node)
  textMeta.set(node, { orig: node.data, shown: out })
  node.data = out
}

const processAttr = (el, attr) => {
  const value = el.getAttribute(attr)
  if (value === null) return
  const metas = attrMeta.get(el) || {}
  if (metas[attr] && value === metas[attr].shown) return
  const out = translate(value)
  if (out === null) {
    delete metas[attr]
    return
  }
  metas[attr] = { orig: value, shown: out }
  attrMeta.set(el, metas)
  el.setAttribute(attr, out)
}

const textNodes = root => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const list = []
  while (walker.nextNode()) list.push(walker.currentNode)
  return list
}

const elementsWithAttrs = root => [root, ...root.querySelectorAll(ATTR_SELECTOR)]

const processTree = root => {
  if (root.nodeType === Node.TEXT_NODE) return processText(root)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  textNodes(root).forEach(processText)
  elementsWithAttrs(root).forEach(el => ATTRS.forEach(a => processAttr(el, a)))
}

const restoreTree = root => {
  textNodes(root).forEach(node => {
    const meta = textMeta.get(node)
    if (meta && node.data === meta.shown) node.data = meta.orig
    textMeta.delete(node)
  })
  elementsWithAttrs(root).forEach(el => {
    const metas = attrMeta.get(el)
    if (!metas) return
    Object.keys(metas).forEach(a => {
      if (el.getAttribute(a) === metas[a].shown) el.setAttribute(a, metas[a].orig)
    })
    attrMeta.delete(el)
  })
}

const onMutations = records => {
  observer.disconnect()
  records.forEach(r => {
    if (r.type === 'childList') r.addedNodes.forEach(processTree)
    else if (r.type === 'characterData') processText(r.target)
    else processAttr(r.target, r.attributeName)
  })
  observer.observe(document.body, OBSERVE)
}

const syncButton = () => {
  const btn = $('btnLang')
  if (!btn) return
  btn.textContent = lang.toUpperCase()
  btn.setAttribute('aria-label', lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia')
}

export const getLang = () => lang

export const setLang = next => {
  lang = next === 'en' ? 'en' : 'id'
  try { localStorage.setItem(KEY, lang) } catch (e) { /* abaikan */ }
  document.documentElement.lang = lang
  if (observer) observer.disconnect()
  if (lang === 'en') {
    processTree(document.body)
    if (!observer) observer = new MutationObserver(onMutations)
    observer.observe(document.body, OBSERVE)
  } else {
    restoreTree(document.body)
  }
  syncButton()
  emit('lang:changed', lang)
}

const readStored = () => {
  try { return localStorage.getItem(KEY) } catch (e) { return null }
}

export function initI18n () {
  let btn = $('btnLang')
  if (!btn) {
    btn = document.createElement('button')
    btn.type = 'button'
    btn.id = 'btnLang'
    btn.className = 'lang-btn'
    const theme = $('btnTheme')
    if (theme) theme.insertAdjacentElement('beforebegin', btn)
    else document.body.insertAdjacentElement('afterbegin', btn)
  }
  btn.addEventListener('click', () => setLang(lang === 'id' ? 'en' : 'id'))
  setLang(readStored() === 'en' ? 'en' : 'id')
  // Bantuan debug: di console EN, jalankan copy(__i18nMissing()) untuk daftar teks yang belum punya padanan.
  window.__i18nMissing = () => [...new Set(textNodes(document.body)
    .map(n => n.data.trim()).filter(s => /[A-Za-z]{3,}/.test(s)))].sort().join('\n')
}

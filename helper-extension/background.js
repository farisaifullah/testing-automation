// Mencari tab/jendela Chrome Remote Desktop dan membawanya ke depan. Hanya menjawab permintaan dari content.js.
var CRD = 'https://remotedesktop.google.com/'

function bringFront (tab) {
  return chrome.tabs.update(tab.id, { active: true })
    .then(function () { return chrome.windows.get(tab.windowId) })
    .then(function (w) {
      var upd = { focused: true }
      if (w.state === 'minimized') upd.state = 'normal'
      return chrome.windows.update(tab.windowId, upd)
    })
}

function recent (a, b) { return (b.lastAccessed || 0) - (a.lastAccessed || 0) }

async function findRemote (device) {
  var tabs = await chrome.tabs.query({ url: CRD + '*' })
  var sessions = tabs.filter(function (t) { return /\/access\/session\//.test(t.url || '') })
  var pool = sessions
  if (device) {
    var key = device.toLowerCase()
    var named = sessions.filter(function (t) { return (t.title || '').toLowerCase().indexOf(key) !== -1 })
    if (named.length) pool = named
  }
  if (pool.length) {
    pool.sort(recent)
    await bringFront(pool[0])
    return { status: 'focused', count: pool.length }
  }
  var list = tabs.filter(function (t) { return /\/access\/?(\?.*)?(#.*)?$/.test(t.url || '') }).sort(recent)[0]
  if (list) await bringFront(list)
  else await chrome.tabs.create({ url: CRD + 'access' })
  return { status: 'opened-list' }
}

chrome.runtime.onMessage.addListener(function (msg, sender, send) {
  if (!msg || msg.type !== 'find-remote' || sender.id !== chrome.runtime.id || !sender.tab) return
  findRemote(String(msg.device || '').slice(0, 80)).then(send, function () { send({ status: 'error' }) })
  return true
})

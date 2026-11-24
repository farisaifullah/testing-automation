// Jembatan antara halaman TOF dan background.js. Hanya menerima pesan dari halaman itu sendiri.
(function () {
  if (window.__tofRemoteBridge) return
  window.__tofRemoteBridge = true
  window.addEventListener('message', function (ev) {
    var d = ev.data
    if (ev.source !== window || ev.origin !== location.origin || !d || d.source !== 'tof-app' || d.type !== 'find-remote') return
    var reply = function (r) { window.postMessage({ source: 'tof-helper', id: d.id, result: r }, location.origin) }
    try {
      chrome.runtime.sendMessage({ type: 'find-remote', device: String(d.device || '').slice(0, 80) }, function (r) {
        reply(chrome.runtime.lastError || !r ? { status: 'error' } : { status: r.status })
      })
    } catch (e) { reply({ status: 'error' }) }
  })
})()

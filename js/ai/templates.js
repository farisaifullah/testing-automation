// ====== TOMBOL EKSTRAKSI (masuk ke kolom Gambar) ======
export const EXTRACT_HTML = `
  <button type="button" class="modal-btn primary" id="btnExtract">Extract Data</button>
  <p class="msg" id="visionMsg" role="status"></p>`

// ====== HASIL EKSTRAKSI (di bawah bagian Data masukan) ======
export const VISION_RESULT_HTML = `
<section class="vision-result" id="visionResult" hidden aria-labelledby="visionTitle">
  <div class="ai-head"><h3 id="visionTitle">Extraction Result (editable)</h3><span class="vision-count" id="visionCount"></span></div>
  <div class="vision-loc" id="visionLocBox">
    <label for="visionLoc">Nama wilayah</label>
    <input type="text" id="visionLoc" maxlength="60" placeholder="mis. P-SW SOUTH C4" autocomplete="off">
    <span class="vision-loc-hint" id="visionLocHint"></span>
  </div>
  <div class="vision-check good" id="visionCheck" role="status"></div>
  <div class="vision-verify">
    <h4>Verification Overlay</h4>
    <div class="vision-trace-box"><canvas id="visionTrace" aria-label="Verification overlay"></canvas></div>
    <p class="hint">Garis hijau = tick waktu, oranye/merah muda = tick sumbu Y (putus-putus = tidak menempel pada grid), titik berwarna = hasil pelacakan kurva. Bila meleset, koreksi nilai tick di bawah; data dihitung ulang otomatis tanpa memanggil AI.</p>
    <div class="table-scroll vision-cal-scroll">
      <table class="edit-table">
        <thead><tr><th>Axis</th><th>Pos (px)</th><th>Grid</th><th>Value</th></tr></thead>
        <tbody id="visionCalBody"></tbody>
      </table>
    </div>
  </div>
  <div class="table-scroll vision-scroll">
    <table class="edit-table">
      <thead><tr><th>#</th><th>Time</th><th>Disp (mm)</th><th>Vel (mm/h)</th><th>Accel (mm/h²)</th><th></th></tr></thead>
      <tbody id="visionTbody"></tbody>
    </table>
  </div>
  <div class="ai-actions">
    <button type="button" class="modal-btn primary" id="btnUseVision">Use This Data</button>
    <button type="button" class="modal-btn" id="btnSaveXLSX">Export Excel</button>
    <button type="button" class="modal-btn" id="btnSaveCSV">Export CSV</button>
  </div>
</section>`

// ====== LAPORAN AI (masuk ke dalam dashboard) ======
export const AI_PANEL_HTML = `
<section class="ai-panel" id="aiPanel" aria-labelledby="aiTitle">
  <div class="ai-head"><h3 id="aiTitle">AI Analysis Report</h3><span class="ai-badge ai-IDLE" id="reportBadge">IDLE</span></div>
  <div class="ai-body" id="reportBody"><div class="ai-empty">Klik "Generate AI Report" untuk analisis.</div></div>
  <div class="ai-actions">
    <button type="button" class="modal-btn primary" id="btnGenAi">Generate AI Report</button>
    <button type="button" class="modal-btn" id="btnCopyAi">Copy AI Report</button>
  </div>
</section>`

// ====== CHAT POPUP (gaya messenger, dipasang di body) ======
export const CHAT_POPUP_HTML = `
<button type="button" class="chat-fab" id="btnChat" hidden aria-label="Chat dengan asisten AI" title="Chat dengan asisten AI" aria-expanded="false">
  <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path class="ico-bubble" d="M7 3h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H15l-6.5 5.2V25H7a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z"/><path class="ico-in" d="M13.5 6.5c.8 4.6 2.4 6.2 7 7-4.6.8-6.2 2.4-7 7-.8-4.6-2.4-6.2-7-7 4.6-.8 6.2-2.4 7-7z"/><path class="ico-accent" d="M22.6 6c.3 1.8.9 2.4 2.7 2.7-1.8.3-2.4.9-2.7 2.7-.3-1.8-.9-2.4-2.7-2.7 1.8-.3 2.4-.9 2.7-2.7z"/></svg>
  <span class="chat-fab-dot" id="chatDot" hidden></span>
</button>
<section class="chat-pop" id="chatPanel" hidden role="dialog" aria-label="Asisten analisis geoteknik">
  <header class="chat-pop-head">
    <div class="chat-pop-id">
      <span class="chat-pop-avatar" aria-hidden="true"><svg viewBox="0 0 32 32" width="22" height="22"><path class="ico-in" d="M16 3c1 7 3.4 9.4 10.5 10.5C19.4 14.6 17 17 16 24c-1-7-3.4-9.4-10.5-10.5C12.6 12.4 15 10 16 3z"/><path class="ico-accent" d="M25 20c.4 2.4 1.2 3.2 3.6 3.6-2.4.4-3.2 1.2-3.6 3.6-.4-2.4-1.2-3.2-3.6-3.6 2.4-.4 3.2-1.2 3.6-3.6z"/></svg></span>
      <div class="chat-pop-title"><strong>Asisten Analisis Geoteknik</strong><span class="chat-pop-sub" id="chatSub">Tanya seputar sistem dan cara kerja</span></div>
    </div>
    <span class="chat-pop-actions">
      <button type="button" id="btnChatClear">Reset</button>
      <button type="button" id="btnChatClose" aria-label="Minimalkan">Close</button>
    </span>
  </header>
  <div class="chat-log" id="chatLog" aria-live="polite"></div>
  <div class="chat-chips" id="chatChips"></div>
  <div class="chat-input">
    <input type="text" id="chatInput" placeholder="Tulis pertanyaan Anda…" aria-label="Pertanyaan">
    <button type="button" class="modal-btn primary" id="btnChatSend">Send</button>
  </div>
  <p class="chat-disclaimer">Jawaban bersumber dari pengetahuan aplikasi serta laporan dan data aktif. Keputusan operasional tetap menjadi kewenangan penanggung jawab geoteknik.</p>
</section>`

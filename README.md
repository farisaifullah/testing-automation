# SLOPE RADAR MONITOR

**Monitoring & Time-of-Failure Prediction**

Aplikasi web front-end untuk memantau data deformasi lereng dari radar, memperkirakan waktu runtuh (*Time of Failure*, ToF), dan menetapkan level kewaspadaan TARP. Dirancang untuk tim geoteknik di lapangan: data dimuat dari file atau screenshot chart, dihitung langsung di browser, lalu hasilnya dapat didiskusikan dengan asisten AI dan diekspor sebagai laporan.

> Aplikasi ini adalah alat bantu analisis. Keputusan operasional (peringatan, pengosongan area, penghentian kerja) tetap menjadi kewenangan penanggung jawab geoteknik sesuai prosedur TARP.

---

## Tujuan

Pemantauan lereng dengan radar menghasilkan deret waktu displacement dan kecepatan yang harus segera ditafsirkan. Aplikasi ini membantu:

1. Mengubah data mentah (CSV/Excel atau screenshot chart radar) menjadi analisis siap pakai tanpa pemrosesan manual.
2. Memperkirakan ToF dengan dua metode independen dan menyatukannya menjadi satu konsensus.
3. Menetapkan level TARP (NORMAL, WASPADA, SIAGA, AWAS) secara konsisten dan terdokumentasi.
4. Menyediakan laporan teks, PDF, dan diskusi lanjutan berbasis AI untuk pengambilan keputusan tim.

Seluruh perhitungan berjalan di browser. Tidak ada server aplikasi; satu-satunya panggilan jaringan adalah ke API Claude untuk fitur AI.

---

## Fitur

### 1. Input data
- **Tabel**: CSV, TSV, XLS, XLSX (kolom waktu wajib, plus displacement atau kecepatan). Seret-lepas atau pilih file.
- **Gambar**: PNG, JPG, WebP lewat pilih file, seret-lepas, atau tempel dengan `Ctrl+V`. Pratinjau dapat diperbesar.
- **Tangkap layar**: pilih tab atau jendela, area chart dipotong (crop), lalu hasilnya masuk ke kolom Gambar.
- **Ekstrak data dari gambar (AI Vision)**: Claude membaca chart radar menjadi tabel waktu, displacement, velocity, dan accel. Hasil dapat diedit, divalidasi otomatis (rata-rata terhadap bar statistik, interval waktu, skala), lalu dipakai atau disimpan sebagai CSV.

### 2. Analisis dan prediksi
- **Fukuzono (inverse velocity)**: regresi linear 1/v terhadap waktu untuk memperkirakan ToF, lengkap dengan slope, intercept, R², SE, dan interval kepercayaan 95%.
- **Bayesian regression**: ToF dengan interval kredibel 95% dan probabilitas runtuh P(fail).
- **Tiga window** (default 30, 60, 120 menit) dengan gerbang kualitas (misalnya R² minimum). Konsensus = ToF valid paling awal dari ketiga window.
- **Level TARP** otomatis dari sisa waktu dan ambang kecepatan/inverse velocity.
- **Filter analisis**: seluruh data, jumlah titik terakhir, rentang tanggal, atau rentang jam (mendukung lintas tengah malam). Semua grafik, tabel, dan prediksi mengikuti filter.
- **Threshold dapat diubah** (kecepatan warning/danger, inverse velocity kritis, lonjakan displacement, R² minimum, horizon prediksi, akselerasi kritis, ukuran window).

### 3. Dashboard
- Badge status, banner ToF dengan hitung mundur, dan kartu KPI (displacement, velocity, inverse velocity, akselerasi, ToF).
- Grafik inverse velocity, Bayesian, displacement, dan probabilitas, ditambah dua grafik referensi termasuk forecast ToF.
- Tabel kalkulasi Fukuzono dan Bayesian dengan pewarnaan P(fail) dan baris konsensus.
- **Event log TARP** (maksimal 50 kejadian terbaru).
- **Edit data**: hapus titik terpilih, kembalikan data asli, terapkan; seluruh analisis dihitung ulang.

### 4. Laporan dan ekspor
- **Salin laporan** teks ringkas.
- **PDF** lengkap (9 bagian: ringkasan, grafik, tabel, dan laporan AI bila ada).
- **Simpan PNG** per grafik.

### 5. Asisten AI (Claude)
- **Laporan analisis AI**: laporan teknis dari hasil analisis yang sedang aktif.
- **Chat geoteknik**: begitu laporan AI selesai, popup chat (gaya messenger) muncul otomatis. Jawaban berbahasa ilmiah, hanya memakai angka dari laporan dan data aktif, dan verdict status terkunci mengikuti sistem.
- Laporan dan chat dikosongkan otomatis saat data diganti atau diedit.

### 6. Antarmuka
- Tema terang/gelap, penanda bahasa **ID / EN** (terjemahan DOM-level), tata letak responsif.

---

## Teknologi

- HTML, CSS, JavaScript ES modules (tanpa build step, tanpa framework)
- [PapaParse](https://www.papaparse.com/), [SheetJS](https://sheetjs.com/) (parsing tabel)
- [Chart.js](https://www.chartjs.org/) (grafik)
- [jsPDF](https://github.com/parallax/jsPDF) (PDF)
- Claude API (laporan, chat, ekstraksi gambar)

---

## Struktur proyek

```
slope-monitor-v1.2/
├── index.html
├── css/
│   └── styles.css
└── js/
    ├── app.js            titik masuk
    ├── core/             state, config, bus, format, math, tema, i18n, secrets
    ├── input/            gambar, tabel, crop, tangkap layar, zoom
    ├── data/             parsing, kolom, pipeline, pembangunan baris
    ├── predict/          Fukuzono, Bayesian, forecast
    ├── dashboard/        banner, KPI, grafik, tabel, filter, threshold,
    │                     event log, edit data, laporan
    ├── export/           PDF dan PNG
    └── ai/               klien Claude, laporan, chat, ekstraksi gambar
```

---

## Menjalankan

Aplikasi memakai ES modules sehingga harus dibuka lewat server lokal (bukan klik dua kali pada `index.html`). Tangkap layar juga hanya berfungsi di `localhost` atau HTTPS.

```bash
cd slope-monitor-v1.2
python -m http.server 8000
# atau: npx serve .
```

Buka `http://localhost:8000`. Gunakan Chrome, Edge, atau Firefox versi terbaru di komputer.

### Mengaktifkan fitur AI

Fitur AI membutuhkan API key Claude. Buat file `js/core/secrets.js` (file ini **diabaikan git** dan tidak boleh di-commit):

```js
export const CLAUDE_API_KEY = 'ISI_KEY_ANDA'
export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'
```

Tanpa key, semua fitur non-AI (input, analisis, grafik, PDF, edit data) tetap berfungsi.

---

## Catatan keamanan

- API key disimpan di sisi klien dan dapat dibaca siapa pun yang mengakses halaman. Gunakan **hanya untuk pemakaian lokal**. Jangan deploy ke publik dengan key tertanam.
- Untuk deployment, pindahkan pemanggilan Claude ke server proxy yang menyimpan key di sisi server.
- Pastikan `js/core/secrets.js` tercantum di `.gitignore` sebelum commit pertama. Cabut dan ganti key apa pun yang pernah tersimpan di repositori atau riwayat git.

---

## Batasan

- Prediksi bersifat statistik dan bergantung pada kualitas serta kerapatan data; window dengan R² rendah atau titik terlalu sedikit otomatis digugurkan.
- Ekstraksi dari gambar memiliki ketidakpastian pembacaan skala; selalu periksa kotak validasi dan tabel hasil sebelum dipakai.
- Jawaban asisten AI adalah dukungan analisis dan wajib diverifikasi oleh engineer geoteknik.

---

## Metode (ringkas)

- **Fukuzono (1985)**: untuk keruntuhan lereng yang dipercepat, kebalikan kecepatan (1/v) menurun mendekati linear terhadap waktu; ekstrapolasi ke 1/v = 0 memberi ToF = −intercept/slope.
- **Bayesian**: regresi dengan sebaran posterior sehingga ToF dilaporkan sebagai interval kredibel dan probabilitas runtuh dalam horizon prediksi.
- **Konsensus**: ToF valid paling awal dari tiga window; level TARP: sisa waktu < 6 jam = AWAS, < 24 jam = SIAGA, selain itu WASPADA bila kecepatan melewati batas warning atau inverse velocity di bawah nilai kritis, dan NORMAL bila tidak.

---

## Lisensi

Tentukan lisensi sebelum dipublikasikan (misalnya MIT) dan tambahkan berkas `LICENSE`.

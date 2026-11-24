TOF Remote Tab Finder  (pasang SEKALI di Chrome PC kantor)

Fungsi: tombol "Open E-Survey" di TOF mencari tab/jendela Chrome Remote Desktop yang menampilkan PC site, di semua
jendela Chrome, lalu membawanya ke depan. Extension tidak membaca isi halaman, tidak memakai akun Gmail, dan hanya
melihat alamat/judul tab Chrome Remote Desktop.

Pasang:
1. Salin folder helper-extension ke PC kantor (tempat tetap, jangan dihapus/dipindah setelah dipasang).
2. Buka chrome://extensions, aktifkan "Developer mode" (pojok kanan atas).
3. Klik "Load unpacked", pilih folder helper-extension.
4. Muat ulang halaman TOF (Ctrl+F5).

Syarat:
- TOF dan Chrome Remote Desktop harus dibuka di PROFIL Chrome yang sama dengan tempat extension dipasang.
- Extension hanya aktif di halaman: https://*.netlify.app, http://localhost, http://127.0.0.1.
  Domain lain: jalankan ulang patch dengan --app=https://alamat-tof, lalu klik tombol reload pada kartu extension.
- Di Windows, Chrome dapat menampilkan peringatan "Disable developer mode extensions" saat Chrome dibuka. Klik
  Cancel/Keep. Itu normal untuk extension yang dipasang dari folder.

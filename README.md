# NiDi AutoColor

Editor foto sederhana dengan pengeditan manual langsung di browser dan alur batch Automatic Processing di server lokal. Pratinjau editing tetap berjalan tanpa koneksi internet setelah halaman terbuka.

## Menjalankan

1. Pasang Node.js dan npm.
2. Dari folder proyek, jalankan `npm install`.
3. Jalankan `npm start`.
4. Buka alamat yang ditampilkan server (secara default `http://localhost:3000`).

## Fitur

- Impor gambar umum yang didukung browser, TIFF melalui decoder lokal UTIF, serta banyak format kamera RAW melalui decoder lokal FlashRaw: CR2/CR3, NEF/NRW, ARW, RAF, RW2, ORF, DNG, IIQ, 3FR/FFF, X3F, GPR, dan lainnya. Batas gambar yang dirender saat ini 160 megapiksel (batas praktis bergantung pada memori perangkat).
- Koreksi suhu warna, tint, kontras, kecerahan, exposure, highlights, shadows, whites, blacks, saturation, hue, texture, clarity, dan vignette.
- Penyesuaian HSL untuk delapan rentang warna, kurva tonal yang dapat ditarik, dan roda warna shadows/midtones/highlights.
- Pratinjau diperbarui langsung saat kontrol digeser, dengan render di background worker agar antarmuka tetap responsif.
- Ekspor berjalan di perangkat pada resolusi asli sebagai PNG lossless atau JPEG kualitas maksimum. Menu menyediakan pilihan nama berkas `.jpeg` dan `.jpg`; keduanya memakai encoding JPEG yang sama. JPEG tetap lossy dan memakai latar putih untuk area transparan. File hasil ekspor dipakai sebagai pratinjau final.
- Automatic Processing menerima banyak foto, menerapkan beberapa template tersimpan, dan memproses tiap kombinasi foto-template secara paralel di server. Hasil dapat diunduh satu per satu.

Browser harus mendukung `createImageBitmap`, Web Workers, dan `OffscreenCanvas` untuk pemrosesan lokal. Ekspor dibuat ulang dari foto asli pada resolusi penuh; PNG tidak memakai kompresi lossy. Pipeline Canvas memproses warna 8 bit per kanal; sumber 16 bit/HDR, profil warna khusus, serta metadata kamera tidak dipertahankan persis oleh browser.

Jalankan `npm run build:formats` setelah memasang dependensi untuk membangun decoder RAW dan TIFF lokal. Decoder RAW mencakup banyak varian kamera, tetapi tidak mendukung setiap codec proprietary. HEIC/HEIF, JXL, PSD/PSB, dan EXR hanya dapat dibuka jika browser dapat mendekodenya; format yang tidak terbaca akan menampilkan pesan error. TIFF multi-halaman membuka halaman pertama. EXR dan dokumen ber-layer tidak dipertahankan sebagai data HDR/layer saat diedit atau diekspor.

## Template

Pengaturan HSL, warna, cahaya, kurva, efek, roda warna, dan format ekspor disimpan sebagai file JSON di folder `Template` pada root proyek. File ini hanya berisi konfigurasi, tidak menyimpan foto. Nama template menerima huruf ASCII, angka, spasi, underscore, dan tanda hubung hingga 64 karakter. Template yang diterapkan tidak mengubah file template asal; simpan perubahan sebagai template baru.

## Automatic Processing

Tab Automatic Processing hanya mengatur template dan `Delete After`; upload, status, dan unduh hasil dilakukan lewat API. Pengaturan disimpan di `Automatic_Processing/template_settings.json`. `Delete After` berlaku per foto dan mulai dihitung setelah semua template selesai. Server menghapus file input dan semua hasil saat timer habis. Nilainya 1–10.080 menit; default 60 menit.

API pilihan template memakai `GET` dan `POST /api/automatic-processing/templates`. Contoh body untuk menyimpan pengaturan:

```json
{"templateNames":["hehe"],"deleteAfterMinutes":60}
```

Upload satu gambar mentah per permintaan ke `POST /api/automatic-processing/jobs` dengan `Content-Type: image/jpeg` (sesuaikan format) dan header `X-File-Name` yang di-URL-encode. Respons `202` berisi `jobId`; `GET /api/automatic-processing/jobs/:jobId` memberi status dan URL unduhan. Daftar proses tersedia di `GET /api/automatic-processing/jobs`. Tiap hasil diunduh lewat URL `/api/automatic-processing/jobs/:jobId/outputs/:outputId`.

Renderer server memakai algoritme koreksi dan pemrosesan tile yang sama dengan editor browser. Satu foto menghasilkan satu file untuk setiap template terpilih, dan tiap hasil dirender secara paralel. Upload tidak memiliki batas ukuran atau jumlah piksel buatan aplikasi; kapasitas disk dan perangkat tetap berlaku. Maksimal 20 worker render berjalan bersamaan secara default. Jumlahnya dapat diatur lewat `AUTO_RENDER_WORKERS` dari 1 hingga 20.

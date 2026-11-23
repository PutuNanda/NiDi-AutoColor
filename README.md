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

Pilih beberapa template dari Template Library, lalu simpan pilihannya di `Automatic_Processing/template_settings.json`. Foto yang dikirim melalui `POST /api/automatic-processing/jobs` disimpan di `Automatic_Processing/input/<id>/`; hasil per template berada di `Automatic_Processing/output/<id>/`. Gunakan `GET /api/automatic-processing/jobs` untuk status dan tautan unduhan. Renderer server memakai algoritme koreksi dan pemrosesan tile yang sama dengan editor browser. Tidak ada batas ukuran atau jumlah piksel buatan aplikasi untuk alur ini; pemrosesan tetap dibatasi kapasitas disk dan perangkat. File proses dibersihkan setelah enam jam.

API pilihan template memakai `GET` dan `POST /api/automatic-processing/templates`. Upload menerima satu file gambar per permintaan dengan nama file pada header `X-File-Name`; antarmuka mengirim beberapa permintaan secara bersamaan. Worker render berjalan pada thread terpisah dengan dua proses paralel secara default. Jumlahnya dapat diatur lewat `AUTO_RENDER_WORKERS` hingga maksimal 4.

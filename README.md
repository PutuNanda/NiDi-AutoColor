# NiDi AutoColor

Editor foto sederhana yang mengimpor, mengedit, dan mengekspor gambar langsung di browser. Foto dan pengaturan tidak perlu dikirim ke server saat proses edit, sehingga pratinjau tetap berjalan tanpa koneksi internet setelah halaman terbuka.

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

Browser harus mendukung `createImageBitmap`, Web Workers, dan `OffscreenCanvas` untuk pemrosesan lokal. Ekspor dibuat ulang dari foto asli pada resolusi penuh; PNG tidak memakai kompresi lossy. Pipeline Canvas memproses warna 8 bit per kanal; sumber 16 bit/HDR, profil warna khusus, serta metadata kamera tidak dipertahankan persis oleh browser.

Jalankan `npm run build:formats` setelah memasang dependensi untuk membangun decoder RAW dan TIFF lokal. Decoder RAW mencakup banyak varian kamera, tetapi tidak mendukung setiap codec proprietary. HEIC/HEIF, JXL, PSD/PSB, dan EXR hanya dapat dibuka jika browser dapat mendekodenya; format yang tidak terbaca akan menampilkan pesan error. TIFF multi-halaman membuka halaman pertama. EXR dan dokumen ber-layer tidak dipertahankan sebagai data HDR/layer saat diedit atau diekspor.

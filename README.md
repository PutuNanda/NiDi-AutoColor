# NiDi AutoColor

Editor foto sederhana dengan seluruh pemrosesan gambar berjalan di server menggunakan Node.js dan Sharp. Browser hanya mengirim foto serta pengaturan, lalu menampilkan pratinjau yang dikirim server.

## Menjalankan

1. Pasang Node.js dan npm.
2. Dari folder proyek, jalankan `npm install`.
3. Jalankan `npm start`.
4. Buka alamat yang ditampilkan server (secara default `http://localhost:3000`).

## Fitur

- Impor foto JPG, PNG, WebP, AVIF, GIF, dan TIFF hingga 35 MB.
- Koreksi suhu warna, tint, kontras, kecerahan, exposure, highlights, shadows, whites, blacks, saturation, hue, texture, clarity, dan vignette.
- Penyesuaian HSL untuk delapan rentang warna, kurva tonal yang dapat ditarik, dan roda warna shadows/midtones/highlights.
- Pratinjau hasil edit dan ekspor PNG atau JPG pada resolusi asli.

Foto asli disimpan sementara di memori server dan dibersihkan setelah 30 menit tidak aktif. Maksimal delapan foto aktif disimpan sekaligus. Foto tidak disimpan ke disk.

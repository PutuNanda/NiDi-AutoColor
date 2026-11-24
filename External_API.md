# External API

Base URL default: `http://127.0.0.1:3000`. Dokumen ini membahas workflow batch Automatic Processing untuk script eksternal. Endpoint upload, status, dan unduh di bawah tidak dipanggil oleh UI web.

Sebelum membuat proses, pilih dan simpan template di tab **Automatic Processing**. Server mengambil snapshot template dan `Delete After` saat foto pertama diunggah. Semua foto yang dikirim menggunakan ID tersebut akan memakai pilihan template yang sama.

## Alur API

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| `POST` | `/api/automatic-processing/jobs` | Mengunggah foto pertama, membuat kelompok proses, dan mengembalikan `jobId`. |
| `POST` | `/api/automatic-processing/jobs/:jobId/photos` | Mengunggah satu foto ke kelompok dengan `jobId` tersebut. Kirim foto sebagai raw request body. |
| `GET` | `/api/automatic-processing/jobs/:jobId/status` | Melihat status kelompok, status setiap foto, dan status tiap hasil template. |
| `GET` | `/api/automatic-processing/jobs/:jobId/download` | Mengunduh ZIP berisi semua hasil yang sudah selesai saat request dibuat. |

`jobId` dibuat server menggunakan UUID. Gunakan ID yang dikembalikan endpoint pertama pada upload, status, dan download. Request tanpa ID yang valid tidak diterima.

## 1. Unggah foto pertama dan buat ID kelompok

```http
POST /api/automatic-processing/jobs
Content-Type: image/jpeg
X-File-Name: portrait.jpg

<raw image bytes>
```

Respons `202 Accepted` berisi ID kelompok yang dibuat server dan ID foto pertama:

```json
{
  "jobId": "7d1fc786-e255-4e7c-a711-3fcbfdb0823d",
  "photoId": "0c4c6d33-29a6-4625-a0d3-f1e25ab520a7",
  "name": "portrait.jpg",
  "status": "processing",
  "total": 2
}
```

## 2. Unggah foto berikutnya ke kelompok

Kirim satu foto per request sebagai raw body. Jangan gunakan `multipart/form-data`. Unggah beberapa foto dengan mengulang request dan memakai `jobId` yang sama.

```http
POST /api/automatic-processing/jobs/7d1fc786-e255-4e7c-a711-3fcbfdb0823d/photos
Content-Type: image/jpeg
X-File-Name: portrait.jpg

<raw image bytes>
```

Header `X-File-Name` sebaiknya URL-encoded bila berisi spasi atau karakter non-ASCII. Format yang didukung: JPEG, PNG, WebP, AVIF, GIF, TIFF, HEIF/HEIC. Maksimal 100 foto dapat sedang diunggah, mengantre, atau diproses pada saat yang sama.

Respons `202 Accepted` mengembalikan `photoId`. Server mulai memproses foto dengan semua template yang dipilih untuk kelompok tersebut. Foto-foto dalam satu kelompok disimpan di folder yang sama berdasarkan `jobId`.

## 3. Cek status kelompok dan foto

```http
GET /api/automatic-processing/jobs/7d1fc786-e255-4e7c-a711-3fcbfdb0823d/status
```

Status kelompok dapat berupa `uploading`, `queued`, `processing`, `done`, `partial`, atau `error`. Di dalam `photos`, tiap foto dan tiap hasil template memiliki statusnya sendiri: `queued`, `processing`, `done`, atau `error` (foto juga dapat berstatus `partial`). `completed` dan `total` menghitung hasil template yang selesai dibanding seluruh hasil yang diterima server.

`done`, `partial`, dan `error` berarti semua foto yang sudah diunggah hingga saat itu telah selesai diproses. Kelompok masih dapat menerima foto tambahan selama belum kedaluwarsa; mengunggah foto tambahan akan memulai kembali penghitung waktu penghapusan setelah foto-foto terbaru selesai.

## 4. Unduh hasil yang sudah selesai

```http
GET /api/automatic-processing/jobs/7d1fc786-e255-4e7c-a711-3fcbfdb0823d/download
```

Respons berupa file ZIP yang hanya berisi hasil berstatus `done` saat request diterima. Jadi script boleh mengunduh hasil yang sudah siap meskipun foto lain masih antre atau diproses. Panggil endpoint ini lagi untuk memperoleh hasil yang selesai belakangan. Jika belum ada hasil yang selesai, server mengembalikan `409 Conflict`.

Nama setiap file hasil memakai nama asli foto, ditambah nama template dalam tanda kurung sebelum ekstensi output. Contoh: `portrait (Portrait).jpg`. Ekstensi mengikuti format ekspor template; jika hasil JPEG dan file sumber memakai `.jpg` atau `.jpeg`, ejaan ekstensi sumber dipertahankan. Hasil di dalam ZIP dikelompokkan ke folder berdasarkan nama foto asal agar nama file yang sama tidak saling menimpa.

## Contoh Python

Memerlukan `requests` (`python -m pip install requests`). Contoh ini membuat satu kelompok, mengunggah semua foto, menunggu sampai semuanya selesai, lalu mengunduh hasilnya.

```python
from mimetypes import guess_type
from pathlib import Path
from time import sleep
from urllib.parse import quote

import requests

base = "http://127.0.0.1:3000"
photos = [Path("portrait.jpg"), Path("landscape.png")]

# Upload the first photo; the server creates the group and its ID.
first_photo = photos[0]
content_type = guess_type(first_photo.name)[0] or "application/octet-stream"
with first_photo.open("rb") as image:
    response = requests.post(
        f"{base}/api/automatic-processing/jobs",
        data=image,
        headers={
            "Content-Type": content_type,
            "X-File-Name": quote(first_photo.name, safe=""),
        },
        timeout=None,
    )
response.raise_for_status()
job_id = response.json()["jobId"]

# Upload the remaining photos to the same group ID.
for photo in photos[1:]:
    content_type = guess_type(photo.name)[0] or "application/octet-stream"
    with photo.open("rb") as image:
        response = requests.post(
            f"{base}/api/automatic-processing/jobs/{job_id}/photos",
            data=image,
            headers={
                "Content-Type": content_type,
                "X-File-Name": quote(photo.name, safe=""),
            },
            timeout=None,
        )
    response.raise_for_status()

# Poll each photo's queue and processing state.
while True:
    response = requests.get(
        f"{base}/api/automatic-processing/jobs/{job_id}/status",
        timeout=30,
    )
    response.raise_for_status()
    job = response.json()
    if job["status"] in {"done", "partial", "error"} and job["uploadsInProgress"] == 0:
        break
    sleep(2)

# The ZIP contains all successful outputs. It may also be downloaded earlier
# to get only the outputs completed so far.
if job["completed"]:
    response = requests.get(
        f"{base}/api/automatic-processing/jobs/{job_id}/download",
        timeout=None,
    )
    response.raise_for_status()
    Path(f"NiDi_AutoColor_{job_id}.zip").write_bytes(response.content)
```

Retensi hasil mengikuti `Delete After` yang tersimpan di tab Automatic Processing (default 60 menit, rentang 1–10.080 menit). Waktu retensi dimulai setelah semua foto yang sudah diunggah selesai diproses. Download hasil sebelum `expiresAt`; setelah kedaluwarsa, ID proses mengembalikan `404` dan file input serta hasilnya dihapus. Render memakai hingga 20 worker secara default; atur `AUTO_RENDER_WORKERS` dari 1 sampai 20 untuk mengubah jumlahnya.

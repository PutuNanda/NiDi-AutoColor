# Automatic Processing API

Base URL default: `http://127.0.0.1:3000`.

The Automatic Processing page configures selected templates and `deleteAfterMinutes`. Photo upload, status polling, and result downloads are API-only.

## Configure templates and retention

`GET /api/templates` lists saved templates stored as `.nd` files containing JSON data. Save the selected names and retention duration with:

```http
POST /api/automatic-processing/templates
Content-Type: application/json

{"templateNames":["hehe"],"deleteAfterMinutes":60}
```

`deleteAfterMinutes` accepts 1–10,080 minutes. The default is 60 minutes. Each job snapshots this value when it is uploaded; its countdown starts after all selected templates finish. The server then deletes that job's input and output files.

## Upload a photo

Send one raw image body per request. Do not use `multipart/form-data`.

```http
POST /api/automatic-processing/jobs
Content-Type: image/jpeg
X-File-Name: photo.jpg

<raw image bytes>
```

The API responds with `202 Accepted` and a `jobId`. The filename header should be URL-encoded when it contains non-ASCII characters or spaces. Image uploads do not have an application byte or pixel limit; available disk and system resources still apply. At most 100 jobs may be queued or processing at once.

## Check status and download results

- `GET /api/automatic-processing/jobs` lists retained jobs.
- `GET /api/automatic-processing/jobs/:jobId` returns one job and its outputs.
- The server creates one output per selected template. Those renders run concurrently, up to 20 workers by default. Each completed output includes its template name and `downloadUrl`, for example `GET /api/automatic-processing/jobs/:jobId/outputs/:outputId`.

Each output is generated from one selected template. `GET /api/automatic-processing/jobs` reports the worker capacity in `parallelWorkers`. Set `AUTO_RENDER_WORKERS` to an integer from 1 to 20 to tune concurrency. Download outputs before the job's `expiresAt`; after expiry its input and outputs are removed and the job ID returns `404`.

## Python example

Requires `requests` (`python -m pip install requests`).

```python
from pathlib import Path
from time import sleep
from urllib.parse import quote

import requests

base = "http://127.0.0.1:3000"
photo = Path("photo.jpg")

with photo.open("rb") as image:
    response = requests.post(
        f"{base}/api/automatic-processing/jobs",
        data=image,
        headers={
            "Content-Type": "image/jpeg",
            "X-File-Name": quote(photo.name),
        },
        timeout=None,
    )
response.raise_for_status()
job_id = response.json()["jobId"]

while True:
    response = requests.get(f"{base}/api/automatic-processing/jobs/{job_id}")
    response.raise_for_status()
    job = response.json()
    if job["status"] in {"done", "partial", "error"}:
        break
    sleep(2)

for output in job["outputs"]:
    if output["status"] != "done":
        continue
    response = requests.get(base + output["downloadUrl"])
    response.raise_for_status()
    Path(output["fileName"]).write_bytes(response.content)
```

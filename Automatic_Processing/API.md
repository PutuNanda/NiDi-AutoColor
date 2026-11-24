# Automatic Processing API

External upload, status, and download endpoints are documented in the project-root [External_API.md](../External_API.md).

Template selection and result retention are configured in the Automatic Processing page. The server snapshots those saved settings when the first photo is uploaded to `POST /api/automatic-processing/jobs` to create an external processing group.

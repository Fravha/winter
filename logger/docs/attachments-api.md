# Attachments API (P10.5)

Attachments are metadata records backed by a private Supabase Storage bucket.
The API is mounted at `/api/v1/attachments`; every operation requires
authentication, `production:read`, and the corresponding `attachments:read` or
`attachments:create` permission.

* `POST /api/v1/attachments` — multipart fields `entityType`, `entityId`,
  `file`, and optional `observations`. Accepted MIME types are JPEG, PNG, WEBP,
  and PDF; the maximum is 10 MiB.
* `GET /api/v1/attachments?entityType=...&entityId=...` — list evidence for a
  validated target.
* `GET /api/v1/attachments/:id` — metadata detail.
* `GET /api/v1/attachments/:id/download-url` — five-minute signed URL,
  generated on demand and never persisted.

The initial target enum is `GRAPE_RECEPTION`, `PRODUCTION_WORK`, `MEASUREMENT`,
`TRANSFORMATION`, and `PRODUCTION_LOSS`. There is intentionally no delete or
detach endpoint. Trace integration is deferred to P11 to avoid coupling.
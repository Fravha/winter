# Production P1 API

Base URL: `/api/v1/production`. All endpoints require authentication. List
queries use `page`, `pageSize`, `search` and `active`.

## Read-only catalogs

* `GET /work-types`
* `GET /measurement-types`

Both require `production:read`. They are intentionally read-only in P1.

## Administrative catalogs

Participants (`/participants`), producers (`/producers`) and grape varieties
(`/grape-varieties`) expose:

* `GET /` with `production:read`
* `POST /` with the respective `production:*_manage` permission and body
  `{ "code": "...", "name": "..." }`
* `PATCH /:id` (name only), `POST /:id/activate`, and
  `POST /:id/deactivate`, with the same management permission.

Codes are unique and immutable; there is no DELETE. Deactivation is logical.
Every administrative command obtains its actor from the authentication context
and records an audit event atomically with the catalog change.

P1 deliberately does not expose orders, batches, works, receptions,
transformations, containers or operational measurements.

## Custom fields

`GET /custom-fields/definitions` (read permission) lists definitions.
`POST /custom-fields/definitions`, `PATCH /custom-fields/definitions/:id`,
and `POST /custom-fields/definitions/:id/activate|deactivate` require
`production:custom_fields_manage`. Codes and data types are immutable.
`PUT /custom-fields/values` upserts a typed Producer or GrapeVariety value with
the same management permission. Values are strict by definition: DATE is an
ISO-8601 string (converted server-side), DECIMAL is a decimal string (never a
JSON number), INTEGER is a safe integer, and TEXT/SELECT/BOOLEAN use their
corresponding JSON primitive. GrapeReception values are explicitly rejected
until P6.
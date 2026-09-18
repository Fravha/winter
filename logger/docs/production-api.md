# Production P2/P3 API

Base URL: `/api/v1/production`. All endpoints require authentication. List
queries use `page`, `pageSize`, `search` and `active`.

## Catalogs

* `GET /work-types` and `GET /measurement-types` require `production:read`.
* `POST /work-types`, `PATCH /work-types/:id`, and
  `POST /work-types/:id/activate|deactivate` require
  `production:work_type_manage`.
* `POST /measurement-types`, `PATCH /measurement-types/:id`, and
  `POST /measurement-types/:id/activate|deactivate` require
  `production:measurement_type_manage`.

Bodies are `{ "code": "...", "name": "..." }` on creation and `{ "name": "..." }`
on update. Codes are immutable, active is logical, and neither catalog has a
DELETE endpoint. These are administrative catalog commands, not historical
production commands, and P1 creates no seed data.

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

P2 exposes only the order aggregates below. Batches, works, receptions,
transformations, containers and operational measurements remain outside this
phase.

## Production batches (P3)

Batch commands are internal typed services only; there are no HTTP mutation
routes. `ProductionBatchService`, `BatchLedgerService`, `BatchLineageService`
and `BatchAvailabilityService` validate authenticated actors and execute
ledger, balance, lineage, operation-key and audit writes atomically.

The read-only endpoints require `production:read`:

* `GET /batches?page=1&pageSize=20&productionOrderId=...&articuloId=...`
* `GET /batches/:id`
* `GET /batches/:id/balance`

All quantities are decimal strings with exactly three supported fractional
places and all units must match exactly. Batches have no status and remain
historically queryable at zero availability. The append-only ledger derives
`available` as generated minus consumed, separated, loss and transferred
quantities. P3 creates only generated, consumed and separated facts; loss,
transformations and Inventory transfers remain future phases.

Internal commands support initial generation, partial consumption, split and
merge. They require stable `operationKey` and `requestHash`; a retry with the
same pair returns the stored result, while a changed request raises
`IDEMPOTENCY_CONFLICT`. Split and merge conserve quantities exactly, preserve
parent/child lineage, reject unit mismatches, self-edges, cycles and
insufficient availability. There is no batch DELETE or editable balance.

## Production orders

`GET /orders` and `GET /orders/:id` require `production:read`.
`POST /orders` requires `production:order_create` and accepts
`{ "code": "...", "startDate": "...", "observations": "..." }`.
`POST /orders/:id/close` requires `production:order_close`.
An order is created `OPEN` and can be closed once only; closing is irreversible.
An order with an open transformation order cannot be closed.

## Transformation orders

`GET /transformation-orders` and `GET /transformation-orders/:id` require
`production:read`. `POST /transformation-orders` requires
`production:transformation_order_create` and accepts
`{ "code": "...", "productionOrderId": "...", "periodStart": "...",
"periodEnd": "...", "observations": "..." }`. `POST
/transformation-orders/:id/close` requires
`production:transformation_order_close`. Transformation orders belong to a
ProductionOrder, use `OPEN`/`CLOSED`, and cannot be reopened. P2 has no
operational child entities, so additional incomplete-operation preconditions
remain an explicit extension point for later phases.

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
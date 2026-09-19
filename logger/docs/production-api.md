# Production P2/P3/P6 API

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

## Production containers (P4)

Containers are managed with `production:container_manage`; reads require
`production:read`:

* `GET /containers`
* `GET /containers/:id`
* `GET /containers/:id/occupancies`
* `GET /containers/:id/movements`
* `POST /containers`
* `PATCH /containers/:id`
* `POST /containers/:id/activate`
* `POST /containers/:id/deactivate`

Creation requires a unique code, positive decimal `capacity` and exact
`capacityUnit`. A container is `DISPONIBLE`, `OCUPADO` or
`FUERA_DE_SERVICIO`; an occupied container cannot accept another batch and an
out-of-service container cannot be occupied. Occupancies are temporal history
records, while the P3 batch ledger remains the source of truth for quantity.

Batch assignment and total/partial container transfers are typed internal
commands, not HTTP mutation routes. They require an operation key and request
hash, use exact decimal quantities and units, and audit atomically. Total
transfer preserves the same batch; partial transfer creates exactly one child
through the P3 split primitive and preserves lineage.

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
 corresponding JSON primitive. GrapeReception values may be supplied during
 reception creation and are validated against active definitions.

## Grape receptions (P6)

`GET /grape-receptions` and `GET /grape-receptions/:id` require
`production:read`; `POST /grape-receptions` requires
`production:reception_create`, a stable `operationKey` and `requestHash`.
Each item creates exactly one initial ProductionBatch through P3 primitives.
Articles are validated through ArticulosApi and units must match exactly. The
contractual classification matrix does not currently exist, so no
classification restriction is invented or enforced. Receptions have no PATCH
or DELETE endpoint and do not create InventoryMovement records.

## Production work (P5)

`GET /works` and `GET /works/:id` require `production:read`. `POST /works`
requires `production:work_create`; `POST /works/:id/corrections` requires
`production:work_correct`. Work records require an open production order and
active work type. A transformation order, batches, containers and active
participants may be linked without changing their quantities or state.

Work creation records the authenticated actor and preserves `performedAt`
separately from `createdAt`. Corrections are explicit, require a reason, and
retain previous and new values. There is no DELETE or generic PATCH endpoint.

## Production measurements (P7)

`GET /measurements` and `GET /measurements/:id` require `production:read`;
`POST /measurements` requires `production:measurement_create`. A measurement
requires an active `measurementTypeId`, a decimal string `value` (persisted as
`DECIMAL(18,6)`), and a trimmed nonblank `unit`. At least one of
`productionBatchId`, `productionContainerId` or `productionWorkId` is required;
all references must exist. Participants are optional but must be active.
When a work is supplied, any supplied batch and container must be linked to it
through the P5 relations. Measurements preserve `measuredAt` separately from
`createdAt`, record the authenticated actor, are append-only, and have no
PATCH or DELETE endpoint. They do not alter batch balances, containers,
Inventory, Articles or other production state. The approved contract does not
define unit catalogs/conversions or batch-container temporal coherence without
work, so those checks remain explicit gaps.

## Release production to Inventory (P9)

`POST /batches/:id/release-to-inventory` requires `production:inventory_release`.
The body contains `quantity`, `warehouseId`, `operationKey`, `lotCode`,
`classification`, `fechaIngreso` and optional `observations`. Releases are
allowed for OPEN and CLOSED orders, while the order and batch are locked.
Only `PRODUCTO_ENVASADO` output is accepted; open container allocations cannot
be consumed. Lot reuse requires the same article and origin batch and unchanged
classification, date and observations. Inventory writes, transfer ledger,
balance, idempotency result and audit are one Serializable transaction and
rollback together. The response returns the batch, quantity, remaining
quantity, lot, movement and warehouse identifiers. No PATCH or DELETE exists.
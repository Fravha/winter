## P10 trace and historical corrections

`GET /api/v1/production/batches/:batchId/trace` reconstructs bounded batch lineage and related reception, work, transformation, loss, container, measurement and Inventory facts with `production:read`.

Historical corrections are append-only commands:

- `POST /api/v1/production/measurements/:id/corrections` (`production:measurement_correct`)
- `POST /api/v1/production/grape-receptions/:id/corrections` (`production:reception_correct`)

Each command requires `field`, `newValue`, `reason`, and stable `operationKey`. Original facts, actors, batches, ledger and inventory movements remain immutable. Reception corrections are limited to `receivedAt`, `producerId`, `observations`, and `status`, with field-specific `newValue` types and no public `requestHash`; quantities, articles, varieties, units and generated batches are not correctable. Corrections are append-only, reject no-ops, preserve the same result on an identical replay, and reject a changed payload with `IDEMPOTENCY_CONFLICT`.
# Production P2/P3/P6 API

Base URL: `/api/v1/production`. All endpoints require authentication. La
paginación y los filtros de los listados son específicos de cada endpoint; no
todos soportan `search` o `active`.

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
* `GET /batches/:batchId`
* `GET /batches/:batchId/balance`

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

Batch assignment and total/partial container transfers are available through
`POST /containers/:id/assign`, `POST /containers/:sourceId/transfers` and
`POST /containers/:sourceId/transfers/partial`, respectively. They require
`production:container_assign` or `production:container_transfer`, an
`operationKey` and a 64-character `requestHash`, use exact decimal quantities
and units, and audit atomically. Total transfer preserves the same batch;
partial transfer creates exactly one child through the P3 split primitive and
preserves lineage.

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

`GET /api/v1/production/grape-receptions` and `GET /api/v1/production/grape-receptions/:id` require
`production:read`. El listado `GET /api/v1/production/grape-receptions` admite únicamente
`page` y `pageSize`; no admite `search` ni `active`. `POST /api/v1/production/grape-receptions` requires
`production:reception_create`, a stable `operationKey` and `requestHash`.
`producerId` and `observations` are optional; observations are capped at 2000
characters and are required when status is `ACCEPTED_WITH_OBSERVATIONS`. Each
item has `grapeVarietyId`, `articuloId`, positive decimal-string `quantity` and
unit `KG|G|L|M|UNIDAD`; each optional custom field is
`{definitionId: UUID, value: string|number|boolean}`. Each item creates exactly one initial ProductionBatch through P3 primitives.
Articles are validated through ArticulosApi and units must match exactly. The
contractual classification matrix does not currently exist, so no
classification restriction is invented or enforced. Receptions have no PATCH
or DELETE endpoint and do not create InventoryMovement records.

## Transformaciones con conciliación física

`POST /transformations` requires `production:transformation_create`; a
non-empty `losses` array also requires `production:loss_create`, and non-empty
`outputPlacements` requires `production:container_assign`. The existing
`inputs`, `outputs`, `losses`, `performedAt`, `productionOrderId`,
`operationKey` and `requestHash` remain valid. Transformations without
containers retain their existing behavior.

Optional `sourceWithdrawals` is an array of
`{ "productionBatchId": "UUID", "containerId": "UUID", "quantity": "40.000" }`.
Each entry identifies an open occupancy of an input batch and the physical
quantity withdrawn from that container. Partial withdrawal closes the
historical occupancy and opens a new occupancy for the remaining amount;
total withdrawal closes it and makes the container available. Losses reducing
the physically withdrawn amount must carry that batch's `productionBatchId`;
losses without an attributable batch are not implicitly assigned to a
container.

Optional `outputPlacements` is an array of
`{ "outputIndex": 0, "containerId": "UUID", "quantity": "39.000" }`.
`outputIndex` is zero-based in the `outputs` array. Placement is optional,
cannot exceed the output quantity, and must respect container status,
capacity, unit and existing occupancy rules. An output can remain unplaced.

For example, 100 L of A in T01 can withdraw 100 L, consume 98 L of A,
attribute 2 L of loss to A, create 98 L of B, and place 98 L of B in T02.
T01 becomes available and A has zero available; B has 98 L available and an
open occupancy in T02. A partial 40 L withdrawal with 39 L consumed and
1 L attributed loss leaves 60 L of A in T01 and generates 39 L of B.
Open occupancies must always remain backed by available batch quantity;
the ledger guard is never disabled.

Closure/reopening of occupancies, ledger changes, output batches, lineage,
optional placement, audit and the idempotency result belong to one
`Serializable` transaction. On any failure all changes roll back. The
idempotency hash covers inputs, outputs, losses, source withdrawals and output
placements; an identical key and payload replays the same result without
duplicate effects, while reusing the key with different data conflicts.
`GET /batches/:id/trace` exposes physical provenance from output to source
batch and containers.

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

`POST /batches/:batchId/release-to-inventory` requires `production:inventory_release`.

The body contains `quantity`, `warehouseId`, `operationKey`, `lotCode`,
`classification`, `fechaIngreso` and optional `observations`. Releases are
allowed for OPEN and CLOSED orders, while the order and batch are locked.
Only `PRODUCTO_ENVASADO` output is accepted; open container allocations cannot
be consumed. Lot reuse requires the same article and origin batch and unchanged
classification, date and observations. Inventory writes, transfer ledger,
balance, idempotency result and audit are one Serializable transaction and
rollback together. The response returns the batch, quantity, remaining
quantity, lot, movement and warehouse identifiers. No PATCH or DELETE exists.

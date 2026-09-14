# Compras API

The authorized `compras` module is mounted at `/api/v1/compras`. It has no
DELETE endpoint and does not reuse the legacy `purchases` contract or tables.

## Permissions

The module declares exactly:

- `compras:read`
- `compras:create`
- `compras:update`
- `compras:receive`
- `compras:cancel`

All endpoints use the current Firebase authentication and current-user
permission middleware. Actors, `createdByUserId`, status, timestamps,
transaction contexts, trusted intermodule markers, and idempotency keys are
server-controlled and are rejected by strict request schemas.

## Purchase representation

`Compra` contains supplier and document reference data, optional currency and
observations, its `REGISTERED`, `RECEIVED`, or `CANCELLED` status, and the
authenticated creator. `CompraItem` contains the article, optional brand,
positive requested quantity, exact article base unit, and optional referential
unit price. Quantities and prices use decimal precision of three places.

Articles are validated exclusively through `ArticulosApi`; they must exist and
be active, and the submitted unit must equal the base unit. `UNIDAD` quantities
must be integers. An article can occur only once in a compra. Items cannot be
physically deleted. Updates are allowed only while `REGISTERED`.

## Endpoints

### `GET /api/v1/compras`

Returns `{ data, meta }`. Pagination defaults to page `1`, page size `20`, and
allows at most `100`. The only filter is the optional `status` enum.

### `GET /api/v1/compras/:id`

Returns `{ data }` for the purchase and its items.

### `POST /api/v1/compras`

Creates a `REGISTERED` compra. The body requires `supplierName` and at least one
item. Optional fields are `supplierTaxId`, `documentNumber`, `documentDate`,
`currency`, and `observations`. Item fields are `articuloId`, `brand`,
`requestedQuantity`, `unit`, and `unitPrice`.

### `PATCH /api/v1/compras/:id`

Updates approved administrative fields and item values while the purchase is
`REGISTERED`. Existing items must remain present; adding an item is allowed,
but deleting a `CompraItem` is not.

### `POST /api/v1/compras/:id/receive`

The body is:

```json
{
  "warehouseId": "uuid",
  "items": [
    { "compraItemId": "uuid", "inventoryLotId": "uuid" }
  ]
}
```

`items` may be omitted when no existing lots are needed. When provided, it must
contain every item exactly once. The backend generates
`purchase-receive:{purchaseId}:{purchaseItemId}` for every item.

Receiving opens one shared Prisma `Serializable` transaction. It reloads the
purchase, validates its state, invokes the trusted internal Inventory batch
API with the same transaction, creates normalized
`CompraInventoryMovementReference` rows, changes the state to `RECEIVED`, and
audits both modules. P2034 retries rerun the entire workflow with the same
keys. Any item failure rolls back purchase state, stock, movement,
idempotency, references, and audits.

Compras does not need `inventory:inbound`; direct manual Inventory inbound
continues to require that permission.

### `POST /api/v1/compras/:id/cancel`

The body is `{ "reason": "optional text" }`. Only `REGISTERED` purchases can be
cancelled. Cancellation never changes Inventory. If supplied, the reason is
stored only in cancellation audit metadata; it is never copied into
`observations` and there is no status-reason field.

There is intentionally no DELETE route.

## Ownership and movement references

Inventory owns warehouses, lots, stock, movements, and Inventory idempotency.
Compras calls only `InventoryApi`. Its reference table stores only the
identifiers of a compra, item, and Inventory movement. It does not duplicate
quantity, unit, stock, warehouse, lot, or actor data.
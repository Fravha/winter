# API de Inventory

Base HTTP: `/api/v1/inventory`.

## Reglas generales

- `InventoryMovement` es el historial inmutable y `InventoryStock` es el saldo
  materializado.
- Todas las cantidades se reciben y devuelven como decimales con máximo tres
  posiciones. La respuesta las normaliza a tres posiciones.
- La unidad debe coincidir exactamente con `unidadMedida` del Artículo.
- `UNIDAD` solo admite cantidades enteras.
- No existen conversiones automáticas, reservas, edición ni eliminación de
  movimientos.
- Cada command de inventario requiere `Idempotency-Key`. Repetir la misma clave
  con la misma operación y payload devuelve la respuesta original. Reutilizarla
  con otra operación o payload responde `409 IDEMPOTENCY_CONFLICT`.
- Las respuestas HTTP usan `{ "data": ..., "meta": ... }`.

## Almacenes

- `GET /warehouses?page=1&pageSize=20`
- `GET /warehouses/:warehouseId`
- `POST /warehouses`
- `PATCH /warehouses/:id`
- `POST /warehouses/:id/activate`
- `POST /warehouses/:id/deactivate`

El código es obligatorio, inmutable y único sin distinguir mayúsculas. No hay
`DELETE`. Un almacén con cualquier saldo distinto de cero no puede
desactivarse.

## Consultas

- `GET /lots/:inventoryLotId`
- `GET /stock?warehouseId=...&articuloId=...&inventoryLotId=...`
- `GET /stock/available?warehouseId=...&articuloId=...&inventoryLotId=...`

Las respuestas de stock incluyen `hasNegativeStock`.

## Movimientos manuales

- `POST /inbound`
- `POST /outbound`
- `POST /transfer`
- `POST /adjustment`

Campos comunes: `articuloId`, almacén, `inventoryLotId` opcional, `quantity`,
`unit`, `source` y `reason` opcional. Transfer usa `sourceWarehouseId` y
`destinationWarehouseId`. Adjustment exige `direction: INCREASE | DECREASE`.

Los commands devuelven como mínimo `movementId`, `articuloId`,
`inventoryLotId`, `quantity`, `unit`, saldo resultante y `createdAt`.
Transfer devuelve además los saldos de origen y destino.

## Stock negativo excepcional

El primer intento que produciría saldo negativo no modifica datos y responde
`409 NEGATIVE_STOCK_AUTHORIZATION_REQUIRED` con:

- `available`
- `requested`
- `resulting`
- `articuloId`
- almacén de origen
- lote opcional
- `requiresNegativeStockAuthorization: true`

Para confirmar se reenvía el mismo command con una nueva clave idempotente,
`authorizeNegativeStock: true` y `negativeStockReason`. El usuario autenticado
debe tener `inventory:negative_stock_authorize`; no se acepta un ID de
autorizador enviado por el cliente. Movimiento y auditoría registran al actor,
el motivo y los saldos anterior y resultante.

## API intermodular

Queries públicas:

- `getWarehouse`
- `listWarehouses`
- `getInventoryLot`
- `getStock`
- `getAvailableQuantity`

Commands públicos:

- `registerInbound`
- `registerOutbound`
- `registerTransfer`
- `registerAdjustment`
- `registerProductionConsumption`
- `registerProductionOutput`
- `transitionInventoryLotClassification`

Production Consumption y Production Output no se exponen como operaciones
manuales del frontend. Production Output exige lote y lo crea o reutiliza en la
misma transacción serializable que stock, movimiento, idempotencia y auditoría.

## Clasificación de lotes

`POST /lots/:inventoryLotId/classification`

Transiciones permitidas:

1. `PRODUCTO_ENVASADO → PRODUCTO_TERMINADO`
2. `PRODUCTO_TERMINADO → PRODUCTO_TERMINADO_EXPORTACION`

La transición no modifica stock, no crea movimiento físico ni un lote nuevo.
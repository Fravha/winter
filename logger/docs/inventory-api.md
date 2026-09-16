# API HTTP de Inventory

Base `/api/v1/inventory`. Todas las rutas requieren `Authorization: Bearer
<Firebase ID Token>` y el permiso indicado; `x-request-id` es opcional. Las
rutas con body usan `Content-Type: application/json`.

`Idempotency-Key` corresponde exclusivamente a los comandos operativos
idempotentes: inbound, outbound, transfer, adjustment y clasificación de lotes.
Los comandos administrativos para crear, actualizar, activar o desactivar
almacenes no usan ni requieren este header.

Errores usan `{"error":{"code":"...","message":"...","requestId":"req-1"}}`.
Un comando responde `201` con `{"data":...,"meta":{"requestId":"req-1"}}`;
una consulta responde `200` con el mismo envelope.

### 1. Listar almacenes — `GET /api/v1/inventory/warehouses`

- **Permiso:** `inventory:read`.
- **Headers:** Authorization; `x-request-id` opcional; no Idempotency-Key.
- **Path/query:** `page` y `pageSize` se aceptan y el servicio usa 1 y 20 por
  defecto; esta ruta no aplica schema Zod.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":[{"id":"11111111-1111-4111-8111-111111111111","codigo":"BOD-1","nombre":"Bodega principal","ubicacion":"Nave 1","encargadoUserId":null,"activo":true,"observaciones":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}],"meta":{"requestId":"req-1"}}
```
- **Errores:** `401`, `403`, `500 INTERNAL_ERROR`.
- **Reglas:** ordena por código ascendente y no pagina mediante envelope.

### 2. Obtener almacén — `GET /api/v1/inventory/warehouses/:warehouseId`

- **Permiso:** `inventory:read`.
- **Headers:** Authorization; `x-request-id` opcional; no Idempotency-Key.
- **Path/query:** `warehouseId` no se valida como UUID en la ruta; sin query.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"BOD-1","nombre":"Bodega principal","ubicacion":"Nave 1","encargadoUserId":null,"activo":true,"observaciones":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"},"meta":{"requestId":null}}
```
- **Errores:** `401`, `403`, `500 INTERNAL_ERROR` si Prisma no encuentra el ID.
- **Reglas:** devuelve el registro persistido sin transformar sus campos.

### 3. Crear almacén — `POST /api/v1/inventory/warehouses`

- **Permiso:** `inventory:warehouse_create`.
- **Headers:** Authorization, Content-Type; `x-request-id` opcional; sin
  Idempotency-Key.
- **Path/query:** ninguno.
- **Body:**
```json
{"codigo":"BOD-1","nombre":"Bodega principal","ubicacion":"Nave 1","encargadoUserId":"22222222-2222-4222-8222-222222222222","observaciones":"Recepción"}
```
- **Éxito (201):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"BOD-1","nombre":"Bodega principal","ubicacion":"Nave 1","encargadoUserId":"22222222-2222-4222-8222-222222222222","activo":true,"observaciones":"Recepción","createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"},"meta":{"requestId":"req-1"}}
```
- **Errores:** `400 VALIDATION_ERROR`, `403`; un conflicto de base de datos no
  mapeado se convierte actualmente en `500 INTERNAL_ERROR`.
- **Reglas:** código/nombre no vacíos; crea activo. Es un comando
  administrativo no idempotente.

### 4. Actualizar almacén — `PATCH /api/v1/inventory/warehouses/:id`

- **Permiso:** `inventory:warehouse_update`.
- **Headers:** Authorization, Content-Type; `x-request-id` opcional; sin
  Idempotency-Key.
- **Path/query:** `id` no se valida como UUID en la ruta; sin query.
- **Body:**
```json
{"codigo":"BOD-1","nombre":"Bodega principal actualizada","ubicacion":"Nave 2","encargadoUserId":"22222222-2222-4222-8222-222222222222","observaciones":"Actualizada"}
```
- **Éxito (201):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"BOD-1","nombre":"Bodega principal actualizada","ubicacion":"Nave 2","encargadoUserId":"22222222-2222-4222-8222-222222222222","activo":true,"observaciones":"Actualizada","createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-02T00:00:00.000Z"},"meta":{"requestId":"req-1"}}
```
- **Errores:** `400 VALIDATION_ERROR`, `403`; un ID inexistente se convierte
  actualmente en `500 INTERNAL_ERROR`.
- **Reglas:** el servicio descarta `codigo` del update; no hay DELETE. Es un
  comando administrativo no idempotente.

### 5. Activar almacén — `POST /api/v1/inventory/warehouses/:id/activate`

- **Permiso:** `inventory:warehouse_activate`.
- **Headers:** Authorization; `x-request-id` opcional; sin Idempotency-Key.
  Content-Type no es obligatorio porque no hay body.
- **Path/query:** `id` no tiene validación UUID; sin query.
- **Body:** no body.
- **Éxito (201):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"BOD-1","nombre":"Bodega principal","ubicacion":"Nave 1","encargadoUserId":null,"activo":true,"observaciones":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-03T00:00:00.000Z"},"meta":{"requestId":"req-1"}}
```
- **Errores:** `403`; un ID inexistente se convierte actualmente en `500
  INTERNAL_ERROR`.
- **Reglas:** deja `activo=true`; es un comando administrativo no idempotente.

### 6. Desactivar almacén — `POST /api/v1/inventory/warehouses/:id/deactivate`

- **Permiso:** `inventory:warehouse_deactivate`.
- **Headers:** Authorization; `x-request-id` opcional; sin Idempotency-Key.
  Content-Type no es obligatorio porque no hay body.
- **Path/query:** `id` no tiene validación UUID; sin query.
- **Body:** no body.
- **Éxito (201):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"BOD-1","nombre":"Bodega principal","ubicacion":"Nave 1","encargadoUserId":null,"activo":false,"observaciones":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-04T00:00:00.000Z"},"meta":{"requestId":"req-1"}}
```
- **Errores:** `403`, `409 WAREHOUSE_HAS_STOCK`; un ID inexistente se convierte
  actualmente en `500 INTERNAL_ERROR`.
- **Reglas:** rechaza cualquier saldo distinto de cero; es un comando
  administrativo no idempotente.

### 7. Consultar stock — `GET /api/v1/inventory/stock`

- **Permiso:** `inventory:read`.
- **Headers:** Authorization; `x-request-id` opcional; no Idempotency-Key.
- **Path/query:** `warehouseId` y `articuloId` UUID; `inventoryLotId` UUID
  opcional. La ruta no aplica schema; valida el servicio.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"warehouseId":"11111111-1111-4111-8111-111111111111","articuloId":"33333333-3333-4333-8333-333333333333","inventoryLotId":null,"quantity":"12.500","unit":"KG","hasNegativeStock":false},"meta":{"requestId":"req-1"}}
```
- **Errores:** `401`, `403`, `400` por IDs inválidos donde aplique.
- **Reglas:** sin fila devuelve cantidad `0.000` y unidad `UNIDAD`.

### 8. Consultar disponible — `GET /api/v1/inventory/stock/available`

- **Permiso:** `inventory:read`.
- **Headers:** Authorization; `x-request-id` opcional; no Idempotency-Key.
- **Path/query:** mismos `warehouseId`, `articuloId` requeridos e
  `inventoryLotId` opcional; sin body.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"quantity":"12.500","unit":"KG","hasNegativeStock":false,"warehouseId":"11111111-1111-4111-8111-111111111111","articuloId":"33333333-3333-4333-8333-333333333333","inventoryLotId":null},"meta":{"requestId":"req-1"}}
```
- **Errores:** `401`, `403` y validación/errores del servicio.
- **Reglas:** es la misma cantidad materializada expuesta como disponible.

### 9. Obtener lote — `GET /api/v1/inventory/lots/:inventoryLotId`

- **Permiso:** `inventory:read`.
- **Headers:** Authorization; `x-request-id` opcional; no Idempotency-Key.
- **Path/query:** `inventoryLotId` no se valida como UUID en router; sin query.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"id":"44444444-4444-4444-8444-444444444444","lotCode":"L-2025-01","articuloId":"33333333-3333-4333-8333-333333333333","originProductionBatchId":null,"classification":"PRODUCTO_ENVASADO","fechaIngreso":"2025-01-01T00:00:00.000Z","observations":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"},"meta":{"requestId":"req-1"}}
```
- **Errores:** `401`, `403`, `500 INTERNAL_ERROR` si no encuentra el lote.
- **Reglas:** devuelve el lote persistido.

### 10. Clasificar lote — `POST /api/v1/inventory/lots/:inventoryLotId/classification`

- **Permiso:** `inventory:lot_classify`.
- **Headers:** Authorization, Content-Type, `Idempotency-Key: lot-classify-001`;
  `x-request-id` opcional.
- **Path/query:** `inventoryLotId` no se valida como UUID en router.
- **Body:** `{"classification":"PRODUCTO_TERMINADO"}`.
- **Éxito (201):**
```json
{"data":{"inventoryLotId":"44444444-4444-4444-8444-444444444444","previousClassification":"PRODUCTO_ENVASADO","classification":"PRODUCTO_TERMINADO","updatedAt":"2025-01-02T00:00:00.000Z"},"meta":{"requestId":"req-1"}}
```
- **Errores:** `400 VALIDATION_ERROR|INVALID_CLASSIFICATION_TRANSITION`,
  `404 NOT_FOUND`, `409 IDEMPOTENCY_CONFLICT`.
- **Reglas:** solo ENVASADO→TERMINADO y TERMINADO→TERMINADO_EXPORTACION; no
  cambia stock ni crea movimiento.

### 11. Registrar inbound — `POST /api/v1/inventory/inbound`

- **Permiso:** `inventory:inbound`.
- **Headers:** Authorization, Content-Type, `Idempotency-Key: inbound-001`;
  `x-request-id` opcional.
- **Path/query:** ninguno.
- **Body:** `{"articuloId":"33333333-3333-4333-8333-333333333333","warehouseId":"11111111-1111-4111-8111-111111111111","quantity":"12.500","unit":"KG","source":"MANUAL","reason":"Recepción"}`.
- **Éxito (201):**
```json
{"data":{"movementId":"55555555-5555-4555-8555-555555555555","articuloId":"33333333-3333-4333-8333-333333333333","inventoryLotId":null,"quantity":"12.500","unit":"KG","resultingStock":"12.500","createdAt":"2025-01-02T00:00:00.000Z"},"meta":{"requestId":"req-1"}}
```
- **Errores:** `400 INVALID_QUANTITY|ARTICULO_INVALID|UNIT_MISMATCH|LOT_ARTICULO_MISMATCH`,
  `404 NOT_FOUND`, `409 WAREHOUSE_INACTIVE|IDEMPOTENCY_CONFLICT`.
- **Reglas:** cantidad positiva; `UNIDAD` entera; crea movimiento y actualiza stock.

### 12. Registrar outbound — `POST /api/v1/inventory/outbound`

- **Permiso:** `inventory:outbound`.
- **Headers:** Authorization, Content-Type, `Idempotency-Key: outbound-001`;
  `x-request-id` opcional.
- **Path/query:** ninguno.
- **Body:** `{"articuloId":"33333333-3333-4333-8333-333333333333","warehouseId":"11111111-1111-4111-8111-111111111111","quantity":"2.000","unit":"KG","source":"MANUAL","reason":"Despacho"}`.
- **Éxito (201):** `{"data":{"movementId":"55555555-5555-4555-8555-555555555556","articuloId":"33333333-3333-4333-8333-333333333333","inventoryLotId":null,"quantity":"2.000","unit":"KG","resultingStock":"10.500","createdAt":"2025-01-03T00:00:00.000Z"},"meta":{"requestId":"req-1"}}`.
- **Errores:** los de inbound, más `409 NEGATIVE_STOCK_AUTHORIZATION_REQUIRED`;
  autorización negativa también requiere `inventory:negative_stock_authorize`.
- **Reglas:** decrementa stock; para saldo negativo se reenvía con nueva clave,
  `authorizeNegativeStock:true` y `negativeStockReason`.

### 13. Transferir — `POST /api/v1/inventory/transfer`

- **Permiso:** `inventory:transfer`.
- **Headers:** Authorization, Content-Type, `Idempotency-Key: transfer-001`;
  `x-request-id` opcional.
- **Path/query:** ninguno.
- **Body:** `{"articuloId":"33333333-3333-4333-8333-333333333333","sourceWarehouseId":"11111111-1111-4111-8111-111111111111","destinationWarehouseId":"66666666-6666-4666-8666-666666666666","quantity":"2.000","unit":"KG","source":"TRASLADO"}`.
- **Éxito (201):** `{"data":{"movementId":"55555555-5555-4555-8555-555555555557","articuloId":"33333333-3333-4333-8333-333333333333","inventoryLotId":null,"quantity":"2.000","unit":"KG","resultingStock":"8.500","destinationResultingStock":"2.000","createdAt":"2025-01-04T00:00:00.000Z"},"meta":{"requestId":"req-1"}}`.
- **Errores:** `400 INVALID_TRANSFER|INVALID_QUANTITY|UNIT_MISMATCH|LOT_ARTICULO_MISMATCH`,
  `404 NOT_FOUND`, `409 WAREHOUSE_INACTIVE|NEGATIVE_STOCK_AUTHORIZATION_REQUIRED|IDEMPOTENCY_CONFLICT`.
- **Reglas:** almacenes distintos y activos; actualiza ambos stocks atómicamente.

### 14. Ajustar — `POST /api/v1/inventory/adjustment`

- **Permiso:** `inventory:adjust`.
- **Headers:** Authorization, Content-Type, `Idempotency-Key: adjustment-001`;
  `x-request-id` opcional.
- **Path/query:** ninguno.
- **Body:** `{"articuloId":"33333333-3333-4333-8333-333333333333","warehouseId":"11111111-1111-4111-8111-111111111111","quantity":"1.000","unit":"KG","source":"CONTEO","direction":"INCREASE","reason":"Diferencia de conteo"}`.
- **Éxito (201):** `{"data":{"movementId":"55555555-5555-4555-8555-555555555558","articuloId":"33333333-3333-4333-8333-333333333333","inventoryLotId":null,"quantity":"1.000","unit":"KG","resultingStock":"9.500","createdAt":"2025-01-05T00:00:00.000Z"},"meta":{"requestId":"req-1"}}`.
- **Errores:** `400 INVALID_QUANTITY|ARTICULO_INVALID|UNIT_MISMATCH`,
  `404 NOT_FOUND`, `409 NEGATIVE_STOCK_AUTHORIZATION_REQUIRED|IDEMPOTENCY_CONFLICT`.
- **Reglas:** `direction` decide incremento/decremento; los movimientos no se
  editan ni eliminan.

No existen endpoints HTTP manuales de Producción: sus operaciones son APIs
internas.
# API HTTP de Compras

Base `/api/v1/compras`. Todas las rutas usan `Authorization: Bearer <Firebase
ID Token>` y el permiso indicado. Las rutas con body usan
`Content-Type: application/json`; `x-request-id` es opcional. Ningún endpoint
acepta `Idempotency-Key` del cliente.

Una respuesta de error es `{"error":{"code":"...","message":"...","requestId":"req-1"}}`.
Las cantidades son strings decimales mayores que cero con hasta tres
decimales; el precio unitario admite cero o un valor positivo. `UNIDAD`
requiere cantidades enteras. Los schemas son strict: campos desconocidos son
error.

### 1. Listar compras — `GET /api/v1/compras`

- **Permiso:** `compras:read`.
- **Headers:** Authorization; `x-request-id` opcional.
- **Path/query:** `page` entero >=1 default 1, `pageSize` 1..100 default 20,
  `status` opcional `REGISTERED|RECEIVED|CANCELLED`; query strict.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":[{"id":"77777777-7777-4777-8777-777777777777","supplierName":"Proveedor SA","supplierTaxId":"TAX-1","documentNumber":"FAC-100","documentDate":"2025-01-15T00:00:00.000Z","currency":"EUR","observations":"Recepción normal","status":"REGISTERED","createdByUserId":"22222222-2222-4222-8222-222222222222","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z","items":[{"id":"88888888-8888-4888-8888-888888888888","compraId":"77777777-7777-4777-8777-777777777777","articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"10.500","unit":"KG","unitPrice":"2.350","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z"}]}],"meta":{"page":1,"pageSize":20,"total":1,"totalPages":1}}
```
- **Errores:** `400 VALIDATION_ERROR`, autenticación `401` y autorización `403`.
- **Reglas:** solo filtra por estado; no hay DELETE.

### 2. Obtener compra — `GET /api/v1/compras/:id`

- **Permiso:** `compras:read`.
- **Headers:** Authorization; `x-request-id` opcional; sin Idempotency-Key.
- **Path/query:** `id` UUID strict; sin query.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"id":"77777777-7777-4777-8777-777777777777","supplierName":"Proveedor SA","supplierTaxId":"TAX-1","documentNumber":"FAC-100","documentDate":"2025-01-15T00:00:00.000Z","currency":"EUR","observations":"Recepción normal","status":"REGISTERED","createdByUserId":"22222222-2222-4222-8222-222222222222","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z","items":[{"id":"88888888-8888-4888-8888-888888888888","compraId":"77777777-7777-4777-8777-777777777777","articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"10.500","unit":"KG","unitPrice":"2.350","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z"}]}}
```
- **Errores:** `400 VALIDATION_ERROR`, `404 COMPRA_NOT_FOUND`, `401/403`.
- **Reglas:** devuelve items completos.

### 3. Crear compra — `POST /api/v1/compras`

- **Permiso:** `compras:create`.
- **Headers:** Authorization, Content-Type; `x-request-id` opcional; sin
  Idempotency-Key.
- **Path/query:** ninguno.
- **Body:**
```json
{"supplierName":"Proveedor SA","supplierTaxId":"TAX-1","documentNumber":"FAC-100","documentDate":"2025-01-15","currency":"EUR","observations":"Recepción normal","items":[{"articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"10.500","unit":"KG","unitPrice":"2.350"}]}
```
- **Éxito (201):** `status` es `REGISTERED` y la respuesta tiene todos los
  campos de Compra e items mostrados en el endpoint 2:
```json
{"data":{"id":"77777777-7777-4777-8777-777777777777","supplierName":"Proveedor SA","supplierTaxId":"TAX-1","documentNumber":"FAC-100","documentDate":"2025-01-15T00:00:00.000Z","currency":"EUR","observations":"Recepción normal","status":"REGISTERED","createdByUserId":"22222222-2222-4222-8222-222222222222","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z","items":[{"id":"88888888-8888-4888-8888-888888888888","compraId":"77777777-7777-4777-8777-777777777777","articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"10.500","unit":"KG","unitPrice":"2.350","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z"}]}}
```
- **Errores:** `400 ARTICULO_INVALID|UNIT_MISMATCH|VALIDATION_ERROR`,
  `409` por conflicto de regla de negocio.
- **Reglas:** proveedor 1..200; tax ID 1..80; documento 1..100; currency 1..12;
  observaciones <=5000; items mínimo uno. Artículo activo, unidad exacta y no
  repetido. Se crean los items y estado REGISTERED.

### 4. Actualizar compra — `PATCH /api/v1/compras/:id`

- **Permiso:** `compras:update`.
- **Headers:** Authorization, Content-Type; `x-request-id` opcional; sin
  Idempotency-Key.
- **Path/query:** `id` UUID strict; sin query.
- **Body:**
```json
{"supplierName":"Proveedor SA actualizado","supplierTaxId":null,"documentNumber":null,"documentDate":null,"currency":"EUR","observations":"Actualizada","items":[{"articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"11.000","unit":"KG","unitPrice":"2.400"}]}
```
- **Éxito (200):**
```json
{"data":{"id":"77777777-7777-4777-8777-777777777777","supplierName":"Proveedor SA actualizado","supplierTaxId":null,"documentNumber":null,"documentDate":null,"currency":"EUR","observations":"Actualizada","status":"REGISTERED","createdByUserId":"22222222-2222-4222-8222-222222222222","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-16T00:00:00.000Z","items":[{"id":"88888888-8888-4888-8888-888888888888","compraId":"77777777-7777-4777-8777-777777777777","articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"11.000","unit":"KG","unitPrice":"2.400","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-16T00:00:00.000Z"}]}}
```
- **Errores:** `400 COMPRA_ITEMS_REQUIRED|COMPRA_DUPLICATE_ITEM|ARTICULO_INVALID|UNIT_MISMATCH|VALIDATION_ERROR`,
  `404 COMPRA_NOT_FOUND`, `409 COMPRA_NOT_EDITABLE|COMPRA_ITEM_REMOVAL_FORBIDDEN`.
- **Reglas:** body strict no vacío; solo REGISTERED; los campos nullable pueden
  limpiarse; no se elimina ningún item existente.

### 5. Recibir compra — `POST /api/v1/compras/:id/receive`

- **Permiso:** `compras:receive`.
- **Headers:** Authorization, Content-Type; `x-request-id` opcional; **sin**
  Idempotency-Key del cliente.
- **Path/query:** `id` UUID strict; sin query.
- **Body:**
```json
{"warehouseId":"11111111-1111-4111-8111-111111111111","items":[{"compraItemId":"88888888-8888-4888-8888-888888888888","inventoryLotId":"44444444-4444-4444-8444-444444444444"}]}
```
- **Éxito (200):**
```json
{"data":{"id":"77777777-7777-4777-8777-777777777777","supplierName":"Proveedor SA","supplierTaxId":"TAX-1","documentNumber":"FAC-100","documentDate":"2025-01-15T00:00:00.000Z","currency":"EUR","observations":"Recepción normal","status":"RECEIVED","createdByUserId":"22222222-2222-4222-8222-222222222222","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-17T00:00:00.000Z","items":[{"id":"88888888-8888-4888-8888-888888888888","compraId":"77777777-7777-4777-8777-777777777777","articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"10.500","unit":"KG","unitPrice":"2.350","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z"}]}}
```
- **Errores:** `400 RECEIVE_ITEMS_MISMATCH|DUPLICATE_COMPRA_ITEM|VALIDATION_ERROR`,
  `404 COMPRA_NOT_FOUND` o errores de almacén/lote de Inventory, `409
  COMPRA_NOT_RECEIVABLE`; una respuesta incompleta de Inventory produce `500
  INVENTORY_BATCH_INVALID` y una transición inconsistente produce `500
  COMPRA_TRANSITION_FAILED`.
- **Reglas:** items omitibles; si se envían, todos exactamente una vez. El
  servidor genera `purchase-receive:{compraId}:{compraItemId}`. En una
  transacción Serializable registra INBOUND de fuente COMPRAS, actualiza stock,
  guarda referencias y cambia a RECEIVED; cualquier error revierte todo.

### 6. Cancelar compra — `POST /api/v1/compras/:id/cancel`

- **Permiso:** `compras:cancel`.
- **Headers:** Authorization, Content-Type; `x-request-id` opcional; sin
  Idempotency-Key.
- **Path/query:** `id` UUID strict; sin query.
- **Body:** `{"reason":"Cancelación solicitada por proveedor"}` o `{}`.
- **Éxito (200):**
```json
{"data":{"id":"77777777-7777-4777-8777-777777777777","supplierName":"Proveedor SA","supplierTaxId":"TAX-1","documentNumber":"FAC-100","documentDate":"2025-01-15T00:00:00.000Z","currency":"EUR","observations":"Recepción normal","status":"CANCELLED","createdByUserId":"22222222-2222-4222-8222-222222222222","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-18T00:00:00.000Z","items":[{"id":"88888888-8888-4888-8888-888888888888","compraId":"77777777-7777-4777-8777-777777777777","articuloId":"33333333-3333-4333-8333-333333333333","brand":"Marca","requestedQuantity":"10.500","unit":"KG","unitPrice":"2.350","createdAt":"2025-01-15T00:00:00.000Z","updatedAt":"2025-01-15T00:00:00.000Z"}]}}
```
- **Errores:** `400 VALIDATION_ERROR`, `404 COMPRA_NOT_FOUND`,
  `409 COMPRA_NOT_CANCELLABLE`.
- **Reglas:** `reason` opcional, recortado, 1..2000; solo se registra en
  auditoría, nunca en observations; cancelar no toca Inventory.

## Flujo manual validado

1. `POST /api/v1/articulos` con un Artículo activo; guardar su `id`.
2. `POST /api/v1/compras` con ese `articuloId`; confirmar `REGISTERED` y guardar
   compra/item IDs.
3. Ejecutar receive con almacén y item; confirmar `RECEIVED`.
4. Consultar `GET /api/v1/inventory/stock?warehouseId=...&articuloId=...` y
   observar el saldo de `InventoryStock`.

No hay endpoint HTTP para listar `InventoryMovement`. El movimiento INBOUND
`source:"COMPRAS"`, sus referencias y auditorías quedan persistidos
internamente en la misma transacción; el stock y el estado RECEIVED son las
observaciones disponibles por HTTP. Compras usa la API interna confiable y no
requiere `inventory:inbound`; un inbound manual sí requiere ese permiso.
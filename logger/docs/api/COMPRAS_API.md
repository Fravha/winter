# Compras — contrato HTTP oficial

Este documento describe únicamente el módulo oficial `compras`, montado en
`/api/v1/compras`. Hay **6 endpoints públicos**: listar, obtener, crear,
actualizar, recibir y cancelar.

Todas las rutas requieren:

```http
Authorization: Bearer <Firebase ID Token>
```

El middleware resuelve el usuario local y sus permisos. `x-request-id` es
opcional, se devuelve en `meta.requestId` cuando el controlador usa el
envelope común y se registra en auditoría. Las rutas con body requieren
`Content-Type: application/json`. Los errores usan:

```json
{"error":{"code":"...","message":"...","requestId":"..."}}
```

## Modelo y reglas comunes

### Estados y transiciones

El enum real es:

- `REGISTERED`: estado inicial y único estado editable.
- `RECEIVED`: recepción completada; no es editable ni recibible de nuevo.
- `CANCELLED`: compra cancelada; no es editable, recibible ni cancelable de
  nuevo.

Las transiciones públicas son `REGISTERED → RECEIVED` mediante `receive` y
`REGISTERED → CANCELLED` mediante `cancel`.

### Compra e items

Una `Compra` responde con:

`id`, `supplierName`, `supplierTaxId`, `documentNumber`, `documentDate`,
`currency`, `observations`, `status`, `createdByUserId`, `createdAt`,
`updatedAt` e `items`.

Cada item responde con `id`, `compraId`, `articuloId`, `brand`,
`requestedQuantity`, `unit`, `unitPrice`, `createdAt` y `updatedAt`.

`supplierName` es obligatorio, trimmed y de 1–200 caracteres. Los campos
opcionales `supplierTaxId`, `documentNumber` y `currency` deben ser no vacíos
si se proporcionan y tienen límites de 80, 100 y 12 caracteres. `observations`
admite hasta 5000 caracteres. `documentDate` se convierte a fecha mediante
Zod.

Cada compra requiere al menos un item. No puede repetirse un `articuloId`.
El artículo debe existir y estar activo, y `unit` debe coincidir con su unidad
base. Las unidades reales son `KG`, `G`, `L`, `M` y `UNIDAD`; las cantidades
son strings decimales no negativos con hasta tres posiciones, mayores que
cero, y `UNIDAD` exige enteros. `unitPrice` es opcional y admite cero o un
decimal positivo de hasta tres posiciones.

Los schemas son strict: propiedades desconocidas son inválidas. No existe
endpoint HTTP para crear, editar o eliminar items por separado; se incluyen
en create/update.

## Endpoints

### 1. Listar compras

**GET `/api/v1/compras`**

- **Objetivo:** listar compras paginadas, opcionalmente filtradas por estado.
- **Autenticación/permiso:** Firebase ID Token; `compras:read`.
- **Headers:** `Authorization`; `x-request-id` opcional. No se requiere ni se
  consume `Idempotency-Key`.
- **Path params:** ninguno.
- **Query params:** `page` entero mínimo 1, default 1; `pageSize` entero 1–100,
  default 20; `status` opcional `REGISTERED | RECEIVED | CANCELLED`.
- **Body:** ninguno.
- **Éxito:** `200`.
- **Response:** `data` array de compras completas y `meta` con `page`,
  `pageSize`, `total` y `totalPages`.
- **Errores:** `400 VALIDATION_ERROR` por query strict o valores inválidos,
  `401`, `403`.
- **Reglas:** orden y forma de los items son los del repositorio; no existe
  DELETE.

```http
GET /api/v1/compras?page=1&pageSize=20&status=REGISTERED
Authorization: Bearer <Firebase-ID-token>
```

```json
{
  "data": [{
    "id": "77777777-7777-4777-8777-777777777777",
    "supplierName": "Proveedor SA",
    "supplierTaxId": "TAX-1",
    "documentNumber": "FAC-100",
    "documentDate": "2025-01-15T00:00:00.000Z",
    "currency": "EUR",
    "observations": "Recepción normal",
    "status": "REGISTERED",
    "createdByUserId": "22222222-2222-4222-8222-222222222222",
    "createdAt": "2025-01-15T00:00:00.000Z",
    "updatedAt": "2025-01-15T00:00:00.000Z",
    "items": []
  }],
  "meta": {"page": 1, "pageSize": 20, "total": 1, "totalPages": 1}
}
```

### 2. Obtener una compra

**GET `/api/v1/compras/:id`**

- **Objetivo:** recuperar una compra y todos sus items.
- **Autenticación/permiso:** Firebase ID Token; `compras:read`.
- **Headers:** `Authorization`; `x-request-id` opcional. Sin
  `Idempotency-Key`.
- **Path params:** `id` UUID requerido y validado estrictamente.
- **Query/body:** ninguno.
- **Éxito:** `200` con `{"data": <Compra>}`.
- **Errores:** `400 VALIDATION_ERROR`, `401`, `403`,
  `404 COMPRA_NOT_FOUND`.

```http
GET /api/v1/compras/77777777-7777-4777-8777-777777777777
Authorization: Bearer <Firebase-ID-token>
```

### 3. Crear compra

**POST `/api/v1/compras`**

- **Objetivo:** crear una compra en estado `REGISTERED`.
- **Autenticación/permiso:** Firebase ID Token; `compras:create`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `x-request-id` opcional. Sin `Idempotency-Key`.
- **Path/query:** ninguno.
- **Body requerido:** `supplierName` e `items` con mínimo un item. Cada item
  requiere `articuloId`, `requestedQuantity` y `unit`.
- **Body opcional:** `supplierTaxId`, `documentNumber`, `documentDate`,
  `currency`, `observations`; por item `brand` y `unitPrice`.
- **Éxito:** `201`, con `data` igual a la compra creada y `status:
  "REGISTERED"`.
- **Errores:** `400 VALIDATION_ERROR`, `COMPRA_ITEMS_REQUIRED`,
  `COMPRA_DUPLICATE_ITEM`, `ARTICULO_INVALID`, `UNIT_MISMATCH`,
  `INVALID_UNIT_PRICE`; `401`, `403`; conflictos no mapeados pueden ser
  `500`.
- **Reglas:** valida artículo activo, unidad base, cantidades, precio y
  unicidad de artículos; crea la compra y todos sus items en una transacción;
  registra auditoría con el actor autenticado.

```json
{
  "supplierName": "Proveedor SA",
  "supplierTaxId": "TAX-1",
  "documentNumber": "FAC-100",
  "documentDate": "2025-01-15",
  "currency": "EUR",
  "observations": "Recepción normal",
  "items": [{
    "articuloId": "33333333-3333-4333-8333-333333333333",
    "brand": "Marca",
    "requestedQuantity": "10.500",
    "unit": "KG",
    "unitPrice": "2.350"
  }]
}
```

### 4. Actualizar compra

**PATCH `/api/v1/compras/:id`**

- **Objetivo:** editar datos administrativos y/o items de una compra
  `REGISTERED`.
- **Autenticación/permiso:** Firebase ID Token; `compras:update`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `x-request-id` opcional. Sin `Idempotency-Key`.
- **Path params:** `id` UUID requerido y strict.
- **Body:** al menos un campo. Todos son opcionales individualmente:
  `supplierName`, `supplierTaxId`, `documentNumber`, `documentDate`,
  `currency`, `observations`, `items`. Los campos administrativos opcionales
  admiten `null` para limpiarlos; `items`, si se envía, requiere mínimo uno.
- **Éxito:** `200`, con la compra actualizada.
- **Errores:** `400 VALIDATION_ERROR`, `COMPRA_ITEMS_REQUIRED`,
  `COMPRA_DUPLICATE_ITEM`, `ARTICULO_INVALID`, `UNIT_MISMATCH`,
  `INVALID_UNIT_PRICE`; `401`, `403`; `404 COMPRA_NOT_FOUND`; `409
  COMPRA_NOT_EDITABLE` o `COMPRA_ITEM_REMOVAL_FORBIDDEN`.
- **Reglas:** solo `REGISTERED` es editable. Los items existentes no pueden
  eliminarse: el array enviado debe conservar cada `articuloId` existente.
  Puede agregar items y actualizar marca, cantidad, unidad o precio. La
  actualización es transaccional y auditada.

```json
{
  "supplierName": "Proveedor SA actualizado",
  "supplierTaxId": null,
  "observations": "Actualizada",
  "items": [{
    "articuloId": "33333333-3333-4333-8333-333333333333",
    "brand": "Marca",
    "requestedQuantity": "11.000",
    "unit": "KG",
    "unitPrice": "2.400"
  }]
}
```

### 5. Recibir compra

**POST `/api/v1/compras/:id/receive`**

- **Objetivo:** recibir una compra `REGISTERED`, producir inbound de
  inventario y cambiarla a `RECEIVED`.
- **Autenticación/permiso:** Firebase ID Token; `compras:receive`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `x-request-id` opcional. No se acepta `Idempotency-Key` del cliente.
- **Path params:** `id` UUID requerido y strict.
- **Body requerido:** `warehouseId` UUID.
- **Body opcional:** `items`, array no vacío si se envía. Cada elemento
  requiere `compraItemId` UUID y puede incluir `inventoryLotId` UUID.
- **Éxito:** `200`, con la compra completa en estado `RECEIVED`.
- **Errores:** `400 RECEIVE_ITEMS_MISMATCH`, `DUPLICATE_COMPRA_ITEM`,
  `VALIDATION_ERROR`, `ARTICULO_INVALID`, `UNIT_MISMATCH`; `401`, `403`;
  `404 COMPRA_NOT_FOUND`, `NOT_FOUND` de almacén/lote; `409
  COMPRA_NOT_RECEIVABLE`, `WAREHOUSE_INACTIVE`, `LOT_ARTICULO_MISMATCH` o
  conflictos de inventario; `500 INVENTORY_BATCH_INVALID` o
  `COMPRA_TRANSITION_FAILED` si una invariante interna falla.
- **Reglas:** solo `REGISTERED`. Si `items` se omite, se reciben todos los
  items sin lote explícito. Si se envía, debe incluir cada item exactamente
  una vez; no se aceptan duplicados ni subconjuntos.
- **Integración Inventory:** el servicio genera internamente una clave
  determinista `purchase-receive:{compraId}:{compraItemId}` por item, crea
  movimientos `INBOUND` con `source: "COMPRAS"`, actualiza `InventoryStock`,
  guarda referencias `CompraInventoryMovement` y cambia el estado dentro de
  una transacción serializable. El actor no necesita
  `inventory:inbound`; el contexto confiable es exclusivamente server-side.
- **Idempotencia:** no hay header de cliente. La clave interna y la
  transición condicional protegen el replay y la concurrencia; una compra ya
  recibida responde `409 COMPRA_NOT_RECEIVABLE`.

```http
POST /api/v1/compras/77777777-7777-4777-8777-777777777777/receive
Authorization: Bearer <Firebase-ID-token>
Content-Type: application/json
```

```json
{
  "warehouseId": "11111111-1111-4111-8111-111111111111",
  "items": [{
    "compraItemId": "88888888-8888-4888-8888-888888888888",
    "inventoryLotId": "44444444-4444-4444-8444-444444444444"
  }]
}
```

### 6. Cancelar compra

**POST `/api/v1/compras/:id/cancel`**

- **Objetivo:** cancelar una compra `REGISTERED`.
- **Autenticación/permiso:** Firebase ID Token; `compras:cancel`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `x-request-id` opcional. Sin `Idempotency-Key`.
- **Path params:** `id` UUID requerido y strict.
- **Body:** objeto opcional vacío o `reason` string trimmed de 1–2000
  caracteres.
- **Éxito:** `200`, con la compra completa en estado `CANCELLED`.
- **Errores:** `400 VALIDATION_ERROR`, `401`, `403`,
  `404 COMPRA_NOT_FOUND`, `409 COMPRA_NOT_CANCELLABLE`.
- **Reglas:** solo `REGISTERED`; la cancelación es una transición condicional
  auditada. `reason` se guarda en metadata de auditoría y no modifica
  `observations`. No toca Inventory.

```json
{"reason":"Cancelación solicitada por proveedor"}
```

## Ejemplos de respuestas de comandos

Todos los comandos administrativos devuelven la compra completa dentro de
`data`. Por ejemplo, una actualización exitosa mantiene `REGISTERED`:

```json
{
  "data": {
    "id": "77777777-7777-4777-8777-777777777777",
    "supplierName": "Proveedor SA actualizado",
    "supplierTaxId": null,
    "documentNumber": null,
    "documentDate": null,
    "currency": "EUR",
    "observations": "Actualizada",
    "status": "REGISTERED",
    "createdByUserId": "22222222-2222-4222-8222-222222222222",
    "createdAt": "2025-01-15T00:00:00.000Z",
    "updatedAt": "2025-01-16T00:00:00.000Z",
    "items": []
  }
}
```

`receive` devuelve el mismo objeto con `status: "RECEIVED"` y `cancel` con
`status: "CANCELLED"`, ambos con HTTP `200`. `get` devuelve la misma forma
dentro de `data`; `list` usa el array y metadata descritos en su sección.

## Relación con Inventory

La única operación HTTP de Compras que modifica Inventory es `receive`.
El flujo es:

```text
Compra REGISTERED
  → POST /:id/receive
  → InventoryMovement INBOUND (source COMPRAS)
  → InventoryStock actualizado
  → referencias CompraInventoryMovement
  → Compra RECEIVED
```

No existe endpoint HTTP de Compras para listar movimientos de inventario ni
para revertir una recepción. La recepción depende exclusivamente de los
módulos oficiales Artículos e Inventory.
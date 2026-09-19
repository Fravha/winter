# Inventory — contrato HTTP

Este documento describe exclusivamente las rutas montadas por
`inventoryDocType` en `/api/v1/inventory`. Hay **14 endpoints públicos**:
almacenes (6), consultas de stock/lotes (3), clasificación de lotes (1) y
movimientos (4).

Todas las rutas requieren:

```http
Authorization: Bearer <Firebase ID Token>
```

El middleware resuelve el usuario local y sus permisos antes de ejecutar el
controlador. `x-request-id` es opcional y se copia a `meta.requestId` y a la
auditoría cuando se envía. Los endpoints con body JSON requieren
`Content-Type: application/json`. Las respuestas de consulta usan
`{"data":...,"meta":{"requestId":...}}`; los comandos usan el mismo envelope y
responden `201`.

Los errores se serializan como
`{"error":{"code":"...","message":"...","requestId":"..."}}`. Según el
middleware, autenticación ausente o inválida es `401` y un permiso ausente es
`403`.

## Reglas transversales

### Unidades y cantidades

Las unidades reales son `KG`, `G`, `L`, `M` y `UNIDAD`. `quantity` acepta un
string o number en el schema HTTP, pero la representación recomendada y la
respuesta son strings decimales. El servicio admite hasta tres decimales,
rechaza cero y cantidades negativas, y exige una cantidad entera cuando la
unidad es `UNIDAD` (por ejemplo, `"3.000"` sí es válido y `"3.500"` no).
La unidad enviada debe coincidir exactamente con `Articulo.unidadMedida`.

Las cantidades se almacenan y responden con tres posiciones (`"12.500"`,
`"0.000"`). No usar cálculos binarios de JavaScript para saldos.

### Tipos, fuentes y lotes

Los tipos persistidos de `InventoryMovement` son `INBOUND`, `OUTBOUND`,
`TRANSFER` y `ADJUSTMENT`. `source` es un string requerido, no un enum HTTP:
el backend conserva el valor recibido. El flujo oficial de Compras genera
`source: "COMPRAS"` y la producción usa `PRODUCTION_OUTPUT`; un cliente
manual debe escoger una fuente no vacía y estable.

Las clasificaciones reales de lote son `PRODUCTO_ENVASADO`,
`PRODUCTO_TERMINADO` y `PRODUCTO_TERMINADO_EXPORTACION`. Un lote solo puede
transicionar `PRODUCTO_ENVASADO → PRODUCTO_TERMINADO` y después
`PRODUCTO_TERMINADO → PRODUCTO_TERMINADO_EXPORTACION`.

### Idempotencia

Los comandos HTTP operativos requieren el header:

```http
Idempotency-Key: <clave-no-vacia>
```

Aplica a inbound, outbound, transfer, adjustment y clasificación de lote. La
clave se persiste con la operación y una repetición con la misma clave y el
mismo payload devuelve el resultado original. Reutilizarla con otra operación
o payload produce `409 IDEMPOTENCY_CONFLICT`. Sin header produce
`400 IDEMPOTENCY_KEY_REQUIRED`.

Crear/actualizar/activar/desactivar almacenes no son comandos idempotentes y
no aceptan un mecanismo HTTP de idempotencia.

### Fuente de verdad

Cada movimiento exitoso escribe un `InventoryMovement` inmutable con tipo,
fuente, cantidad, unidad, saldo anterior y saldo resultante. También actualiza
atómicamente `InventoryStock`, que es el saldo materializado para consultas
rápidas. No existe endpoint HTTP para listar el ledger de movimientos: el
movimiento es el historial/fuente de verdad y `InventoryStock` es la lectura
materializada.

## Almacenes

### 1. Listar almacenes

**GET `/api/v1/inventory/warehouses`**

- **Objetivo:** consultar almacenes ordenados por `codigo`.
- **Autenticación/permiso:** Firebase ID Token; `inventory:read`.
- **Headers:** `Authorization`; `x-request-id` opcional. No
  `Idempotency-Key`.
- **Path params:** ninguno.
- **Query params:** `page` y `pageSize` son aceptados por la implementación,
  con defaults internos `1` y `20`, pero esta ruta no aplica schema Zod ni
  construye metadata de paginación. El servicio usa esos valores para
  `skip/take`; no se valida el rango.
- **Body:** ninguno.
- **Éxito:** `200`.
- **Response:** `data` es un array de almacenes persistidos; `meta` contiene
  `requestId`.
- **Errores contractuales:** `401`, `403`; errores de infraestructura pueden
  ser `500`.
- **Ejemplo:**

```http
GET /api/v1/inventory/warehouses?page=1&pageSize=20
Authorization: Bearer <Firebase-ID-token>
```

```json
{
  "data": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "codigo": "BOD-1",
    "nombre": "Bodega principal",
    "ubicacion": "Nave 1",
    "encargadoUserId": null,
    "activo": true,
    "observaciones": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }],
  "meta": {"requestId": null}
}
```

### 2. Obtener un almacén

**GET `/api/v1/inventory/warehouses/:warehouseId`**

- **Objetivo:** obtener un almacén por ID.
- **Autenticación/permiso:** Firebase ID Token; `inventory:read`.
- **Headers:** `Authorization`; `x-request-id` opcional.
- **Path params:** `warehouseId` requerido. El router no lo valida como UUID.
- **Query/body:** ninguno.
- **Éxito:** `200`, con `data` igual al registro `Warehouse` y `meta`.
- **Errores:** `401`, `403`; un ID no encontrado llega actualmente como error
  de Prisma y puede serializarse como `500 INTERNAL_ERROR`.
- **Reglas:** no transforma ni pagina el registro.

```http
GET /api/v1/inventory/warehouses/11111111-1111-4111-8111-111111111111
Authorization: Bearer <Firebase-ID-token>
```

### 3. Crear un almacén

**POST `/api/v1/inventory/warehouses`**

- **Objetivo:** crear un almacén activo.
- **Autenticación/permiso:** Firebase ID Token; `inventory:warehouse_create`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `x-request-id` opcional. No `Idempotency-Key`.
- **Path/query:** ninguno.
- **Body requerido:** `codigo` y `nombre`, strings no vacíos después de trim.
- **Body opcional:** `ubicacion` string, `encargadoUserId` UUID y
  `observaciones` string.
- **Éxito:** `201`; `data` es el almacén creado con `activo: true`.
- **Errores:** `400 VALIDATION_ERROR` por schema, `403`; conflictos no
  mapeados pueden llegar como `500`.
- **Reglas:** `codigo` y `nombre` se recortan; se audita al actor.

```json
{
  "codigo": "BOD-1",
  "nombre": "Bodega principal",
  "ubicacion": "Nave 1",
  "encargadoUserId": "22222222-2222-4222-8222-222222222222",
  "observaciones": "Recepción"
}
```

### 4. Actualizar un almacén

**PATCH `/api/v1/inventory/warehouses/:id`**

- **Objetivo:** actualizar los datos administrativos del almacén.
- **Autenticación/permiso:** Firebase ID Token; `inventory:warehouse_update`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `x-request-id` opcional. No `Idempotency-Key`.
- **Path params:** `id` requerido; el router no valida UUID.
- **Body requerido por schema:** `nombre`, string no vacío después de trim.
  `ubicacion`, `encargadoUserId` (UUID) y `observaciones` son opcionales.
  El PATCH utiliza un schema dedicado y estricto: no acepta `codigo` ni otras
  propiedades desconocidas.
- **Éxito:** `201` (comportamiento real del controlador de comandos), con
  `data` del almacén actualizado.
- **Errores:** `400 VALIDATION_ERROR`, `403`; ID inexistente o conflicto no
  mapeado puede llegar como `500`.
- **Reglas:** `codigo` es identidad estable y no forma parte del payload de
  actualización; intentar enviarlo produce `400 VALIDATION_ERROR`. Solo se
  actualizan `nombre`, `ubicacion`, `encargadoUserId` y `observaciones`. Se
  audita al actor.

```http
PATCH /api/v1/inventory/warehouses/11111111-1111-4111-8111-111111111111
Authorization: Bearer <Firebase-ID-token>
Content-Type: application/json
```

```json
{
  "nombre": "Bodega principal actualizada",
  "ubicacion": "Nave 2",
  "encargadoUserId": "22222222-2222-4222-8222-222222222222",
  "observaciones": "Conteo anual"
}
```

### 5. Activar un almacén

**POST `/api/v1/inventory/warehouses/:id/activate`**

- **Objetivo:** establecer `activo: true`.
- **Autenticación/permiso:** Firebase ID Token; `inventory:warehouse_activate`.
- **Headers:** `Authorization`; `x-request-id` opcional. Body vacío y
  `Content-Type` no requerido; no `Idempotency-Key`.
- **Path/query:** `id` requerido sin validación UUID; sin query.
- **Éxito:** `201`, con el almacén actualizado.
- **Errores:** `401`, `403`; ID inexistente puede llegar como `500`.
- **Reglas:** operación auditada y no idempotente.

### 6. Desactivar un almacén

**POST `/api/v1/inventory/warehouses/:id/deactivate`**

- **Objetivo:** establecer `activo: false`.
- **Autenticación/permiso:** Firebase ID Token; `inventory:warehouse_deactivate`.
- **Headers/path/query:** iguales a activate; no body ni `Idempotency-Key`.
- **Éxito:** `201`, con el almacén actualizado.
- **Errores:** `401`, `403`, `409 WAREHOUSE_HAS_STOCK` si algún saldo del
  almacén es distinto de cero; ID inexistente puede llegar como `500`.
- **Reglas:** no se puede desactivar un almacén con stock; se audita al actor.

## Stock y lotes

### 7. Consultar stock materializado

**GET `/api/v1/inventory/stock`**

- **Objetivo:** leer el saldo de un artículo en un almacén y, opcionalmente,
  lote.
- **Autenticación/permiso:** Firebase ID Token; `inventory:read`.
- **Headers:** `Authorization`; `x-request-id` opcional.
- **Query params requeridos:** `warehouseId` UUID y `articuloId` UUID.
- **Query param opcional:** `inventoryLotId` UUID.
- **Body:** ninguno. Esta ruta no aplica schema Zod; los valores llegan al
  servicio/Prisma.
- **Éxito:** `200`.
- **Response:** `{warehouseId, articuloId, inventoryLotId, quantity, unit,
  hasNegativeStock}` dentro de `data`.
- **Reglas:** sin fila devuelve `quantity: "0.000"`, `unit: "UNIDAD"` y
  `hasNegativeStock: false`.

```http
GET /api/v1/inventory/stock?warehouseId=11111111-1111-4111-8111-111111111111&articuloId=33333333-3333-4333-8333-333333333333
Authorization: Bearer <Firebase-ID-token>
```

```json
{
  "data": {
    "warehouseId": "11111111-1111-4111-8111-111111111111",
    "articuloId": "33333333-3333-4333-8333-333333333333",
    "inventoryLotId": null,
    "quantity": "12.500",
    "unit": "KG",
    "hasNegativeStock": false
  },
  "meta": {"requestId": null}
}
```

### 8. Consultar cantidad disponible

**GET `/api/v1/inventory/stock/available`**

- **Objetivo:** obtener la cantidad disponible materializada.
- **Autenticación/permiso:** Firebase ID Token; `inventory:read`.
- **Headers/query/body:** iguales a `GET /stock`.
- **Éxito:** `200`; `data` contiene `quantity`, `unit`,
  `hasNegativeStock`, `warehouseId`, `articuloId` e `inventoryLotId`.
- **Errores:** `401`, `403` y errores de lectura/validación.
- **Idempotencia:** no aplica; es consulta.

### 9. Obtener lote

**GET `/api/v1/inventory/lots/:inventoryLotId`**

- **Objetivo:** obtener metadata persistida de un lote.
- **Autenticación/permiso:** Firebase ID Token; `inventory:read`.
- **Headers:** `Authorization`; `x-request-id` opcional.
- **Path params:** `inventoryLotId` requerido; el router no valida UUID.
- **Query/body:** ninguno.
- **Éxito:** `200`, con `data` incluyendo `id`, `lotCode`, `articuloId`,
  `originProductionBatchId`, `classification`, `fechaIngreso`,
  `observations`, `createdAt` y `updatedAt`.
- **Errores:** `401`, `403`; lote inexistente puede llegar como `500` por
  `findUniqueOrThrow`.

### 10. Clasificar lote

**POST `/api/v1/inventory/lots/:inventoryLotId/classification`**

- **Objetivo:** avanzar la clasificación del lote.
- **Autenticación/permiso:** Firebase ID Token; `inventory:lot_classify`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `Idempotency-Key` requerido y `x-request-id` opcional.
- **Path params:** `inventoryLotId` requerido; se incorpora al comando aunque
  no se valida como UUID en el router.
- **Body requerido:** `classification`, enum real
  `PRODUCTO_ENVASADO | PRODUCTO_TERMINADO | PRODUCTO_TERMINADO_EXPORTACION`.
- **Éxito:** `201`.
- **Response:** `inventoryLotId`, `previousClassification`,
  `classification` y `updatedAt`.
- **Errores:** `400 VALIDATION_ERROR` o
  `INVALID_CLASSIFICATION_TRANSITION`, `403`, `404 NOT_FOUND`,
  `409 IDEMPOTENCY_CONFLICT`.
- **Reglas:** solo se permiten las dos transiciones consecutivas indicadas;
  no crea movimiento ni modifica stock. Se audita al actor.

```http
POST /api/v1/inventory/lots/44444444-4444-4444-8444-444444444444/classification
Authorization: Bearer <Firebase-ID-token>
Content-Type: application/json
Idempotency-Key: lot-classify-001
```

```json
{"classification":"PRODUCTO_TERMINADO"}
```

## Movimientos

### 11. Registrar inbound

**POST `/api/v1/inventory/inbound`**

- **Objetivo:** sumar stock y registrar un movimiento `INBOUND`.
- **Autenticación/permiso:** Firebase ID Token; `inventory:inbound`.
- **Headers:** `Authorization`, `Content-Type: application/json`,
  `Idempotency-Key` requerido, `x-request-id` opcional.
- **Body requerido:** `articuloId` UUID, `warehouseId` UUID, `quantity`
  positiva, `unit`, `source` no vacío.
- **Body opcional:** `inventoryLotId` UUID, `reason`, `authorizeNegativeStock`,
  `negativeStockReason`. La autorización negativa no es necesaria para
  inbound porque incrementa el saldo.
- **Éxito:** `201`, con `movementId`, `articuloId`, `inventoryLotId`,
  `quantity`, `unit`, `resultingStock` y `createdAt`.
- **Errores:** `400 INVALID_QUANTITY`, `ARTICULO_INVALID`, `UNIT_MISMATCH`,
  `INVALID_UNIT` o `LOT_ARTICULO_MISMATCH`; `403`; `404 NOT_FOUND`;
  `409 WAREHOUSE_INACTIVE` o `IDEMPOTENCY_CONFLICT`.
- **Reglas:** almacén activo, artículo activo y unidad base exacta; si se
  proporciona lote debe pertenecer al artículo. Stock y ledger se escriben
  en la misma transacción.

```json
{
  "articuloId": "33333333-3333-4333-8333-333333333333",
  "warehouseId": "11111111-1111-4111-8111-111111111111",
  "quantity": "12.500",
  "unit": "KG",
  "source": "MANUAL",
  "reason": "Recepción"
}
```

### 12. Registrar outbound

**POST `/api/v1/inventory/outbound`**

- **Objetivo:** restar stock y registrar un movimiento `OUTBOUND`.
- **Autenticación/permiso:** Firebase ID Token; `inventory:outbound`.
- **Headers/body/query:** mismos campos y headers de inbound, incluido
  `Idempotency-Key`.
- **Éxito:** `201` con el resultado estándar del movimiento.
- **Errores:** los de inbound, además de `409
  NEGATIVE_STOCK_AUTHORIZATION_REQUIRED`, o `403 AUTH_FORBIDDEN` si se
  solicita saldo negativo sin `inventory:negative_stock_authorize`.
- **Reglas:** saldo insuficiente se rechaza salvo que el actor envíe
  `authorizeNegativeStock: true`, un `negativeStockReason` no vacío y tenga
  `inventory:negative_stock_authorize`. La autorización y actor quedan en el
  movimiento/auditoría.

```json
{
  "articuloId": "33333333-3333-4333-8333-333333333333",
  "warehouseId": "11111111-1111-4111-8111-111111111111",
  "quantity": "2.000",
  "unit": "KG",
  "source": "MANUAL",
  "authorizeNegativeStock": true,
  "negativeStockReason": "Autorización de despacho pendiente"
}
```

### 13. Transferir entre almacenes

**POST `/api/v1/inventory/transfer`**

- **Objetivo:** restar del origen y sumar al destino atómicamente, registrando
  un movimiento `TRANSFER`.
- **Autenticación/permiso:** Firebase ID Token; `inventory:transfer`.
- **Headers:** `Authorization`, `Content-Type`, `Idempotency-Key` requerido y
  `x-request-id` opcional.
- **Body requerido:** `articuloId`, `sourceWarehouseId`,
  `destinationWarehouseId` UUID, `quantity`, `unit` y `source`.
- **Body opcional:** `inventoryLotId`, `reason`, `authorizeNegativeStock`,
  `negativeStockReason`.
- **Éxito:** `201`; además del resultado estándar incluye
  `destinationResultingStock`.
- **Errores:** `400 INVALID_TRANSFER` si almacenes son iguales,
  `INVALID_QUANTITY`, `UNIT_MISMATCH` o `LOT_ARTICULO_MISMATCH`; `403`;
  `404 NOT_FOUND`; `409 WAREHOUSE_INACTIVE`,
  `NEGATIVE_STOCK_AUTHORIZATION_REQUIRED` o `IDEMPOTENCY_CONFLICT`.
- **Reglas:** ambos almacenes deben existir y estar activos; el lote, si se
  envía, debe corresponder al artículo. El saldo negativo se autoriza con las
  mismas tres condiciones del outbound.

```json
{
  "articuloId": "33333333-3333-4333-8333-333333333333",
  "sourceWarehouseId": "11111111-1111-4111-8111-111111111111",
  "destinationWarehouseId": "66666666-6666-4666-8666-666666666666",
  "quantity": "2.000",
  "unit": "KG",
  "source": "TRASLADO"
}
```

### 14. Registrar ajuste

**POST `/api/v1/inventory/adjustment`**

- **Objetivo:** modificar el saldo por conteo o corrección y registrar un
  movimiento `ADJUSTMENT`.
- **Autenticación/permiso:** Firebase ID Token; `inventory:adjust`.
- **Headers:** `Authorization`, `Content-Type`, `Idempotency-Key` requerido y
  `x-request-id` opcional.
- **Body requerido:** los campos de movimiento y `direction`, cuyo enum real
  es `INCREASE | DECREASE`.
- **Body opcional:** `inventoryLotId`, `reason`,
  `authorizeNegativeStock`, `negativeStockReason`.
- **Éxito:** `201`, con el resultado estándar del movimiento.
- **Errores:** `400 INVALID_QUANTITY`, `INVALID_UNIT`, `ARTICULO_INVALID`,
  `UNIT_MISMATCH` o `LOT_ARTICULO_MISMATCH`; `403`; `404 NOT_FOUND`;
  `409 NEGATIVE_STOCK_AUTHORIZATION_REQUIRED` o
  `IDEMPOTENCY_CONFLICT`.
- **Reglas:** `INCREASE` suma y `DECREASE` resta; la autorización para
  terminar bajo cero se aplica al resultado final. Los movimientos no se
  editan ni eliminan.

```json
{
  "articuloId": "33333333-3333-4333-8333-333333333333",
  "warehouseId": "11111111-1111-4111-8111-111111111111",
  "quantity": "1.000",
  "unit": "KG",
  "source": "CONTEO",
  "direction": "INCREASE",
  "reason": "Diferencia de conteo"
}
```

## Ejemplos de respuestas de comandos y lecturas

Los siguientes ejemplos completan el envelope de éxito de los endpoints cuyo
request ya aparece en su sección:

```json
{
  "data": {
    "activo": true,
    "id": "11111111-1111-4111-8111-111111111111",
    "codigo": "BOD-1",
    "nombre": "Bodega principal",
    "ubicacion": null,
    "encargadoUserId": null,
    "observaciones": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "meta": {"requestId": "req-1"}
}
```

Las activaciones/desactivaciones usan el mismo envelope y `201`, variando
únicamente `data.activo`. Un movimiento exitoso tiene esta forma:

```json
{
  "data": {
    "movementId": "55555555-5555-4555-8555-555555555555",
    "articuloId": "33333333-3333-4333-8333-333333333333",
    "inventoryLotId": null,
    "quantity": "2.000",
    "unit": "KG",
    "resultingStock": "10.500",
    "createdAt": "2025-01-03T00:00:00.000Z"
  },
  "meta": {"requestId": "req-1"}
}
```

Transfer agrega `destinationResultingStock`; clasificación agrega
`previousClassification`, `classification` y `updatedAt`; consultas de lote
devuelven el registro persistido dentro de `data`.

## Operaciones internas no HTTP

La API interna también expone primitivas para Compras y Production, como
`registerInbounds`, `registerProductionOutput` y
`releaseProductionOutput`. No son endpoints públicos y no deben ser
inventados por el frontend. `POST /api/v1/compras/:id/receive` usa el
contexto confiable de servidor y no exige `inventory:inbound` al actor de
Compras.
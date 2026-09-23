# Production API — contrato real

Base: `/api/v1/production`. Todas las rutas requieren
`Authorization: Bearer <Firebase ID token>`; el middleware verifica el token,
resuelve el usuario local y evalúa el permiso. JSON usa
`Content-Type: application/json`. Los UUID de los ejemplos son UUID RFC 4122
válidos de ejemplo (`11111111-1111-4111-8111-111111111111`,
`22222222-2222-4222-8222-222222222222`,
`33333333-3333-4333-8333-333333333333`,
`44444444-4444-4444-8444-444444444444`,
`55555555-5555-4555-8555-555555555555`).

Las respuestas exitosas usan `{data: ...}`; listas usan además
`meta: {page,pageSize,total,totalPages}`. Fechas son ISO-8601 y decimales
son strings. Errores usan `{error:{code,message,requestId}}`; los errores
comunes son `AUTH_MISSING_TOKEN`, `AUTH_FORBIDDEN` y `VALIDATION_ERROR`.
IDs de path son UUID; cuerpos strict de Zod rechazan campos desconocidos.

## Permisos

`production:read`, `production:participant_manage`,
`production:producer_manage`, `production:grape_variety_manage`,
`production:custom_fields_manage`, `production:work_type_manage`,
`production:measurement_type_manage`, `production:order_create`,
`production:order_close`, `production:transformation_order_create`,
`production:transformation_order_close`, `production:container_manage`,
`production:container_assign`, `production:container_transfer`,
`production:work_create`, `production:work_correct`,
`production:reception_create`, `production:measurement_create`,
`production:transformation_create`, `production:loss_create`,
`production:inventory_release`, `production:measurement_correct`,
`production:reception_correct`, `production:work_input_create`,
`production:work_input_reverse`, `production:inventory_release_reverse`.

`code` tiene 1--100 caracteres; `name` y `label`, 1--200. Las cantidades
son strings no negativas con hasta tres decimales; cantidades de operación
son positivas. Las mutaciones que no reciben `operationKey` no tienen
idempotencia de aplicación. Cuando un schema exige `operationKey`, un replay
debe conservar el mismo payload; un payload distinto produce
`IDEMPOTENCY_CONFLICT`. `requestHash` sólo es requerido donde se indica.

## 1. Catálogos

Los cinco catálogos comparten query `page` (default 1), `pageSize` (default
20, máximo 100), `search` y `active=true|false`. El response concreto de
lectura y mutación es:
`{"id":"11111111-1111-4111-8111-111111111111","code":"C-1","name":"Nombre","active":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}`.
Participantes además incluyen `userId` nullable.

### `GET /api/v1/production/participants`

Permiso `production:read`; query anterior; body `—`; 200:
`{"data":[{"id":"11111111-1111-4111-8111-111111111111","code":"P-1","name":"Ana","userId":"22222222-2222-4222-8222-222222222222","active":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}],"meta":{"page":1,"pageSize":20,"total":1,"totalPages":1}}`.

### `POST /api/v1/production/participants`

Permiso `production:participant_manage`; body requerido `code,name`,
`userId` opcional; 201:
`{"data":{"id":"11111111-1111-4111-8111-111111111111","code":"P-1","name":"Ana","userId":"22222222-2222-4222-8222-222222222222","active":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}}`.
Request: `{"code":"P-1","name":"Ana","userId":"22222222-2222-4222-8222-222222222222"}`.

### `PATCH /api/v1/production/participants/:id`

Permiso `production:participant_manage`; path `id`; body `{"name":"Ana R."}`;
200 devuelve el objeto anterior con `name:"Ana R."`. 404:
`PRODUCTION_NOT_FOUND`; sin `operationKey`.

### `POST /api/v1/production/participants/:id/activate`

Permiso `production:participant_manage`; path UUID; body `—`; 200 devuelve
`{data:{id,code,name,userId,active:true,createdAt,updatedAt}}`; errores:
`PRODUCTION_NOT_FOUND`, `VALIDATION_ERROR`.

### `POST /api/v1/production/participants/:id/deactivate`

Permiso `production:participant_manage`; path UUID; body `—`; 200 devuelve
`{data:{id,code,name,userId,active:false,createdAt,updatedAt}}`; errores:
`PRODUCTION_NOT_FOUND`, `VALIDATION_ERROR`.

### `GET /api/v1/production/producers`

Permiso `production:read`; query `page,pageSize,search,active`; 200:
`{"data":[{"id":"11111111-1111-4111-8111-111111111111","code":"PR-1","name":"Bodega","active":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}],"meta":{"page":1,"pageSize":20,"total":1,"totalPages":1}}`.

### `POST /api/v1/production/producers`

Permiso `production:producer_manage`; request
`{"code":"PR-1","name":"Bodega"}`; 201:
`{"data":{"id":"11111111-1111-4111-8111-111111111111","code":"PR-1","name":"Bodega","active":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}}`.
Error de duplicado: `PRODUCTION_CODE_ALREADY_EXISTS`.

### `PATCH /api/v1/production/producers/:id`

Permiso `production:producer_manage`; request path UUID + `{"name":"Bodega Sur"}`;
200 devuelve `{data:{id,code:"PR-1",name:"Bodega Sur",active,createdAt,updatedAt}}`;
404 `PRODUCTION_NOT_FOUND`.

### `POST /api/v1/production/producers/:id/activate`

Permiso `production:producer_manage`; body `—`; 200
`{data:{id,code:"PR-1",name:"Bodega",active:true,createdAt,updatedAt}}`;
errores `PRODUCTION_NOT_FOUND`, `VALIDATION_ERROR`.

### `POST /api/v1/production/producers/:id/deactivate`

Permiso `production:producer_manage`; body `—`; 200
`{data:{id,code:"PR-1",name:"Bodega",active:false,createdAt,updatedAt}}`;
errores `PRODUCTION_NOT_FOUND`, `VALIDATION_ERROR`.

### `GET /api/v1/production/grape-varieties`

Permiso `production:read`; query `page,pageSize,search,active`; 200:
`{"data":[{"id":"11111111-1111-4111-8111-111111111111","code":"CAB","name":"Cabernet","active":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}],"meta":{"page":1,"pageSize":20,"total":1,"totalPages":1}}`.

### `POST /api/v1/production/grape-varieties`

Permiso `production:grape_variety_manage`; request
`{"code":"CAB","name":"Cabernet"}`; 201:
`{"data":{"id":"11111111-1111-4111-8111-111111111111","code":"CAB","name":"Cabernet","active":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}}`.

### `PATCH /api/v1/production/grape-varieties/:id`

Permiso `production:grape_variety_manage`; request path UUID +
`{"name":"Cabernet Sauvignon"}`; 200 devuelve `{data:{id,code,name,active,createdAt,updatedAt}}`;
404 `PRODUCTION_NOT_FOUND`.

### `POST /api/v1/production/grape-varieties/:id/activate`

Permiso `production:grape_variety_manage`; body `—`; 200 devuelve
`{data:{id,code,name,active:true,createdAt,updatedAt}}`; errores
`PRODUCTION_NOT_FOUND`, `VALIDATION_ERROR`.

### `POST /api/v1/production/grape-varieties/:id/deactivate`

Permiso `production:grape_variety_manage`; body `—`; 200 devuelve
`{data:{id,code,name,active:false,createdAt,updatedAt}}`; errores
`PRODUCTION_NOT_FOUND`, `VALIDATION_ERROR`.

### `GET /api/v1/production/work-types`

Permiso `production:read`; query `page,pageSize,search,active`; 200 devuelve
`{data:[{id,code:"FERM",name:"Fermentación",active,createdAt,updatedAt}],meta}`.

### `POST /api/v1/production/work-types`

Permiso `production:work_type_manage`; request
`{"code":"FERM","name":"Fermentación"}`; 201 devuelve
`{data:{id,code:"FERM",name:"Fermentación",active:true,createdAt,updatedAt}}`;
duplicado: `PRODUCTION_CODE_ALREADY_EXISTS`.

### `PATCH /api/v1/production/work-types/:id`

Permiso `production:work_type_manage`; body `{"name":"Fermentación alcohólica"}`;
200 devuelve `{data:{id,code,name,active,createdAt,updatedAt}}`; 404
`PRODUCTION_NOT_FOUND`.

### `POST /api/v1/production/work-types/:id/activate`

Permiso `production:work_type_manage`; body `—`; 200
`{data:{id,code,name,active:true,createdAt,updatedAt}}`; sin idempotency key.

### `POST /api/v1/production/work-types/:id/deactivate`

Permiso `production:work_type_manage`; body `—`; 200
`{data:{id,code,name,active:false,createdAt,updatedAt}}`; sin idempotency key.

### `GET /api/v1/production/measurement-types`

Permiso `production:read`; query `page,pageSize,search,active`; 200 devuelve
`{data:[{id,code:"TEMP",name:"Temperatura",active,createdAt,updatedAt}],meta}`.

### `POST /api/v1/production/measurement-types`

Permiso `production:measurement_type_manage`; request
`{"code":"TEMP","name":"Temperatura"}`; 201 devuelve
`{data:{id,code:"TEMP",name:"Temperatura",active:true,createdAt,updatedAt}}`.

### `PATCH /api/v1/production/measurement-types/:id`

Permiso `production:measurement_type_manage`; body `{"name":"Temperatura tanque"}`;
200 devuelve `{data:{id,code,name,active,createdAt,updatedAt}}`; 404
`PRODUCTION_NOT_FOUND`.

### `POST /api/v1/production/measurement-types/:id/activate`

Permiso `production:measurement_type_manage`; body `—`; 200
`{data:{id,code,name,active:true,createdAt,updatedAt}}`; errores comunes.

### `POST /api/v1/production/measurement-types/:id/deactivate`

Permiso `production:measurement_type_manage`; body `—`; 200
`{data:{id,code,name,active:false,createdAt,updatedAt}}`; errores comunes.

## 2. Custom Fields (6 rutas)

Una definición devuelve `{id,entityType,code,label,dataType,required,active,
options,displayOrder,createdAt,updatedAt}`. `entityType` es
`PRODUCER|GRAPE_VARIETY|GRAPE_RECEPTION`; `dataType` es
`TEXT|INTEGER|DECIMAL|BOOLEAN|DATE|SELECT`.

### `GET /api/v1/production/custom-fields/definitions`

Permiso `production:read`; sin query/body; 200:
`{"data":[{"id":"11111111-1111-4111-8111-111111111111","entityType":"PRODUCER","code":"ORIGIN","label":"Origen","dataType":"TEXT","required":true,"active":true,"options":null,"displayOrder":0,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}]}`.

### `POST /api/v1/production/custom-fields/definitions`

Permiso `production:custom_fields_manage`; request:
`{"entityType":"GRAPE_VARIETY","code":"CLONE","label":"Clon","dataType":"SELECT","required":false,"active":true,"options":["1103P","110R"],"displayOrder":1}`;
201 devuelve la definición completa anterior. `required` default false,
`active` true y `displayOrder` 0. SELECT exige opciones; opciones sólo son
válidas para SELECT. Errores: `CUSTOM_FIELD_OPTIONS_REQUIRED`,
`CUSTOM_FIELD_OPTIONS_INVALID`, `PRODUCTION_CODE_ALREADY_EXISTS`.

### `PATCH /api/v1/production/custom-fields/definitions/:id`

Permiso `production:custom_fields_manage`; path UUID; body parcial sólo
`label`, `required`, `options`, `displayOrder`; request
`{"label":"Clon varietal","options":["1103P","110R"]}`; 200 devuelve la
definición completa con esos cambios. No cambia `entityType`, `code`,
`dataType` ni `active`. Errores: `CUSTOM_FIELD_DEFINITION_NOT_FOUND`,
`CUSTOM_FIELD_OPTIONS_REQUIRED`, `CUSTOM_FIELD_OPTIONS_INVALID`.

### `POST /api/v1/production/custom-fields/definitions/:id/activate`

Permiso `production:custom_fields_manage`; body `—`; 200 devuelve la
definición completa con `active:true`; 404
`CUSTOM_FIELD_DEFINITION_NOT_FOUND`.

### `POST /api/v1/production/custom-fields/definitions/:id/deactivate`

Permiso `production:custom_fields_manage`; body `—`; 200 devuelve la
definición completa con `active:false`; 404
`CUSTOM_FIELD_DEFINITION_NOT_FOUND`.

### `PUT /api/v1/production/custom-fields/values`

Permiso `production:custom_fields_manage`; request:
`{"definitionId":"11111111-1111-4111-8111-111111111111","entityType":"PRODUCER","entityId":"22222222-2222-4222-8222-222222222222","value":"Mendoza"}`;
200:
`{"data":{"id":"33333333-3333-4333-8333-333333333333","definitionId":"11111111-1111-4111-8111-111111111111","entityType":"PRODUCER","entityId":"22222222-2222-4222-8222-222222222222","textValue":"Mendoza","integerValue":null,"decimalValue":null,"booleanValue":null,"dateValue":null,"selectValue":null}}`.
Es upsert por `definitionId+entityId`. Tipo: TEXT string, INTEGER int32,
DECIMAL string con hasta seis decimales, BOOLEAN boolean, DATE string parseable,
SELECT string en `options`. `GRAPE_RECEPTION` usa la recepción existente
identificada por `entityId`; las recepciones no tienen un estado `active`, pero
deben existir. Otros errores: `CUSTOM_FIELD_DEFINITION_NOT_FOUND`,
`CUSTOM_FIELD_DEFINITION_INACTIVE`, `CUSTOM_FIELD_ENTITY_NOT_FOUND`,
`CUSTOM_FIELD_ENTITY_INACTIVE`, `CUSTOM_FIELD_VALUE_INVALID`.

## 3. Órdenes de producción

`status` sólo es `OPEN|CLOSED`; lists usan `page,pageSize,status`.

### `GET /api/v1/production/orders`

Permiso `production:read`; body `—`; 200:
`{"data":[{"id":"11111111-1111-4111-8111-111111111111","code":"ORD-1","status":"OPEN","startDate":"2025-01-01T00:00:00.000Z","observations":null,"closedAt":null,"closedByUserId":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0}],"meta":{"page":1,"pageSize":20,"total":1,"totalPages":1}}`.

### `GET /api/v1/production/orders/:id`

Permiso `production:read`; path UUID; 200 devuelve el objeto de orden completo
anterior **más** `transformationOrders`, un array anidado de órdenes de
transformación. Ejemplo:
`{"data":{"id":"11111111-1111-4111-8111-111111111111","code":"ORD-1","status":"OPEN","startDate":"2025-01-01T00:00:00.000Z","observations":null,"closedAt":null,"closedByUserId":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0,"transformationOrders":[{"id":"22222222-2222-4222-8222-222222222222","code":"TR-1","productionOrderId":"11111111-1111-4111-8111-111111111111","status":"OPEN","periodStart":"2025-01-01T00:00:00.000Z","periodEnd":null,"observations":null,"closedAt":null,"closedByUserId":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0}]}}`.
404 `PRODUCTION_ORDER_NOT_FOUND`.

### `POST /api/v1/production/orders`

Permiso `production:order_create`; request
`{"code":"ORD-1","startDate":"2025-01-01T00:00:00.000Z","observations":"Inicio"}`;
201 devuelve el objeto con `status:"OPEN"`, `version:0`, `closedAt:null` y
`closedByUserId:null`. Código duplicado y validación son errores.

### `POST /api/v1/production/orders/:id/close`

Permiso `production:order_close`; path UUID; body `—`; 200 devuelve el mismo
objeto con `status:"CLOSED"`, `closedAt`, `closedByUserId` y version
incrementada. Sólo `OPEN`; errores de estado, inexistencia y
`PRODUCTION_CONCURRENCY_CONFLICT`.

## 4. Transformation Orders

Las respuestas de **listado y detalle** de transformation-orders incluyen la
relación `productionOrder` completa (el repository usa
`include: { productionOrder: true }`):
`{"id":"22222222-2222-4222-8222-222222222222","code":"TR-1","productionOrderId":"11111111-1111-4111-8111-111111111111","status":"OPEN","periodStart":"2025-01-01T00:00:00.000Z","periodEnd":null,"observations":null,"closedAt":null,"closedByUserId":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0,"productionOrder":{"id":"11111111-1111-4111-8111-111111111111","code":"ORD-1","status":"OPEN","startDate":"2025-01-01T00:00:00.000Z","observations":null,"closedAt":null,"closedByUserId":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0}}`.

### `GET /api/v1/production/transformation-orders`

Permiso `production:read`; query `page,pageSize,status`; 200:
`{"data":[{"id":"22222222-2222-4222-8222-222222222222","code":"TR-1","productionOrderId":"11111111-1111-4111-8111-111111111111","status":"OPEN","periodStart":"2025-01-01T00:00:00.000Z","periodEnd":null,"observations":null,"closedAt":null,"closedByUserId":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0,"productionOrder":{"id":"11111111-1111-4111-8111-111111111111","code":"ORD-1","status":"OPEN","startDate":"2025-01-01T00:00:00.000Z","observations":null,"closedAt":null,"closedByUserId":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0}}],"meta":{"page":1,"pageSize":20,"total":1,"totalPages":1}}`.

### `GET /api/v1/production/transformation-orders/:id`

Permiso `production:read`; path UUID; 200 devuelve el transformation-order
completo **con** la relación anidada `productionOrder` de la forma anterior;
404 `TRANSFORMATION_ORDER_NOT_FOUND`. Las respuestas de POST no incluyen esa
relación porque el create repository no usa `include`.

### `POST /api/v1/production/transformation-orders`

Permiso `production:transformation_order_create`; request
`{"code":"TR-1","productionOrderId":"22222222-2222-4222-8222-222222222222","periodStart":"2025-01-01T00:00:00.000Z","periodEnd":"2025-01-31T00:00:00.000Z"}`;
201 devuelve el objeto con `status:"OPEN"`. Requiere orden padre; no usa
`operationKey`.

### `POST /api/v1/production/transformation-orders/:id/close`

Permiso `production:transformation_order_close`; path UUID; body `—`; 200
devuelve el objeto con `status:"CLOSED"`, cierre y versión incrementada.
Requiere estado OPEN y orden padre compatible.

## 5. Batches

Un detalle/listado de batch tiene:
`{id,code,productionOrderId,articuloId,unit,createdAt,observations,version,
balance:{productionBatchId,generated,consumed,separated,lost,
transferredToInventory,available,ledgerVersion,updatedAt}}`.

### `GET /api/v1/production/batches`

Permiso `production:read`; query `page,pageSize,articuloId,productionOrderId`;
200 devuelve `data` de detalles con la forma anterior y `meta`.

### `GET /api/v1/production/batches/:batchId`

Permiso `production:read`; path UUID; 200 devuelve un detalle completo con
balance embebido; el controller delega inexistencia al servicio.

### `GET /api/v1/production/batches/:batchId/trace`

Permiso `production:read`; path UUID; 200:
`{"data":{"batches":[{"id":"11111111-1111-4111-8111-111111111111","code":"B-1","productionOrderId":"22222222-2222-4222-8222-222222222222","articuloId":"33333333-3333-4333-8333-333333333333","unit":"KG","createdAt":"2025-01-01T00:00:00.000Z","observations":null,"version":0,"balance":{"productionBatchId":"11111111-1111-4111-8111-111111111111","generated":"100.000","consumed":"0.000","separated":"0.000","lost":"0.000","transferredToInventory":"0.000","available":"100.000","ledgerVersion":0,"updatedAt":"2025-01-01T00:00:00.000Z"}}],"lineage":[],"ledger":[],"receptions":[],"transformations":[],"measurements":[],"works":[],"containers":[]}}`.
Puede producir `TRACE_LIMIT_EXCEEDED` (422) sobre profundidad 100 o 1000
batches.

### `GET /api/v1/production/batches/:batchId/balance`

Permiso `production:read`; path UUID; body/query `—`; 200 **sólo**:
`{"data":{"productionBatchId":"11111111-1111-4111-8111-111111111111","unit":"KG","available":"100.000"}}`.
No devuelve `generated`, `consumed`, `ledgerVersion` ni el balance embebido
del detalle.

### `POST /api/v1/production/batches/:batchId/release-to-inventory`

Permiso `production:inventory_release`; request:
`{"quantity":"20.000","warehouseId":"44444444-4444-4444-8444-444444444444","operationKey":"release-1","lotCode":"LOT-1","classification":"PRODUCTO_ENVASADO","fechaIngreso":"2025-01-02T00:00:00.000Z","observations":"Liberación"}`.
El backend calcula y persiste el SHA-256 del comando normalizado; el cliente no
puede elegir ese hash.
El replay con la misma clave y payload devuelve el resultado original y un
payload distinto produce `IDEMPOTENCY_CONFLICT`. 200:
`{"data":{"releaseId":"33333333-3333-4333-8333-333333333333","productionBatchId":"11111111-1111-4111-8111-111111111111","quantity":"20.000","remainingProductionQuantity":"80.000","inventoryLotId":"55555555-5555-4555-8555-555555555555","inventoryMovementId":"44444444-4444-4444-8444-444444444444","warehouseId":"44444444-4444-4444-8444-444444444444"}}`.
`classification` acepta exclusivamente `PRODUCTO_ENVASADO`. Production libera
el lote con esa clasificación inicial; las transiciones posteriores a
`PRODUCTO_TERMINADO` o `PRODUCTO_TERMINADO_EXPORTACION` son responsabilidad de
Inventory. Balance insuficiente e
`IDEMPOTENCY_CONFLICT` son errores relevantes.

### `GET /api/v1/production/inventory-release/warehouses`

Permiso `production:inventory_release`; devuelve los almacenes activos
disponibles para release a Inventory.

## 6. Containers / occupancies / movements

Container: `{id,code,name,type,location,material,capacity,capacityUnit,status,
observations,currentOccupancy,createdAt,updatedAt,version}`. Metadata is
nullable for legacy rows; new API-created containers require
`type:TANQUE|BARRICA|OTRO`. `currentOccupancy` is a nullable summary
`{batchId,batchCode,quantity,unit,openedAt}` included by the list query.
Occupancy is `{id,containerId,batchId,quantity,unit,openedAt,closedAt}`;
movement is `{id,movementType,sourceContainerId,destinationContainerId,
sourceBatchId,destinationBatchId,quantity,unit,productionWorkId,observations,
actorUserId,occurredAt,createdAt}` and never exposes `requestHash`.

### `GET /api/v1/production/batches/:batchId/releases`

Permiso `production:read`; devuelve el historial append-only de releases del
batch, con cantidad, lote/movimiento de Inventory, almacén, actor y fechas. No
se edita ni elimina historia.

### `POST /api/v1/production/batches/:batchId/releases/:releaseId/reverse`

Permiso `production:inventory_release_reverse`; request:
`{"operationKey":"reverse-1","reason":"Corrección operativa"}`. La reversión es
completa y append-only: conserva el release original y crea el movimiento
compensatorio. Rechaza un release ya revertido, ajeno al batch o cuyo estado
actual haría insegura la compensación (`UNSAFE_RELEASE_REVERSAL`). No acepta
`authorizeNegativeStock` ni autoriza stock negativo. Production, Inventory y
auditoría confirman o revierten juntas.

### `GET /api/v1/production/containers`

Permiso `production:read`; sin query/body; 200:
`{"data":[{"id":"11111111-1111-4111-8111-111111111111","code":"T-1","name":null,"type":"TANQUE","location":null,"material":null,"capacity":"1000.000","capacityUnit":"L","status":"DISPONIBLE","observations":null,"currentOccupancy":null,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z","version":0}]}`

### `GET /api/v1/production/containers/:id`

Permiso `production:read`; path UUID; 200 devuelve container más
`occupancies:[{id,containerId,batchId,quantity,unit,openedAt,closedAt}]`;
404 `CONTAINER_NOT_FOUND`.

### `GET /api/v1/production/containers/:id/occupancies`

Permiso `production:read`; path UUID; 200:
`{"data":[{"id":"22222222-2222-4222-8222-222222222222","containerId":"11111111-1111-4111-8111-111111111111","batchId":"33333333-3333-4333-8333-333333333333","quantity":"100.000","unit":"L","openedAt":"2025-01-01T00:00:00.000Z","closedAt":null}]}`

### `GET /api/v1/production/containers/:id/movements`

Permiso `production:read`; path UUID; 200:
`{"data":[{"id":"22222222-2222-4222-8222-222222222222","movementType":"ASSIGNED","sourceContainerId":null,"destinationContainerId":"11111111-1111-4111-8111-111111111111","sourceBatchId":"33333333-3333-4333-8333-333333333333","destinationBatchId":null,"quantity":"100.000","unit":"L","occurredAt":"2025-01-01T00:00:00.000Z","createdAt":"2025-01-01T00:00:00.000Z"}]}`

### `POST /api/v1/production/containers`

Permiso `production:container_manage`; request
`{"code":"T-1","capacity":"1000.000","capacityUnit":"L","observations":"Acero"}`;
201 devuelve container completo con status `DISPONIBLE`; `type` es obligatorio
en altas nuevas. Código duplicado:
`PRODUCTION_CODE_ALREADY_EXISTS`.

### `PATCH /api/v1/production/containers/:id`

Permiso `production:container_manage`; path UUID; request
`{"capacity":"1100.000","observations":"Calibrado"}`; 200 devuelve container
completo actualizado. Capacidad menor que ocupación:
`CONTAINER_CAPACITY_EXCEEDED` (409).

### `POST /api/v1/production/containers/:id/activate`

Permiso `production:container_manage`; path UUID; body `—`; 200 devuelve
container completo con `status:"DISPONIBLE"`. Contenedor ocupado:
`CONTAINER_OCCUPIED` (409).

### `POST /api/v1/production/containers/:id/deactivate`

Permiso `production:container_manage`; path UUID; body `—`; 200 devuelve
container completo con `status:"FUERA_DE_SERVICIO"`; `CONTAINER_OCCUPIED`
si tiene ocupación abierta.

### `POST /api/v1/production/containers/:id/assign`

Permiso `production:container_assign`; `:id` es destino. Body:
```json
{"batchId":"22222222-2222-4222-8222-222222222222","quantity":"100.000",
 "productionWorkId":"33333333-3333-4333-8333-333333333333",
 "observations":"Carga inicial","occurredAt":"2025-01-01T08:00:00.000Z",
 "operationKey":"assign-1","requestHash":"<sha256>"}
```
La respuesta es `{container,occupancy}`. El hash es SHA-256 del payload
canónico semántico, sin `operationKey` ni `requestHash`.

### `POST /api/v1/production/containers/:sourceId/transfers`

Permiso `production:container_transfer`. Body:
```json
{"destinationContainerId":"44444444-4444-4444-8444-444444444444",
 "batchId":"22222222-2222-4222-8222-222222222222",
 "productionWorkId":"33333333-3333-4333-8333-333333333333",
 "observations":"Traslado","occurredAt":"2025-01-01T09:00:00.000Z",
 "operationKey":"transfer-1","requestHash":"<sha256>"}
```
No se envía `quantity`: deriva de la ocupación completa. Responde
`{container,occupancy}`.

### `POST /api/v1/production/containers/:sourceId/transfers/partial`

Permiso `production:container_transfer`. Body:
```json
{"destinationContainerId":"44444444-4444-4444-8444-444444444444",
 "batchId":"22222222-2222-4222-8222-222222222222","quantity":"20.000",
 "childCode":"B-CHILD-1","productionWorkId":"33333333-3333-4333-8333-333333333333",
 "observations":"Separación","occurredAt":"2025-01-01T09:00:00.000Z",
 "operationKey":"partial-1","requestHash":"<sha256>"}
```
Responde `{parent,child,source,destination}` y crea el hijo/lineage
atómicamente. Work se valida contra la ProductionOrder del batch; actor y
fecha efectiva los determina/persiste backend. No hay InventoryMovement para
traslados internos.

## 7. Works

Work: `{id,productionOrderId,transformationOrderId,workTypeId,performedAt,
observations,createdByUserId,createdAt,updatedAt,version,batchIds,
containerIds,participants,corrections,inputs}`. `inputs` is append-only and
contains the inventory movement provenance and reversal fields.

### `POST /api/v1/production/works/:id/inputs`

Permiso `production:work_input_create`. Body:
`{articuloId,warehouseId,inventoryLotId?,quantity,unit,operationKey,requestHash,
observations?,authorizeNegativeStock?,negativeStockReason?}`. `quantity` is a
positive decimal string with at most three decimals and `unit` is
`KG|G|L|M|UNIDAD`; no automatic conversion is performed. The command atomically
creates an OUTBOUND inventory movement and the work input. Replaying the same
operation key and request hash returns the same result; a mismatch returns
`IDEMPOTENCY_CONFLICT`.

### `POST /api/v1/production/works/:workId/inputs/:inputId/reverse`

Permiso `production:work_input_reverse`. Body
`{reason,operationKey,requestHash}`. A work input can be reversed once; reversal
creates a compensating INBOUND movement and preserves the original row.

### `GET /api/v1/production/works`

Permiso `production:read`; query `page,pageSize,productionOrderId,workTypeId`;
200 devuelve array de work y `meta`.

### `GET /api/v1/production/works/:id`

Permiso `production:read`; path UUID; 200 devuelve work completo; 404
`PRODUCTION_WORK_NOT_FOUND`.

### `POST /api/v1/production/works`

Permiso `production:work_create`; request:
`{"productionOrderId":"22222222-2222-4222-8222-222222222222","workTypeId":"33333333-3333-4333-8333-333333333333","performedAt":"2025-01-02T08:00:00.000Z","observations":"Trabajo","batchIds":["11111111-1111-4111-8111-111111111111"],"containerIds":["44444444-4444-4444-8444-444444444444"],"participants":[{"participantId":"55555555-5555-4555-8555-555555555555","role":"OPERADOR"}]}`.
`batchIds`, `containerIds`, `participants` default `[]`; 201 devuelve work
completo con arrays `batchIds`, `containerIds`, `participants`, `corrections`.
Requiere orden OPEN, work type activo, referencias existentes y participantes
activos.

### `POST /api/v1/production/works/:id/corrections`

Permiso `production:work_correct`; path UUID; request
`{"field":"observations","newValue":"Corregido","reason":"Dato original incorrecto"}`;
200 devuelve **el ProductionWork completo actualizado**, no una corrección:
`{"data":{"id":"11111111-1111-4111-8111-111111111111","productionOrderId":"22222222-2222-4222-8222-222222222222","transformationOrderId":null,"workTypeId":"33333333-3333-4333-8333-333333333333","performedAt":"2025-01-02T08:00:00.000Z","observations":"Corregido","createdByUserId":"44444444-4444-4444-8444-444444444444","createdAt":"2025-01-02T08:00:00.000Z","updatedAt":"2025-01-02T09:00:00.000Z","version":1,"batchIds":[],"containerIds":[],"participants":[],"corrections":[{"id":"55555555-5555-4555-8555-555555555555","field":"observations","previousValue":"Original","newValue":"Corregido","reason":"Dato original incorrecto","correctedAt":"2025-01-02T09:00:00.000Z","actorUserId":"44444444-4444-4444-8444-444444444444","fromVersion":0,"toVersion":1}]}}`.
El schema sólo permite `performedAt|workTypeId|transformationOrderId|
observations`; no `operationKey` ni `requestHash`.

## 8. Grape receptions

La recepción no expone relaciones humanas anidadas: `productionOrderId`,
`producerId`, `grapeVarietyId` y `articuloId` son referencias opacas. Los estados
de wire son exactamente `ACCEPTED|ACCEPTED_WITH_OBSERVATIONS`; cuando se usa
`ACCEPTED_WITH_OBSERVATIONS`, `observations` debe existir y no ser sólo espacios.
`observations` es opcional en los demás casos y admite como máximo 2000
caracteres. `producerId` también es opcional.

### `GET /api/v1/production/grape-receptions`

Permiso `production:read`; query únicamente `page,pageSize`; 200 devuelve
receptions y `meta`. Este listado no admite `search` ni `active`.

### `GET /api/v1/production/grape-receptions/:id`

Permiso `production:read`; path UUID; 200 devuelve en `data` el detalle completo
de la recepción (sin wrapper adicional):
`{id,productionOrderId,producerId?,receivedAt,status,observations,actorUserId,
createdAt,updatedAt,version,items,corrections,customFields}`. `items` contiene
`{id,grapeVarietyId,articuloId,quantity,unit,productionBatchId}`, `corrections`
y `customFields`. Cada correction histórica tiene
`{id,field,previousValue,newValue,reason,correctedAt,actorUserId,fromVersion,
toVersion}`. Cada custom field público tiene
`{definitionId,entityType,value}`, donde `entityType` es
`GRAPE_RECEPTION` y `value` es el valor público tipado (TEXT/SELECT string,
INTEGER number, DECIMAL string, BOOLEAN boolean o DATE ISO-8601 string). No
incluye la definición completa ni relaciones anidadas. 404
`GRAPE_RECEPTION_NOT_FOUND`.

### `POST /api/v1/production/grape-receptions`

Permiso `production:reception_create`; request completo:
`{"productionOrderId":"22222222-2222-4222-8222-222222222222","producerId":"33333333-3333-4333-8333-333333333333","receivedAt":"2025-01-02T09:00:00.000Z","status":"ACCEPTED","observations":"Recepción normal","items":[{"grapeVarietyId":"44444444-4444-4444-8444-444444444444","articuloId":"55555555-5555-4555-8555-555555555555","quantity":"100.000","unit":"KG"}],"customFields":[{"definitionId":"11111111-1111-4111-8111-111111111111","value":"Mendoza"}],"operationKey":"reception-1","requestHash":"hash-1"}`.
`producerId`, `observations` y `customFields` son opcionales. Cada item
requiere `grapeVarietyId`, `articuloId`, `quantity` decimal string positiva con
hasta tres decimales y `unit` exactamente uno de `KG|G|L|M|UNIDAD`.
Cada custom field requiere `definitionId` UUID y `value` string, number o
boolean; no se aceptan propiedades adicionales. `operationKey` y `requestHash`
son requeridos. 201 devuelve este **ReceptionResult** completo, no una
recepción aplanada:
`{"data":{"reception":{"id":"11111111-1111-4111-8111-111111111111","productionOrderId":"22222222-2222-4222-8222-222222222222","producerId":"33333333-3333-4333-8333-333333333333","receivedAt":"2025-01-02T09:00:00.000Z","status":"ACCEPTED","observations":"Recepción normal","actorUserId":"44444444-4444-4444-8444-444444444444","createdAt":"2025-01-02T09:00:00.000Z","updatedAt":"2025-01-02T09:00:00.000Z","version":0},"items":[{"grapeVarietyId":"44444444-4444-4444-8444-444444444444","articuloId":"55555555-5555-4555-8555-555555555555","quantity":"100.000","unit":"KG","productionBatchId":"11111111-1111-4111-8111-111111111111"}],"batchIds":["11111111-1111-4111-8111-111111111111"]}}`.
Errores: referencias inexistentes, unidad/cantidad inválida,
`ARTICULOS_API_UNAVAILABLE`, estado inválido e `IDEMPOTENCY_CONFLICT`.

### `POST /api/v1/production/grape-receptions/:id/corrections`

Permiso `production:reception_correct`; strict request
`{"field":"status","newValue":"ACCEPTED_WITH_OBSERVATIONS","reason":"Control","operationKey":"corr-rec-1"}`.
Sólo se permiten `receivedAt` (`newValue` ISO-8601 con offset),
`producerId` (UUID), `observations` (string de hasta 2000 caracteres o
`null`) y `status` (`ACCEPTED|ACCEPTED_WITH_OBSERVATIONS`); cada tipo de
`newValue` es específico del campo. `reason` (1--2000 caracteres) y
`operationKey` (1--100 caracteres) son obligatorios. No se acepta
`requestHash` ni ningún campo desconocido.
200 devuelve **`{id,field,value,version,correctionId}`**:
`{"data":{"id":"11111111-1111-4111-8111-111111111111","field":"status","value":"ACCEPTED_WITH_OBSERVATIONS","version":1,"correctionId":"22222222-2222-4222-8222-222222222222"}}`.
El resultado compacto de este command no es el DTO histórico de `corrections`
del detalle. Las correcciones son append-only: conservan original, actor, fecha,
motivo y valores anterior/nuevo; no hay edición destructiva ni DELETE. El replay
con la misma `operationKey` y payload devuelve la misma forma; un payload
distinto produce `IDEMPOTENCY_CONFLICT`, y un valor idéntico produce
`CORRECTION_NOOP`. `status` no puede ser `ACCEPTED_WITH_OBSERVATIONS` sin
observaciones no vacías ni pueden borrarse observaciones mientras ese estado
continúe. `receivedAt` no puede quedar después de la generación del batch.

## 9. Measurements

Measurement: `{id,measurementTypeId,productionBatchId,productionContainerId,
productionWorkId,participantId,value,unit,measuredAt,observations,createdAt,
updatedAt,version}`.

### `GET /api/v1/production/measurements`

Permiso `production:read`; query `page,pageSize,measurementTypeId,
productionBatchId,productionContainerId,productionWorkId,measuredAtFrom,
measuredAtTo`; 200 devuelve measurements y `meta`.

### `GET /api/v1/production/measurements/:id`

Permiso `production:read`; path UUID; 200 devuelve measurement completo; 404
`PRODUCTION_MEASUREMENT_NOT_FOUND`.

### `POST /api/v1/production/measurements`

Permiso `production:measurement_create`; request:
`{"measurementTypeId":"11111111-1111-4111-8111-111111111111","productionBatchId":"22222222-2222-4222-8222-222222222222","value":"18.500000","unit":"C","measuredAt":"2025-01-02T10:00:00.000Z","observations":"Tanque 1"}`.
Debe existir al menos uno de batch/container/work; 201 devuelve measurement
completo. No usa `operationKey`.

### `POST /api/v1/production/measurements/:id/corrections`

Permiso `production:measurement_correct`; request
`{"field":"value","newValue":"19.000000","reason":"Relectura","operationKey":"corr-meas-1"}`;
200 devuelve **`{id,field,value,version,correctionId}`**:
`{"data":{"id":"11111111-1111-4111-8111-111111111111","field":"value","value":"19.000000","version":1,"correctionId":"22222222-2222-4222-8222-222222222222"}}`.
`operationKey` requerido; `requestHash` no existe. El replay devuelve la misma
forma. Campos: `value|unit|measuredAt|participantId|observations`.

## 10. Transformations

Transformation: `{id,productionOrderId,transformationOrderId,
productionWorkId,performedAt,actorUserId,observations,operationKey,
requestHash,inputs,outputs,losses}`. Input incluye
`productionBatchId,quantity,unit`; output incluye
`productionBatchId,articuloId,quantity,unit,code`; loss incluye
`id,productionBatchId,quantity,unit,operationKey`.

### `GET /api/v1/production/transformations`

Permiso `production:read`; query `page,pageSize,productionOrderId`; 200
devuelve transformations y `meta`.

### `GET /api/v1/production/transformations/:id`

Permiso `production:read`; path UUID; 200 devuelve transformation completa;
404 `TRANSFORMATION_NOT_FOUND`.

### `POST /api/v1/production/transformations`

Permisos `production:transformation_create` y, cuando `losses` no está vacío,
`production:loss_create`. Request:
`productionOrderId` es obligatorio; `transformationOrderId` y
`productionWorkId` son opcionales:
`{"productionOrderId":"11111111-1111-4111-8111-111111111111","transformationOrderId":"44444444-4444-4444-8444-444444444444","productionWorkId":"55555555-5555-4555-8555-555555555555","performedAt":"2025-01-02T12:00:00.000Z","operationKey":"tr-1","requestHash":"hash-1","inputs":[{"productionBatchId":"22222222-2222-4222-8222-222222222222","quantity":"10.000"}],"outputs":[{"articuloId":"33333333-3333-4333-8333-333333333333","quantity":"9.000","unit":"KG"}],"losses":[{"productionBatchId":"22222222-2222-4222-8222-222222222222","quantity":"1.000","unit":"KG"}]}`.
Si se envía `transformationOrderId`, debe existir, pertenecer a
`productionOrderId` y estar en estado `OPEN`; el backend valida estas tres
condiciones.
`inputs`/`outputs` requieren al menos un elemento; cantidades positivas;
unidades `KG|G|L|M|UNIDAD`. 201 devuelve transformation completa con
`requestHash`. `operationKey`/`requestHash` identifican el comando completo:
el replay devuelve la Transformation completa cuando el payload coincide y un
payload distinto produce `IDEMPOTENCY_CONFLICT`. El request público no recibe
claves de idempotencia por pérdida; las claves que puedan persistirse en cada
pérdida son identificadores internos y no existe retry por API independiente
de una pérdida. Errores:
balance insuficiente, estado, referencias, `ARTICULOS_API_UNAVAILABLE` e
`IDEMPOTENCY_CONFLICT`.

## 11. Production losses

No hay ruta HTTP independiente. Sólo se crean en `losses` de
`POST /api/v1/production/transformations`, con permiso adicional
`production:loss_create`.

## 12. Production → Inventory

Las rutas son `POST /api/v1/production/batches/:batchId/release-to-inventory`
y `POST /api/v1/production/batches/:batchId/releases/:releaseId/reverse`,
descrita arriba. Crea InventoryMovement y actualiza lote/stock de forma
transaccional; `operationKey` evita duplicar el efecto. No hay endpoint
adicional.

## Conteo y auditoría

El inventario de rutas públicas de este documento (incluidas las rutas de
release/reversal y el historial de release) se verificó contra métodos, paths,
permisos, schemas Zod y controllers; las correcciones, ReceptionResult,
balance reducido y ejemplos UUID reflejan sus formas actuales.

## Cierre P5.5 — contrato público vigente

El inventario público de este documento comprende catálogos, custom fields,
órdenes, transformation-orders, batches (listado, detalle, trace, balance,
releases, release y reversal), warehouse options, containers (maestro, detalle,
occupancies,
movements, assign, transfer total y partial), works (listado, detalle,
creación, corrección, inputs y reversal), receptions (listado, detalle,
creación y corrección), measurements (listado, detalle, creación y corrección)
y transformations (listado, detalle y creación), todos bajo
`/api/v1/production` y autenticación Firebase.

P5.5A usa `ProductionWorkInput`, primitives confiables de Inventory y
`SharedUnitOfWork`; consumo y reversal preservan provenance y son idempotentes.
Inventory decide la autorización de stock negativo. P5.5B conserva estados
`DISPONIBLE`, `OCUPADO`, `FUERA_DE_SERVICIO` y movimientos
`ASSIGNED`/`TRANSFERRED`/`PARTIAL_TRANSFERRED` con lineage. No hay merge-back ni
reversión destructiva automática de un traslado parcial en el MVP: la corrección
requiere una nueva operación productiva válida. P5.5C expone trace backward y
forward con límites, warnings y enlaces de Inventory. P5.5D fija
`PRODUCTO_ENVASADO`, hash canónico server-side, reversión completa, historia y
auditoría append-only, y rechazo de reversiones inseguras.

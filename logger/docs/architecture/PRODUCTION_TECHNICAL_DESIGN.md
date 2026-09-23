# Production — diseño técnico persistente (FASE 2)

## 1. Autoridad, alcance y notación

Este documento convierte las decisiones persistidas de
`DECISION_PRODUCTION.md` en un modelo técnico implementable. Es diseño de
persistencia y contrato; no es código ni migración Prisma.

La autoridad es, en este orden:

1. decisiones de negocio aprobadas y persistidas;
2. `DECISION_PRODUCTION.md`;
3. contratos de arquitectura persistidos.

No se agregan estados, permisos, campos de negocio, conversiones ni entidades
que no estén aprobados. Los campos citados por contratos inferiores pero no
exigidos por `DECISION_PRODUCTION.md` se marcan como extensión no aprobada y
quedan fuera de P1.

### 1.1 Tipos comunes

| Notación | Prisma | Dominio/DTO |
|---|---|---|
| `Id` | `String` | `string` opaco |
| `Decimal` | `Decimal` | `DecimalString` |
| `Timestamp` | `DateTime` | `Date` / ISO-8601 |
| `Json` | `Json` | objeto JSON tipado por el caso de uso |
| actor | `String` | `User.id`, derivado del contexto autenticado |

Los identificadores propios utilizan UUID y son `@id @default(uuid())`,
salvo que la convención vigente de persistencia indique otra generación. Las
referencias a `Articulo`, `User` e `Inventory` son referencias opacas validadas
por APIs públicas; Production no crea FK Prisma contra tablas de otros
módulos.

Las cantidades se almacenan como `Decimal`, son estrictamente positivas en
líneas de hechos, y nunca se transportan como `number`. No se redondean ni
convierten silenciosamente.

Las relaciones internas usan FK y `onDelete: Restrict`. Ninguna entidad
operativa o relación histórica se elimina físicamente.

## 2. Modelo técnico completo y alcance P1

Las entidades enumeradas a continuación describen el modelo técnico completo
previsto para Production. El alcance entregable de P1 es deliberadamente menor
y se define en `PRODUCTION_IMPLEMENTATION_PLAN.md`: únicamente bootstrap,
catálogos administrativos WorkType/MeasurementType, Participant, Producer,
GrapeVariety y custom fields. Órdenes, batches, trabajos, recepciones,
transformaciones, recipientes, mediciones operativas y correcciones se reservan
para sus fases posteriores; no forman parte de la migración P1.

El modelo técnico completo comprende:

- `ProductionOrder`;
- `TransformationOrder`;
- `ProductionBatch`;
- ledger de cantidades y `ProductionBatchLineage`;
- `Container` y `ContainerOccupancy`;
- `ProductionWork` y `WorkType`;
- `ProductionParticipant`;
- `Producer` y `GrapeVariety`;
- `GrapeReception` y `GrapeReceptionItem`;
- `Transformation`, `TransformationInput` y `TransformationOutput`;
- `ProductionLoss`;
- `Measurement` y `MeasurementType`;
- `CustomFieldDefinition` y `CustomFieldValue`;
- correcciones explícitas.

Quedan fuera de P1, aunque aparezcan en contratos inferiores o documentos
históricos: `harvestId`, `productionProcessId`, `productionLineId`,
`targetArticuloId`, `TransformationOrder.transformationTypeId`, entidades de
`DecisionProduccion`, `Vendimia`, `GrapeLot`, `TipoMerma`, rutas de producción,
recetas, subproductos, conversiones entre unidades y campos administrativos
adicionales de Producer/GrapeVariety. No se persisten hasta una decisión
contractual explícita.

`ProductionConsumption` y `ProductionOutput` no son Aggregate Roots
independientes: son líneas persistidas de una `Transformation`, mientras
que cada output reutilizable tiene además su `ProductionBatch`.

## 3. Ownership y referencias

Production es propietario de todos los modelos de este documento, incluidos
catálogos `Producer`, `GrapeVariety`, `WorkType`, `MeasurementType` y campos
configurables. Articulos es propietario de `Articulo`; Inventory es
propietario de `InventoryLot`, `InventoryMovement` e `InventoryStock`; Core es
propietario de `User` y auditoría.

Una referencia intermodular se valida mediante la API pública correspondiente:

- `Articulo`: `ArticulosApi`;
- actor: contexto autenticado/Core;
- stock, `InventoryLot` y salida física: `InventoryApi`.

El consumidor no accede a repositories, Prisma ni tablas de otro módulo.

## 4. Entidades canónicas

En las tablas siguientes, `?` significa nullable. Todo campo no marcado con `?`
es obligatorio.

### 4.1 `ProductionOrder`

Aggregate Root y contexto principal de producción.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | único, estable |
| `status` | `OPEN \| CLOSED` | no | único enum aprobado |
| `startDate` | Timestamp | no | fecha de inicio |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización técnica |
| `closedAt` | Timestamp | sí | solo al cerrar |
| `closedByUserId` | Id externo | sí | actor de cierre |
| `observations` | String | sí | observación libre |
| `version` | Int | no | concurrencia, inicia en 0 |

Índices: `(status)`, `(startDate)`. Unique: `code`.

Relaciones: `ProductionOrder 1:N TransformationOrder`,
`ProductionOrder 1:N ProductionWork`, `ProductionOrder 1:N ProductionBatch`,
`ProductionOrder 1:N GrapeReception`, y contextos `0:N` de pérdidas,
transformaciones y mediciones mediante sus FKs.

Lifecycle: nace `OPEN`; `OPEN -> CLOSED` es irreversible. No puede cerrar con
órdenes de transformación abiertas, trabajos pendientes o transformaciones
incompletas. Puede cerrar con batches con saldo. No se elimina.

### 4.2 `TransformationOrder`

Aggregate Root subordinado a `ProductionOrder`.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | único dentro de la orden |
| `productionOrderId` | Id | no | FK a `ProductionOrder` |
| `status` | `OPEN \| CLOSED` | no | único enum aprobado |
| `periodStart` | Timestamp | no | inicio del periodo |
| `periodEnd` | Timestamp | sí | fin efectivo/conocido |
| `observations` | String | sí | observación |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización técnica |
| `closedAt` | Timestamp | sí | cierre |
| `closedByUserId` | Id externo | sí | actor de cierre |
| `version` | Int | no | concurrencia |

Índices: `(productionOrderId, status)`, `(periodStart, periodEnd)`.
Unique: `(productionOrderId, code)`.

Relaciones: `ProductionOrder 1:N`; `ProductionWork 0:N`; `Transformation
0:N`; `ProductionLoss 0:N`.

Lifecycle: `OPEN -> CLOSED`, irreversible. No puede cerrar con trabajos,
transformaciones u operaciones productivas incompletas. No se elimina.

### 4.3 `ProductionBatch`

Aggregate Root. Es la identidad de una cantidad concreta de un `Articulo`
dentro de Production y la fuente de verdad del producto en proceso.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | único, estable |
| `productionOrderId` | Id | no | FK |
| `articuloId` | Id externo | no | Articulos API; debe estar activo |
| `unit` | String | no | unidad capturada, sin conversión |
| `createdAt` | Timestamp | no | creación |
| `observations` | String | sí | observación |
| `version` | Int | no | concurrencia |

Índices: `(productionOrderId)`, `(articuloId)`, `(createdAt)`. Unique: `code`.

No tiene `status` ni saldo editable persistido. `quantityGenerated` pertenece
al ledger como hecho `GENERATED`, no como autoridad duplicada en el batch.

Relaciones: `1:N` ledger entries; `1:N` lineage como padre y como hijo; `1:N`
TransformationInput; `1:N` TransformationOutput; `1:N` ProductionLoss;
`N:N` ProductionWork; `N:N` Container mediante ocupación; `0:N` Measurement.

Lifecycle: nace con generación positiva, permanece históricamente con saldo
cero, nunca puede tener saldo negativo y nunca se elimina. Un consumo parcial
conserva su identidad; una división produce hijos irreversibles; una mezcla
produce un batch nuevo.

### 4.4 Historia canónica: `ProductionBatchLedgerEntry`

El ledger append-only es la historia canónica de cantidades. Cada hecho
cuantitativo del batch se registra una sola vez, con su operación causal.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `productionBatchId` | Id | no | FK |
| `entryType` | Enum contractual | no | `GENERATED`, `CONSUMED`, `SEPARATED`, `LOSS`, `TRANSFERRED_TO_INVENTORY`; los valores deben corresponder al contrato |
| `quantity` | Decimal | no | `> 0` |
| `unit` | String | no | igual a la unidad del hecho/batch |
| `transformationId` | Id | sí | FK |
| `productionWorkId` | Id | sí | FK |
| `productionLossId` | Id | sí | FK |
| `operationKey` | String | no | unique, idempotencia |
| `createdAt` | Timestamp | no | fecha de registro |
| `occurredAt` | Timestamp | no | fecha efectiva |
| `actorUserId` | Id externo | no | contexto autenticado |
| `metadata` | Json | sí | referencias tipadas no estructurales |

Índices: `(productionBatchId, occurredAt, id)`, `(entryType, occurredAt)`,
`(transformationId)`, `(productionWorkId)`, `(operationKey)`. Unique:
`operationKey`.

El signo es derivado de `entryType`; nunca se persisten cantidades negativas.
La fórmula canónica es:

```text
available =
  SUM(GENERATED)
  - SUM(CONSUMED)
  - SUM(SEPARATED)
  - SUM(LOSS)
  - SUM(TRANSFERRED_TO_INVENTORY)
```

Los movimientos entre recipientes que conservan el batch no reducen este
saldo. Una división parcial registra el retiro/separación del padre, genera el
hijo y crea el hecho de generación correspondiente dentro de la misma
transacción. Una transformación consume inputs y genera outputs atómicamente.

No se permite insertar una entrada reductora si `available - quantity < 0`.
La comprobación se hace bajo lock y la base debe tener una restricción o
mecanismo equivalente para impedir duplicidad por `operationKey`.

### 4.5 `ProductionBatchBalance` (saldo materializado reconstruible)

Es un índice de lectura opcional, nunca una segunda fuente de verdad.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `productionBatchId` | Id | no | PK/FK 1:1 |
| `generated` | Decimal | no | reconstruible |
| `consumed` | Decimal | no | reconstruible |
| `separated` | Decimal | no | reconstruible |
| `lost` | Decimal | no | reconstruible |
| `transferredToInventory` | Decimal | no | reconstruible |
| `available` | Decimal | no | nunca negativa |
| `ledgerVersion` | Int | no | versión agregada |
| `updatedAt` | Timestamp | no | actualización |

Antes de usarlo, el servicio puede reconstruirlo desde el ledger y comparar
`ledgerVersion`. Si hay discrepancia, el ledger prevalece y el balance se
reconstruye. No existe endpoint para editarlo.

### 4.6 `ProductionBatchLineage`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `parentBatchId` | Id | no | FK a `ProductionBatch` |
| `childBatchId` | Id | no | FK a `ProductionBatch` |
| `quantity` | Decimal | sí | cantidad trazada, si aplica |
| `unit` | String | sí | unidad de quantity |
| `createdAt` | Timestamp | no | creación |
| `operationKey` | String | no | idempotencia |

Unique: `(parentBatchId, childBatchId, operationKey)`. Índices:
`(parentBatchId)`, `(childBatchId)`. No se permiten ciclos ni
`parentBatchId = childBatchId`; no se elimina. La trazabilidad combina lineage
con `TransformationInput` y `TransformationOutput`.

### 4.7 `Container`

 Aggregate Root de recipientes productivos. `containerType` y `status` usan los
enums existentes del contrato; P4 no crea valores adicionales.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | unique, inmutable |
| `name` | String | sí | nombre operativo |
| `containerType` | Enum existente | no | tipo de recipiente |
| `capacity` | Decimal | no | `> 0` |
| `capacityUnit` | Enum `Unit` existente | no | unidad de capacidad |
| `material` | String | sí | material, si se captura |
| `location` | String | sí | ubicación |
| `owner` | String | sí | propietario operativo |
| `status` | Enum existente | no | `DISPONIBLE`, `OCUPADO`, `FUERA_DE_SERVICIO` |
| `usageCount` | Int | sí | contador físico, no regla automática |
| `acquisitionDate` | Timestamp | sí | fecha de adquisición |
| `observations` | String | sí | observación |
| `active` | Boolean | no | baja lógica |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |
| `version` | Int | no | concurrencia |

Índices: `(containerType)`, `(status)`, `(location)`, `(active)`. Unique:
`code`.

P4 usa exactamente el enum `Unit` ya existente; no se introduce un enum
paralelo. La unidad de cada ocupación/movimiento debe ser exactamente igual a
`capacityUnit` para validar capacidad. No hay conversiones automáticas.

Lifecycle: ocupación normal `DISPONIBLE -> OCUPADO -> DISPONIBLE`;
`FUERA_DE_SERVICIO` bloquea nuevas ocupaciones. No se elimina; se desactiva o
se pone fuera de servicio.

### 4.8 `ContainerOccupancy`

Registro temporal de cantidad física en un recipiente; no es InventoryStock.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `containerId` | Id | no | FK |
| `productionBatchId` | Id | no | FK |
| `entryAt` | Timestamp | no | entrada efectiva |
| `exitAt` | Timestamp | sí | salida completa |
| `initialQuantity` | Decimal | no | `> 0` |
| `currentQuantity` | Decimal | no | `>= 0` |
| `finalQuantity` | Decimal | sí | al cerrar |
| `unit` | Enum `Unit` existente | no | igual a `Container.capacityUnit` |
| `observations` | String | sí | observación |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |
| `version` | Int | no | concurrencia |

Índices: `(containerId, exitAt)`, `(productionBatchId, exitAt)`,
`(entryAt)`. Regla de integridad: un recipiente no puede tener simultáneamente
dos batches independientes ocupándolo. El solapamiento se valida dentro de la
transacción y, donde esté disponible, con índice parcial sobre ocupaciones
abiertas.

Un batch puede estar en varios recipientes. Un retiro parcial disminuye
`currentQuantity`; solo el vaciado cierra la ocupación. La suma abierta por
recipiente nunca puede exceder `capacity`.

### 4.9 `ProductionWork`

Registro inmutable del trabajo realmente ejecutado.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `productionOrderId` | Id | no | FK obligatoria |
| `transformationOrderId` | Id | sí | FK opcional |
| `workTypeId` | Id | no | FK |
| `performedAt` | Timestamp | no | fecha real |
| `createdAt` | Timestamp | no | fecha de registro |
| `actorUserId` | Id externo | no | contexto autenticado |
| `observations` | String | sí | observación |

Índices: `(productionOrderId, performedAt)`,
`(transformationOrderId, performedAt)`, `(workTypeId)`.

Relaciones opcionales `0:N` con batches y containers mediante tablas de unión;
`0:N` participantes, mediciones y pérdidas. No contiene cantidades,
consumos, outputs, pérdidas ni mediciones. No tiene cancelación ni borrado;
corrección explícita.

### 4.10 `WorkType`

Catálogo configurable propiedad de Production.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | unique, estable |
| `name` | String | no | editable |
| `active` | Boolean | no | baja lógica |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |

Índice `(active)`; unique `code`. No se añaden reglas estructurales al tipo.
Es un catálogo administrativo, no un comando histórico: se crea, se edita
únicamente `name` y se activa/desactiva lógicamente con
`production:work_type_manage`; no se elimina ni se generan datos seed.

### 4.11 Tablas de unión de ProductionWork

`ProductionWorkBatch(workId, batchId)` y
`ProductionWorkContainer(workId, containerId)` tienen PK compuesta por ambos
IDs, FKs internas, unique equivalente e índices inversos. Cardinalidad de cada
lado: `0:N`.

`ProductionWorkParticipant` tiene PK `(workId, participantId)`, FK a trabajo y
participante, `role` opcional como descripción operativa, índice por
`participantId` y no tiene autoridad de actor.

### 4.12 `ProductionParticipant`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | unique, inmutable |
| `name` | String | no | editable |
| `active` | Boolean | no | baja lógica |
| `userId` | Id externo | sí | vínculo opcional a Core User |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |

Índices `(active)`, `(userId)`; unique `code`. Un participante no es actor ni
recibe permisos. No se elimina físicamente.

### 4.13 `Producer`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | unique, inmutable |
| `name` | String | no | editable |
| `active` | Boolean | no | baja lógica |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |

Índice `(active)`; unique `code`. No se elimina físicamente cuando existan
referencias. No se agregan datos de finca, dirección, documento o contacto:
son campos no aprobados. Los adicionales van por custom fields.

### 4.14 `GrapeVariety`

Tiene exactamente el mismo núcleo aprobado que `Producer`:

`id`, `code` único e inmutable, `name`, `active`, `createdAt`, `updatedAt`.

Índice `(active)` y unique `code`. No se inventan atributos agronómicos.

### 4.15 `GrapeReception`

Toda recepción pertenece a una `ProductionOrder`, puede referenciar un productor
y contiene uno o más items.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `productionOrderId` | Id | no | FK |
| `producerId` | Id | sí | referencia opaca opcional |
| `receivedAt` | Timestamp | no | fecha/hora efectiva |
| `status` | `ACCEPTED \| ACCEPTED_WITH_OBSERVATIONS` | no | estados aprobados |
| `observations` | String | sí | observación |
| `actorUserId` | Id externo | no | contexto autenticado |
| `createdAt` | Timestamp | no | registro |
| `updatedAt` | Timestamp | no | actualización técnica |

Índices `(productionOrderId, receivedAt)`, `(producerId)`, `(status)`.
`GrapeReception 1:N GrapeReceptionItem`, mínimo un item.
Una recepción confirmada no se elimina. Una recepción rechazada no se
persiste. Correcciones son explícitas.

### 4.16 `GrapeReceptionItem`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `receptionId` | Id | no | FK |
| `grapeVarietyId` | Id | no | FK |
| `articuloId` | Id externo | no | referencia opaca a Articulos |
| `quantity` | Decimal | no | `> 0` |
| `unit` | Enum `Unit` existente | no | unidad capturada |
| `createdAt` | Timestamp | no | creación |

Índices `(receptionId)`, `(grapeVarietyId)`. La recepción tiene `1:N` items.
La repetición de una variedad se valida por regla de comando; no se crea un
unique adicional hasta que se decida si dos descargas de la misma variedad
pueden formar items distintos dentro de una recepción.

Cada item aceptado genera su propio batch inicial de uva, de forma atómica,
con identidad y unidad capturada.

### 4.17 `Transformation`

Operación atómica del ciclo productivo de una `ProductionOrder`, con una
`TransformationOrder` opcional y un `ProductionWork` opcional como contexto
operativo.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `productionOrderId` | Id | no | FK a `ProductionOrder` |
| `transformationOrderId` | Id | sí | FK opcional; si se informa, debe pertenecer a `productionOrderId` y estar `OPEN` |
| `productionWorkId` | Id | sí | FK opcional a `ProductionWork`; si se informa, debe existir y ser compatible con el contexto productivo según las reglas vigentes |
| `performedAt` | Timestamp | no | fecha real |
| `actorUserId` | Id externo | no | contexto autenticado |
| `observations` | String | sí | observación |
| `operationKey` | String | no | unique, idempotencia |
| `requestHash` | String | no | detección de conflicto |
| `createdAt` | Timestamp | no | registro |

Índices `(productionOrderId, performedAt)`, `(transformationOrderId, performedAt)`,
`(productionWorkId)`, `(operationKey)`;
unique `operationKey`. `Transformation 1:N Input`, `1:N Output`; una
transformación productiva debe tener inputs y outputs coherentes con la
operación antes de quedar completa. No se elimina.

P8 no incluye `transformationTypeId`: es una extensión no aprobada por
DECISION_PRODUCTION.

### 4.18 `TransformationInput`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `transformationId` | Id | no | FK |
| `productionBatchId` | Id | no | FK obligatoria |
| `quantity` | Decimal | no | `> 0` |
| `unit` | String/Unit contractual | no | debe coincidir con el batch |
| `createdAt` | Timestamp | no | registro |

Índices `(transformationId)`, `(productionBatchId)`. Cardinalidad
`Transformation 1:N`; mínimo un input. No acepta `articuloId` sin batch.
Distingue material físico transformado de insumos auxiliares.

### 4.19 `TransformationOutput`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `transformationId` | Id | no | FK |
| `productionBatchId` | Id | no | FK al batch generado/reutilizado |
| `quantity` | Decimal | no | `> 0` |
| `unit` | String/Unit contractual | no | unidad del output |
| `createdAt` | Timestamp | no | registro |

Índices `(transformationId)`, `(productionBatchId)`. Cardinalidad `1:N`.
Cambiar `Articulo` exige nuevo batch; un output reutilizable siempre es batch.
No existe entidad `Subproducto`.

### 4.20 Insumos auxiliares

Un insumo auxiliar no es `TransformationInput`: es un artículo consumido
durante un `ProductionWork` y su existencia pertenece a Inventory. Si P5
persiste la referencia operativa, la línea debe ser:

`ProductionWorkInput(id PK, productionWorkId FK, articuloId externo,
inventoryLotId externo nullable, quantity Decimal, unit contractual,
operationKey unique, createdAt)`.

No reduce `ProductionBatch`; llama a `InventoryApi.registerProductionConsumption`
dentro de la UoW apropiada. Como `ProductionWorkInput` no está en el conjunto de
modelos solicitado por DECISION como entidad canónica independiente, queda como
extensión de integración y no debe confundirse con transformación de producto.

### 4.21 `ProductionLoss`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `productionOrderId` | Id | no | FK/contexto |
| `transformationOrderId` | Id | sí | FK |
| `transformationId` | Id | sí | FK |
| `productionWorkId` | Id | sí | FK |
| `productionBatchId` | Id | sí | FK conocido, nullable |
| `quantity` | Decimal | no | `> 0` |
| `unit` | String/Unit contractual | no | unidad del hecho |
| `occurredAt` | Timestamp | no | fecha efectiva |
| `actorUserId` | Id externo | no | contexto |
| `observations` | String | sí | observación |
| `operationKey` | String | no | unique |
| `requestHash` | String | no | payload |
| `createdAt` | Timestamp | no | registro |

Índices por `productionOrderId`, `transformationOrderId`, `transformationId`,
`productionWorkId`, `productionBatchId`, y `(occurredAt)`. Unique
`operationKey`. Cuando la pérdida pertenece a una `Transformation`, esta
clave se conserva como identificador interno/persistido y no constituye un
replay HTTP independiente.

Debe pertenecer a una `Transformation` o `ProductionWork`. Puede no conocer
el batch exacto. Si lo conoce, inserta `LOSS` en su ledger dentro de la misma
transacción. Nunca calcula automáticamente `input - output`, nunca genera
InventoryMovement por sí sola y no se elimina.

### 4.22 `MeasurementType`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `code` | String | no | unique, estable |
| `name` | String | no | configurable |
| `active` | Boolean | no | baja lógica |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |

Índice `(active)`; unique `code`. Puede configurar Brix, Babo, temperatura,
pH, densidad, grado alcohólico y otras mediciones sin convertirlas en columnas
rígidas.
Es un catálogo administrativo, no un comando histórico: se crea, se edita
`name` y se activa/desactiva lógicamente con
`production:measurement_type_manage`; no se elimina ni se generan datos seed.

### 4.23 `Measurement`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `measurementTypeId` | Id | no | FK |
| `productionBatchId` | Id | sí | FK |
| `containerId` | Id | sí | FK |
| `productionWorkId` | Id | sí | FK |
| `value` | Decimal | no | valor medido |
| `unit` | String | no | unidad configurada |
| `measuredAt` | Timestamp | no | fecha física |
| `createdAt` | Timestamp | no | fecha de registro |
| `actorUserId` | Id externo | no | contexto |
| `participantId` | Id | sí | FK opcional, medidor físico |
| `observations` | String | sí | observación |

Índices por cada contexto y `(measurementTypeId, measuredAt)`. Debe existir
al menos uno de `productionBatchId`, `containerId` o `productionWorkId`; se
permite la combinación válida de varios. No modifica cantidad, estado ni
Articulo. No se elimina; toda corrección conserva valor original.

### 4.24 `CustomFieldDefinition`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `entityType` | Enum | no | `PRODUCER`, `GRAPE_VARIETY`, `GRAPE_RECEPTION` |
| `code` | String | no | estable |
| `label` | String | no | etiqueta |
| `dataType` | Enum | no | `TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE`, `SELECT` |
| `required` | Boolean | no | no invalida históricos |
| `active` | Boolean | no | desactivable |
| `options` | Json | sí | opciones solo para SELECT |
| `displayOrder` | Int | no | orden |
| `createdByUserId` | Id externo | no | actor administrativo |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |

Unique `(entityType, code)`; índices `(entityType, active, displayOrder)`.
No se elimina si hay valores históricos; `code` es estable; no se cambia
`dataType` libremente con valores. Solo `production:custom_fields_manage`.

### 4.25 `CustomFieldValue`

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `definitionId` | Id | no | FK |
| `entityType` | Enum | no | coincide con definición |
| `entityId` | Id | no | ID de entidad propietaria |
| `textValue` | String | sí | solo TEXT |
| `integerValue` | Int | sí | solo INTEGER |
| `decimalValue` | Decimal | sí | solo DECIMAL |
| `booleanValue` | Boolean | sí | solo BOOLEAN |
| `dateValue` | Timestamp | sí | solo DATE |
| `selectValue` | String | sí | opción válida |
| `createdAt` | Timestamp | no | creación |
| `updatedAt` | Timestamp | no | actualización |

Unique `(definitionId, entityId)`; índices `(entityType, entityId)`,
`(definitionId)`. Exactamente una columna de valor debe estar presente y
coincidir con `dataType`. `entityId` es referencia polimórfica validada por
servicio; no se inventa una FK cruzada.

### 4.26 `ProductionCorrection`

Corrección append-only, no edición destructiva.

| Campo | Tipo | Null | Regla |
|---|---|---:|---|
| `id` | Id | no | PK |
| `entityType` | Enum contractual | no | tipo corregido |
| `entityId` | Id | no | registro original |
| `reason` | String | no | obligatorio |
| `beforeValue` | Json | no | snapshot anterior |
| `correctedValue` | Json | no | snapshot corregido |
| `actorUserId` | Id externo | no | contexto |
| `createdAt` | Timestamp | no | fecha |

Índices `(entityType, entityId, createdAt)`, `(actorUserId, createdAt)`.
No se elimina. En correcciones cuantitativas, `correctedValue` no se aplica
como overwrite: se genera el hecho compensatorio tipado que corresponda en el
ledger o entidad operativa, en la misma transacción.

La estructura es técnicamente polimórfica porque el contrato exige conservar
registro original, actor, fecha, motivo, valor anterior y corregido. Si se
requiere FK SQL estricto por entidad, debe aprobarse una descomposición por
tipo antes de implementar.

## 5. Unidades y capacidad

Container usa exclusivamente el enum `Unit` ya existente en el modelo/API
vigente. No se define un enum paralelo ni un catálogo de conversiones.

Para ocupar o mover un recipiente:

1. se obtiene el `capacityUnit` del Container;
2. se compara igualdad exacta con `unit` del movimiento/ocupación;
3. si no son iguales, se rechaza;
4. se valida capacidad con el mismo valor decimal;
5. se actualizan ocupaciones y auditoría atómicamente.

La conversión kg↔quintal, kg↔L, L↔botellas o cualquier otra requiere una
operación de negocio explícita aún no aprobada y por eso no pertenece a P4.

## 6. Matriz conservadora `Articulo.clasificacion` → operación

Production nunca modifica `clasificacion`, `unidadMedida` ni `activo`. La
clasificación la devuelve `ArticulosApi`. La matriz solo puede usar valores
del enum existente de Articulos; no se agregan strings ni valores locales.

Mientras el enum exacto no esté publicado en el contrato de Articulos, la
matriz conservadora aplicable es:

| Uso de Production | Clasificación aprobada |
|---|---|
| Crear batch inicial de recepción | Solo un Articulo activo cuya clasificación vigente de Articulos haya sido aprobada explícitamente para materia prima; de lo contrario, rechazar |
| Input de transformación | Solo batch existente y trazable; no se valida por `articuloId` directo |
| Output de transformación | Articulo activo cuya clasificación vigente de Articulos haya sido aprobada explícitamente para producto en proceso |
| Producto enviado a Inventory | Articulo activo validado por Articulos e Inventory; clasificación inicial exclusivamente `PRODUCTO_ENVASADO` y las transiciones posteriores las decide Inventory |
| Insumo auxiliar de trabajo | Articulo activo aprobado para insumo/material por Articulos; se consume por Inventory, no como input de transformación |
| Container, Producer, GrapeVariety | No son Articulos |

No se permite operar con una clasificación desconocida, inactiva o no
autorizada por la matriz. `INVALID_ARTICULO_CLASSIFICATION` es el error
resultante. La publicación de los valores enum y de la matriz concreta es una
decisión bloqueante antes de implementar validaciones específicas.

## 7. Concurrencia, atomicidad y fuente de verdad

Toda operación crítica utiliza `SharedUnitOfWork` y contiene cambio de dominio,
ledger, ocupación/saldo materializado si corresponde y auditoría. Si auditoría
falla, se revierte todo.

Se bloquean bajo transacción los batches, ocupaciones y containers afectados.
`version` permite detectar escrituras concurrentes; un conflicto no se
resuelve reintentando con un UUID nuevo. El servicio vuelve a leer, valida y
devuelve conflicto de dominio.

La disponibilidad se deriva del ledger y debe satisfacer siempre
`available >= 0`. El balance materializado puede acelerar queries, pero se
reconstruye desde el ledger y nunca se acepta como input del cliente.

La ocupación se valida por suma de cantidades abiertas; la capacidad nunca se
excede. Un recipiente no tiene dos batches independientes simultáneos.

## 8. Idempotencia

Requieren idempotencia recepción, transformación, consumos, outputs, movimientos
entre recipientes y salida Production→Inventory. Las pérdidas registradas
dentro de una transformación no tienen un replay HTTP independiente.

Cada comando idempotente guarda `operationKey` unique y `requestHash`. Repetir
la misma clave con el mismo hash devuelve el resultado persistido; repetirla
con payload distinto produce `IDEMPOTENCY_CONFLICT`. En `Transformation`, la
clave identifica la transformación completa, incluidas sus pérdidas; no se
reintenta una pérdida mediante API separada. Las claves estables incluyen:

```text
production-reception:{receptionId}
production-transformation:{transformationId}
```

Nunca se genera un UUID distinto al reintentar.

## 9. Auditoría y lifecycle

Se auditan creación/cierre de órdenes, recepciones, trabajos,
transformaciones, consumos, outputs, pérdidas, mediciones y correcciones,
movimientos de recipientes y administración de catálogos/custom fields.

Cada evento registra actor, acción, recurso, fecha y metadata relevante. El
actor siempre procede del contexto autenticado. `ProductionParticipant` solo
describe participación física.

No hay borrado físico de órdenes, batches, transformaciones, pérdidas,
mediciones, recepciones, correcciones ni relaciones históricas. Catálogos
usan `active`/desactivación.

## 10. API HTTP y queries conceptuales

Base: `/api/v1/production`. Commands y queries permanecen separados; no se
expone CRUD genérico para históricos.

Endpoints de commands aprobados:

```text
POST /api/v1/production/orders
POST /api/v1/production/orders/:id/close
POST /api/v1/production/transformation-orders
POST /api/v1/production/transformation-orders/:id/close
POST /api/v1/production/works
POST /api/v1/production/works/:id/corrections
POST /api/v1/production/grape-receptions
POST /api/v1/production/grape-receptions/:id/corrections
POST /api/v1/production/transformations
POST /api/v1/production/measurements
POST /api/v1/production/measurements/:id/corrections
```

Query explícita de trazabilidad:

```text
GET /api/v1/production/batches/:batchId/trace
```

La respuesta tipada reconstruye origen, padres, hijos, transformaciones,
trabajos, pérdidas y `InventoryLot` resultante. Las demás queries son
listados/lecturas paginados de órdenes, batches, trabajos, transformaciones,
recepciones, containers y mediciones con filtros consistentes.

API intermodular mínima:

```ts
getProductionBatch(id: string): Promise<ProductionBatchDto>
getAvailableBatchQuantity(id: string): Promise<AvailableBatchQuantityDto>
validateProductionBatch(id: string): Promise<ProductionBatchValidationDto>
traceProductionBatch(id: string): Promise<ProductionBatchTraceDto>
```

No se exponen modelos Prisma.

## 11. Permisos aprobados

La lista completa y cerrada de permisos aprobados es:

```text
production:read
production:order_create
production:order_close
production:transformation_order_create
production:transformation_order_close
production:work_create
production:work_correct
production:reception_create
production:reception_correct
production:transformation_create
production:loss_create
production:measurement_create
production:measurement_correct
production:container_manage
production:producer_manage
production:grape_variety_manage
production:participant_manage
production:work_type_manage
production:measurement_type_manage
production:custom_fields_manage
```

No se inventan permisos para batch, output, input, ledger o corrección
genérica. La administración de custom fields exige
`production:custom_fields_manage`; catálogos exigen su permiso específico.
WorkType y MeasurementType usan los permisos específicos anteriores para CRUD
administrativo; no son comandos históricos ni tienen seed.

## 12. Errores de dominio

Production debe traducir fallos de persistencia/dependencias a códigos
estables, nunca exponer Prisma, PostgreSQL o Firebase:

```text
PRODUCTION_ORDER_NOT_FOUND
PRODUCTION_ORDER_CLOSED
TRANSFORMATION_ORDER_CLOSED
BATCH_NOT_FOUND
INSUFFICIENT_BATCH_QUANTITY
CONTAINER_NOT_AVAILABLE
CONTAINER_CAPACITY_EXCEEDED
CONTAINER_ALREADY_OCCUPIED
INVALID_BATCH_TRANSFORMATION
INVALID_ARTICULO_CLASSIFICATION
MEASUREMENT_TYPE_INVALID
IDEMPOTENCY_CONFLICT
```

La envoltura HTTP usa el contrato común (`code`, `message`, `requestId` y
detalles seguros).

## 13. Cambio mínimo requerido en Inventory

No se modifica directamente Inventory ni se replica ninguna de sus tablas.
Para cumplir el contrato Production→Inventory, Inventory debe exponer una
operación pública tipada, ejecutable dentro del `SharedUnitOfWork`, equivalente
a `registerProductionOutput`, cuyo resultado incluya al menos:

```ts
type ProductionOutputResult = {
  inventoryLotId: string;
  originProductionBatchId: string;
  quantity: DecimalString;
  unit: string;
  movementId: string;
};
```

La operación debe aceptar `productionOrderId`, `productionBatchId`, cantidad,
unidad y referencia opcional de `ProductionWork`; debe crear o reutilizar el
`InventoryLot`, conservar `originProductionBatchId`, registrar movement y
actualizar stock en Inventory. Production, por su lado, registra el hecho
`TRANSFERRED_TO_INVENTORY` en su ledger. Todas las escrituras y ambas
auditorías deben confirmar o revertir juntas.

El cambio es únicamente contractual/tipado: Production no crea
`InventoryLot`, `InventoryMovement` ni `InventoryStock`, y no se define aquí
ningún endpoint nuevo de Inventory.

## 14. Bloqueantes pendientes

1. Publicar los valores reales de los enums de `Articulo.clasificacion` y la
   matriz concreta clasificación→operación.
2. Confirmar la forma exacta del enum `Unit` existente y reutilizable por
   Container, recepción y cantidades.
3. Resolver la tensión entre `GrapeReception.productionOrderId` de
   `DECISION_PRODUCTION` y contratos antiguos que mencionan `Harvest`.
4. Definir el enum contractual del tipo de entrada del ledger si sus valores no
   están ya registrados en el contrato vigente.
5. Aprobar la estrategia de correcciones polimórficas o tablas de corrección
   tipadas con FK estricta.
6. Definir si `ProductionWorkInput` pasa de extensión de integración a entidad
   canónica persistida.
7. Confirmar el resultado y contexto transaccional final de
   `registerProductionOutput` en Inventory.
8. Resolver la regla de repetición de una misma variedad dentro de una
   recepción.
9. Definir explícitamente la semántica operativa de `SEPARATED` cuando se
   implemente división parcial.

Ningún bloqueante se resuelve por inferencia durante la implementación.

P5.5A: `ProductionWorkInput` stores the Inventory movement provenance and
nullable legacy rows remain non-reversible. Production calls trusted Inventory
primitives inside the shared unit of work; Inventory owns stock mutation,
negative-stock authorization and movement audit.

## 15. P5.5B — diseño vigente

La extensión de recipientes es aditiva: `type` es nullable para filas legacy,
sin backfill ni tipos supuestos; `name`, `location` y `material` también son
nullable. Las nuevas altas API exigen `TANQUE|BARRICA|OTRO`. El listado expone
`currentOccupancy` como resumen nullable. El Movement DTO contiene
`productionWorkId`, `observations`, `actorUserId` y `occurredAt`, pero no
`requestHash`.

Se conservan las rutas administrativas y de lectura, y se publican assign,
transfer total y transfer partial con permisos dedicados
`production:container_assign` y `production:container_transfer`; el maestro
usa `production:container_manage`. Los cuerpos exactos están en
`PRODUCTION_API.md`. El hash canónico es SHA-256 de JSON con claves ordenadas,
opcionales normalizados a `null`, excluyendo `operationKey`/`requestHash`.
Work es opcional pero debe pertenecer a la ProductionOrder del batch.
`SharedUnitOfWork` cubre movimiento, ocupación, estados, idempotencia y
auditoría; Failure C revierte todo, incluido split/lineage/ledger.

Los movimientos históricos son inmutables. Total puede compensarse con un
traslado inverso nuevo si el estado actual sigue compatible; no se inventa
un unassign destructivo. La reversión parcial no es automática en el MVP: no
hay merge-back ni reversión destructiva; la corrección requiere una nueva
operación productiva válida. El traslado interno no crea InventoryMovement.

## 16. Cierre P5.5A–D y criterios de validación

P5.5A–D están reflejados en el diseño vigente: `ProductionWorkInput` usa
primitives confiables de Inventory dentro de `SharedUnitOfWork`, con consumo,
reversal compensatorio, idempotencia y política de stock negativo propiedad de
Inventory. Containers conservan metadata, ocupaciones y movimientos
`ASSIGNED`, `TRANSFERRED` y `PARTIAL_TRANSFERRED`; el traslado parcial crea
batch hijo y lineage.

P5.5C expone trace backward/forward con límites, warnings y enlaces de release.
P5.5D usa las rutas públicas de release y reversal, permisos dedicados,
clasificación inicial fija `PRODUCTO_ENVASADO`, hash canónico server-side,
reversión completa, rechazo de estado inseguro e historia append-only.

Las comprobaciones ejecutables y contractuales quedan **PASS**:
P5.5A PostgreSQL **5/5**, P5.5B **6/6**, P5.5D **21/21**, P5.5E **1/1**,
P10 Trace **10/10**, Production backend **236/236** con **0 skipped**, Vitest
frontend **20/20**, typecheck/build backend y frontend **PASS**, Prisma
validate/generate **PASS**, 33 migraciones aplicadas/status actualizado,
`No difference detected` entre datasource configurado y schema, y
`git diff --check` **PASS**.

Las migraciones nuevas son `20260927000000_production_p55e_align_prisma_object_names`
(alineación de metadata) y
`20260927010000_production_p55e_eliminate_schema_drift` (eliminación de drift
de `onUpdate` de FK y nombres de índices); no se editó ninguna migración
existente.

La aceptación operativa E2E A–F es **PASS**: **A**, BARRICA dinámica sin
cambios de código; **B**, WorkType dinámico; **C**, WorkInput estructurado y
consumo mediante InventoryMovement; **D**, movimiento físico estructurado de
recipientes; **E**, separación GrapeVariety/producto; **F**, observaciones sólo
narrativas y hechos estructurados en sus campos/entidades correspondientes.
Login shell
frontend **PASS** en desktop 1440x1000 y mobile 390x844, con consola limpia.
El smoke autenticado PASS cubrió las páginas y estados
Production, Orders, Reception, Batches, Works, Measurements, Transformations,
Containers, Batch Trace, Release y Reversal, además de permisos,
loading/empty, errores `requestId`, confirmaciones y double-submit. Se
corrigieron cuatro defectos demostrados: crashes FormControl/FormItem de
Reception y Transformation, balance embebido ausente en batches y pageSize 500
de trace sobre max 100. Cinco variables runtime estuvieron presentes; target
`runner@127.0.0.1/winter_p55_test`, DB remota NO; las mismas 33 migraciones
existentes se reaplicaron tras reinicio sin generar migración, status al día,
drift `No difference detected`, health 200, identidades/datos temporales
limpiados y sin credenciales persistidas/reportadas. Las pruebas frontend
focalizadas cubren trace/release/reversal,
permisos, errores, historial vacío, pending/double-submit e idempotencia;
La aceptación frontend autenticada requerida queda PASS por este smoke. El
cierre global P5.5E es
**PASS / CLOSED**: **BLOCK 5 — PRODUCTION: CLOSED**. La revisión final de
arquitectura permanece pendiente hasta la revisión final.
Fotografías/evidencia quedan
`Deferred to UAT / Hardening`.

La validación destructiva usa exclusivamente `LOCAL INTEGRATION TEST`,
`127.0.0.1`, `winter_p55_test`, PostgreSQL local, sin acceso productivo/remoto y
sin credenciales documentadas. `DATABASE_URL`/heliumdb no están autorizados.
La limitación del workflow Winter Backend por ausencia de
`WINTER_DATABASE_URL`/Firebase no invalida typecheck, build, Prisma validation o
tests de integración.

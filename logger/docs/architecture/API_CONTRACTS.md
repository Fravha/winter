# API_CONTRACTS.md

## 1. Propósito

Este documento define los contratos públicos de comunicación entre los
módulos de Winter para el MVP de Bodega Cruce del Zorro. Winter se construye
sobre la base técnica Logger y reutiliza sus convenciones de seguridad,
auditoría, errores y composición modular.

Su objetivo es que cada módulo pueda evolucionar internamente sin
obligar a otros módulos a conocer:

-   repositories;
-   Prisma models;
-   tablas;
-   services internos;
-   detalles de implementación.

Los consumidores utilizan únicamente las **Public APIs** definidas aquí.

Este documento complementa:

``` text
ARCHITECTURE.md
AI_IMPLEMENTATION_RULES.md
MODULE_CONTRACT.md
DOMAIN_MODEL.md
AGGREGATES_AND_ENTITIES.md
MODULE_MAP.md
WORKFLOWS.md
```

------------------------------------------------------------------------

# 2. Regla fundamental

Una API pública representa una **capacidad de negocio**, no una tabla.

Incorrecto:

``` text
Production → InventoryStockRepository
```

Correcto:

``` text
Production → Inventory API → registrarConsumo(...)
```

La implementación interna de Inventory puede cambiar sin modificar
Production mientras el contrato público permanezca compatible.

------------------------------------------------------------------------

# 3. Módulos que exponen API pública

``` text
Core / Access Management
Articulos
Compras
Production
Inventory
```

Cada módulo debe exponer un único punto público de integración.

Ejemplo conceptual:

``` text
production.api.ts
inventory.api.ts
articulos.api.ts
compras.api.ts
```

El nombre exacto seguirá la convención ya establecida por Logger.

------------------------------------------------------------------------

# 4. Reglas de contratos

## 4.1 Los DTOs son contratos

Los módulos no deben exponer:

-   Prisma entities;
-   Prisma input types;
-   modelos ORM;
-   objetos internos de persistence.

Debe existir un DTO explícito.

## 4.2 Los identificadores son opacos

Un módulo consumidor no debe asumir cómo está generado el ID de otro
módulo.

Solo debe conservarlo como referencia.

## 4.3 Las cantidades no deben perder precisión

Para cantidades donde el dominio requiere precisión decimal, el contrato
debe utilizar la convención de Logger para valores decimales.

En particular:

``` text
volúmenes
pesos
grados
cantidades de insumos
```

No deben convertirse silenciosamente a `number` si la arquitectura ya
establece representación decimal segura.

## 4.4 Actor autenticado

En operaciones iniciadas por HTTP, el actor debe obtenerse del contexto
autenticado de Logger/Core y representarse mediante `User.id`. Los campos
`performedByUserId`, `responsibleUserId` o `userId` de contratos internos no
deben permitir que el frontend suplante al actor autenticado.

Los participantes físicos de un trabajo se representan como lista de
`ProductionParticipant`; no requieren ser usuarios del sistema y nunca
reemplazan al actor autenticado.

## 4.5 Errores

Los errores deben utilizar el contrato común de Logger:

``` text
code
message
details
```

El código debe permitir que el consumidor distinga entre:

``` text
VALIDATION_ERROR
NOT_FOUND
CONFLICT
FORBIDDEN
UNAVAILABLE
BUSINESS_RULE_VIOLATION
```

y equivalentes ya definidos por Logger.

------------------------------------------------------------------------

# 5. Articulos API

## Responsabilidad pública

Articulos responde:

> ¿Qué artículo es este?

No administra:

-   stock;
-   compras;
-   producción;
-   almacenes;
-   tanques.

## Operaciones públicas mínimas

### `getArticulo`

Obtiene información de un artículo.

Entrada:

``` ts
{
  articuloId: string
}
```

Salida conceptual:

``` ts
{
  id: string
  codigo: string
  nombre: string
  clasificacion: string
  unidad: string
  activo: boolean
}
```

------------------------------------------------------------------------

### `listArticulos`

Consulta artículos para selección en:

-   Production;
-   Compras;
-   Inventory.

Filtros iniciales:

``` ts
{
  search?: string
  clasificacion?: string
  activo?: boolean
}
```

Debe soportar paginación según las convenciones de Logger.

------------------------------------------------------------------------

### `validateArticulo`

Valida que un artículo:

-   exista;
-   esté activo;
-   pueda ser utilizado según su clasificación cuando el caso de negocio
    lo requiera.

Entrada:

``` ts
{
  articuloId: string
}
```

Salida conceptual:

``` ts
{
  valid: boolean
  articulo?: ArticuloSummary
}
```

------------------------------------------------------------------------

## Regla de integración

Los demás módulos pueden leer artículos.

Solo Articulos puede crear/modificar el maestro.

------------------------------------------------------------------------

# 6. Compras API

## Responsabilidad pública

Compras responde:

> ¿Qué adquirimos y cuál es el estado administrativo de esa adquisición?

Compras no responde:

> ¿Cuánto stock existe?

Eso corresponde a Inventory.

------------------------------------------------------------------------

## `createPurchase`

Crea una compra.

Entrada conceptual:

``` ts
{
  supplierId: string
  date: string
  document?: PurchaseDocumentDTO
  lines: [
    {
      articuloId: string
      quantity: DecimalString
      unit: string
      unitPrice?: DecimalString
    }
  ]
  observations?: string
}
```

La referencia `articuloId` debe validarse mediante la API pública de
Articulos.

------------------------------------------------------------------------

## `getPurchase`

Obtiene una compra.

Entrada:

``` ts
{
  purchaseId: string
}
```

------------------------------------------------------------------------

## `listPurchases`

Consulta compras con filtros de negocio.

Filtros posibles:

``` ts
{
  status?: string
  supplierId?: string
  from?: string
  to?: string
}
```

------------------------------------------------------------------------

## `receivePurchase`

Representa la recepción de los artículos adquiridos.

No significa solamente "editar la compra".

Puede producir una operación hacia Inventory.

Flujo:

``` text
receivePurchase
      ↓
validar compra
      ↓
confirmar cantidades recibidas
      ↓
Inventory API
      ↓
crear entrada física
```

La respuesta debe comunicar el resultado de la operación y las
referencias de Inventory creadas.

------------------------------------------------------------------------

## Contrato intermodular

Compras nunca debe llamar:

``` text
InventoryRepository
InventoryStockService
Prisma
```

Debe llamar únicamente:

``` text
InventoryPublicApi
```

------------------------------------------------------------------------

# 7. Inventory API

## Responsabilidad pública

Inventory responde:

> ¿Qué existencia física hay y qué movimiento de stock ocurrió?

Inventory administra:

``` text
Warehouse
InventoryLot
InventoryStock
InventoryMovement
```

------------------------------------------------------------------------

# 8. Inventory API --- Consultas

## `getWarehouse`

Entrada:

``` ts
{
  warehouseId: string
}
```

Salida:

``` ts
{
  id: string
  code: string
  name: string
  type: string
  managerUserId?: string
  active: boolean
}
```

------------------------------------------------------------------------

## `listWarehouses`

Permite obtener almacenes disponibles.

Filtros:

``` ts
{
  active?: boolean
  type?: string
}
```

------------------------------------------------------------------------

## `getInventoryLot`

Entrada:

``` ts
{
  inventoryLotId: string
}
```

Salida conceptual:

``` ts
{
  id: string
  articuloId: string
  lotCode: string
  warehouseId: string
  quantity: DecimalString
  unit: string
  status: string
}
```

------------------------------------------------------------------------

## `getStock`

Consulta existencias.

``` ts
{
  articuloId?: string
  warehouseId?: string
  inventoryLotId?: string
}
```

------------------------------------------------------------------------

## `getAvailableQuantity`

Consulta cantidad disponible de un artículo.

Entrada:

``` ts
{
  articuloId: string
  warehouseId?: string
}
```

Salida:

``` ts
{
  articuloId: string
  availableQuantity: DecimalString
  unit: string
}
```

------------------------------------------------------------------------

# 9. Inventory API --- Commands

## `registerInbound`

Registra una entrada física.

Consumidores:

``` text
Compras
Production
otros módulos autorizados en el futuro
```

Entrada conceptual:

``` ts
{
  articuloId: string
  warehouseId: string
  quantity: DecimalString
  unit: string
  lotCode?: string
  source: {
    type: string
    referenceId: string
  }
  observations?: string
}
```

`source` permite conservar la causa de la entrada.

Ejemplo:

``` text
PURCHASE
referenceId = PUR-001
```

o:

``` text
PRODUCTION
referenceId = ProductionBatch / Work / Order según el caso
```

------------------------------------------------------------------------

## `registerOutbound`

Registra una salida física.

Entrada:

``` ts
{
  articuloId: string
  warehouseId: string
  inventoryLotId?: string
  quantity: DecimalString
  unit: string
  reason: string
  source: {
    type: string
    referenceId: string
  }
  observations?: string
}
```

Debe validar existencia disponible y las reglas de lotes de Inventory.

------------------------------------------------------------------------

## `registerTransfer`

Mueve una existencia entre almacenes.

Entrada:

``` ts
{
  articuloId: string
  sourceWarehouseId: string
  destinationWarehouseId: string
  inventoryLotId?: string
  quantity: DecimalString
  observations?: string
}
```

No debe modificar stock directamente desde el consumidor.

------------------------------------------------------------------------

## `registerAdjustment`

Registra un ajuste.

Entrada:

``` ts
{
  articuloId: string
  warehouseId: string
  inventoryLotId?: string
  quantity: DecimalString
  direction: "INCREASE" | "DECREASE"
  reason: string
  observations: string
}
```

Debe ser una operación auditada.

------------------------------------------------------------------------

## `registerProductionConsumption`

Comando específico para consumo por producción.

Entrada conceptual:

``` ts
{
  articuloId: string
  warehouseId: string
  inventoryLotId?: string
  quantity: DecimalString
  productionReference: {
    productionOrderId?: string
    transformationOrderId?: string
    productionWorkId: string
  }
  observations?: string
}
```

Este contrato permite saber:

> ¿Qué artículo se consumió, de qué lote y en qué trabajo de producción?

------------------------------------------------------------------------

## `registerProductionOutput`

Registra el ingreso de producto generado por Production.

Entrada:

``` ts
{
  articuloId: string
  warehouseId: string
  quantity: DecimalString
  unit: string
  inventoryLotCode?: string
  productionReference: {
    productionOrderId: string
    productionBatchId: string
    productionWorkId?: string
  }
  observations?: string
}
```

El resultado genera o actualiza una existencia administrada por
Inventory. Debe conservar `originProductionBatchId`. La reducción del batch,
el output, el `InventoryLot`, el `InventoryMovement`, el stock y ambas
auditorías forman una única operación atómica y tipada; cualquier fallo
revierte todo. Cuando proviene del embotellado, su clasificación inicial es
`PRODUCTO_ENVASADO`.

------------------------------------------------------------------------

## `transitionInventoryLotClassification`

Cambia la clasificación operativa de un lote sin editarlo directamente ni
crear una nueva entrada física.

Entrada conceptual:

``` ts
{
  inventoryLotId: string
  targetClassification: string
  reason?: string
  observations?: string
}
```

Reglas:

- valida que el lote exista;
- valida su clasificación actual;
- valida que la transición solicitada esté permitida por Inventory;
- conserva identidad y trazabilidad del mismo lote;
- no genera un segundo ingreso físico por el cambio de clasificación;
- genera auditoría;
- inicialmente soporta la transición funcional
  `PRODUCTO_ENVASADO -> PRODUCTO_TERMINADO`;
- el mismo command se reutiliza para las clasificaciones de exportación
  definidas por el dominio.

------------------------------------------------------------------------

# 10. Regla crítica Inventory ↔ Production

Production **no crea InventoryLot manualmente**.

Production solicita:

``` text
registerProductionOutput(...)
```

Inventory determina internamente:

-   cómo crear el lote;
-   cómo actualizar stock;
-   cómo registrar el movimiento;
-   cómo mantener sus invariantes.

------------------------------------------------------------------------

# 11. Production API

Production es el módulo con mayor superficie de negocio.

Su API pública debe dividirse en:

``` text
Harvest
Reception
Production
Transformation
Work
Measurement
Decision
Container
Process movement
Loss
```

No debe convertirse en una única función gigantesca.

------------------------------------------------------------------------

# 12. Production API --- Vendimia

## `createHarvest`

Entrada:

``` ts
{
  year: number
  name: string
  startDate?: string
  endDate?: string
  observations?: string
}
```

Salida:

``` ts
{
  harvestId: string
}
```

------------------------------------------------------------------------

## `getHarvest`

Obtiene una vendimia.

------------------------------------------------------------------------

## `listHarvests`

Permite consultar campañas.

------------------------------------------------------------------------

## `updateHarvestPlan`

Actualiza información de planificación sin modificar recepciones físicas
ya registradas.

La planificación no crea stock.

------------------------------------------------------------------------

# 13. Production API --- Recepción de uva

`Producer`, `GrapeVariety`, `WorkType` y `MeasurementType` son catálogos
propiedad de Production. WorkType y MeasurementType admiten CRUD administrativo
sin DELETE: GET/list con `production:read`, y POST/PATCH/activate/deactivate
con `production:work_type_manage` o `production:measurement_type_manage`,
respectivamente. Son catálogos, no comandos históricos, y no tienen seed.
`GrapeReception` debe referenciarlos por ID. Una recepción puede contener una o
varias variedades con sus cantidades; no se aceptan como texto libre ni como
Articulo. Los campos exactos y los contracts de administración de estos
catálogos deben quedar definidos en Production antes de implementar esta
sección; la IA no debe inventarlos.

## `createGrapeReception`

Entrada conceptual:

``` ts
{
  harvestId: string
  producerId: string
  varieties: [
    {
      grapeVarietyId: string
      quantity: DecimalString
      unit: string
    }
  ]
  dateTime: string

  requestedWeight: DecimalString
  receivedWeight: DecimalString

  brix?: DecimalString
  alcoholDegree?: DecimalString
  quality?: string

  status: "ACCEPTED" | "ACCEPTED_WITH_OBSERVATIONS"

  observations?: string
}
```

No se acepta un estado `REJECTED`.

Los campos adicionales de `Producer`, `GrapeVariety` y `GrapeReception` se
gestionan como `CUSTOM_FIELDS`, separados de los `CORE_FIELDS` contractuales.
Inicialmente admiten `TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE` y
`SELECT`. Sus definiciones tienen código estable, pueden desactivarse sin
perder valores históricos, no se eliminan físicamente cuando tienen valores y
todo cambio administrativo se audita. Un campo configurable no sustituye
invariantes, relaciones ni reglas estructurales del dominio.

------------------------------------------------------------------------

## `getGrapeReception`

Obtiene una recepción.

------------------------------------------------------------------------

## `listGrapeReceptions`

Filtros:

``` ts
{
  harvestId?: string
  producerId?: string
  grapeVarietyId?: string
  from?: string
  to?: string
  status?: string
}
```

------------------------------------------------------------------------

## `createGrapeLot`

Crea los lotes derivados de una recepción.

Entrada conceptual:

``` ts
{
  receptionId: string
  lots: [
    {
      grapeVarietyId?: string
      quality?: string
      weight: DecimalString
      observations?: string
    }
  ]
}
```

La operación debe validar que la suma de los lotes sea coherente con las
cantidades disponibles de la recepción según las reglas del negocio.

------------------------------------------------------------------------

# 14. Production API --- OP Maestra

## `createProductionOrder`

Entrada:

``` ts
{
  harvestId?: string
  productionProcessId: string
  productionLineId?: string
  targetArticuloId?: string
  startDate: string
  observations?: string
}
```

El `targetArticuloId` puede representar un objetivo inicial, pero no
obliga al resultado final si la realidad productiva cambia mediante una
decisión válida.

------------------------------------------------------------------------

## `getProductionOrder`

Obtiene la OP Maestra y su resumen de situación actual.

------------------------------------------------------------------------

## `listProductionOrders`

Filtros:

``` ts
{
  harvestId?: string
  productionProcessId?: string
  productionLineId?: string
  status?: string
}
```

------------------------------------------------------------------------

# 15. Production API --- OP de Transformación

## `createTransformationOrder`

Entrada:

``` ts
{
  productionOrderId: string
  transformationTypeId: string
  periodStart: string
  periodEnd?: string
  observations?: string
}
```

------------------------------------------------------------------------

## `getTransformationOrder`

Obtiene una OP de transformación con:

``` text
estado
inputs
outputs
trabajos
mermas
transformaciones
```

------------------------------------------------------------------------

## `closeTransformationOrder`

Cierra el período cuando el resultado correspondiente ha sido
registrado.

Debe validar los invariantes necesarios antes del cierre.

Las órdenes utilizan únicamente los estados `OPEN` y `CLOSED`. `CLOSED` es
irreversible: no existe reapertura. No puede cerrarse con trabajos,
transformaciones u operaciones productivas incompletas.

------------------------------------------------------------------------

# 16. Production API --- ProductionBatch

## `createProductionBatch`

Entrada:

``` ts
{
  productionOrderId: string
  articuloId: string
  quantity: DecimalString
  unit: string
  sourceReference: {
    type: string
    id: string
  }
  observations?: string
}
```

Este comando representa la creación de una cantidad concreta de un
artículo dentro de una producción.

------------------------------------------------------------------------

## `getProductionBatch`

Obtiene:

``` text
artículo
cantidad actual
producción
recipientes
estado
historial relevante
```

------------------------------------------------------------------------

## `listProductionBatches`

Filtros:

``` ts
{
  productionOrderId?: string
  articuloId?: string
  status?: string
  containerId?: string
}
```

------------------------------------------------------------------------

# 17. Production API --- Trabajos

## `createProductionWork`

Entrada:

``` ts
{
  productionOrderId: string
  transformationOrderId?: string
  workTypeId: string
  productionBatchIds?: string[]
  containerIds?: string[]
  dateTime: string
  participants?: string[]
  observations?: string
}
```

Un trabajo existe solamente porque fue realizado.

Puede asociarse directamente con uno o varios `ProductionBatch` y/o
`Container`. Ambas asociaciones son opcionales según el tipo de trabajo. Las
cantidades, movimientos, mediciones y mermas permanecen en sus contratos
específicos.

El actor de auditoría se obtiene del contexto autenticado; `participants` es
una lista operativa y no una lista de usuarios/RBAC.

No se contempla `cancelProductionWork` como operación normal del MVP.

------------------------------------------------------------------------

## `addWorkInput`

Entrada:

``` ts
{
  workId: string
  articuloId: string
  inventoryLotId?: string
  quantity: DecimalString
  unit: string
}
```

La operación debe coordinarse con Inventory para el consumo físico.

------------------------------------------------------------------------

## `getProductionWork`

Obtiene el trabajo junto con sus insumos y referencias productivas.

------------------------------------------------------------------------

## `listProductionWorks`

Filtros:

``` ts
{
  productionOrderId?: string
  transformationOrderId?: string
  workTypeId?: string
  from?: string
  to?: string
}
```

------------------------------------------------------------------------

# 18. Production API --- Mediciones

## `recordMeasurement`

Entrada:

``` ts
{
  productionBatchId?: string
  containerId?: string
  workId?: string

  measurementTypeId: string
  value: DecimalString
  unit: string

  dateTime: string
  observations?: string
}
```

Debe existir al menos un contexto válido de medición.

------------------------------------------------------------------------

## `getMeasurements`

Filtros:

``` ts
{
  productionBatchId?: string
  containerId?: string
  workId?: string
  measurementTypeId?: string
  from?: string
  to?: string
}
```

------------------------------------------------------------------------

# 19. Production API --- Decisiones

## `recordProductionDecision`

Entrada:

``` ts
{
  productionOrderId: string
  productionBatchId?: string
  decisionType: string
  dateTime: string
  observations: string
}
```

Ejemplos:

``` text
CAMBIO_RUTA
CAMBIO_PRODUCTO_OBJETIVO
ENVIAR_A_CRIANZA
ENVIAR_A_JOVEN
REALIZAR_CORTE
AGREGAR
QUITAR
AGREGAR_INSUMO
CAMBIAR_RECIPIENTE
DETENER_PROCESO
CONTINUAR_PROCESO
```

Registrar una decisión no significa ejecutar automáticamente el efecto
físico.

Las operaciones físicas posteriores deben quedar registradas por los
workflows correspondientes.

------------------------------------------------------------------------

# 20. Production API --- Recipientes

## `createContainer`

Entrada:

``` ts
{
  code: string
  name?: string
  type: string
  capacity: DecimalString
  unit: string
  material: string
  location: string
  owner: string

  toastType?: string
  acquisitionDate?: string
  observations?: string
}
```

------------------------------------------------------------------------

## `updateContainer`

Permite modificar datos maestros que no rompan el historial de
ocupación.

Cambios sensibles deben auditarse.

------------------------------------------------------------------------

## `getContainer`

------------------------------------------------------------------------

## `listContainers`

Filtros:

``` ts
{
  type?: string
  status?: string
  location?: string
}
```

------------------------------------------------------------------------

# 21. Production API --- Ocupación

La API pública actual permite consultar las ocupaciones de un recipiente, pero
no expone comandos HTTP para ocuparlo, retirar contenido ni cerrar una
ocupación. Esas capacidades permanecen como primitivas internas del dominio
hasta que exista un contrato público específico.

------------------------------------------------------------------------

# 22. Production API --- Movimientos de proceso

La API pública actual permite consultar los movimientos asociados a un
recipiente, pero no expone un comando HTTP para mover producto entre
recipientes. La operación interna debe seguir validando cantidad, capacidad y
consistencia, pero no puede ser invocada directamente por clientes.

------------------------------------------------------------------------

# 23. Production API --- Transformaciones

## `createTransformation`

Entrada:

``` ts
{
  productionOrderId: string
  transformationOrderId?: string
  performedAt: string
  observations?: string
  operationKey: string
  requestHash: string
  inputs: TransformationInput[]
  outputs: TransformationOutput[]
  losses?: ProductionLossInput[]
}
```

`productionOrderId` es obligatorio. `transformationOrderId` es opcional; si se
envía, debe existir, pertenecer a `productionOrderId` y estar `OPEN`. Inputs,
outputs y pérdidas se registran como parte del comando atómico de la
Transformation; no existen comandos HTTP independientes para pérdidas.

------------------------------------------------------------------------

### `TransformationInput`

``` ts
{
  productionBatchId: string
  quantity: DecimalString
}
```

Todo input de una `Transformation` es uno o varios `ProductionBatch` trazables;
no se aceptan inputs identificados únicamente por `articuloId`. Los inputs se
envían dentro de `createTransformation`; no se agregan posteriormente mediante
un comando HTTP independiente.

------------------------------------------------------------------------

### `TransformationOutput`

``` ts
{
  articuloId: string
  quantity: DecimalString
  unit: string
}
```

Todo output reutilizable se representa mediante `ProductionBatch`; este
contrato conceptual no implica una entidad persistida independiente de output.
La transformación completa, incluidos consumos, outputs y pérdidas, es atómica.
Los outputs se envían dentro de `createTransformation`; no se agregan mediante
un comando HTTP independiente.

------------------------------------------------------------------------

## `getTransformation`

Obtiene:

``` text
tipo
fecha
ejecutor
inputs
outputs
mermas asociadas
```

------------------------------------------------------------------------

# 24. Production API --- Mermas

No existe una operación HTTP pública independiente para registrar o listar
`ProductionLoss`.

Las pérdidas se envían exclusivamente dentro de
`POST /api/v1/production/transformations` y forman parte del mismo comando
atómico e idempotente que sus inputs y outputs. La `operationKey` pública
identifica la transformación completa; las claves persistidas por pérdida son
identificadores internos y no habilitan reintentos independientes.

Cada pérdida debe conservar suficiente contexto para conocer dónde se produjo.
La merma no es un sustituto para ocultar diferencias no explicadas.

------------------------------------------------------------------------

# 25. Production API --- Cierre

## `closeProductionOrder`

Antes de cerrar debe validar las reglas del dominio correspondientes.

No debe permitir cerrar arbitrariamente una producción que aún tenga
información obligatoria pendiente.

La orden solo utiliza los estados `OPEN` y `CLOSED`. `CLOSED` es irreversible:
no existe reapertura. No puede cerrarse si tiene `TransformationOrder` abiertas,
trabajos pendientes o transformaciones incompletas; puede cerrarse aunque
existan batches con saldo disponible.

------------------------------------------------------------------------

# 26. API de consulta de estado productivo

Una capacidad especialmente importante será:

## `getProductionCurrentState`

Entrada:

``` ts
{
  productionOrderId: string
}
```

Salida conceptual:

``` ts
{
  productionOrderId: string

  currentArticulo?: ArticuloSummary

  batches: [
    {
      productionBatchId: string
      articuloId: string
      quantity: DecimalString
      unit: string
      containers: [...]
    }
  ]

  currentRouteStep?: string

  openTransformationOrder?: string

  lastMeasurements: [...]

  lastDecision?: [...]

  status: string
}
```

Este endpoint/command no debe inventar el estado leyendo una sola tabla.

Debe representar el estado productivo derivado de los registros válidos
existentes.

------------------------------------------------------------------------

# 27. API de trazabilidad

## `getProductionTrace`

Entrada:

``` ts
{
  productionOrderId: string
}
```

Debe permitir navegar:

``` text
ProductionOrder
↓
TransformationOrders
↓
Batches
↓
Works
↓
Measurements
↓
Decisions
↓
Transformations
↓
Losses
↓
Containers
↓
GrapeReception / Harvest
```

No debe generar genealogía ficticia.

------------------------------------------------------------------------

# 28. API pública mínima de cada módulo

## Articulos

``` text
getArticulo
listArticulos
validateArticulo
```

## Compras

``` text
createPurchase
getPurchase
listPurchases
receivePurchase
```

## Inventory

``` text
getWarehouse
listWarehouses
getInventoryLot
getStock
getAvailableQuantity

registerInbound
registerOutbound
registerTransfer
registerAdjustment
registerProductionConsumption
registerProductionOutput
transitionInventoryLotClassification
```

## Production

``` text
createHarvest
getHarvest
listHarvests
updateHarvestPlan

createGrapeReception
getGrapeReception
listGrapeReceptions
createGrapeLot

createProductionOrder
getProductionOrder
listProductionOrders

createTransformationOrder
getTransformationOrder
closeTransformationOrder

createProductionBatch
getProductionBatch
listProductionBatches

createProductionWork
addWorkInput
getProductionWork
listProductionWorks

recordMeasurement
getMeasurements

recordProductionDecision

createContainer
updateContainer
getContainer
listContainers
getContainerOccupancies
getContainerMovements

createTransformation
getTransformation

closeProductionOrder

getProductionCurrentState
getProductionTrace
```

------------------------------------------------------------------------

# 29. Permisos

Las APIs públicas no deben confiar en el frontend.

Cada command debe validar permisos antes de ejecutarse.

Ejemplos conceptuales:

``` text
article:read
article:manage

purchase:create
purchase:read
purchase:receive

inventory:read
inventory:movement_create
inventory:adjust
inventory:transfer

production:read
production:harvest_create
production:reception_create
production:order_create
production:work_create
production:measurement_create
production:decision_create
production:transformation_create
production:loss_create
production:container_manage
production:work_type_manage
production:measurement_type_manage
```

La convención definitiva de permisos de Winter es `<module>:<action>` y debe
respetar el mecanismo RBAC existente de Logger.

La autorización debe ejecutarse en backend.

------------------------------------------------------------------------

# 30. Roles de negocio especiales

El sistema tiene operaciones cuyo significado depende del dominio,
especialmente las decisiones enológicas.

Sin crear un sistema paralelo de autorización, el módulo puede requerir
que determinadas operaciones estén permitidas únicamente para
personas/roles autorizados.

Ejemplos:

``` text
Decisiones enológicas
Finalización de crianza
Decisiones de producto
```

La implementación debe usar el mecanismo de permisos/RBAC de Core.

No debe crear una entidad local de permisos en Production.

------------------------------------------------------------------------

# 31. Reglas de compatibilidad

Una Public API se considera contrato estable.

No debe:

-   eliminar campos sin estrategia de compatibilidad;
-   cambiar tipos silenciosamente;
-   cambiar el significado de un comando;
-   convertir una operación opcional en obligatoria sin revisión;
-   exponer detalles internos.

Si el dominio cambia, primero debe actualizarse la documentación y
después la API.

------------------------------------------------------------------------

# 32. Idempotencia

Las operaciones que puedan ser reintentadas por HTTP o integraciones
deberían soportar una estrategia de idempotencia.

Especialmente:

``` text
receivePurchase
registerInbound
registerOutbound
createTransformation
```

La implementación concreta de la clave idempotente seguirá las
convenciones existentes de Logger.

No debe inventarse una estrategia diferente por módulo.

------------------------------------------------------------------------

# 33. Transacciones

Una operación de dominio que produzca varios efectos que deban confirmarse o
revertirse juntos se ejecuta mediante el `UnitOfWork` compartido de
infraestructura. El mismo contexto transaccional puede ser utilizado por
Production, Inventory y Audit sin que un módulo importe repositories internos
del otro.

Ejemplo:

``` text
ProductionWork
      +
Consumption
      +
InventoryMovement
      +
Audit
```

No debe quedar una operación parcialmente aplicada.

Cuando una operación realmente requiera coordinación distribuida o
asíncrona, debe documentarse explícitamente y no introducirse
silenciosamente.

------------------------------------------------------------------------

# 34. Auditoría

Los commands que modifican información relevante deben producir
auditoría.

Al menos:

``` text
createHarvest
createGrapeReception
createGrapeLot

createProductionOrder
createTransformationOrder
closeTransformationOrder

createProductionWork
addWorkInput

recordMeasurement
recordProductionDecision

createTransformation
closeProductionOrder

receivePurchase

registerInbound
registerOutbound
registerTransfer
registerAdjustment
registerProductionConsumption
registerProductionOutput
transitionInventoryLotClassification
```

La auditoría pertenece a Core/Access Management.

------------------------------------------------------------------------

# 35. HTTP

Las Public APIs internas no necesariamente tienen que ser HTTP.

Dentro del backend modular pueden implementarse como interfaces
TypeScript.

La capa HTTP debe adaptarlas a controllers/routes cuando corresponda.

Ejemplo:

``` text
HTTP Controller
      ↓
Application Service
      ↓
Public API / Module Service
      ↓
Domain
      ↓
Repository
```

No:

``` text
HTTP Controller
      ↓
Prisma
```

------------------------------------------------------------------------

# 36. Regla de no exposición de persistence

Nunca debe aparecer en un contrato público:

``` text
PrismaClient
PrismaModel
PrismaWhereInput
PrismaCreateInput
PrismaUpdateInput
```

Los DTOs de API pertenecen a la capa de aplicación/contrato.

------------------------------------------------------------------------

# 37. Regla Production → Inventory

Production utiliza Inventory para efectos de inventario.

Casos iniciales:

``` text
consumo de insumo
ingreso de producto envasado
```

Production no debe registrar:

``` text
InventoryStock
InventoryLot
InventoryMovement
```

directamente.

------------------------------------------------------------------------

# 38. Regla Compras → Inventory

Cuando una compra recibida representa una entrada física:

``` text
Compras
   ↓
Inventory.registerInbound(...)
```

El movimiento y el stock pertenecen a Inventory.

------------------------------------------------------------------------

# 39. Regla Articulos → Production / Inventory / Compras

Los tres módulos pueden consultar artículos:

``` text
Production ──→ Articulos
Compras ─────→ Articulos
Inventory ───→ Articulos
```

Pero ninguno puede modificar el maestro salvo mediante la API de
Articulos.

------------------------------------------------------------------------

# 40. Caso completo --- Compra de insumo

``` text
Administración
      ↓
Compras.createPurchase
      ↓
Articulos.validateArticulo
      ↓
Compra creada
      ↓
Compras.receivePurchase
      ↓
Inventory.registerInbound
      ↓
InventoryLot
      ↓
InventoryStock
      ↓
Audit
```

------------------------------------------------------------------------

# 41. Caso completo --- Consumo de insumo

``` text
Production.createProductionWork
      ↓
Production.addWorkInput
      ↓
Inventory.registerProductionConsumption
      ↓
InventoryMovement
      ↓
Stock actualizado
      ↓
Audit
```

------------------------------------------------------------------------

# 42. Caso completo --- Producto envasado

``` text
ProductionWork
    EMBOTELLADO
        ↓
resultado físico
        ↓
Production
        ↓
Inventory.registerProductionOutput
        ↓
InventoryLot
        ↓
Stock
        ↓
Audit
```

------------------------------------------------------------------------

# 43. Caso completo --- Producto terminado y exportación

``` text
InventoryLot PRODUCTO_ENVASADO
      ↓
ProductionWork: ETIQUETADO
      ↓
ProductionWork: CONTROL_FINAL
      ↓
Inventory.transitionInventoryLotClassification
      ↓
InventoryLot PRODUCTO_TERMINADO
      ↓
Inventory.transitionInventoryLotClassification
      ↓
clasificación de exportación cuando corresponda
```

La exportación no crea una nueva producción ni un nuevo lote físico por el
solo cambio de clasificación.

------------------------------------------------------------------------

# 44. Caso completo --- Producción

``` text
Harvest
  ↓
GrapeReception
  ↓
GrapeLot
  ↓
ProductionOrder
  ↓
ProductionBatch
  ↓
ProductionWork
  ↓
Measurement
  ↓
Decision
  ↓
TransformationOrder
  ↓
Transformation
  ↓
nuevo ProductionBatch
  ↓
ContainerOccupancy / ProcessMovement
  ↓
Loss
  ↓
Envasado
  ↓
Inventory
```

------------------------------------------------------------------------

# 45. Regla para nuevos endpoints

Antes de agregar un endpoint, debe preguntarse:

> ¿Estoy exponiendo una capacidad de negocio o simplemente una tabla?

Si es solamente CRUD de persistencia y no representa una capacidad útil
del dominio, debe evaluarse si realmente necesita ser pública.

## P8 — Transformaciones y pérdidas

La API de producción expone únicamente el command atómico de transformación:

- `GET /api/v1/production/transformations` (`production:read`)
- `GET /api/v1/production/transformations/:id` (`production:read`)
- `POST /api/v1/production/transformations` (`production:transformation_create`)

El POST exige `productionOrderId`, `operationKey`, `requestHash`, uno o más
inputs por `productionBatchId` y cantidad, y uno o más outputs por
`articuloId`, cantidad y unidad exacta. `transformationOrderId` y
`productionWorkId` son contextos opcionales y deben pertenecer a la misma
ProductionOrder; no se exponen PATCH ni DELETE.

Cada output crea un nuevo `ProductionBatch`, con ledger GENERATED y lineage
hacia todos sus inputs. Las pérdidas son explícitas dentro del command; una
pérdida con batch conocido registra ledger LOSS y una pérdida sin batch no
inventa distribución. Todo el command, incluidos ledger, balances, lineage,
idempotencia y auditoría, confirma o revierte en una única transacción.

P8 no crea `InventoryMovement` ni implementa integración Production →
Inventory; esa capacidad pertenece a P9.

Los commands de negocio tienen prioridad sobre endpoints CRUD cuando
existe una regla/invariante relevante.

------------------------------------------------------------------------

# 46. Evolución de la API

Las futuras versiones pueden agregar:

``` text
Planificación avanzada de personal
Agenda de producción
Costeo
Ventas
Despacho
Mantenimiento
Activos
LIMS
```

sin romper los contratos actuales.

Un nuevo módulo debe:

1.  definir ownership;
2.  definir su Public API;
3.  documentar dependencias;
4.  registrar permisos;
5.  definir auditoría;
6.  definir transacciones;
7.  agregar workflows;
8.  agregar tests.

------------------------------------------------------------------------

# 47. Decisiones pendientes antes de implementación

Este documento deja deliberadamente algunas decisiones como pendientes:

### Nombres definitivos

Debe validarse si el código usará:

``` text
Articulo
Compra
ProductionOrder
TransformationOrder
ProductionBatch
```

o las convenciones de nombres ya existentes del backend.

### DTOs exactos

Los tipos finales de fecha, decimal, paginación, errores y metadata
deben respetar las utilidades ya implementadas en Logger.

### UnitOfWork compartido

La decisión arquitectónica está cerrada: las operaciones que requieran
atomicidad entre módulos utilizarán un único `UnitOfWork` compartido de
infraestructura. Durante la implementación solamente debe resolverse su
integración técnica con el Prisma/Unit of Work existente, sin cambiar el
contrato funcional ni crear coordinadores paralelos.

### Idempotencia

Debe reutilizarse la infraestructura existente si Logger ya dispone de
ella.

Estas decisiones deben resolverse antes de generar código definitivo, no
improvisarse durante implementación.

------------------------------------------------------------------------

# 47.1 Decisiones funcionales cerradas incorporadas

Quedan incorporadas como contrato:

- Winter es el sistema de negocio construido sobre Logger;
- `Articulos` y `Compras` son módulos propios de Winter;
- el actor autenticado se identifica por `User.id`;
- `ProductionWork` admite contexto directo múltiple de batches/containers;
- el producto entra a Inventory al envasarse como `PRODUCTO_ENVASADO`;
- la clasificación del lote cambia mediante `transitionInventoryLotClassification`;
- `Producer` y `GrapeVariety` pertenecen a Production;
- `Subproducto` no es entidad/agregado del MVP;
- los permisos utilizan `<module>:<action>`;
- la atomicidad intermodular utiliza el `UnitOfWork` compartido de infraestructura.

------------------------------------------------------------------------

# 48. Regla final para IA

La IA que implemente Winter sobre Logger debe:

``` text
leer este documento
      ↓
leer ARCHITECTURE + AI_IMPLEMENTATION_RULES + MODULE_CONTRACT
      ↓
leer DOMAIN_MODEL + AGGREGATES_AND_ENTITIES
      ↓
leer MODULE_MAP + WORKFLOWS
      ↓
revisar APIs existentes y módulos de referencia
      ↓
implementar únicamente el contrato solicitado
```

Si una tarea exige modificar una Public API existente, crear una nueva
dependencia o inventar una entidad necesaria para satisfacer un
endpoint:

``` text
NO improvisar
      ↓
reportar la inconsistencia
      ↓
actualizar documentación
      ↓
validar la decisión
      ↓
implementar
```

El contrato público es una frontera arquitectónica y no debe romperse
para simplificar la implementación interna.

### P9 production inventory release

Production exposes only `POST /api/v1/production/batches/:id/release-to-inventory`
for this command, protected by `production:inventory_release`. Its command
contains the positive decimal quantity, warehouse, operation key and existing
Inventory lot fields. It is allowed for OPEN and CLOSED orders. Production
coordinates a single Serializable transaction with the trusted Inventory API;
Production never writes Inventory tables directly. The output lot must be
`PRODUCTO_ENVASADO`, and lot reuse requires the same article, origin batch and
unchanged lot metadata. The operation rejects consumption of open container
allocations, persists a canonical idempotent result, appends the explicit
transfer ledger fact, rebuilds balance and records the release audit atomically.

# Guía funcional de flujos Winter — reunión pre-demo

**Propósito:** guiar una revisión de los procesos de bodega y producción que están implementados en el backend actual. Esta guía describe lo que hacen las rutas de `logger`, no lo que una pantalla, un diseño o un servidor de artefactos pudiera sugerir.

> **La secuencia de demostración es un guion, no una ejecución.** Todos los nombres, códigos y cantidades marcados como **DEMO ficticio** son ilustrativos; no identifican datos reales ni deben cargarse sin autorización. No se ha ejecutado ningún flujo como parte de esta guía.

## Cómo leer esta guía

- Las rutas se indican completas desde `/api/v1`. Requieren token Bearer Firebase, usuario Winter resuelto y el permiso indicado. Los cuerpos son JSON; los UUID y campos obligatorios se validan en el backend.
- “Consultar” indica una ruta de lectura; “registrar” indica una operación que persiste datos. Un resultado correcto se confirma consultando las rutas de lectura mencionadas, no suponiendo que una pantalla lo guardó.
- En este documento, **NO IMPLEMENTADO** significa que no existe la operación HTTP de negocio descrita en ese punto; **REQUIERE OPERACIÓN MANUAL** significa que el backend no realiza automáticamente una tarea que corresponde coordinar por separado.
- Los nombres en mayúscula de las entidades son entidades/modelos del dominio, no instrucciones para escribir directamente en tablas.

## Preparación de la demo

### Antes de la reunión

1. **Acordar el recorrido y no usar datos productivos sin autorización.** La sección “Escenario secuencial” usa únicamente datos ficticios etiquetados DEMO.
2. **Confirmar el acceso de cada operador.** Se necesita usuario autenticado, con usuario local activo y los permisos por acción enumerados en cada flujo. `production:read` no autoriza a registrar; para cada escritura se requiere además el permiso de comando.
3. **Elegir IDs existentes desde las consultas permitidas.** El backend relaciona registros por UUID: orden, productor, variedad, artículos, almacén, tipo de trabajo, participante, tipo de medición, recipiente y lote. No se deben inventar UUID. Confirmar que los catálogos estén activos cuando corresponda y que el artículo y la unidad de medida sean compatibles.
4. **Preparar los maestros** (o comprobar que ya existen): orden de producción abierta; productor; variedad de uva; artículo apto para representar la uva en Production; tipos de trabajo y medición; participante activo; recipientes disponibles; almacén activo; artículos de insumo y, si aplica, una orden de transformación abierta. La recepción también puede incluir campos personalizados obligatorios configurados para `GRAPE_RECEPTION`.
5. **Preparar los datos operativos:** cantidades y unidades coherentes con la unidad base del artículo; para Inventory, una cantidad positiva de hasta tres decimales (para `UNIDAD`, cantidad entera); fecha, notas, proveedor y, si aplica, lote de Inventory.
6. **Preparar el cliente de API autorizado.** Varias escrituras de Production reciben `operationKey` y `requestHash`. En asignación/trasiego y consumo de insumos el hash debe coincidir con el payload canónico que calcula el backend; no es un hash libre. En recepciones el backend normaliza el payload y comprueba la clave. No reutilizar la misma clave para otra operación ni cambiar el payload de una operación ya registrada.
7. **Inventory directo** requiere `Idempotency-Key` en el encabezado para entrada, salida, transferencia, ajuste y clasificación de lote. La recepción oficial de Compras no necesita que el operador envíe esa clave: el backend genera claves internas.
8. **No editar la base de datos.** No crear ni corregir órdenes, lotes, existencias, ocupaciones, movimientos, vínculos o auditoría mediante SQL o escrituras directas. Usar las rutas públicas; solicitar intervención autorizada si un dato no está disponible.

### Resultado esperado general

Una operación correcta debe devolver una respuesta de éxito con el registro o resultado de la operación. La comprobación posterior debe observar las entidades y los saldos indicados en cada flujo. Errores como `VALIDATION_ERROR`, permisos insuficientes, referencias inexistentes/inactivas, estados incompatibles o conflictos de idempotencia significan que el registro no debe darse por completado; resolver la causa antes de reintentar.

---

## Flujo 1 — Recepción de uva

**Qué representa:** una recepción asocia la orden, productor opcional y variedad/artículo/cantidad. Por cada línea válida, el backend crea un batch inicial de Production y conserva su relación con la recepción.

### Pasos y comportamiento

1. Consultar/seleccionar una orden `OPEN`, un productor activo (opcional), una variedad activa y un artículo activo cuya unidad base sea exactamente la enviada. **NO IMPLEMENTADO:** el servicio aún no exige una matriz que clasifique qué artículo corresponde a qué variedad de uva; esa selección debe verificarse con los responsables de negocio.
2. Registrar la recepción en `POST /api/v1/production/grape-receptions` (`production:reception_create`). Enviar `productionOrderId`, `receivedAt`, `status` (`ACCEPTED` o `ACCEPTED_WITH_OBSERVATIONS`), una o más líneas `items` con `grapeVarietyId`, `articuloId`, `quantity` y `unit`, más `operationKey` y `requestHash`. `producerId` y `observations` son opcionales. Para el estado con observaciones, escribir observaciones no vacías. Cantidades son decimales positivos con hasta tres cifras decimales.
3. La respuesta identifica la recepción, cada línea y `batchIds`. Cada línea da lugar a un `ProductionBatch` inicial asociado a esa recepción. La creación de recepción, líneas, batches, campos personalizados aplicables, idempotencia y auditoría se realiza dentro de una transacción.
4. **La recepción no ocupa un recipiente.** Si la operación física exige depositar la uva en un tanque, seleccionar el batch creado y realizar después una asignación separada mediante `POST /api/v1/production/containers/:id/assign` (`production:container_assign`). Enviar `batchId`, `quantity`, `operationKey`, `requestHash`; opcionalmente trabajo, observaciones y fecha efectiva. El destino debe estar disponible, tener capacidad adecuada y ser compatible con el batch. Esta segunda solicitud registra ocupación y movimiento de recipiente.
5. Registrar mediciones por separado en `POST /api/v1/production/measurements` (`production:measurement_create`), con `measurementTypeId`, `value` decimal, `unit`, `measuredAt` y al menos uno de los contextos `productionBatchId`, `productionContainerId` o `productionWorkId`. Opcionalmente `participantId` y observaciones. La medición debe referirse a entidades existentes y el tipo/participante debe estar activo; cuando se combinan trabajo y batch o recipiente, ese contexto debe estar vinculado al trabajo.

**Importante:** recibir uva **no** crea un movimiento de Inventory ni suma stock a un almacén. El batch y su balance de Production no equivalen a existencias de Inventory. No se proporciona en el endpoint de recepción una selección de recipiente ni medición automática.

**Comprobación:** `GET /api/v1/production/grape-receptions/:id` muestra recepción y líneas; `GET /api/v1/production/batches/:id` muestra cada batch y su balance; `GET /api/v1/production/containers/:id/occupancies` solo mostrará ocupación si se hizo la asignación independiente; `GET /api/v1/production/measurements?productionBatchId=...` muestra mediciones. Consultar Inventory no debe mostrar una entrada originada por la recepción.

## Flujo 2 — Compra de insumos

**Qué representa:** Compra captura proveedor como nombre referencial y cada artículo comprado, con marca y precio unitario también referenciales. No se crea maestro de proveedor o marca desde estas rutas.

1. Crear en `POST /api/v1/compras` (`compras:create`) con `supplierName` y al menos un `items[]`: `articuloId`, `requestedQuantity`, `unit`; opcionalmente `brand`, `unitPrice`. También se admiten `supplierTaxId`, `documentNumber`, `documentDate`, `currency` y `observations`. El artículo debe existir y estar activo; unidad debe coincidir con unidad base; no repetir un artículo; cantidades > 0, hasta 3 decimales, y enteras para `UNIDAD`; precio opcional no negativo.
2. El estado inicial es `REGISTERED`. Mientras siga así puede editarse mediante `PATCH /api/v1/compras/:id` (`compras:update`); los ítems se actualizan dentro de la compra y los existentes no se pueden eliminar. No hay endpoint independiente de ítems ni DELETE.
3. Recibir mediante `POST /api/v1/compras/:id/receive` (`compras:receive`), con `warehouseId` activo. `items` es opcional; si se omite se reciben todos sin lote explícito. Si se envía, debe identificar **cada** `compraItemId` exactamente una vez; puede asociar `inventoryLotId`. No es posible recibir un subconjunto.
4. La operación, en una transacción, cambia la compra a `RECEIVED`, crea entradas `INBOUND` de Inventory con fuente `COMPRAS`, registra las referencias entre compra y movimientos y actualiza el stock. El backend usa una clave interna determinista. El usuario necesita `compras:receive`, no `inventory:inbound`.

**Comprobación:** `GET /api/v1/compras/:id` muestra `RECEIVED`; `GET /api/v1/inventory/stock?warehouseId=...&articuloId=...` muestra el saldo nuevo; `GET /api/v1/inventory/movements?articuloId=...` muestra `INBOUND`/`COMPRAS`. Una compra `RECEIVED` no se vuelve a recibir. Cancelar compra solo es posible mientras `REGISTERED`, no crea ni revierte stock.

## Flujo 3 — Movimiento de inventario

Todas las rutas bajo `/api/v1/inventory`, autenticadas y autorizadas con el permiso indicado. Los comandos de movimiento exigen encabezado `Idempotency-Key` no vacío. El artículo debe estar activo; almacenes pertinentes activos; unidad exactamente igual a la unidad base del artículo; cantidad positiva, hasta tres decimales (entera para `UNIDAD`). No reutilice una clave con payload diferente. Un movimiento y el saldo materializado se actualizan atómicamente; el historial es inmutable.

| Operación | Ruta y permiso | Datos esenciales | Efecto y validación |
|---|---|---|---|
| Entrada | `POST /api/v1/inventory/inbound` — `inventory:inbound` | `articuloId`, `warehouseId`, `quantity`, `unit`, `source`; opcional `inventoryLotId`, `reason` | Crea `INBOUND`, aumenta stock. Lote, si se envía, corresponde al artículo. |
| Salida | `POST /api/v1/inventory/outbound` — `inventory:outbound` | mismos datos de movimiento | Crea `OUTBOUND`, disminuye stock. Sin saldo suficiente se rechaza salvo autorización especial: `authorizeNegativeStock:true`, motivo no vacío y permiso `inventory:negative_stock_authorize`. |
| Transferencia entre almacenes | `POST /api/v1/inventory/transfer` — `inventory:transfer` | `articuloId`, `sourceWarehouseId`, `destinationWarehouseId`, `quantity`, `unit`, `source` | Un único movimiento `TRANSFER`; reduce origen y aumenta destino. Los almacenes deben ser distintos y activos. |
| Ajuste | `POST /api/v1/inventory/adjustment` — `inventory:adjust` | campos de movimiento más `direction: INCREASE` o `DECREASE` | Crea `ADJUSTMENT`; no edita ni borra un movimiento previo. Saldo negativo sigue las condiciones de autorización anteriores. |

**Comprobación:** `GET /api/v1/inventory/stock` (saldo) o `/stock/available` (disponible), filtrados por `warehouseId`, `articuloId` y opcionalmente `inventoryLotId`; `/movements?articuloId=...` para historial. `InventoryMovement` es evidencia histórica; `InventoryStock` es saldo materializado. Las transferencias entre almacenes de Inventory no son trasiegos entre recipientes de Production.

## Flujo 4 — Trabajo de producción

1. Crear o seleccionar `ProductionOrder` abierta. Alta: `POST /api/v1/production/orders` (`production:order_create`) con `code`, `startDate` y observaciones opcionales.
2. Crear un trabajo con `POST /api/v1/production/works` (`production:work_create`): `productionOrderId`, `workTypeId` activo y `performedAt`; opcionales `transformationOrderId` compatible y abierta, `batchIds[]`, `containerIds[]`, `participants[]` (cada uno `participantId` activo y rol opcional) y observaciones. Las referencias de contexto pueden dejarse vacías; si se incluyen, deben existir. El backend guarda el usuario creador y audita el alta.
3. Mediciones del trabajo se registran por separado en `/api/v1/production/measurements`; asociar `productionWorkId` y, cuando corresponda, batch/recipiente vinculados. Valor numérico decimal de hasta seis decimales, unidad y tipo de medición activo.
4. Si el trabajo consume un insumo de Inventory, usar `POST /api/v1/production/works/:id/inputs` (`production:work_input_create`): `articuloId`, `warehouseId`, cantidad positiva, unidad (`KG|G|L|M|UNIDAD`), `operationKey`, `requestHash`; `inventoryLotId` y observaciones son opcionales. La unidad debe corresponder al artículo y el consumo genera un `OUTBOUND` y un `ProductionWorkInput` de forma atómica. No se realizan conversiones automáticas de unidades. Saldo negativo solo si hay autorización, motivo y permiso apropiados.

**Comprobación:** `GET /api/v1/production/works/:id` muestra orden, batch(s), recipiente(s), participantes, mediciones/contexto consultables, entradas de insumos y sus movimientos de Inventory. Para una entrada revertida, el original permanece y se registra movimiento compensatorio mediante la ruta específica de reversión (`production:work_input_reverse`); no se borra el consumo histórico.

## Flujo 5 — Transformación de producto

**Qué representa:** una sola operación de transformación registra batches de entrada, cantidades consumidas, pérdidas opcionales y uno o más outputs que generan batches destino y relaciones de lineage. Puede reconciliar además la retirada física de ocupaciones origen y la colocación de outputs en recipientes. Estas acciones se coordinan atómicamente en la transacción de transformación, no son una secuencia de llamadas separadas.

1. Confirmar orden padre `OPEN`, batch(s) disponibles, artículos destino activos y recipientes compatibles. Si se especifica `TransformationOrder`, debe pertenecer a la misma orden y seguir `OPEN`; el trabajo opcional también debe pertenecer a esa orden/contexto.
2. Enviar `POST /api/v1/production/transformations` con `productionOrderId`, `performedAt`, `operationKey`, `requestHash`, al menos un `inputs[]` (`productionBatchId`, `quantity`) y `outputs[]` (`articuloId`, `quantity`, `unit`); opcionales `transformationOrderId`, `productionWorkId`, observaciones, `losses[]`, `sourceWithdrawals[]`, `outputPlacements[]`.
3. Si se usan `sourceWithdrawals`, cada línea identifica `productionBatchId`, `containerId`, cantidad. La cantidad retirada físicamente debe corresponder a batch de entrada y no exceder las reducciones (consumo más pérdidas atribuidas) de ese batch. Se cierra/ajusta ocupación fuente en el mismo comando.
4. Para cada pérdida (`losses[]`), enviar cantidad positiva y unidad; `productionBatchId` opcional. Si se indica batch, debe existir, pertenecer a la orden y usar su misma unidad; reduce su balance disponible y deja entidad de pérdida y ledger. Se requiere además `production:loss_create` si el array de pérdidas contiene elementos.
5. Los outputs crean nuevos batches y lineage desde los inputs. No hay conversión de unidades en una transformación: el artículo destino y el batch deben tener unidad compatible con el input; las cantidades deben ser positivas. Para ocuparlos, `outputPlacements[]` lleva `outputIndex` (índice desde cero en outputs), `containerId` y cantidad positiva, hasta la cantidad generada. La colocación necesita además `production:container_assign`. Puede haber menos cantidad colocada que generada.
6. La transformación es idempotente por `operationKey`; el backend compara hash del payload canónico y un payload diferente produce conflicto. Se requiere hash válido; no inventarlo ni calcularlo a mano durante la reunión.

**Comprobación:** `GET /api/v1/production/transformations/:id` muestra entradas, outputs/batches destino, pérdidas y reconciliación física; `GET /api/v1/production/batches/:id` muestra balance disponible; `GET /api/v1/production/batches/:id/trace` muestra lineage y ledger; las consultas de recipientes muestran ocupaciones. Un output solo ocupa recipiente si se especificó `outputPlacements` en la transformación o se hizo asignación posterior independiente.

## Flujo 6 — Trasiego o cambio de recipiente

Un trasiego entre recipientes Production **no** es un movimiento de Inventory. Seleccione una ocupación abierta, el batch correcto y un recipiente destino disponible con capacidad compatible. Opcionalmente vincule un trabajo de la misma ProductionOrder.

- **Traslado total:** `POST /api/v1/production/containers/:sourceId/transfers` (`production:container_transfer`) con `destinationContainerId`, `batchId`, `operationKey`, `requestHash`; `quantity` no se envía: se traslada toda la ocupación.
- **Traslado parcial:** `POST /api/v1/production/containers/:sourceId/transfers/partial`, además `quantity` y `childCode`. Crea batch hijo y lineage, y registra ocupaciones origen/destino; la respuesta contiene parent, child, source y destination.

Ambas operaciones aceptan opcionalmente trabajo, observaciones y `occurredAt`. El backend valida el hash canónico, contexto de trabajo, ocupación/capacidad y mantiene registros de movimiento/ocupación. El traslado interno no escribe `InventoryMovement`. Si la intención es cambiar de almacén, use la transferencia de Inventory del flujo 3; si es mover físicamente vino/producto entre recipientes, use Production.

**Comprobación:** `GET /api/v1/production/containers/:id/occupancies` y `/movements`; para traslado parcial, consultar el batch hijo y su trazabilidad.

## Flujo 7 — Cierre de órdenes

- **Orden de producción:** consultar con `GET /api/v1/production/orders/:id`; cerrar con `POST /api/v1/production/orders/:id/close` (`production:order_close`), sin body. Solo puede cerrarse una orden `OPEN`. El código bloquea el cierre si tiene alguna `TransformationOrder` hija `OPEN` (`PRODUCTION_ORDER_NOT_CLOSABLE`). Un cierre correcto deja estado `CLOSED`, actor/fecha de cierre y versión incrementada. Recepción, creación de trabajo y transformación exigen orden abierta, por lo que dejan de ser aceptadas para una orden cerrada.
- **Orden de transformación:** consultar lista/detalle en `/api/v1/production/transformation-orders`; cerrar con `POST /api/v1/production/transformation-orders/:id/close` (`production:transformation_order_close`), sin body. Debe estar `OPEN`; el endpoint marca `CLOSED` con actor/fecha/versión. El código actual tiene un hook de validación de operaciones incompletas que actualmente devuelve `false`: **no se debe asumir que realiza una conciliación operativa o que comprueba que las tareas estén completas**. Las nuevas transformaciones y trabajos que la referencien exigen orden de transformación abierta.

**REQUIERE OPERACIÓN MANUAL:** antes del cierre, los responsables deben revisar saldos, recipientes, operaciones y requisitos internos de negocio. Cerrar no vacía un recipiente, no mueve stock, no crea un informe de conformidad ni compensa movimientos. No cerrar durante la demostración salvo que los asistentes confirmen el impacto.

## Flujo 8 — Trazabilidad, historial y auditoría

Son comprobaciones relacionadas, pero son registros distintos:

1. **Linaje del batch:** `GET /api/v1/production/batches/:id/trace` devuelve batches conectados, `lineage`, ledger, recepciones, transformaciones, mediciones, trabajos y recipientes relacionados (con límites de profundidad/tamaño; puede responder `TRACE_LIMIT_EXCEEDED`). `/batches/:id` incluye balance detallado; `/balance` solo el disponible y unidad.
2. **Trabajo y medidas:** consultar `/works/:id`, `/measurements?...`, `/grape-receptions/:id` y `/transformations/:id`. Estos detalles permiten verificar actor/contexto, correcciones y relaciones según cada recurso.
3. **Movimiento de Inventory:** `GET /api/v1/inventory/movements?articuloId=...` requiere `inventory:read` y filtra por artículo (y opcionalmente almacén, lote, tipo, página). Revisar origen, tipo, cantidad, saldo resultante y lote. El stock actual se verifica aparte con `GET /api/v1/inventory/stock`.
4. **Recipientes:** `GET /api/v1/production/containers/:id/occupancies` y `GET /api/v1/production/containers/:id/movements` prueban asignaciones, trasiegos y ocupación actual; no reemplazan el ledger del batch.
5. **Auditoría:** `GET /api/v1/audit-logs` requiere `audit:read` y permite consultar los eventos registrados con actor. Es un historial independiente de batch trace y de `InventoryMovement`; comparar recurso, acción y actor, sin inferir la auditoría únicamente de una traza ni modificarla manualmente.

---

## Escenario secuencial recomendado — DEMO ficticia, sin ejecutar

Los datos siguientes son **DEMO ficticios, no IDs ni registros reales**: orden `DEMO-ORD-UVA-01`; productor `DEMO-Finca-Los-Alamos`; variedad `DEMO-Cabernet`; artículo uva `DEMO-UVA-CAB`, unidad `KG`; batch inicial de 1.000,000 KG; tanque `DEMO-TQ-01` y tanque destino `DEMO-TQ-02`; tipo de trabajo `DEMO-Recepción-y-control`; participante `DEMO-Operador-01`; medición `DEMO-Temperatura`; artículo de insumo `DEMO-Nutriente`, unidad `KG`; proveedor referencial `DEMO-Insumos Andinos`; marca referencial `DEMO-Marca-01`; almacén `DEMO-Almacén-01`. Los valores y cantidades ilustran el proceso; antes de cualquier demo real hay que sustituirlos por referencias válidas y aprobadas. Para seguir el ejemplo, la transformación conserva unidad `KG`; no representa conversión enológica de unidades.

En cada paso, las rutas que escriben se indican para preparación del guion solamente. Deben sustituirse referencias con IDs devueltos por consultas y claves/hash válidos del cliente; no ejecutar el texto literalmente.

### 1. Recibir uva y crear el batch

- **Acción:** registrar la recepción ficticia de 1.000,000 KG de uva DEMO.
- **Endpoint:** `POST /api/v1/production/grape-receptions` — `production:reception_create`.
- **Datos requeridos:** orden abierta, productor opcional, fecha, estado; item con variedad, artículo uva, `quantity:"1000.000"`, `unit:"KG"`; `operationKey` y `requestHash`. Observaciones si el estado es `ACCEPTED_WITH_OBSERVATIONS`.
- **Resultado esperado:** recepción y un batch inicial vinculado a la línea.
- **Entidades afectadas:** `GrapeReception`, `GrapeReceptionItem`, `ProductionBatch`, balance/ledger de batch, registro idempotente y auditoría.
- **Verificación:** `GET /api/v1/production/grape-receptions/:id`, `GET /api/v1/production/batches/:batchId`. El batch debe existir; no se espera ocupación de recipiente ni movimiento de Inventory.
- **Preparación física por separado:** solo si aplica, asignar luego batch a TQ-01 con `POST /api/v1/production/containers/:id/assign` (`production:container_assign`), cantidad en KG, clave/hash canónicos y operación válida. Ver `GET /api/v1/production/containers/:id/occupancies`.

### 2. Registrar medición de recepción

- **Acción:** anotar una medición ficticia de temperatura para el batch recién creado.
- **Endpoint:** `POST /api/v1/production/measurements` — `production:measurement_create`.
- **Datos requeridos:** tipo de medición activo, `productionBatchId`, valor numérico (ej. `"18.5"` DEMO), unidad (ej. `"°C"` DEMO) y `measuredAt`; participante opcional.
- **Resultado esperado:** registro cuantitativo asociado al batch; no cambia su cantidad.
- **Entidades afectadas:** `ProductionMeasurement`, referencia al batch/tipo/participante y auditoría.
- **Verificación:** `GET /api/v1/production/measurements?productionBatchId=:batchId` y detalle de medición. El backend valida valor numérico de hasta seis decimales; **NO IMPLEMENTADO** tipo cualitativo estructurado en este endpoint.

### 3. Registrar el trabajo de producción

- **Acción:** registrar control inicial ligado a orden, batch, TQ-01 si ya fue asignado, tipo y participante.
- **Endpoint:** `POST /api/v1/production/works` — `production:work_create`.
- **Datos requeridos:** `productionOrderId`, `workTypeId` activo y `performedAt`; `batchIds:[batchId]`, `containerIds:[tankId]` si corresponde; participante activo con rol DEMO opcional.
- **Resultado esperado:** trabajo creado con las relaciones indicadas; todavía no consume stock.
- **Entidades afectadas:** `ProductionWork`, vínculos work-batch/container/participant y auditoría.
- **Verificación:** `GET /api/v1/production/works/:workId`; comprobar por separado con `GET /api/v1/production/measurements?productionBatchId=:batchId` que la medición esté enlazada al contexto correcto.

### 4. Crear compra DEMO del insumo

- **Acción:** registrar compra de 10,000 KG ficticios de `DEMO-Nutriente` al proveedor y marca referenciales.
- **Endpoint:** `POST /api/v1/compras` — `compras:create`.
- **Datos requeridos:** `supplierName:"DEMO-Insumos Andinos"`, línea con ID real elegido para artículo, `brand:"DEMO-Marca-01"`, `requestedQuantity:"10.000"`, `unit:"KG"`, `unitPrice:"2.500"` DEMO opcional.
- **Resultado esperado:** compra `REGISTERED`; todavía no hay entrada de stock.
- **Entidades afectadas:** `Compra`, `CompraItem`, auditoría.
- **Verificación:** `GET /api/v1/compras/:compraId` y consulta del stock previo para tener comparación.

### 5. Recibir la compra en almacén

- **Acción:** recibir la compra completa en `DEMO-Almacén-01`.
- **Endpoint:** `POST /api/v1/compras/:compraId/receive` — `compras:receive`.
- **Datos requeridos:** `warehouseId`; opcionalmente enumerar todos los `compraItemId` y lote Inventory válido por artículo. No enviar un subconjunto.
- **Resultado esperado:** compra `RECEIVED`, un `INBOUND` por línea fuente `COMPRAS` y aumento de stock por 10,000 KG; el contexto server-side hace la integración.
- **Entidades afectadas:** `Compra`, `InventoryMovement`, `InventoryStock`, referencias compra-movimiento y auditoría.
- **Verificación:** `GET /api/v1/compras/:compraId`, `GET /api/v1/inventory/stock?warehouseId=...&articuloId=...` y `GET /api/v1/inventory/movements?articuloId=...`.

### 6. Consumir parte del insumo en el trabajo

- **Acción:** cargar consumo ficticio de 1,000 KG de nutriente en el trabajo de paso 3.
- **Endpoint:** `POST /api/v1/production/works/:workId/inputs` — `production:work_input_create`.
- **Datos requeridos:** artículo, almacén, cantidad `"1.000"`, unidad compatible, `operationKey` y `requestHash` calculado por cliente conforme al payload canónico. Lote opcional si se recibió con lote.
- **Resultado esperado:** entrada de insumo asociada al trabajo y movimiento `OUTBOUND`; el stock desciende 1,000 KG en una operación atómica.
- **Entidades afectadas:** `ProductionWorkInput`, `InventoryMovement`, `InventoryStock`, auditoría.
- **Verificación:** volver a consultar `GET /api/v1/production/works/:workId`, `GET /api/v1/inventory/stock` y `GET /api/v1/inventory/movements?articuloId=...`; deben concordar cantidad y movimiento.

### 7. Transformar el batch

- **Acción:** plantear una transformación del batch DEMO: input consumido de 980,000 KG y output de 980,000 KG del artículo destino ficticio compatible en `KG`; registrar además una pérdida de 20,000 KG del batch origen. Los 1.000,000 KG iniciales quedan representados como 980,000 KG de producto y 20,000 KG de merma. Es un escenario ficticio, no una regla de conversión.
- **Endpoint:** `POST /api/v1/production/transformations` — `production:transformation_create`; además `production:loss_create` porque se informa merma. Para placement en recipiente se requiere también `production:container_assign`.
- **Datos requeridos:** orden `OPEN`; input `{productionBatchId,quantity:"980.000"}`; output `{articuloId,quantity:"980.000",unit:"KG"}`; `losses:[{productionBatchId,quantity:"20.000",unit:"KG",observations:"Merma DEMO"}]`; fecha, clave y hash del payload canónico. Si el batch completo ocupa TQ-01, incluir `sourceWithdrawals:[{productionBatchId,containerId:TQ-01,quantity:"1000.000"}]` para reconciliar consumo más merma. `outputPlacements:[{outputIndex:0,containerId:TQ-02,quantity:"980.000"}]` solo si se desea crear ocupación del producto generado.
- **Resultado esperado:** transformación, reducción de disponibilidad de fuente, pérdida, nuevo batch destino y lineage; la retirada física y colocación incluidas se registran en la misma transacción. El total físico retirado debe ser compatible con las reducciones; no exceder consumo más pérdidas atribuidas.
- **Entidades afectadas:** `Transformation`, `TransformationInput`, `TransformationOutput`, `ProductionBatch`, ledger/balance, lineage, `ProductionLoss`, ocupaciones/movimientos de recipientes cuando se incluyan, operación idempotente y auditoría.
- **Verificación:** detalle de transformación, batch origen y destino, trace y recipiente. La unidad no se convierte.

### 8. Comprobar la merma de la transformación

- **Acción:** como paso de revisión del mismo evento, validar que los 20,000 KG de pérdida se registraron con explicación de negocio acordada.
- **Endpoint:** **no hay endpoint independiente para crear pérdida**; queda registrada dentro del `POST /production/transformations` del paso 7. No enviar una segunda operación para duplicarla.
- **Datos requeridos:** pérdida asociada al batch fuente, cantidad/unidad/observación incluidas en la transformación original.
- **Resultado esperado:** línea de pérdida y ledger `LOSS` enlazados al evento; el paso es verificación, no escritura nueva.
- **Entidades afectadas:** las mismas `ProductionLoss`, balance/ledger, `Transformation` y auditoría del paso 7.
- **Verificación:** `GET /api/v1/production/transformations/:id` y `GET /api/v1/production/batches/:sourceBatchId/trace`; confirmar cantidad, unidad y balance. Si la respuesta no incluye una pérdida, no asumir que se registró separadamente.

### 9. Trasladar el producto a otro recipiente

- **Acción:** trasladar el batch de salida de TQ-02 a otro tanque ficticio disponible, si la operación física lo requiere.
- **Endpoint:** `POST /api/v1/production/containers/:sourceId/transfers` — `production:container_transfer`.
- **Datos requeridos:** `destinationContainerId`, batch de salida, `operationKey` y hash canónico; no enviar cantidad para movimiento total. El tank origen debe tener ocupación correspondiente; opcional trabajo compatible y observación/fecha.
- **Resultado esperado:** se cierra ocupación de origen y abre ocupación destino con el batch/cantidad; movimiento de recipiente. **No** se crea `InventoryMovement` ni cambia stock de almacén.
- **Entidades afectadas:** ocupaciones y movimientos de container; auditoría.
- **Verificación:** consultar `GET /api/v1/production/containers/:id/occupancies` y `GET /api/v1/production/containers/:id/movements` para ambos recipientes, y trace del batch. Si se desea trasladar solo una parte, usar en su lugar `POST /api/v1/production/containers/:sourceId/transfers/partial`, cantidad y `childCode`; esto crea batch hijo/lineage.

### 10. Revisar trazabilidad e historial

- **Acción:** reconstruir el recorrido del batch desde la recepción hasta el batch de salida, y corroborar aparte el consumo/stock de insumo.
- **Endpoint:** lecturas `GET /api/v1/production/batches/:sourceBatchId/trace`, `GET /api/v1/production/transformations/:id`, `GET /api/v1/production/works/:workId`, `GET /api/v1/inventory/movements?articuloId=:inputArticleId`, `GET /api/v1/inventory/stock` y `GET /api/v1/audit-logs` (si se tiene `audit:read`).
- **Datos requeridos:** UUIDs persistidos devueltos en los pasos previos y permisos `production:read`, `inventory:read`.
- **Resultado esperado:** trace muestra recepciones, lineage, ledger, trabajo, medida, transformación, pérdidas y recipientes; historial Inventory muestra compra inbound y consumo outbound; stock refleja saldo restante.
- **Entidades afectadas:** ninguna escritura; son consultas a recepciones/batches/ledger/transformaciones/trabajos/mediciones/containers y a movimientos/stock de Inventory.
- **Verificación:** comparar cantidades y unidades con las respuestas de cada paso. Revisar auditoría por separado mediante acceso autorizado; el trace no es la auditoría.

---

## Checklist de reunión

- [ ] Flujo entendido por usuarios
- [ ] Resultado coincide con operación real
- [ ] Falta regla de negocio
- [ ] Requiere cambio
- [ ] Aprobado

**Observaciones / acuerdos / preguntas pendientes**

______________________________________________________________________________

______________________________________________________________________________

______________________________________________________________________________

## Apéndice técnico — fuentes revisadas

Fuentes utilizadas para confirmar rutas, permisos, validación y comportamiento; todas pertenecen al backend actual en `logger` (no se usaron artefactos de API o frontend como evidencia):

- `logger/src/modules/production/production.routes.ts`
- `logger/src/modules/production/production.schema.ts`
- `logger/src/modules/production/production.service.ts`
- `logger/src/modules/production/production.reception.ts`
- `logger/src/modules/production/production.batch.ts`
- `logger/src/modules/production/production.measurement.ts`
- `logger/src/modules/production/production.work.ts`
- `logger/src/modules/production/production.transformation.ts`
- `logger/src/modules/production/production.container.ts`
- `logger/src/modules/production/production.trace.ts`
- `logger/src/modules/production/production.doc-type.ts`
- `logger/src/modules/compras/compra.routes.ts`
- `logger/src/modules/compras/compra.schema.ts`
- `logger/src/modules/compras/compra.service.ts`
- `logger/src/modules/compras/compra.doc-type.ts`
- `logger/src/modules/inventory/inventory.routes.ts`
- `logger/src/modules/inventory/inventory.schema.ts`
- `logger/src/modules/inventory/inventory.service.ts`
- `logger/prisma/schema.prisma`
- `logger/docs/api/PRODUCTION_API.md`
- `logger/docs/api/COMPRAS_API.md`
- `logger/docs/api/INVENTORY_API.md`

Cuando el texto contractual y las rutas/servicios debían distinguirse, esta guía describe el comportamiento verificable en código. En particular: recepción de uva no asigna recipiente ni genera movimiento de Inventory; cierre de orden padre bloquea si quedan órdenes de transformación abiertas; y el cierre de orden de transformación no tiene actualmente comprobación efectiva de operaciones incompletas.
# Production — plan de implementación (FASE 3)

## 1. Propósito y límites

Este documento descompone la implementación de Production en incrementos
implementables. La autoridad funcional y técnica es, en este orden,
`DECISION_PRODUCTION.md` y `PRODUCTION_TECHNICAL_DESIGN.md`. No agrega estados,
permisos, campos, conversiones ni reglas.

Cada incremento debe conservar las fronteras de ownership: Production es
propietario de sus modelos; Articulos, Inventory, Core/Auth y Core/Audit se
consumen mediante APIs públicas. Los DTOs públicos no exponen Prisma, el actor
se obtiene del contexto autenticado y ninguna entidad histórica se elimina
físicamente.

Los bloqueantes de la sección 14 del diseño técnico son gates: no se resuelven
por inferencia. Una fase que dependa de uno queda diseñada, pero no se puede
cerrar hasta que la decisión contractual correspondiente esté publicada.

## 2. Orden y reglas comunes de ejecución

La secuencia es estricta: P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10 →
P11. Cada fase entrega migración reversible según la convención vigente,
repositories, services, DTOs, autorización, auditoría y pruebas. Las
operaciones críticas usan `SharedUnitOfWork`; el cambio de dominio, cantidades,
integraciones y auditoría confirman o revierten juntas.

Todos los listados son queries paginadas con filtros consistentes. Los comandos
no se implementan como CRUD genérico. Las cantidades son `Decimal`, positivas
en los hechos, sin conversiones silenciosas. `operationKey` y `requestHash`
son obligatorios donde el diseño exige idempotencia. Los errores se traducen a
códigos de dominio aprobados.

## 3. P1 — base de módulo y catálogos maestros

### Alcance

P1 es deliberadamente pequeño: bootstrap del módulo, boundaries, autorización,
auditoría y catálogos administrativos. **No implementa operaciones históricas**:
no crea órdenes, batches, ledger, recepciones, trabajos, transformaciones,
ocupaciones, mediciones operativas, pérdidas ni transferencias a Inventory.

Modelos Prisma:

- `WorkType`, `MeasurementType` (catálogos administrativos);
- `ProductionParticipant`;
- `Producer`, `GrapeVariety`;
- `CustomFieldDefinition` y `CustomFieldValue`, únicamente para
  `Producer`, `GrapeVariety` y `GrapeReception`;
- tablas auxiliares estrictamente necesarias para la configuración del módulo,
  sin alterar modelos de otros módulos.

Se respetan exactamente los campos, `active`, códigos estables, bajas lógicas y
unicidades del diseño técnico. La referencia opcional a `User` es opaca; no se
crea FK externa. Los `CORE_FIELDS` no se administran como custom fields.

### Interfaces y componentes

- Endpoints: base `/api/v1/production`; query de lectura de catálogos y
  comandos administrativos de catálogos/custom fields se publican solo con el
  contrato HTTP común y los permisos existentes; no se agrega una ruta,
  permiso o estado no aprobado. No se habilitan todavía los comandos
  históricos.
- Services: `WorkTypeService`, `MeasurementTypeService`,
  `ProductionParticipantService`, `ProducerService`, `GrapeVarietyService`,
  `CustomFieldDefinitionService` y `CustomFieldValueService`; validan
  unicidad, baja lógica, estabilidad de `code`/`dataType` y tipo de valor.
- Repositories: uno por agregado/catálogo, con queries de activos,
  paginación y transacciones; no se exponen a otros módulos.
- APIs intermodulares: ninguna llamada productiva. Se deja el boundary para
  `ArticulosApi`, `InventoryApi`, Core/Auth y Core/Audit sin inventar métodos.
- Permisos: `production:read`, `production:work_type_manage`,
  `production:measurement_type_manage`, `production:participant_manage`,
  `production:producer_manage`, `production:grape_variety_manage` y
  `production:custom_fields_manage`, según cada operación. No se crea un
  permiso de catálogo genérico.
  WorkType y MeasurementType admiten CRUD administrativo (alta, edición de
  nombre y activación/desactivación lógica), no comandos históricos; no se
  crean valores seed. No tienen DELETE.
- Auditoría: administración de catálogos y custom fields, con actor del
  contexto autenticado, acción, recurso, fecha y metadata. No hay eventos
  operativos en esta fase.

### Pruebas, migración y dependencias

Pruebas unitarias de invariantes de códigos, baja lógica, tipos de valores y
permisos; integración de repositories, unicidades, paginación y auditoría;
HTTP de autorización y errores contractuales. La migración crea solo las tablas
P1, índices y restricciones internas, sin datos históricos ni backfill
inventado. Depende de convenciones Prisma, contexto de autenticación,
`SharedUnitOfWork`, Core/Audit y del enum `Unit` solo cuando sea requerido por
tipado compartido; no depende de Articulos ni Inventory para operar estos
catálogos.

## 4. P2 — órdenes

### Alcance

Modelos: `ProductionOrder` y `TransformationOrder`, con estados únicamente
`OPEN` y `CLOSED`, versiones, fechas, observaciones y actores de cierre. No se
crean aún batches ni hechos cuantitativos.

Endpoints aprobados:

- `POST /api/v1/production/orders`;
- `POST /api/v1/production/orders/:id/close`;
- `POST /api/v1/production/transformation-orders`;
- `POST /api/v1/production/transformation-orders/:id/close`.

Services: `ProductionOrderService` y `TransformationOrderService`; repositories
correspondientes y validadores de cierre. El cierre es irreversible y aplica
solo las precondiciones que puedan evaluarse con lo ya implementado; no se
inventan estados pendientes.

APIs intermodulares: contexto autenticado/Core y Core/Audit. No requiere
ArticulosApi ni InventoryApi. Permisos: `production:read`,
`production:order_create`, `production:order_close`,
`production:transformation_order_create` y
`production:transformation_order_close`. Auditoría de creación y cierre.

Pruebas unitarias de transición única, versionado y actor; integración de
unicidad de códigos, ownership y cierres; HTTP de permisos y errores
`PRODUCTION_ORDER_NOT_FOUND`, `PRODUCTION_ORDER_CLOSED` y
`TRANSFORMATION_ORDER_CLOSED`. Migración crea ambas tablas, enums aprobados,
FK restrict e índices; no hay backfill. Depende de P1 y de los servicios
comunes.

## 5. P3 — batches, ledger y lineage

### Alcance

Modelos: `ProductionBatch`, `ProductionBatchLedgerEntry`,
`ProductionBatchBalance` reconstruible y `ProductionBatchLineage`. Se
implementan generación inicial y operaciones de saldo necesarias para
trazabilidad, sin confundirlas con recepción o transformación de P6/P8.
`ProductionConsumption`/`ProductionOutput` no se convierten en roots.

Endpoints: lectura paginada de batches/balance conforme al contrato de queries;
no se agrega un command HTTP para editar saldo. La creación de hechos se expone
solo a través de los commands de las fases que los causan.

Services: `ProductionBatchService`, `BatchLedgerService`,
`BatchLineageService`, `BatchAvailabilityService`; repositories para batch,
ledger, balance y lineage. El ledger es append-only, bloquea bajo UoW,
impide saldo negativo y usa `operationKey` único. Se implementan DTOs tipados
para `getProductionBatch`, `getAvailableBatchQuantity`,
`validateProductionBatch` y `traceProductionBatch` como APIs internas, sin
exponer Prisma.

Permisos: lectura con `production:read`; no se inventa permiso de batch o
ledger. APIs intermodulares: ninguna escritura externa; validación futura de
Articulo queda en ArticulosApi. Auditoría de hechos de cantidad y lineage
cuando sean causados por una operación.

Pruebas de fórmula, cantidades positivas, concurrencia/locks, idempotencia,
ciclos y saldo reconstruible; integración de restricciones e índices.
Migración crea tablas, enums de `entryType` únicamente cuando estén publicados,
índices y unicidad de `operationKey`; no backfill. Depende de P2 y del
bloqueante de enum del ledger.

## 6. P4 — containers

### Alcance

Modelos: `Container` y `ContainerOccupancy`, usando exactamente los enums
existentes de `containerType`, `status` y `Unit`; no se agregan valores.

Endpoints: operaciones de gestión y movimientos de recipientes se publican
bajo `/api/v1/production` con `production:container_manage`, y las queries de
containers/ocupaciones bajo `production:read`; la forma exacta de commands se
mantiene alineada al contrato aprobado, sin rutas nuevas inventadas.

Services: `ContainerService`, `ContainerOccupancyService`,
`ContainerMovementService`; repositories de container y ocupación. Validan
disponibilidad, capacidad, igualdad exacta de unidad, ocupación exclusiva,
traslado total, traslado parcial con lineage y bloqueo de
`FUERA_DE_SERVICIO`, todo bajo UoW y locks.

APIs intermodulares: ninguna; batches se consultan por repository/service del
módulo. Permisos `production:container_manage` y `production:read`.
Auditoría de altas/cambios administrativos y cada movimiento.

Pruebas de transiciones, capacidad, unidad, ocupación concurrente, traslado
parcial/total e idempotencia. Migración crea tablas, FKs restrict, índices y
la protección de ocupaciones abiertas disponible en la base. Depende de P1,
P3 y confirmación del enum `Unit`.

## 7. P5 — works y participants

### Alcance

Modelos: `ProductionWork`, `ProductionWorkBatch`,
`ProductionWorkContainer`, `ProductionWorkParticipant`; `ProductionParticipant`
proviene de P1. No se almacenan consumos, outputs, pérdidas ni mediciones en
el trabajo.

Endpoint aprobado: `POST /api/v1/production/works`; lectura paginada de works y
relaciones con `production:read`; corrección se habilita en P10 mediante
`POST /api/v1/production/works/:id/corrections`.

Services: `ProductionWorkService`, `WorkParticipantService` y repositories de
work/uniones. El actor no entra en body; `performedAt` se distingue de
`createdAt`; no hay delete. APIs: contexto autenticado/Core, Core/Audit y
validación interna de batches/containers. Permisos
`production:work_create`, `production:participant_manage` para el catálogo y
`production:read`; no se inventa permiso para vincular batches.

Auditoría de creación y relaciones. Pruebas de cardinalidades 0..N,
orden/transformation-order, participante frente a actor, inmutabilidad y
permisos. Migración crea work y uniones con PK compuestas e índices; depende de
P2, P3, P4 y P1.

## 8. P6 — reception

### Alcance

Modelos: `GrapeReception` y `GrapeReceptionItem`, con recepción perteneciente a
una orden y productor, uno o más items, estados únicamente `ACCEPTED` y
`ACCEPTED_WITH_OBSERVATIONS`. Cada item aceptado genera atómicamente su batch
inicial y hecho `GENERATED`.

Endpoints aprobados: `POST /api/v1/production/grape-receptions` y
`POST /api/v1/production/grape-receptions/:id/corrections` (corrección se completa en
P10); query paginada de recepciones/items con `production:read`.

Services: `GrapeReceptionService`, `GrapeReceptionItemService`,
`InitialBatchGenerationService`; repositories de recepción/items. APIs:
`ArticulosApi` valida Articulo activo y clasificación autorizada; Core/Auth y
Core/Audit participan en la UoW. Inventory no participa.

Permiso `production:reception_create`; `production:reception_correct` solo
cuando P10 esté entregada; `production:read`. Auditoría de recepción, items y
generación de batches. Idempotencia por clave estable de recepción y hash.

Pruebas de mínimo un item, variedades/cantidades, estado, rechazo no persistido,
clasificación y atomicidad; integración de idempotencia y no duplicación de
batch. Migración crea recepción/items y FKs/indexes; no backfill. Depende de
P1–P3, P2, ArticulosApi, publicación de clasificación/matriz y resolución de
repetición de variedad.

## 9. P7 — measurements

### Alcance

Modelos `Measurement` y `MeasurementType` (catálogo de P1). Measurement puede
referir batch, container, work o combinación válida; no cambia cantidades,
estados ni Articulos.

Endpoints aprobados: `POST /api/v1/production/measurements` y
`POST /api/v1/production/measurements/:id/corrections` (corrección en P10);
lectura paginada con `production:read`.

Services `MeasurementService`, `MeasurementTypeService` y repositories.
`MeasurementType` se administra con `production:measurement_type_manage`; la
operación es administración de ese catálogo no histórico; la creación de
mediciones usa `production:measurement_create`. APIs Core/Auth y Core/Audit;
participante se valida dentro de Production.

Auditoría de medición. Pruebas de contexto mínimo, combinaciones válidas,
unidad/tipo, participante no actor, decimal y no modificación de dominio.
Migración crea measurement y FKs/indexes; depende de P1, P3–P5 y de tipos de
unidad contractuales.

## 10. P8 — transformations, inputs, outputs y losses

### Alcance

Modelos `Transformation`, `TransformationInput`, `TransformationOutput` y
`ProductionLoss`. Inputs son siempre batches; outputs reutilizables tienen
batch; no existe `Subproducto`, `transformationTypeId` ni conversión de
unidades. Auxiliares permanecen fuera salvo aprobación explícita de
`ProductionWorkInput`.

Endpoint aprobado: `POST /api/v1/production/transformations`; lecturas
paginadas; no se inventan endpoints separados de input/output/loss. Loss se
registra mediante el command de transformación o el command aprobado que
corresponda al contrato, con `production:loss_create`.

Services: `TransformationService`, `TransformationInputService`,
`TransformationOutputService`, `ProductionLossService`; repositories
correspondientes. UoW atómica: lock de inputs, ledger `CONSUMED`/`GENERATED` o
`LOSS`, idempotencia de la Transformation completa y auditoría. Las pérdidas se
registran dentro de ese command y no tienen retry HTTP independiente. APIs
ArticulosApi valida clasificación activa; Core/Auth/Audit. Permisos
`production:transformation_create` y
`production:loss_create`, además de lectura.

Pruebas de uno o varios inputs/outputs, cantidades parciales, cambio de
Articulo, pérdida explícita, saldo, atomicidad, hash/idempotencia y estados de
órdenes. Migración crea modelos, FKs restrict, índices y unicidades.
Depende de P2, P3, P5, P7, clasificación/matriz de Articulos, enum ledger y
semántica aprobada de `SEPARATED`.

## 11. P9 — Production → Inventory

### Alcance e integración

No se crean tablas Inventory en Production. Se implementa el adaptador tipado
para la operación pública de Inventory equivalente a
`registerProductionOutput`, cuyo resultado contiene
`inventoryLotId`, `originProductionBatchId`, `quantity`, `unit` y `movementId`.
Production registra `TRANSFERRED_TO_INVENTORY` en su ledger.

Endpoint: no se inventa endpoint HTTP de Inventory. El command de salida se
expone solo si el contrato HTTP de Production lo autoriza; su ejecución usa la
API interna tipada y no controllers de otro módulo.

Services: `ProductionInventoryTransferService`,
`ProductionOutputAdapter`; repository de ledger y lectura de batch. APIs:
`InventoryApi.registerProductionOutput` dentro de `SharedUnitOfWork`,
`ArticulosApi` según validación y Core/Audit. Permisos: no se crea permiso de
output; se usa el permiso aprobado del command que el contrato asigne y
`production:read` para lectura. Si no existe asignación contractual, queda
bloqueado, no se inventa.

Auditoría de Production e Inventory en la misma transacción lógica. Pruebas de
transferencia parcial, varios lotes Inventory, no duplicación, rollback de
cualquier fallo, idempotencia y origen conservado. Migración solo agrega
referencias/ledger necesarias en Production; no toca tablas Inventory.
Depende de P3, P8, SharedUnitOfWork y confirmación del resultado/contexto final
de `registerProductionOutput`.

## 12. P10 — trazabilidad y correcciones

### Alcance

Modelos `ProductionCorrection` y la implementación completa de correcciones
append-only. Se habilitan las correcciones de work, reception y measurement
mediante los endpoints aprobados, conservando snapshot, actor, fecha, motivo,
valor anterior y corregido. No se sobrescriben hechos cuantitativos: se
generan hechos compensatorios tipados.

Endpoints aprobados:

- `POST /api/v1/production/works/:id/corrections`;
- `POST /api/v1/production/grape-receptions/:id/corrections`;
- `POST /api/v1/production/measurements/:id/corrections`;
- `GET /api/v1/production/batches/:batchId/trace`.

Services `ProductionCorrectionService`, `ProductionTraceService` y
repositories de correcciones/consultas. La traza devuelve origen, padres,
hijos, transformaciones, trabajos, pérdidas e `InventoryLot` resultante.
APIs internas: `traceProductionBatch` y las consultas tipadas ya definidas;
InventoryApi solo para el lote resultante. Permisos de corrección específicos
(`production:work_correct`, `production:reception_correct`,
`production:measurement_correct`) y `production:read`.

Auditoría de cada corrección y traza cuando corresponda. Pruebas de razón
obligatoria, append-only, actor, snapshots, compensación, no delete, ciclos
ausentes y consistencia de la respuesta. Migración crea correction y sus
índices; estrategia polimórfica o descomposición tipada queda bloqueada hasta
aprobación. Depende de P3, P5–P9 y resolución del bloqueante de correcciones.

## 13. P11 — E2E

### Escenario y alcance

Prueba de extremo a extremo, sin agregar modelos, endpoints, permisos o reglas:
administrar catálogos en P1; crear/cerrar órdenes; recibir variedades y crear
batches; ejecutar works y ocupaciones; medir; transformar con inputs, outputs,
lineage y pérdidas; transferir parcialmente a Inventory; consultar traza;
corregir de forma explícita; y cerrar respetando precondiciones.

### Interfaces y controles

Se ejercitan todos los endpoints aprobados de P2, P5, P6, P7, P8, P9 y P10,
las queries paginadas y las cuatro APIs intermodulares tipadas. Se verifica
cada permiso aprobado, actor autenticado, auditoría Production/Inventory,
idempotencia, locks, rollback y traducción de errores. No se aceptan actors en
body, cantidades negativas, clasificación desconocida, exceso de capacidad,
duplicación de salida ni pérdida implícita.

### Pruebas y migración

Incluye tests de contrato entre Production–Articulos, Production–Inventory y
Core/Audit; integración con PostgreSQL/Prisma; concurrencia; reintentos con
misma clave y hash distinto; reconstrucción de balance; y prueba E2E de
rollback si falla auditoría. Se ejecuta sobre una base migrada desde cero y
una base con datos de prueba autorizados; no se hace backfill productivo.
Depende de todas las fases y de que no quede ningún bloqueante contractual
abierto.

## 14. Bloqueos explícitos antes de cerrar fases

Permanecen bloqueantes, sin resolución inferida: valores reales y matriz de
`Articulo.clasificacion` (salvo la clasificación inicial de la salida
Production → Inventory, resuelta como `PRODUCTO_ENVASADO`); enum `Unit`;
tensión recepción/Harvest; enum del
ledger; estrategia de correcciones; decisión sobre `ProductionWorkInput`;
contrato transaccional y resultado de Inventory; repetición de variedad; y
semántica de `SEPARATED`. Las fases que los requieren deben reportarlos como
bloqueo, no sustituirlos con valores locales.

P5.5A is implemented as backend-only work-input consumption/reversal. The
operation key is globally advisory-locked and requestHash is the canonical
SHA-256 of the semantic payload (excluding operationKey/requestHash).

## 15. P5.5B — entregado y alineado al código

P5.5B añade metadata operativa de forma aditiva: `type` es nullable para
contenedores legacy (sin backfill inventado), mientras las altas nuevas lo
requieren; `name`, `location` y `material` son nullable. El listado devuelve
`currentOccupancy` resumida. Se mantienen las rutas administrativas y de
consulta existentes y se exponen:

- `POST /api/v1/production/containers/:id/assign`;
- `POST /api/v1/production/containers/:sourceId/transfers`;
- `POST /api/v1/production/containers/:sourceId/transfers/partial`.

Los permisos dedicados son `production:container_assign` y
`production:container_transfer`; `production:container_manage` queda para el
maestro. Assign y total reciben `batchId` y el contexto opcional
`productionWorkId`, `observations`, `occurredAt`, más `operationKey` y
`requestHash`; parcial añade `quantity` y `childCode`, y total no recibe
quantity. El DTO de lectura omite `requestHash` y contiene
`productionWorkId`, `observations`, `actorUserId`, `occurredAt`.

El requestHash es SHA-256 del payload canónico (claves ordenadas, opcionales
normalizados, sin operationKey/requestHash). Work se valida por existencia y
ProductionOrder compatible; actor/fecha efectiva/observaciones quedan
estructurados. Los comandos son atómicos en `SharedUnitOfWork`; Failure C
revierte todos los efectos. No hay Inventory movement para traslados internos.
El historial es inmutable: total admite traslado inverso sólo si el estado
actual sigue compatible, no se inventa un unassign, y la reversión parcial se
no es automática en el MVP: no hay merge-back ni reversión destructiva; la
corrección requiere una nueva operación productiva válida.

El frontend debe ofrecer listado (incluyendo ocupación actual), detalle,
historial de ocupaciones y movimientos, alta/edición/activación, assign,
traslado total y parcial; debe usar confirmación, bloquear doble submit e
invalidar sólo las queries afectadas.

## 16. Cierre P5.5E — BLOCKED y futura integración

P5.5A–D son contratos entregados y alineados: WorkInput/Inventory usa
`SharedUnitOfWork`, idempotencia y reversals compensatorios; containers exponen
metadata, ocupaciones, `ASSIGNED`, `TRANSFERRED` y `PARTIAL_TRANSFERRED` con
lineage; trace cubre backward/forward; release usa
`PRODUCTO_ENVASADO`, hash canónico server-side y reversal completo con rechazo
de estado inseguro. No existe reversión automática de traslado parcial en MVP.

Las comprobaciones ejecutables y contractuales quedan **PASS**:
P5.5A PostgreSQL **5/5**, P5.5B **6/6**, P5.5D **21/21**, P5.5E **1/1**,
P10 Trace **10/10**, regresión completa de Production backend **236/236** con
**0 skipped**, Vitest frontend **20/20**, typecheck/build backend y frontend
**PASS**, `prisma validate`/`prisma generate` **PASS**, 33 migraciones aplicadas
y status actualizado, datasource configurado frente a schema **`No difference
detected`**, y `git diff --check` **PASS**.

Se añadieron exactamente dos migraciones, sin editar migraciones existentes:
`20260927000000_production_p55e_align_prisma_object_names` (alineación de
metadata) y `20260927010000_production_p55e_eliminate_schema_drift`
(eliminación de drift de `onUpdate` de FK y nombres de índices).

La aceptación operativa E2E A–F es **PASS**: **A**, BARRICA dinámica sin
cambios de código; **B**, WorkType dinámico; **C**, WorkInput estructurado y
consumo mediante InventoryMovement; **D**, movimiento físico estructurado de
recipientes; **E**, separación GrapeVariety/producto; **F**, observaciones sólo
narrativas y hechos estructurados en sus campos/entidades correspondientes.
Frontend login shell smoke **PASS** en 1440x1000 y 390x844, con consola limpia.
El smoke autenticado de Production no es ejecutable porque faltan
`WINTER_DATABASE_URL` y credenciales runtime Firebase; no se inventaron
credenciales. Por ese único bloqueo, el cierre global P5.5E queda **BLOCKED**.
Las pruebas frontend focalizadas cubren confirmaciones,
permisos, errores, historial vacío, pending/double-submit e idempotencia;
el UAT autenticado completo queda diferido. Fotos/evidencia:
`Deferred to UAT / Hardening`.

Entorno TEST autorizado: `LOCAL INTEGRATION TEST`, `127.0.0.1`,
`winter_p55_test`, PostgreSQL local, destructivo/de integración, sin acceso
productivo ni remoto; no se documentan secretos y `DATABASE_URL`/heliumdb no
son destinos permitidos. El workflow Winter Backend tiene una limitación
conocida por falta de `WINTER_DATABASE_URL` y Firebase; no se inventan
credenciales y esto no invalida typecheck, build, Prisma validation ni
integration tests.

Plan futuro, no ejecutado: `main` → `integration/production-p5` →
reconcile/cherry-pick backend, migrations, tests y contracts → PostgreSQL
migration validation → backend regression → merge main → Render deploy →
backend smoke tests → frontend integration/deploy. Despliegue: backup/check DB,
migrations, backend, backend smoke tests, frontend y frontend smoke/UAT.

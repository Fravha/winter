# Winter — panorama técnico del backend

**Alcance:** esta descripción refleja el backend que existe en `logger/`: rutas,
servicios, esquemas Zod, modelos Prisma y configuración. No toma artefactos de
frontend ni `artifacts/api-server` como evidencia. Una ruta o mecanismo descrito
como implementado no implica que esté habilitado en un entorno determinado ni
que sus datos maestros estén cargados.

## Objetivo

Winter concentra operaciones de bodega y producción en una API: maestros de
artículos, compras y sus recepciones a inventario, movimientos y saldos de stock,
y registros de producción con batches, trabajos, mediciones, recipientes,
transformaciones y trazabilidad. La intención arquitectónica es mantener
integridad entre estos dominios mediante servicios y contratos intermodulares,
en lugar de que un módulo escriba directamente las tablas de otro.

## Stack comprobado

- **Node.js** con módulos ECMAScript; TypeScript.
- **Express 5** para HTTP; **Prisma 7** con adaptador PostgreSQL (`pg`) y
  PostgreSQL como base de datos.
- **Firebase Admin/Auth** para verificar Firebase ID tokens, administrar
  identidades y enviar restablecimientos de contraseña.
- **Zod** para validar cuerpos, parámetros y queries en las rutas.
- **Pino**, **Helmet**, **cors** y **express-rate-limit** para logging y
  controles/configuración HTTP; **dotenv** para variables de entorno.
- **Multer** para multipart/archivos; **ExcelJS** para hojas de cálculo en el
  módulo de reportes. El módulo de adjuntos usa **Supabase Storage** para
  objetos; PostgreSQL conserva sus metadatos.
- **tsx**, **TypeScript** y **Prisma CLI** en el ciclo de desarrollo/build.

La presencia de una dependencia no garantiza un uso en todos los endpoints:
por ejemplo, los mecanismos de archivos corresponden a módulos específicos.

## Arquitectura y petición

```text
Client
  → API HTTP (Express; /api/v1)
  → Auth (Firebase ID token, User local) / RBAC (permisos)
  → Modules (rutas, validación, controladores)
  → Services / contratos intermodulares
  → Prisma (repositorios y límites transaccionales)
  → PostgreSQL
```

- El cliente presenta un Firebase ID token; el backend lo verifica y resuelve
  una cuenta `User` local. Firebase proporciona la identidad, mientras que la
  autorización operativa se resuelve con el usuario, rol y permisos locales.
- Las rutas componen autenticación, resolución de usuario, permiso requerido y
  validación Zod antes del controlador. Controladores traducen HTTP a comandos
  de servicios; repositorios Prisma persisten modelos del dominio.
- `DocTypeRegistry` registra módulos de negocio en el orden de sus dependencias
  y monta sus routers bajo `/api/v1`. Auth y administración de acceso se montan
  aparte. `/health` es una ruta separada.
- Cuando un flujo necesita cambios coordinados, el servicio dueño invoca APIs
  intermodulares con contexto confiable y comparte la transacción, en vez de
  exponer el cliente transaccional como dato HTTP.

## Módulos y contratos HTTP principales

Las rutas siguientes son relativas a `/api/v1`, salvo `/health`. Cada ruta
protegida requiere token y los permisos mencionados en el router.

| Módulo | Responsabilidad y entidades | Endpoints principales | Dependencias |
|---|---|---|---|
| **Auth / Users** | Verificación Firebase, resolución de `User` local, estado de cuenta y administración de identidad. | `/auth/me`, `/auth/password-reset`; `/users` (listar/crear), `/users/:id`, `PATCH /users/:id`, `POST /users/:id/activate`, `/suspend`, `/send-password-setup`. Administración bajo `users:read` / `users:manage`. | Firebase Admin y repositorio de usuarios; administración persiste en PostgreSQL y coordina Firebase cuando corresponde. |
| **Roles** | Roles y su asignación de permisos (`Role`, `RolePermission`). | `/roles`, `/roles/:id`, `PATCH /roles/:id`, `DELETE /roles/:id`, `PUT /roles/:id/permissions`; `rbac:read` / `rbac:manage`. | `Permission`, auditoría y asignaciones de usuarios. |
| **Permissions** | Catálogo de `Permission` y códigos que RBAC evalúa. | `/permissions`, `/permissions/:id`, `POST`, `PATCH` y `DELETE` bajo `/permissions`; `rbac:read` / `rbac:manage`. | Roles y auditoría; el registro de permisos de DocTypes declara permisos de los módulos de negocio. |
| **Audit** | Eventos `AuditLog`, actor, acción, recurso, metadata y contexto de request. | `GET /audit-logs`; `audit:read`. | Servicios de dominio registran eventos con el actor autenticado; la consulta usa repositorio Prisma. |
| **Artículos** | Maestro `Articulo`: código, código externo, nombre, clasificación, unidad y activo. Validación compartida para módulos consumidores. | `/articulos`, `/articulos/:id`, `POST /articulos`, `PATCH /articulos/:id`, `POST /articulos/:id/activate|deactivate`; permisos `articulos:read|create|update|activate|deactivate`. | Es dependencia de Compras, Inventory y Production. El servicio audita altas, cambios y estado; con referencias operativas impide cambiar clasificación o unidad. |
| **Compras** | Compra, líneas, proveedor capturado como datos de la compra y relación de líneas con movimientos de recepción. Entidades `Compra`, `CompraItem`, `CompraInventoryMovementReference`. | `/compras`, `/compras/:id`, `POST /compras`, `PATCH /compras/:id`, `POST /compras/:id/receive`, `/cancel`; `compras:read|create|update|receive|cancel`. | Valida `Articulo`; llama primitivas confiables de Inventory al recibir. |
| **Inventory** | Almacenes, lotes, ledger de movimientos, stock y claves de idempotencia. Entidades `Warehouse`, `InventoryLot`, `InventoryMovement`, `InventoryStock`, `InventoryIdempotency`. | `/inventory/warehouses`, `/inventory/movements`, `/inventory/stock`, `/inventory/stock/available`, `/inventory/lots/:id`; `POST /inventory/inbound`, `/outbound`, `/transfer`, `/adjustment`; permisos `inventory:*`. | Valida artículos; expone primitivas internas a Compras y Production para sus flujos atómicos. |
| **Production** | Órdenes, recepción de uva, batches, trabajos, mediciones, recipientes/ocupaciones, transformaciones, pérdidas y trazabilidad. | `/production/orders`, `/transformation-orders`, `/grape-receptions`, `/batches` (lectura/trace/balance/releases), `/works`, `/measurements`, `/transformations`, `/containers` y catálogos; permisos `production:*`. | Usa Artículos, Inventory para consumos y releases, y auditoría. Comparte límites transaccionales con Inventory en operaciones intermodulares. |

Production también contiene catálogos de participantes, productores,
variedades, tipos de trabajo y medición, además de campos personalizados para
productor, variedad y recepción. La ruta `/production/batches` es de consulta:
la creación de batches resulta de operaciones de recepción, transformación o
separación parcial de un batch, no de un `POST /batches` público.

## Seguridad y autorización (RBAC)

El flujo es **Firebase ID token → `User` local → `Role` → `Permission`**.
`authenticate` verifica el token; `resolveCurrentUser` busca el usuario local
con roles y permisos; `requirePermission` exige un permiso explícito para la
ruta. Una cuenta tiene asignación de rol singular según el modelo `UserRole`
(`userId` único); el rol puede tener varios permisos mediante
`RolePermission`.

La convención de permisos se expresa como `<módulo>:<acción>` (por ejemplo,
`inventory:transfer`, `production:work_create` y `articulos:read`). Hay también
permisos de control administrativo compartidos, como `rbac:manage`, y permisos
de seguridad como `audit:read`. El código de una ruta es la autoridad efectiva;
no se debe inferir permiso sólo por la pantalla o el nombre de un rol.

## Inventory: historial, saldos y autorización de stock negativo

- `InventoryMovement` conserva los hechos del movimiento y los valores de stock
  antes/después; los comandos HTTP implementados crean movimientos, no ofrecen
  una ruta para editar o borrar ese historial.
- `InventoryStock` es el saldo materializado por almacén, artículo y lote. Los
  comandos actualizan saldo y escriben el movimiento en la misma transacción;
  los GET de stock consultan ese saldo.
- Entrada y salida registran cantidades; transferencia reduce el origen y
  aumenta el destino y registra tipo `TRANSFER`; ajuste registra la dirección.
  Todos validan artículo activo, unidad base, almacén y, si aplica, pertenencia
  del lote al artículo.
- Los comandos públicos de movimientos están protegidos por permiso y reciben
  una clave de idempotencia. Se guarda huella de la solicitud y respuesta: una
  repetición con misma clave y mismo payload devuelve el resultado previo; la
  clave reutilizada con operación o payload diferente produce
  `IDEMPOTENCY_CONFLICT` (409).
- Una operación que deja stock negativo requiere petición explícita de
  autorización, motivo no vacío y permiso `inventory:negative_stock_authorize`.
  Si falta la autorización explícita o el motivo, responde conflicto; si el
  usuario no tiene el permiso, responde prohibido. El movimiento conserva actor,
  autorización y motivo.
- Los flujos de Compras y Production llaman primitivas de Inventory dentro de
  una transacción compartida: la entrada recibida de compra, consumos de
  insumos, liberación de producto terminado y sus referencias/auditoría quedan
  coordinados con sus entidades de origen.

## Production: ciclo y vínculos

- `ProductionOrder` agrupa operaciones de producción. Puede tener
  `TransformationOrder` con períodos, estado OPEN/CLOSED y trabajos y
  transformaciones vinculados.
- `GrapeReception` referencia orden, productor, variedad y artículo; sus items
  dan cantidad/unidad y originan batches. La recepción usa operación idempotente.
- `ProductionBatch` identifica un artículo, orden y unidad. Su ledger registra
  generación, consumo, separación, pérdida y transferencia a Inventory; el
  `ProductionBatchBalance` materializa generado, consumido, separado, perdido,
  transferido y disponible. `ProductionBatchLineage` enlaza lotes padre/hijo.
  Las consultas de trace combinan linaje, ledger, recepciones, transformaciones,
  mediciones, trabajos y recipientes.
- `ProductionWork` vincula orden, tipo de trabajo, fecha, actor y opcionalmente
  TransformationOrder. Puede enlazar batches, recipientes y participantes.
  `ProductionWorkInput` conecta consumo de un artículo en Inventory con el
  trabajo y la referencia a su movimiento; la reversión crea movimiento
  compensatorio y mantiene la historia.
- `ProductionMeasurement` guarda un valor decimal y unidad con referencia
  opcional a batch, recipiente o trabajo, tipo, actor, fecha y observaciones.
  Correcciones tienen registros propios y versionado.
- `ProductionContainer` representa un tanque, barrica u otro recipiente;
  `ProductionContainerOccupancy` modela una ocupación en el tiempo. Los
  movimientos registran asignación, traslado total o parcial. El traslado
  parcial puede crear batch hijo y linaje. Son movimientos internos de proceso,
  no movimientos de Inventory.
- Una transformación registra inputs, outputs, pérdidas opcionales, withdrawals
  físicos desde ocupaciones, ubicaciones de salida, ledger, balances y lineage.
  Genera batches de salida dentro de la misma operación. Hay claves de operación
  con hash del payload para replay idempotente y detección de conflicto.
- Liberar un batch a Inventory crea lote de inventario clasificado inicialmente
  `PRODUCTO_ENVASADO`, movimiento de entrada y relación `ProductionInventoryRelease`.
  La reversión agrega un movimiento compensatorio y conserva el release original;
  no autoriza stock negativo.

## Compras: alcance del dato comercial y recepción

El flujo implementado es **`Compra` → `CompraItem` → recepción → movimiento
Inventory → saldo**. Una compra registrada se puede actualizar; al recibirse
cambia a `RECEIVED`, genera entrada de inventario y guarda referencia por línea
al movimiento; sólo una compra `REGISTERED` se puede cancelar. La recepción
valida todos los artículos/unidades y se ejecuta en transacción compartida con
Inventory y auditoría.

Proveedor (`supplierName`, `supplierTaxId`), moneda, número/fecha de documento y
marca (`brand`) son campos de la compra/línea. La marca es texto opcional;
precio unitario (`unitPrice`) es decimal opcional. No son referencias a
catálogos normalizados de proveedores, marcas o listas de precios en el esquema
actual: son información referencial/documental de la compra.

## Integridad y persistencia

- `SharedUnitOfWork` ejecuta transacciones Prisma en aislamiento `Serializable`
  con hasta tres reintentos adicionales por conflicto serializable/deadlock;
  timeout opcional se valida de forma acotada. Los módulos también poseen
  límites transaccionales propios cuando corresponde.
- Hay validaciones de request con Zod y validaciones de dominio en servicios
  (existencia/estado, unidad, cantidades, relaciones, estados de órdenes,
  claves y concurrencia). Las FK Prisma/PostgreSQL conectan usuarios, artículos,
  lotes, almacenes, órdenes y registros operacionales; varias relaciones
  históricas usan `onDelete: Restrict`, mientras tablas de asignación permiten
  cascadas explícitas.
- Los comandos intermodulares usan transacción compartida y primitivas de
  servicio, de modo que ledger/saldo, entidad origen, referencias y auditoría
  requeridas puedan confirmarse o revertirse juntos. Las reglas concretas son
  por flujo; no toda operación del API implica una transacción entre módulos.
- Cantidades de Inventory y producción se modelan como `Decimal(18,3)` y las
  mediciones como `Decimal(18,6)`; precios de compra usan decimal, no coma
  flotante binaria. Los servicios normalizan/validan límites de precisión antes
  de persistir.
- `AuditLog` conserva actor, acción, tipo/ID de recurso, metadata, IP/request ID
  y fecha. El actor se deriva de la autenticación, no de un campo libre del
  cuerpo para las operaciones auditadas.

## Panorama del esquema Prisma

El schema PostgreSQL agrupa:

1. **Identidad y acceso:** `users`, `roles`, `permissions`, `user_roles`,
   `role_permissions`, `audit_logs`.
2. **Maestros y adjuntos:** `articulos`, `attachments`.
3. **Compras:** `compras`, `compra_items`, referencias a movimientos.
4. **Inventario:** almacenes, lotes, saldos, movimientos e idempotencia.
5. **Producción:** órdenes y TransformationOrders; recepciones, catálogos,
   batches, ledger/balance/lineage/operaciones; trabajos, inputs, participantes,
   mediciones y correcciones; recipientes, ocupaciones y movimientos; pérdidas,
   transformaciones y releases/reversiones a Inventory.
6. **Campos extensibles:** definiciones y valores de campos personalizados de
   producción.

El schema evita duplicar el mismo conjunto de tablas aquí; los nombres
anteriores son agrupaciones por dominio, no una lista exhaustiva de modelos.

## Dos operaciones de punta a punta

### Compra de insumo a stock

```text
POST /compras
  → validar artículos, unidades y cantidades
  → Compra + CompraItem + auditoría
POST /compras/:id/receive (almacén)
  → transacción compartida Compra + Inventory
  → InventoryMovement INBOUND + actualización InventoryStock
  → CompraInventoryMovementReference + auditoría
GET /inventory/stock (o /stock/available)
```

Los servicios confirman la recepción como un todo; no es el cliente quien
escribe saldos ni inventa referencias de movimientos.

### Recepción y elaboración de un batch

```text
POST /production/orders
  → POST /production/grape-receptions
  → batch inicial + ledger/balance + trazabilidad
  → POST /production/works y opcionalmente /measurements
  → POST /production/transformations
      inputs consumidos + pérdidas + outputs/batches + lineage
      + reconciliation de recipientes cuando se envía
  → GET /production/batches/:id/trace
  → opcional POST /production/batches/:id/release-to-inventory
```

Un trabajo puede consumir insumo Inventory mediante
`POST /production/works/:id/inputs`; transforma stock mediante Inventory y
registra su procedencia en el trabajo. Un traslado entre recipientes no crea
por sí solo `InventoryMovement`.

## Estado de implementación y límites

**Lo verificable en el código:** están registrados servicios y rutas de los
módulos descritos; hay contratos intermodulares de Artículos e Inventory,
operaciones de compras, flujos de producción, auditoría, validaciones y controles
de acceso. Esto describe capacidad de código, no configuración, disponibilidad,
datos ni aceptación de negocio en un entorno.

**Observación operacional, no garantía del código:** en la verificación
pre-demo previa a esta redacción se reportó **PASS** para la
regresión de staging (incluidos casos A1 y Golden de Production).
Tras una limpieza de datos técnicos autorizada y confirmada por postcheck de
solo lectura, producción conservó 429 artículos oficiales, 9 almacenes
y los demás maestros esperados; no quedaron los movimientos ni stocks de prueba
identificados. Estos resultados son una fotografía de esa
verificación, **no** una propiedad asegurada por el código ni una comprobación
en tiempo real para una futura demo. El backup manual fue confirmado por el
administrador, no verificado desde este workspace. Aún no se cargó stock
físico inicial ni la fotografía actual de bodega: requieren fuentes reales.

Limitaciones y precauciones visibles:

- La medición tiene valor numérico decimal, unidad y observaciones; no tiene un
  valor cualitativo tipado. No representar resultados cualitativos estructurados
  como si ya tuvieran soporte.
- `transformationOrderHasIncompleteOperations` actualmente devuelve siempre
  `false`. El cierre de TransformationOrder por ahora no realiza una búsqueda
  real de operaciones incompletas, aunque la capa de servicio tiene el hook.
- No hay `POST /production/batches` público. Usar las rutas de recepción,
  transformación y separación que crean batches, no asumir una ruta CRUD de
  batch.
- Las cantidades/unidades son explícitas; las rutas no implementan conversión
  general entre unidades. Los valores cualitativos, conversiones físicas o
  reglas no validadas en el servicio requieren decisión/implementación antes de
  depender de ellas.
- `lib/api-spec/openapi.yaml` contiene `/healthz`, mientras este backend monta
  `/health` y numerosas rutas `/api/v1`; por tanto ese spec no representa el
  contrato actual de `logger`. También hay texto de planificación desactualizado
  en `logger/docs/production-api.md`: su sección inicial dice que ciertos
  flujos quedan fuera de P2 aunque sus secciones posteriores y el router ya
  documentan/implementan esos flujos. Prevalecen rutas, esquemas y servicios.
- No se ejecutaron pruebas ni consultas a la base para elaborar estos documentos.
  Las observaciones operativas anteriores proceden de la validación previa
  de esta sesión.

## Principios técnicos

1. **Trazabilidad:** movimientos, ledger de batches, lineage y auditoría
   explican el origen y efecto de operaciones.
2. **Consistencia:** servicios validan reglas de dominio y relaciones; PostgreSQL
   mantiene FK y tipos decimales.
3. **Atomicidad:** una operación que coordina dominios comparte la transacción
   del flujo; errores evitan estados parciales en esos comandos.
4. **Modularidad:** módulos colaboran mediante APIs/servicios explícitos, no
   mediante escrituras ajenas a sus tablas.
5. **Auditabilidad:** la identidad del actor y las acciones relevantes forman
   parte de los registros del workflow.
6. **Reintento seguro donde existe:** idempotencia es específica de comandos que
   aceptan operation key/idempotency key; no es una garantía global de todos los
   endpoints.

## Referencias de implementación consultadas

- Arranque, configuración HTTP y composición: `logger/src/server.ts`,
  `logger/src/app.ts`, `logger/src/routes/index.ts`.
- Dependencias: `logger/package.json`.
- Auth, Firebase y RBAC: `logger/src/infrastructure/identity/firebase-token-verifier.ts`,
  `logger/src/core/auth/`, `logger/src/core/access-control/`,
  `logger/src/modules/access-management/`.
- Registro de módulos y permisos: `logger/src/modules/doc-types/`,
  `logger/src/modules/{articulos,compras,inventory,production}/*.doc-type.ts`.
- Rutas y servicios de Artículos: `logger/src/modules/articulos/`.
- Rutas, servicio e integración de Compras: `logger/src/modules/compras/`.
- Rutas, servicio, stock, movimientos e idempotencia de Inventory:
  `logger/src/modules/inventory/`.
- Rutas, órdenes, batches, trabajo, mediciones, recipientes y transformaciones:
  `logger/src/modules/production/`.
- Transacción compartida y auditoría: `logger/src/core/database/shared-unit-of-work.ts`,
  `logger/src/core/audit/`.
- Modelo de datos: `logger/prisma/schema.prisma`.
- Auditoría: `logger/src/modules/access-management/audit-logs/audit-log.routes.ts`.
- Contraste de OpenAPI: `lib/api-spec/openapi.yaml`.
- Contratos y notas consultados para contraste, no como prueba superior al
  código: `logger/docs/api/`, `logger/docs/architecture/`,
  `logger/docs/BACKEND_HANDOFF.md`.
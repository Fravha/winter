# Winter Backend Handoff

## 1. Estado

- Backend MVP completado.
- P1–P11 completados.
- Limpieza legacy completada.
- 33 migraciones oficiales.
- Suite local verificada: P5.5A PostgreSQL **5/5**, P5.5B **6/6**, P5.5D
  **21/21**, P5.5E **1/1**, P10 Trace **10/10** y regresión Production
  backend **236/236**, con **0 skipped**, sobre PostgreSQL local.
- Drift validado en cero.
- El frontend aún no forma parte de este repositorio de entrega.

La documentación API en [`docs/api/`](./api/README.md) es el contrato técnico
para el frontend. Los módulos históricos retirados no son APIs ni permisos
actuales.

## 2. Stack

- Node.js
- Express 5
- TypeScript
- Prisma 7
- PostgreSQL
- Firebase Admin/Auth
- Supabase Storage
- Zod
- Multer para multipart
- Pino para logging

## 3. Módulos

- Auth/RBAC
- Artículos
- Compras
- Inventory
- Production
- Attachments
- Auditoría e infraestructura compartida

Las rutas y payloads de cada módulo están en `docs/api/`; este handoff solo
resume arquitectura y operación para evitar duplicación.

## 4. Variables de entorno

### Runtime y aplicación

- `NODE_ENV`: `development`, `test` o `production`; por defecto
  `development`.
- `PORT`: puerto HTTP entero; por defecto `3000`.
- `CORS_ORIGINS`: orígenes separados por comas; por defecto
  `http://localhost:5173`.
- `LOG_LEVEL`: nivel Pino (`fatal`, `error`, `warn`, `info`, `debug`, `trace`
  o `silent`); por defecto `info`.
- `RATE_LIMIT_WINDOW_MS`: ventana del rate limiter; por defecto `900000`.
- `RATE_LIMIT_MAX`: máximo de requests por ventana; por defecto `100`.
- `TRUST_PROXY`: booleano para la configuración de Express.
- `SHUTDOWN_TIMEOUT_MS`: timeout de cierre; por defecto `10000`.

### PostgreSQL / Prisma

- `WINTER_DATABASE_URL`: connection string requerido por la aplicación y por
  Prisma.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`:
  valores de apoyo del entorno local descrito en `.env.example`.

### Firebase

- `FIREBASE_WEB_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

`FIREBASE_PRIVATE_KEY` admite saltos de línea escapados como `\n`. Ninguna de
estas variables debe incluirse con valores reales en documentación, commits o
clientes.

### Supabase Storage

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `ATTACHMENTS_BUCKET`, por defecto `winter-attachments`
- `ATTACHMENTS_SIGNED_URL_SECONDS`, por defecto `300`

`SUPABASE_SECRET_KEY` es exclusivamente backend-only. El bucket de adjuntos
debe ser privado; el backend comprueba esa condición antes de subir, consultar
o firmar un objeto.

### Testing

Los tests de integración aceptan variables de conexión aisladas por suite,
incluidas `P1_DATABASE_URL` a `P10_DATABASE_URL`,
`P10_5_DATABASE_URL`, `P11_E2E_DATABASE_URL`,
`P11_INVENTORY_DATABASE_URL` y `P11_HARDENING_DATABASE_URL` cuando la suite
correspondiente las requiere. También existen recursos temporales definidos por
los helpers de tests. Nunca apuntar una base de integración a la base de
desarrollo: el helper rechaza esa reutilización.

## 5. Instalación y operación

Desde `logger/`:

```bash
npm install
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

Scripts reales de `package.json`:

- `npm run dev`: `tsx watch src/server.ts`.
- `npm run build`: limpia `dist`, genera Prisma, compila TypeScript y empaqueta
  el cliente Prisma.
- `npm start`: ejecuta `dist/server.js`.
- `npm run typecheck`: `tsc --noEmit`.
- `npm test`: suite Node/tsx serializada.
- `npm run db:generate`: `prisma generate`.
- `npm run db:validate`: `prisma validate`.
- `npm run db:migrate`: `prisma migrate dev`.
- `npm run db:migrate:deploy`: `prisma migrate deploy`.
- `npm run db:seed`: `prisma db seed`.

Para inspección del estado se puede ejecutar `npx prisma migrate status`.
`migrate diff` se utiliza para comprobar drift contra el schema real. No usar
`prisma db push` en este backend.

## 6. Base de datos y transacciones

Las migraciones Prisma son la fuente versionada del esquema. Los despliegues
aplican migraciones con `prisma migrate deploy`; el estado y el drift deben
comprobarse antes de entregar.

`SharedUnitOfWork` coordina workflows que escriben en más de un agregado:

- usa transacciones PostgreSQL `Serializable`;
- reintenta de forma acotada, con 3 reintentos posteriores por defecto;
- reconoce `P2034`, conflictos `40001` y deadlocks `40P01`, incluidos errores
  anidados del driver;
- no hace reintentos ilimitados.

Las suites de integración usan bases separadas/temporales para no contaminar la
base de desarrollo.

## 7. Auth y RBAC

El flujo real es:

```text
Firebase ID Token → middleware → User local → Role único → Permissions
```

Las rutas componen autenticación, resolución del usuario local y autorización
por permiso. Los permisos se registran junto con los DocTypes y se evalúan en
middleware; el frontend debe consultar los documentos API del módulo y no
inventar códigos.

## 8. Flujos de negocio

### Inventory

`InventoryMovement` es el historial y fuente de verdad de los movimientos.
`InventoryStock` es el saldo materializado que se actualiza dentro de los
workflows transaccionales.

Inventory expone además una consulta de solo lectura del historial mediante:

```text
GET /api/v1/inventory/movements
```
La consulta utiliza articuloId como criterio principal y permite filtrar
opcionalmente por almacén, lote y tipo de movimiento. La respuesta incorpora
datos legibles de artículo, almacén origen, almacén destino y lote cuando
corresponde, evitando que el frontend dependa de UUID de lote como mecanismo
principal de consulta.

### Production

El flujo principal conecta:

```text
ProductionOrder
→ GrapeReception
→ ProductionBatch
→ Work / Container / Measurement
→ Transformation / Loss
→ Batch
→ Inventory
→ Trace
```

Las precondiciones y permisos de cada command están en
[`PRODUCTION_API.md`](./api/PRODUCTION_API.md).

### Compras

```text
Compra
→ Receive
→ InventoryMovement
→ InventoryStock
```

La integración se realiza dentro de las operaciones transaccionales
correspondientes y se describe en [`COMPRAS_API.md`](./api/COMPRAS_API.md).

### Attachments

PostgreSQL conserva metadatos y Supabase Storage conserva los objetos en bucket
privado. Las descargas usan URLs firmadas temporales. La subida compensa el
objeto si falla la persistencia de metadatos/auditoría; si la compensación
falla, el backend devuelve un error explícito para limpieza operativa.

## 9. Auditoría

Las operaciones usan el actor autenticado resuelto por el backend. Los eventos
de auditoría forman parte de los workflows atómicos cuando la operación los
requiere. El actor no se acepta desde el body del request.

## 10. Idempotencia

La idempotencia no es global: solo aplica a los commands que la documentación
del módulo marca con `Idempotency-Key` u `operationKey`. Esos módulos definen
replay y conflicto de payload. Attachments no declara ninguna de esas claves
en su API actual.

## 11. Concurrencia

Los workflows críticos usan aislamiento `Serializable`, locks explícitos donde
corresponde y retries acotados. Las señales de retry reconocidas son Prisma
`P2034` y PostgreSQL `40001`/`40P01`. El límite evita repetir indefinidamente
una operación contra una base no disponible.

## 12. Testing

Suite completa:

```bash
npm test
```

Validaciones de entrega:

```bash
npm run db:validate
npm run db:generate
npm run typecheck
npm test
npm run build
git diff --check
```

Las suites de integración requieren sus variables de base aislada cuando están
configuradas. No se afirma ejecución de P5.5A/P5.5B PostgreSQL porque sus URLs
no están disponibles.

## 13. Decisiones diferidas

No se registran decisiones funcionales abiertas en este handoff. Cualquier
extensión debe primero contrastarse con el contrato de `docs/api/`, las rutas,
schemas, DTOs y DocTypes actuales, sin reintroducir APIs históricas.

## 14. Frontend readiness

El contrato que debe consumir el frontend es exclusivamente:

```text
logger/docs/api/*
```

El frontend no debe deducir rutas desde documentos históricos, modelos Prisma o
implementaciones internas. Debe respetar autenticación, permisos, enums,
representación decimal/fecha, paginación e idempotencia indicados por cada
documento.

The P5.5A endpoints are `/production/works/:id/inputs` and
`/production/works/:workId/inputs/:inputId/reverse`. Production never writes
Inventory tables directly: both commands use trusted Inventory primitives,
atomic shared transactions, idempotent replay/conflict handling and explicit
compensating reversal.

## P5.5B — handoff de recipientes

La migración es aditiva: `type` permanece nullable en contenedores legacy y no
se inventa un backfill; las altas nuevas requieren `TANQUE|BARRICA|OTRO`.
`name`, `location` y `material` son nullable. El listado incluye
`currentOccupancy` resumida sin N+1. Se mantienen las rutas administrativas y
de lectura y se publican assign, transferencia total y parcial, con
`production:container_assign`/`production:container_transfer` separados de
`production:container_manage`. Los bodies exactos están en
`PRODUCTION_API.md`; total no recibe quantity y parcial exige quantity y
childCode.

Movement DTO incluye `productionWorkId`, `observations`, `actorUserId` y
`occurredAt`, nunca `requestHash`. Work se valida por orden compatible, el
actor viene de autenticación y el hash canónico SHA-256 excluye las claves de
idempotencia. `SharedUnitOfWork` y Failure C garantizan rollback de todos los
efectos. Traslados internos no escriben InventoryMovement.

El historial es inmutable. Total admite traslado inverso sólo si el estado
permanece compatible; no se inventa un unassign. La compensación parcial no es
automática en MVP: no hay merge-back ni reversal destructivo. El frontend debe
cubrir lista/detalle, ocupación actual e histórica, movements, assign, total y
parcial, con confirmación y bloqueo de doble envío.

## P5.5E — cierre documental BLOCKED

El contrato vigente incluye release
`POST /api/v1/production/batches/:batchId/release-to-inventory` y reversal
`POST /api/v1/production/batches/:batchId/releases/:releaseId/reverse`, con
`production:inventory_release` y `production:inventory_release_reverse`.
La clasificación inicial es `PRODUCTO_ENVASADO`; el hash es canónico y
server-side; la reversión es completa, append-only, rechaza estados inseguros y
no autoriza stock negativo. `PRODUCTION_API.md` es la lista pública completa de
rutas, permisos, DTOs y errores.

### Entorno y limitación operativa

La regresión destructiva usa `LOCAL INTEGRATION TEST` en `127.0.0.1`, base
`winter_p55_test`, PostgreSQL local, sin acceso a producción/remoto. No se
guardan valores de `P55A_DATABASE_URL`, `P55B_DATABASE_URL` ni otras
credenciales; `DATABASE_URL`/heliumdb no son destinos autorizados. El workflow
Winter Backend no inicia sin `WINTER_DATABASE_URL` y configuración Firebase.
No se inventan credenciales; esto no invalida typecheck, build, Prisma
validation ni integration tests.

### Evidencia de cierre y bloqueo

Las comprobaciones ejecutables/backend contractuales quedan **PASS** con esta evidencia
auditable: P5.5A PostgreSQL **5/5**, P5.5B **6/6**, P5.5D **21/21**, P5.5E
**1/1**, P10 Trace **10/10**, regresión completa de Production backend
**236/236**, **0 skipped**, Vitest frontend **20/20**, typecheck y build de
backend/frontend **PASS**, y `prisma validate`/`prisma generate` **PASS**.
Se aplicaron **33 migraciones** y el estado está actualizado; la comparación
del datasource configurado contra el schema devuelve exactamente **`No
difference detected`**. `git diff --check` **PASS**.

Se aplicaron dos migraciones nuevas, sin editar ninguna migración existente:
`20260927000000_production_p55e_align_prisma_object_names` (alineación de
nombres de metadata) y `20260927010000_production_p55e_eliminate_schema_drift`
(eliminación del drift de `onUpdate` de FK y nombres de índices).

### Aceptación operativa

Las aserciones E2E dejan A–F en **PASS**: **A**, BARRICA dinámica sin cambios
de código; **B**, WorkType dinámico; **C**, WorkInput estructurado y consumo
mediante InventoryMovement; **D**, movimiento físico estructurado de
recipientes; **E**, separación GrapeVariety/producto; **F**, observaciones sólo
narrativas mientras los hechos estructurados viven en sus campos/entidades
correspondientes. Las pruebas frontend focalizadas cubren
confirmaciones de trace/release/reversal, estados de permisos, errores,
historial vacío, estado pending/double-submit e idempotencia.

El login shell frontend pasa en desktop **1440x1000** y mobile **390x844**, con
consola del navegador limpia. El smoke autenticado de la página Production no
es ejecutable en este entorno porque Winter Backend carece de
`WINTER_DATABASE_URL` y credenciales runtime de Firebase; no se inventaron
credenciales. Por ello el cierre P5.5E global queda **BLOCKED**, únicamente
por el smoke manual autenticado de Production que no pudo ejecutarse. El UAT
autenticado completo queda diferido. Fotos/evidencia quedan `Deferred to UAT /
Hardening`. El reporte obligatorio y su matriz DoD están en
`P5.5E_PRODUCTION_BLOCK_CLOSURE.md`.

El inventario se clasificó revisando los archivos modificados de cada commit:

| Orden | Commit | Clasificación | Evidencia de archivos |
|---:|---|---|---|
| 1 | `09c0a26` | FRONTEND | `artifacts/sistema-produccion/src/features/inventory/**`, navegación y tipos Inventory |
| 2 | `86b7117` | MIXED | docs/contracts, `logger/src/modules/production/**`, tests |
| 3 | `721fdc8` | FRONTEND | `artifacts/sistema-produccion/src/features/production/**` catalogs/orders |
| 4 | `13f7886` | MIXED | docs, production reception code, schemas and tests |
| 5 | `15d6608` | FRONTEND | frontend receptions/batches API, hooks, schemas and types |
| 6 | `b9ea32c` | FRONTEND | frontend works/measurements API, views, schemas and types |
| 7 | `0c78f59` | MIXED | frontend transformations plus Production docs/backend schema/code |
| 8 | `5a9ca01` | MIXED | frontend work inputs plus Prisma, Inventory and Production backend |
| 9 | `9465139` | MIXED | frontend containers plus migrations, Prisma and Production backend |
| 10 | `ef0a01b` | TEST | integration-test fixtures and P5.5A/P5.5B tests only |
| 11 | `54a9cef` | MIXED | frontend trace plus Production trace code/tests and lockfile |
| 12 | `58c67ad` | MIXED | frontend release UI/tests plus migrations, Prisma and Inventory backend |

Chronological dependency order is exactly the table order. `09c0a26` supplies
the Inventory frontend/API context; `86b7117` establishes the reconciled
Production contract; `721fdc8` depends on that contract; reception hardening
(`13f7886`) precedes its frontend (`15d6608`), followed by works/measurements
(`b9ea32c`), transformations (`0c78f59`), work-input Inventory integration
(`5a9ca01`), containers (`9465139`), fixture corrections (`ef0a01b`), trace
(`54a9cef`) and release/reversal (`58c67ad`) last. Do not reorder migrations
or cherry-pick P5.5D before its backend prerequisites.

Plan no ejecutado: `main` → `integration/production-p5` → reconcile/cherry-pick
backend, migrations, tests and contracts → PostgreSQL migration validation →
backend regression → merge main → Render deploy → backend smoke tests →
frontend integration/deploy. Frontend MUST NOT deploy before Render/backend
supports every P5 contract used by the frontend; deployment order is
backup/check DB, migrations, backend, backend smoke tests, frontend, then
frontend smoke/UAT.

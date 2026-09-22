# Winter Backend Handoff

## 1. Estado

- Backend MVP completado.
- P1–P11 completados.
- Limpieza legacy completada.
- 25 migraciones oficiales.
- Línea base validada: 279/279 tests, 0 fallos y 0 skips.
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
configuradas. Hay cobertura de contratos HTTP, servicios, PostgreSQL,
concurrencia, producción, RBAC y Storage mediante providers controlados. La
línea base de este handoff es 279/279, sin fallos ni skips.

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
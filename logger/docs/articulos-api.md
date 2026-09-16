# API de Artículos

Esta es la guía de prueba manual del contrato HTTP implementado. La base completa
es `/api/v1/articulos`. Todas las rutas requieren `Authorization: Bearer <Firebase
ID Token>` y el permiso indicado. En las rutas con body se envía también
`Content-Type: application/json`; `x-request-id` es opcional. No se usa
`Idempotency-Key` en este módulo.

Los errores tienen siempre esta forma (en entornos no productivos pueden incluir
`details`):

```json
{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed","requestId":"req-123"}}
```

## Modelo y valores permitidos

```json
{
  "id":"uuid","codigo":"MP-0001","codigoExterno":"ERP-1",
  "nombre":"Uva blanca","clasificacion":"MATERIA_PRIMA",
  "unidadMedida":"KG","activo":true,
  "createdAt":"2025-01-01T00:00:00.000Z",
  "updatedAt":"2025-01-01T00:00:00.000Z"
}
```

`clasificacion` puede ser `MATERIA_PRIMA`, `INSUMO_ENOLOGICO`,
`MATERIAL_ENVASE`, `MATERIAL_EMPAQUE`, `PRODUCTO_PROCESO`,
`PRODUCTO_ENVASADO` o `PRODUCTO_TERMINADO`. `unidadMedida` puede ser `KG`, `G`,
`L`, `M` o `UNIDAD`. `codigo` es único sin distinguir mayúsculas; puede repetirse
el nombre y `codigoExterno`. No hay conversiones automáticas ni carga masiva Odoo.

## Endpoints

### 1. Listar — `GET /api/v1/articulos`

- **Permiso:** `articulos:read`.
- **Headers:** `Authorization: Bearer <token>`; `x-request-id` opcional; sin
  `Idempotency-Key`.
- **Path/query:** query opcional:
`page` entero >=1 (default 1), `pageSize` entero 1..100 (default 20),
`search` texto no vacío, `clasificacion` con los valores anteriores y `activo`
`true|false` (se transforma a boolean). La query es validada y se ordena por
`codigo` ascendente.
- **Body:** no body.
- **Éxito (200):**

```json
{"data":[],"meta":{"page":1,"pageSize":20,"total":0,"totalPages":0}}
```

- **Errores:** `401 AUTH_MISSING_TOKEN|AUTH_INVALID_HEADER`, `403
AUTH_USER_NOT_REGISTERED|AUTH_USER_INACTIVE|AUTH_FORBIDDEN`, `400
VALIDATION_ERROR`.
- **Reglas:** la respuesta usa paginación `page/pageSize/total/totalPages`.

### 2. Obtener — `GET /api/v1/articulos/:id`

- **Permiso:** `articulos:read`.
- **Headers:** `Authorization: Bearer <token>`; `x-request-id` opcional; sin
  `Idempotency-Key`.
- **Path/query:** `id` UUID validado; sin query.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"MP-0001","codigoExterno":"ERP-1","nombre":"Uva blanca","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}}
```
- **Errores:** `400 VALIDATION_ERROR`, `404 ARTICULO_NOT_FOUND` y errores de
  autenticación/autorización.
- **Reglas:** las referencias históricas no se modifican.

### 3. Crear — `POST /api/v1/articulos`

- **Permiso:** `articulos:create`.
- **Headers:** Authorization, `Content-Type: application/json`; `x-request-id`
  opcional; sin `Idempotency-Key`.
- **Path/query:** ninguno.
- **Body completo:**

```json
{"codigo":"MP-0001","codigoExterno":"ERP-1","nombre":"Uva blanca","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG"}
```

`codigo`, `nombre` y, si existe, `codigoExterno` se recortan y no pueden quedar
vacíos. El schema actual elimina los campos desconocidos; `id`, fechas y
`activo` no forman parte del contrato y no controlan los valores persistidos.
- **Éxito (201):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"MP-0001","codigoExterno":"ERP-1","nombre":"Uva blanca","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-01T00:00:00.000Z"}}
```
- **Errores:** `400 VALIDATION_ERROR`, `409 ARTICULO_CODE_ALREADY_EXISTS`.
- **Reglas:** se crea activo y `codigo` es único sin distinguir mayúsculas.

### 4. Actualizar — `PATCH /api/v1/articulos/:id`

- **Permiso:** `articulos:update`.
- **Headers:** Authorization, `Content-Type: application/json`; `x-request-id`
  opcional; sin `Idempotency-Key`.
- **Path/query:** `id` UUID validado; sin query.
- **Body completo:** debe incluir al menos un campo.

```json
{"codigoExterno":null,"nombre":"Uva blanca seleccionada","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG"}
```

Todos los campos son opcionales: `codigoExterno` string no vacío o `null`,
`nombre` no vacío, `clasificacion` y `unidadMedida` de los enums. `codigo` no
puede cambiar y `activo` solo cambia con los comandos siguientes.
- **Éxito (200):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"MP-0001","codigoExterno":null,"nombre":"Uva blanca seleccionada","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-02T00:00:00.000Z"}}
```
- **Errores:** `400 VALIDATION_ERROR`, `404 ARTICULO_NOT_FOUND`, `409
  ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE` cuando ya hay referencias operativas
  de inventario, compras o producción.
- **Reglas:** después de una referencia operativa se mantienen editables
  `nombre` y `codigoExterno`, pero no `clasificacion` ni `unidadMedida`.

### 5. Activar — `POST /api/v1/articulos/:id/activate`

- **Permiso:** `articulos:activate`.
- **Headers:** Authorization; `x-request-id` opcional; sin `Idempotency-Key`.
- **Path/query:** `id` UUID; sin query.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"MP-0001","codigoExterno":"ERP-1","nombre":"Uva blanca","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":true,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-03T00:00:00.000Z"}}
```
- **Errores:** `400 VALIDATION_ERROR`, `404 ARTICULO_NOT_FOUND`, `401/403`.
- **Reglas:** activación lógica e idempotente respecto al estado.

### 6. Desactivar — `POST /api/v1/articulos/:id/deactivate`

- **Permiso:** `articulos:deactivate`.
- **Headers:** Authorization; `x-request-id` opcional; sin `Idempotency-Key`.
- **Path/query:** `id` UUID; sin query.
- **Body:** no body.
- **Éxito (200):**
```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","codigo":"MP-0001","codigoExterno":"ERP-1","nombre":"Uva blanca","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":false,"createdAt":"2025-01-01T00:00:00.000Z","updatedAt":"2025-01-04T00:00:00.000Z"}}
```
- **Errores:** `400 VALIDATION_ERROR`, `404 ARTICULO_NOT_FOUND`, `401/403`.
- **Reglas:** desactivación lógica; conserva referencias históricas.

La activación es lógica y repetir el estado es válido. Un artículo inactivo y
uno inexistente no son válidos para nuevas operaciones; las referencias
históricas permanecen.

## Uso intermodular

Las APIs internas usan `getArticulo`, `listArticulos` y `validateArticulo`.
`validateArticulo` devuelve `valid:false` si falta el artículo, está inactivo o
no coincide con las clasificaciones permitidas. La condición de exportación no
es una clasificación de Artículo.
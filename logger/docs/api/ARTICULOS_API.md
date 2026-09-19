# Artículos API

Contrato implementado bajo `/api/v1/articulos`. El módulo administra el
catálogo de artículos usado por Inventory, Compras y Production.

## Convenciones

- Todos los endpoints requieren:

  ```http
  Authorization: Bearer <firebase-id-token>
  ```

- `Content-Type: application/json` es necesario en `POST` y `PATCH`.
- Permisos reales: `articulos:read`, `articulos:create`, `articulos:update`,
  `articulos:activate`, `articulos:deactivate`.
- Todos los ids son UUID.
- Fechas de respuesta: ISO-8601.
- Errores:

  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Request validation failed",
      "requestId": "uuid"
    }
  }
  ```

`401` corresponde a token ausente/inválido; `403` a usuario no registrado,
inactivo o sin permiso. Los errores de dominio documentados abajo conservan
sus códigos. No se acepta actor en el body: auditoría usa el usuario del
token.

## Enums reales

### `clasificacion`

`MATERIA_PRIMA`, `INSUMO_ENOLOGICO`, `MATERIAL_ENVASE`,
`MATERIAL_EMPAQUE`, `PRODUCTO_PROCESO`, `PRODUCTO_ENVASADO`,
`PRODUCTO_TERMINADO`.

### `unidadMedida`

`KG`, `G`, `L`, `M`, `UNIDAD`.

### `activo` en filtros

Query string `"true"` o `"false"`; el backend lo convierte a boolean.

## GET `/api/v1/articulos`

### Objetivo y acceso

Lista artículos con filtros y paginación.

- Auth: Bearer Firebase ID Token y User local `ACTIVE`.
- Permiso: `articulos:read`.
- Headers: `Authorization`; no body.

### Query params

Todos son opcionales:

| Campo | Tipo | Regla/default |
|---|---|---|
| `page` | integer | mínimo 1, default `1` |
| `pageSize` | integer | 1–100, default `20` |
| `search` | string | trim, mínimo 1 si se envía |
| `clasificacion` | enum | enum real indicado arriba |
| `activo` | `"true"`/`"false"` | filtro booleano |

### Éxito y ejemplo

`200 OK`

Request:

```bash
curl -G https://api.example.com/api/v1/articulos \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "page=1" \
  --data-urlencode "pageSize=20" \
  --data-urlencode "clasificacion=MATERIA_PRIMA" \
  --data-urlencode "activo=true"
```

Response `200`:

```json
{
  "data": [{
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "codigo": "UVA-TEMPRANILLO",
    "codigoExterno": null,
    "nombre": "Uva Tempranillo",
    "clasificacion": "MATERIA_PRIMA",
    "unidadMedida": "KG",
    "activo": true,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Errores y reglas

- `400 VALIDATION_ERROR` para query inválida.
- `articulos:read` se evalúa antes del controller.
- No hay idempotency key: es una lectura repetible.

## GET `/api/v1/articulos/:id`

- Objetivo: obtener un artículo por UUID.
- Auth/permiso: Bearer + `articulos:read`.
- Path: `id` UUID requerido.
- Query/body: ninguno.
- Éxito: `200 { "data": Articulo }`.
- Error: `404 ARTICULO_NOT_FOUND`.

Request:

```bash
curl https://api.example.com/api/v1/articulos/8d4a2b3e-4f1c-4b56-8f6b-111111111111 \
  -H "Authorization: Bearer $TOKEN"
```

Response `200`:

```json
{"data":{"id":"8d4a2b3e-4f1c-4b56-8f6b-111111111111","codigo":"UVA-TEMPRANILLO","codigoExterno":null,"nombre":"Uva Tempranillo","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":true,"createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:00:00.000Z"}}
```

## POST `/api/v1/articulos`

### Objetivo y body

Crea un artículo administrativo.

- Auth/permiso: Bearer + `articulos:create`.
- Headers: `Authorization`, `Content-Type: application/json`.
- Campos requeridos: `codigo`, `nombre`, `clasificacion`, `unidadMedida`.
- Campo opcional: `codigoExterno`.
- Todos los strings se recortan; `codigo`, `nombre` y `codigoExterno` no pueden
  quedar vacíos.

Request body:

```json
{
  "codigo": "UVA-TEMPRANILLO",
  "codigoExterno": "EXT-001",
  "nombre": "Uva Tempranillo",
  "clasificacion": "MATERIA_PRIMA",
  "unidadMedida": "KG"
}
```

Request:

```bash
curl -X POST https://api.example.com/api/v1/articulos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"codigo":"UVA-TEMPRANILLO","codigoExterno":"EXT-001","nombre":"Uva Tempranillo","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG"}'
```

### Respuesta y errores

`201 Created`

Response `201`:

```json
{
  "data": {
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "codigo": "UVA-TEMPRANILLO",
    "codigoExterno": "EXT-001",
    "nombre": "Uva Tempranillo",
    "clasificacion": "MATERIA_PRIMA",
    "unidadMedida": "KG",
    "activo": true,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }
}
```

- `400 VALIDATION_ERROR` por body inválido.
- `409 ARTICULO_CODE_ALREADY_EXISTS` si ya existe el código sin distinguir
  mayúsculas/minúsculas.
- No define `Idempotency-Key` ni `operationKey`; repetir puede producir
  conflicto por código.

## PATCH `/api/v1/articulos/:id`

### Objetivo y body

Actualiza datos administrativos del artículo.

- Auth/permiso: Bearer + `articulos:update`.
- Path: `id` UUID.
- Body: al menos un campo:

```json
{
  "codigoExterno": null,
  "nombre": "Uva Tempranillo seleccionada",
  "clasificacion": "MATERIA_PRIMA",
  "unidadMedida": "KG"
}
```

Todos son opcionales individualmente: `codigoExterno` puede ser string no
vacío o `null`; `nombre` string no vacío; `clasificacion` y `unidadMedida`
deben pertenecer a sus enums reales. `codigo` no es actualizable.

### Respuesta, errores y reglas

`200 OK` con `{ "data": Articulo }`.

Request:

```http
PATCH /api/v1/articulos/8d4a2b3e-4f1c-4b56-8f6b-111111111111
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"nombre":"Uva Tempranillo seleccionada"}
```

Response `200`:

```json
{"data":{"id":"8d4a2b3e-4f1c-4b56-8f6b-111111111111","codigo":"UVA-TEMPRANILLO","codigoExterno":null,"nombre":"Uva Tempranillo seleccionada","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":true,"createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:20:00.000Z"}}
```

- `400 VALIDATION_ERROR` si el body está vacío o es inválido.
- `404 ARTICULO_NOT_FOUND`.
- `409 ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE` si existen referencias
  operacionales y se intenta cambiar `clasificacion` o `unidadMedida`.

Los campos de identidad operacional son inmutables después de cualquiera de
estas referencias:

- `InventoryMovement`
- `CompraItem`
- `ProductionWorkInput`
- `ProductionBatch`

Cambiar nombre o código externo sigue permitido. No hay idempotency key;
repetir el mismo update es una operación normal de actualización.

## POST `/api/v1/articulos/:id/activate`

- Objetivo: activar un artículo.
- Auth/permiso: Bearer + `articulos:activate`.
- Path: `id` UUID; query/body: ninguno.
- Éxito: `200 { "data": Articulo }`.
- Error: `404 ARTICULO_NOT_FOUND`.
- Si ya está activo, devuelve el estado actual; no define `Idempotency-Key`.

Ejemplo:

```bash
curl -X POST \
  https://api.example.com/api/v1/articulos/8d4a2b3e-4f1c-4b56-8f6b-111111111111/activate \
  -H "Authorization: Bearer $TOKEN"
```

Response `200`:

```json
{"data":{"id":"8d4a2b3e-4f1c-4b56-8f6b-111111111111","codigo":"UVA-TEMPRANILLO","codigoExterno":null,"nombre":"Uva Tempranillo","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":true,"createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:25:00.000Z"}}
```

## POST `/api/v1/articulos/:id/deactivate`

- Objetivo: desactivar un artículo sin borrar su historial.
- Auth/permiso: Bearer + `articulos:deactivate`.
- Path: `id` UUID; query/body: ninguno.
- Éxito: `200 { "data": Articulo }`.
- Error: `404 ARTICULO_NOT_FOUND`.
- Si ya está inactivo, devuelve el estado actual; no define
  `Idempotency-Key`.

Request:

```http
POST /api/v1/articulos/8d4a2b3e-4f1c-4b56-8f6b-111111111111/deactivate
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{"data":{"id":"8d4a2b3e-4f1c-4b56-8f6b-111111111111","codigo":"UVA-TEMPRANILLO","codigoExterno":null,"nombre":"Uva Tempranillo","clasificacion":"MATERIA_PRIMA","unidadMedida":"KG","activo":false,"createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:30:00.000Z"}}
```

La desactivación no elimina movimientos, compras ni producción. Los
consumidores operacionales deben validar que el artículo esté activo antes de
usarlo, según sus propios comandos.

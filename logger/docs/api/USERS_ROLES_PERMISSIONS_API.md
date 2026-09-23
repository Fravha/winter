# Users, Roles & Permissions API

Estos endpoints se montan directamente bajo `/api/v1`. Todos requieren:

```http
Authorization: Bearer <firebase-id-token>
```

El token se verifica, se resuelve el User local y se comprueba que esté
`ACTIVE`; después se evalúa el permiso indicado. El audit actor se obtiene del
usuario autenticado y **no** se acepta un actor en el body.

## Convenciones

- `Content-Type: application/json` en endpoints con body.
- Los ids son UUID.
- `204 No Content` no contiene body.
- No hay `Idempotency-Key` ni `operationKey` en estos comandos.
- Errores:

```json
{
  "error": {
    "code": "ROLE_NOT_FOUND",
    "message": "Role not found",
    "requestId": "uuid"
  }
}
```

Validación Zod produce `400 VALIDATION_ERROR`. Errores frecuentes son `401
AUTH_MISSING_TOKEN`, `401 AUTH_INVALID_HEADER`, `403 AUTH_USER_NOT_REGISTERED`,
`403 AUTH_USER_INACTIVE`, `403 AUTH_FORBIDDEN` y `404` del recurso indicado.

## Audit logs

### GET `/api/v1/audit-logs`

- Objetivo: consultar registros de auditoría. Es una operación únicamente de
  lectura; no existe API pública para crear, editar o eliminar registros.
- Auth/permiso: Bearer + `audit:read`.
- Query opcional:
  `actorUserId` (UUID), `action`, `resourceType`, `resourceId`, `from` y `to`
  (fechas ISO 8601), `page` (positivo, por defecto `1`) y `pageSize`
  (positivo, por defecto `20`, máximo `100`).
- `from` no puede ser posterior a `to`. Las consultas inválidas devuelven
  `400 VALIDATION_ERROR`.
- Orden: `createdAt DESC`.
- Éxito: `200` con paginación:

```json
{
  "data": [{
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "actorUserId": "9e5b3c4f-5a2d-4c67-9f7c-222222222222",
    "action": "USER_CREATED",
    "resourceType": "USER",
    "resourceId": "7f6e5d4c-3b2a-4910-8111-333333333333",
    "metadata": {"email": "operador@example.com"},
    "ipAddress": "192.0.2.10",
    "requestId": "11111111-1111-4111-8111-111111111111",
    "createdAt": "2026-01-15T10:00:00.000Z"
  }],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

El permiso `audit:read` se incorpora mediante el seed idempotente existente y
se asigna al rol `admin`.

## Users

Un User tiene un único rol (`role` nullable en la vista administrativa). Los
estados reales son `PENDING`, `ACTIVE` y `SUSPENDED`.

### GET `/api/v1/users`

- Objetivo: listar usuarios administrativos.
- Auth/permiso: Bearer + `users:read`.
- Params/query/body: ninguno.
- Éxito: `200 { "data": UserAdmin[] }`.

Request:

```bash
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/v1/users
```

Response `200`:

```json
{
  "data": [{
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "firebaseUid": "firebase-uid",
    "email": "operador@example.com",
    "displayName": "Operador",
    "status": "ACTIVE",
    "lastLoginAt": null,
    "role": {"id": "11111111-1111-4111-8111-111111111111", "code": "operator", "name": "Operator"},
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }]
}
```

### GET `/api/v1/users/:id`

- Objetivo: consultar un usuario.
- Auth/permiso: Bearer + `users:read`.
- Path: `id` UUID requerido.
- Query/body: ninguno.
- Éxito: `200 { "data": UserAdmin }`.
- Error adicional: `404 USER_NOT_FOUND`.

Request:

```http
GET /api/v1/users/8d4a2b3e-4f1c-4b56-8f6b-111111111111
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{
  "data": {
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "firebaseUid": "firebase-uid",
    "email": "operador@example.com",
    "displayName": "Operador",
    "status": "ACTIVE",
    "lastLoginAt": "2026-01-15T10:30:00.000Z",
    "role": {"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator"},
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
}
```

### POST `/api/v1/users`

- Objetivo: provisionar un User local y su identidad Firebase.
- Auth/permiso: Bearer + `users:manage`.
- Headers: `Authorization`, `Content-Type: application/json`.
- Body requerido:

```json
{
  "email": "nuevo@example.com",
  "roleId": "11111111-1111-4111-8111-111111111111"
}
```

- Campos: `email` y `roleId` UUID son obligatorios; `displayName` es opcional,
  string no vacío de máximo 150.
- Éxito: `201 { "data": UserAdmin }`.
- Errores: `409 USER_EMAIL_ALREADY_EXISTS`, `404 ROLE_NOT_FOUND`; si falla
  la provisión se compensa la identidad/local creado cuando corresponde.
- Reglas: el servidor genera el Firebase uid y envía el setup de contraseña.

Ejemplo:

```bash
curl -X POST https://api.example.com/api/v1/users \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"nuevo@example.com","displayName":"Nuevo operador","roleId":"11111111-1111-4111-8111-111111111111"}'
```

Response `201`:

```json
{
  "data": {
    "id": "9e5b3c4f-5a2d-4c67-9f7c-222222222222",
    "firebaseUid": "generated-firebase-uid",
    "email": "nuevo@example.com",
    "displayName": "Nuevo operador",
    "status": "PENDING",
    "lastLoginAt": null,
    "role": {"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator"},
    "createdAt": "2026-01-15T11:00:00.000Z",
    "updatedAt": "2026-01-15T11:00:00.000Z"
  }
}
```

### PATCH `/api/v1/users/:id`

- Objetivo: actualizar correo y/o nombre visible.
- Auth/permiso: Bearer + `users:manage`.
- Path: `id` UUID requerido.
- Body: al menos un campo; `email` opcional (correo, máximo 320), `displayName`
  opcional y puede ser `null` (o string no vacío, máximo 150).
- Éxito: `200 { "data": UserAdmin }`.
- Errores: `400 VALIDATION_ERROR`, `404 USER_NOT_FOUND`,
  `409 USER_EMAIL_ALREADY_EXISTS`.
- No acepta cambiar `status`, rol, Firebase uid ni timestamps.

Request:

```http
PATCH /api/v1/users/8d4a2b3e-4f1c-4b56-8f6b-111111111111
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"displayName":"Operador de bodega"}
```

Response `200`:

```json
{
  "data": {
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "firebaseUid": "firebase-uid",
    "email": "operador@example.com",
    "displayName": "Operador de bodega",
    "status": "ACTIVE",
    "lastLoginAt": "2026-01-15T10:30:00.000Z",
    "role": {"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator"},
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T11:05:00.000Z"
  }
}
```

### POST `/api/v1/users/:id/activate`

- Objetivo: activar el User local y habilitar su identidad.
- Auth/permiso: Bearer + `users:manage`.
- Path: `id` UUID; body/query: ninguno.
- Éxito: `200 { "data": UserAdmin }`.
- Error: `404 USER_NOT_FOUND`.
- No define idempotency key; repetir deja el estado `ACTIVE` y audita la
  operación.

Request:

```http
POST /api/v1/users/8d4a2b3e-4f1c-4b56-8f6b-111111111111/activate
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{
  "data": {
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "firebaseUid": "firebase-uid",
    "email": "operador@example.com",
    "displayName": "Operador",
    "status": "ACTIVE",
    "lastLoginAt": null,
    "role": {"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator"},
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T11:10:00.000Z"
  }
}
```

### POST `/api/v1/users/:id/suspend`

- Objetivo: suspender acceso local y deshabilitar identidad.
- Auth/permiso: Bearer + `users:manage`.
- Path: `id` UUID; body/query: ninguno.
- Éxito: `200 { "data": UserAdmin }`.
- Errores: `404 USER_NOT_FOUND`, `409 USER_CANNOT_SUSPEND_SELF`,
  `409 LAST_ADMIN_PROTECTED`.
- El estado local es la barrera autoritativa aunque falle la sincronización
  posterior con Firebase.

Request:

```http
POST /api/v1/users/8d4a2b3e-4f1c-4b56-8f6b-111111111111/suspend
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{
  "data": {
    "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
    "firebaseUid": "firebase-uid",
    "email": "operador@example.com",
    "displayName": "Operador",
    "status": "SUSPENDED",
    "lastLoginAt": "2026-01-15T10:30:00.000Z",
    "role": {"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator"},
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T11:15:00.000Z"
  }
}
```

### POST `/api/v1/users/:id/send-password-setup`

- Objetivo: reenviar el correo de configuración de contraseña.
- Auth/permiso: Bearer + `users:manage`.
- Path: `id` UUID; body/query: ninguno.
- Éxito: `204 No Content`.
- Error: `404 USER_NOT_FOUND`.
- No define idempotency key; cada llamada puede enviar un correo.

Request:

```http
POST /api/v1/users/8d4a2b3e-4f1c-4b56-8f6b-111111111111/send-password-setup
Authorization: Bearer <firebase-id-token>
```

Response `204 No Content`: cuerpo vacío.

## Roles

Los roles tienen `code`, `name`, `description`, permisos y timestamps. El
código se normaliza con trim, admite 2–80 caracteres y debe coincidir con
`^[a-z][a-z0-9:_-]*$`.

### GET `/api/v1/roles`

- Objetivo: listar roles.
- Auth/permiso: Bearer + `rbac:read`.
- Params/query/body: ninguno.
- Éxito: `200 { "data": RoleModel[] }`.

Cada rol incluye `permissions: [{id, code, name}]`.

Request:

```http
GET /api/v1/roles
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{
  "data": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "code": "operator",
    "name": "Operator",
    "description": "Acceso operativo",
    "permissions": [{"id":"22222222-2222-4222-8222-222222222222","code":"articulos:read","name":"Read articulos"}],
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }]
}
```

### GET `/api/v1/roles/:id`

- Objetivo: consultar un rol con sus permisos.
- Auth/permiso: Bearer + `rbac:read`.
- Path: `id` UUID.
- Éxito: `200 { "data": RoleModel }`.
- Error: `404 ROLE_NOT_FOUND`.

Request:

```http
GET /api/v1/roles/11111111-1111-4111-8111-111111111111
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator","description":"Acceso operativo","permissions":[],"createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:00:00.000Z"}}
```

### POST `/api/v1/roles`

- Objetivo: crear un rol.
- Auth/permiso: Bearer + `rbac:manage`.
- Body requerido:

```json
{"code":"operator","name":"Operator","description":"Acceso operativo"}
```

`code` y `name` son requeridos; `description` opcional, máximo 500.
- Éxito: `201 { "data": RoleModel }`.
- Error: `409 ROLE_CODE_ALREADY_EXISTS`.

Request:

```http
POST /api/v1/roles
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"code":"operator","name":"Operator","description":"Acceso operativo"}
```

Response `201`:

```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator","description":"Acceso operativo","permissions":[],"createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:00:00.000Z"}}
```

### PATCH `/api/v1/roles/:id`

- Objetivo: actualizar nombre y/o descripción.
- Auth/permiso: Bearer + `rbac:manage`.
- Path: `id` UUID.
- Body: al menos un campo; `name` opcional no vacío (máximo 150),
  `description` opcional nullable (máximo 500).
- Éxito: `200 { "data": RoleModel }`.
- Error: `404 ROLE_NOT_FOUND`, `400 VALIDATION_ERROR`.
- El `code` no se modifica mediante este endpoint.

Request:

```http
PATCH /api/v1/roles/11111111-1111-4111-8111-111111111111
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"description":"Operación de bodega"}
```

Response `200`:

```json
{"data":{"id":"11111111-1111-4111-8111-111111111111","code":"operator","name":"Operator","description":"Operación de bodega","permissions":[],"createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T11:20:00.000Z"}}
```

### DELETE `/api/v1/roles/:id`

- Objetivo: soft-delete de un rol.
- Auth/permiso: Bearer + `rbac:manage`.
- Path: `id` UUID; body/query: ninguno.
- Éxito: `204 No Content`.
- Errores: `404 ROLE_NOT_FOUND`, `409 SYSTEM_ROLE_PROTECTED` para `admin`,
  `409 ROLE_IN_USE` si tiene usuarios.

Request:

```http
DELETE /api/v1/roles/11111111-1111-4111-8111-111111111111
Authorization: Bearer <firebase-id-token>
```

Response `204 No Content`: cuerpo vacío.

### PUT `/api/v1/roles/:id/permissions`

- Objetivo: reemplazar el conjunto completo de permisos de un rol.
- Auth/permiso: Bearer + `rbac:manage`.
- Path: `id` UUID.
- Body requerido:

```json
{"permissionIds":["22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333"]}
```

`permissionIds` es array de UUID, máximo 500; puede ser vacío. Los duplicados
se deduplican antes de persistir.
- Éxito: `204 No Content`.
- Errores: `404 ROLE_NOT_FOUND`, `404 PERMISSION_NOT_FOUND`,
  `409 SYSTEM_ROLE_PERMISSIONS_PROTECTED` si el rol `admin` pierde alguno de
  `users:read`, `users:manage`, `rbac:read` o `rbac:manage`.

Request:

```http
PUT /api/v1/roles/11111111-1111-4111-8111-111111111111/permissions
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"permissionIds":["22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333"]}
```

Response `204 No Content`: cuerpo vacío. Una lectura posterior devuelve
`id`, `code`, `name`, `description`, `permissions`, `createdAt` y `updatedAt`.

## Permissions

Una Permission tiene `code`, `name`, `description` y timestamps. El `code`
admite 1–100 caracteres y solo minúsculas, dígitos, `:`, `_` y `-`
(`^[a-z0-9:_-]+$`).

### GET `/api/v1/permissions`

- Objetivo: listar permisos.
- Auth/permiso: Bearer + `rbac:read`.
- Sin params/query/body.
- Éxito: `200 { "data": PermissionModel[] }`.

Request:

```http
GET /api/v1/permissions
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{"data":[{"id":"22222222-2222-4222-8222-222222222222","code":"inventory:read","name":"Read inventory","description":"Consultar existencias","createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:00:00.000Z"}]}
```

### GET `/api/v1/permissions/:id`

- Objetivo: consultar permiso.
- Auth/permiso: Bearer + `rbac:read`.
- Path: `id` UUID.
- Éxito: `200 { "data": PermissionModel }`.
- Error: `404 PERMISSION_NOT_FOUND`.

Request:

```http
GET /api/v1/permissions/22222222-2222-4222-8222-222222222222
Authorization: Bearer <firebase-id-token>
```

Response `200`:

```json
{"data":{"id":"22222222-2222-4222-8222-222222222222","code":"inventory:read","name":"Read inventory","description":"Consultar existencias","createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:00:00.000Z"}}
```

### POST `/api/v1/permissions`

- Objetivo: crear permiso.
- Auth/permiso: Bearer + `rbac:manage`.
- Body:

```json
{
  "code": "inventory:read",
  "name": "Read inventory",
  "description": "Consultar existencias"
}
```

`code` y `name` son requeridos; `description` opcional, nullable, máximo 500.
- Éxito: `201 { "data": PermissionModel }`.
- Error: `409 PERMISSION_CODE_ALREADY_EXISTS`.
- La operación y su evento `PERMISSION_CREATED` se confirman atómicamente.

Request:

```http
POST /api/v1/permissions
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"code":"inventory:read","name":"Read inventory","description":"Consultar existencias"}
```

Response `201`:

```json
{"data":{"id":"22222222-2222-4222-8222-222222222222","code":"inventory:read","name":"Read inventory","description":"Consultar existencias","createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T10:00:00.000Z"}}
```

### PATCH `/api/v1/permissions/:id`

- Objetivo: actualizar uno o más metadatos del permiso.
- Auth/permiso: Bearer + `rbac:manage`.
- Path: `id` UUID.
- Body: al menos un campo entre `code`, `name`, `description`; mismos límites
  del alta y `description` puede ser `null`.
- Éxito: `200 { "data": PermissionModel }`.
- Errores: `404 PERMISSION_NOT_FOUND`, `409
  PERMISSION_CODE_ALREADY_EXISTS`.
- La operación y su evento `PERMISSION_UPDATED` se confirman atómicamente.

Request:

```http
PATCH /api/v1/permissions/22222222-2222-4222-8222-222222222222
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"name":"Consultar inventario"}
```

Response `200`:

```json
{"data":{"id":"22222222-2222-4222-8222-222222222222","code":"inventory:read","name":"Consultar inventario","description":"Consultar existencias","createdAt":"2026-01-15T10:00:00.000Z","updatedAt":"2026-01-15T11:25:00.000Z"}}
```

### DELETE `/api/v1/permissions/:id`

- Objetivo: eliminar un permiso.
- Auth/permiso: Bearer + `rbac:manage`.
- Path: `id` UUID; sin body/query.
- Éxito: `204 No Content`.
- Errores: `404 PERMISSION_NOT_FOUND`, `409 PERMISSION_IN_USE` si el permiso
  está asignado a uno o más roles. El mensaje es:
  `el permiso no puede eliminarse mientras esté asignado a uno o más roles.`
- La eliminación y su evento `PERMISSION_DELETED` se confirman atómicamente.
  La operación bloquea el permiso durante la comprobación y no elimina
  automáticamente relaciones `RolePermission`.

Request:

```http
DELETE /api/v1/permissions/22222222-2222-4222-8222-222222222222
Authorization: Bearer <firebase-id-token>
```

Response `204 No Content`: cuerpo vacío.

## Assignment

### PUT `/api/v1/users/:id/role`

- Objetivo: reemplazar el único rol asignado a un usuario.
- Auth/permiso: Bearer + `rbac:manage`.
- Path: `id` UUID del usuario.
- Body requerido: `{"roleId":"11111111-1111-4111-8111-111111111111"}`.
- Éxito: `204 No Content`.
- Errores: `404 USER_NOT_FOUND`, `404 ROLE_NOT_FOUND`,
  `409 USER_CANNOT_REMOVE_OWN_ADMIN`, `409 LAST_ADMIN_PROTECTED`.
- Reglas: no se puede quitar el propio rol `admin`; tampoco degradar o
  suspender al último administrador activo.
- La asignación de rol está permitida intencionalmente para usuarios
  `PENDING`, `ACTIVE` y `SUSPENDED`. Cambiar el rol no cambia el estado del
  usuario; las protecciones del último administrador activo se mantienen.

Request:

```http
PUT /api/v1/users/8d4a2b3e-4f1c-4b56-8f6b-111111111111/role
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"roleId":"11111111-1111-4111-8111-111111111111"}
```

Response `204 No Content`: cuerpo vacío. La lectura posterior del usuario
devuelve `role` con `id`, `code` y `name`.

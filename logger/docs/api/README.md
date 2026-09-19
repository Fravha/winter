# Winter Backend API

Índice del contrato HTTP implementado por Winter. Estos documentos describen
la implementación actual; el frontend debe usarlos como contrato y no deducir
rutas desde documentos históricos o desde el esquema Prisma.

## Base URL

En desarrollo local, la aplicación escucha en `http://localhost:3000` por
defecto. La API funcional usa el prefijo:

```text
http://localhost:3000/api/v1
```

El puerto se configura con `PORT`. Health endpoints quedan fuera del prefijo:

- `GET /health`
- `GET /health/ready`
- `GET /health/db`

## Health endpoints

Estos endpoints son públicos y no forman parte de `/api/v1`.

### GET `/health`

**Objetivo:** comprobar que el proceso HTTP está levantado.

- Autenticación: ninguna.
- Permiso: ninguno.
- Headers requeridos: ninguno.
- Path params: ninguno.
- Query params: ninguno.
- Body: ninguno.
- Idempotencia: no aplica; no acepta `Idempotency-Key` ni `operationKey`.

Ejemplo de request:

```bash
curl http://localhost:3000/health
```

Respuesta exitosa: `200 OK`.

```json
{
  "status": "ok",
  "service": "logger-api",
  "environment": "development"
}
```

El campo `environment` refleja el valor efectivo de `NODE_ENV` y puede ser
`development`, `test` o `production`.

Errores: el endpoint no implementa errores de dominio propios. Puede recibir
la respuesta global de rate limiting si se supera el límite configurado
(`429`), con la forma de error común; una solicitud a otra ruta no se
considera un error de este endpoint.

### GET `/health/ready`

**Objetivo:** comprobar que el proceso está levantado y que la conexión a
PostgreSQL está lista.

- Autenticación: ninguna.
- Permiso: ninguno.
- Headers requeridos: ninguno.
- Path params: ninguno.
- Query params: ninguno.
- Body: ninguno.
- Idempotencia: no aplica; no acepta `Idempotency-Key` ni `operationKey`.

Ejemplo de request:

```bash
curl http://localhost:3000/health/ready
```

Cuando `HealthService.databaseIsReady()` termina correctamente, responde
`200 OK` con esta forma exacta:

```json
{
  "status": "ok",
  "database": "connected",
  "message": "Hello World! This is the logger API. It is running and ready to accept requests."
}
```

Si la comprobación de base de datos lanza un error, el endpoint lo captura y
responde `503 Service Unavailable`:

```json
{
  "status": "error",
  "database": "disconnected"
}
```

No expone detalles de la excepción de PostgreSQL. El rate limiter global puede
responder `429` antes de ejecutar la comprobación.

### GET `/health/db`

**Objetivo:** exponer la misma comprobación de readiness de PostgreSQL que
`GET /health/ready`.

- Autenticación: ninguna.
- Permiso: ninguno.
- Headers requeridos: ninguno.
- Path params: ninguno.
- Query params: ninguno.
- Body: ninguno.
- Idempotencia: no aplica; no acepta `Idempotency-Key` ni `operationKey`.

Ejemplo de request:

```bash
curl http://localhost:3000/health/db
```

La respuesta exitosa es `200 OK` con:

```json
{
  "status": "ok",
  "database": "connected",
  "message": "Hello World! This is the logger API. It is running and ready to accept requests."
}
```

Si PostgreSQL no está disponible, responde `503 Service Unavailable` con:

```json
{
  "status": "error",
  "database": "disconnected"
}
```

`/health/db` y `/health/ready` comparten exactamente el mismo handler; no hay
diferencia contractual entre ellos. El rate limiter global puede responder
`429`.

## Módulos documentados

- [Auth](./AUTH_API.md)
- [Users, roles y permisos](./USERS_ROLES_PERMISSIONS_API.md)
- [Artículos](./ARTICULOS_API.md)
- [Inventory](./INVENTORY_API.md)
- [Compras](./COMPRAS_API.md)
- [Production](./PRODUCTION_API.md)
- [Attachments](./ATTACHMENTS_API.md)

Cada documento de módulo es la fuente de detalle de sus endpoints. Este índice
no duplica payloads ni reglas específicas.

## Autenticación común

Los endpoints protegidos reciben:

```http
Authorization: Bearer <Firebase ID token>
```

El backend verifica el Firebase ID token, busca o resuelve el usuario local,
obtiene su único rol y evalúa los permisos de ese rol mediante middleware. El
actor de auditoría se toma del usuario autenticado; no se acepta un actor
enviado por el cliente.

Los endpoints de health no requieren autenticación. Las credenciales Firebase
y cualquier clave privada son configuración del backend y no forman parte del
contrato del frontend.

## Errores

Las respuestas de error usan:

```json
{
  "error": {
    "code": "CONTRACT_ERROR_CODE",
    "message": "Descripción segura",
    "requestId": "uuid"
  }
}
```

En entornos no productivos pueden aparecer `details` no sensibles. En
producción se omiten detalles internos. Los códigos y status indicados en cada
documento de módulo son contractuales.

Convenciones generales observables:

- `400`: request, formato, enum o precondición de entrada inválida.
- `401`: token ausente o inválido.
- `403`: permiso insuficiente.
- `404`: recurso inexistente.
- `409`: conflicto de estado o de idempotencia.
- `413`: payload/archivo demasiado grande.
- `422`: validación semántica cuando el endpoint la utiliza.
- `500`/`502`/`503`: fallo interno o de dependencia.

## Permisos

Cada ruta protegida declara su permiso en el documento del módulo. No se debe
inferir un permiso por el nombre de la URL. Una operación puede requerir
permisos de más de un módulo; por ejemplo, Attachments requiere
`production:read` además de `attachments:read` o `attachments:create`.

## Idempotencia

Los endpoints que soportan idempotencia documentan explícitamente si usan
`Idempotency-Key` u `operationKey`, el alcance de la clave y el
comportamiento de replay/conflicto. No enviar esos headers o campos a
endpoints que no los documentan. Un replay debe conservar el resultado
contractual de la operación; reutilizar una clave con payload incompatible
produce conflicto cuando el módulo lo implementa.

## Representación de datos

- Las fechas se devuelven como strings ISO-8601 en JSON.
- Los valores `Decimal` no deben convertirse a `number` por el frontend:
  conservarlos como strings decimales para evitar pérdida de precisión.
- Los UUID se envían como strings.
- Los enums son case-sensitive y solo aceptan los valores enumerados en el
  documento de su módulo.
- Los listados indican sus parámetros de paginación reales; no asumir una
  paginación global.

## Alcance

El contrato actual comprende Auth/RBAC, Artículos, Compras, Inventory,
Production, Attachments y la infraestructura compartida/auditoría. Los
módulos de prueba históricos de Logger no forman parte del runtime ni de este
contrato.
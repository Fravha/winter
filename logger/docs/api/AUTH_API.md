# Auth API

Contrato implementado bajo `/api/v1/auth`. La autenticación no crea una
sesión propia: el cliente obtiene un **Firebase ID Token** y lo envía en cada
endpoint protegido.

## Flujo de autenticación y autorización

```text
Firebase ID Token
  -> verifyIdToken() en el backend
  -> identidad Firebase (uid)
  -> User local buscado por firebaseUid
  -> User.status === ACTIVE
  -> rol único del usuario
  -> permisos del rol
  -> middleware del endpoint
```

El token se envía como:

```http
Authorization: Bearer <firebase-id-token>
```

`Authorization` ausente produce `401 AUTH_MISSING_TOKEN`; una forma distinta de
`Bearer <token>` produce `401 AUTH_INVALID_HEADER`. Un uid sin User local
produce `403 AUTH_USER_NOT_REGISTERED`; un User con estado distinto de
`ACTIVE` produce `403 AUTH_USER_INACTIVE`.

Los endpoints de autenticación no reciben credenciales de Firebase ni secretos
del backend. El servidor verifica el token con Firebase Admin. El usuario local
tiene un único rol y el middleware resuelve los permisos de ese rol.

## Formato común de error

Todos los errores usan:

```json
{
  "error": {
    "code": "AUTH_INVALID_HEADER",
    "message": "Authorization must use Bearer <token>",
    "requestId": "uuid"
  }
}
```

Los errores de validación son `400 VALIDATION_ERROR`; los errores de negocio
conservan su código contractual. `requestId` debe utilizarse para correlación
con logs.

## GET `/api/v1/auth/me`

### Objetivo

Devuelve el User local autenticado y la autorización efectiva que el backend
resolvió desde Firebase.

### Acceso y headers

- Autenticación: Firebase ID Token obligatorio.
- Permiso: no requiere un permiso de negocio adicional; requiere identidad
  Firebase válida, User local registrado y estado `ACTIVE`.
- Headers: `Authorization: Bearer <firebase-id-token>`.
- Path/query/body: ninguno.

### Respuesta exitosa

`200 OK`

Response `200`:

```json
{
  "id": "8d4a2b3e-4f1c-4b56-8f6b-111111111111",
  "firebaseUid": "firebase-uid",
  "email": "operador@example.com",
  "displayName": "Operador",
  "status": "ACTIVE",
  "lastLoginAt": "2026-01-15T10:30:00.000Z",
  "roles": ["operator"],
  "permissions": ["articulos:read", "inventory:read"]
}
```

`status` es uno de `PENDING`, `ACTIVE` o `SUSPENDED`. Las fechas se serializan
como ISO-8601. `roles` contiene el rol efectivo y `permissions` sus códigos.

### Ejemplo

Request:

```bash
curl -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  https://api.example.com/api/v1/auth/me
```

### Errores contractuales

- `401 AUTH_MISSING_TOKEN`
- `401 AUTH_INVALID_HEADER`
- `401` si el verificador Firebase rechaza el token (el handler expone el
  error de autenticación correspondiente sin secretos).
- `403 AUTH_USER_NOT_REGISTERED`
- `403 AUTH_USER_INACTIVE`

### Idempotencia y reglas

Es una lectura. Puede repetirse sin efectos de negocio. Si el token contiene
`authTime` posterior al `lastLoginAt` local, el middleware actualiza
`lastLoginAt` antes de devolver el usuario.

## POST `/api/v1/auth/password-reset`

### Objetivo

Solicita el envío del enlace de restablecimiento/configuración de contraseña
para un correo. El endpoint está montado cuando la aplicación tiene configurado
el `PasswordResetSender`.

### Acceso y headers

- Autenticación: no requiere Bearer token.
- Permiso: ninguno.
- Headers: `Content-Type: application/json`.
- Body requerido:

```json
{ "email": "usuario@example.com" }
```

`email` es obligatorio, se recorta, debe ser correo válido y admite como máximo
320 caracteres. No hay path params ni query params.

### Respuesta exitosa

`202 Accepted`

Response `202`:

```json
{ "accepted": true }
```

La misma respuesta se devuelve aunque la identidad no exista, para no revelar
si un correo está registrado en Firebase.

### Ejemplo

Request:

```bash
curl -X POST https://api.example.com/api/v1/auth/password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@example.com"}'
```

### Errores contractuales

- `400 VALIDATION_ERROR` si falta `email`, no es válido o supera 320
  caracteres.
- `202` para una identidad no encontrada (`USER_IDENTITY_NOT_FOUND`) por
  diseño anti-enumeración.
- Errores del proveedor de correo/identidad se normalizan por el handler
  general; no se devuelven secretos.

### Idempotencia y reglas

No define `Idempotency-Key` ni `operationKey`. Repetir la solicitud puede
reenviar un correo; el cliente debe evitar reintentos automáticos
innecesarios.

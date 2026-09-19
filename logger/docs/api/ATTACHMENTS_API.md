# Attachments API

Los adjuntos son metadatos en PostgreSQL y objetos en un bucket privado de
Supabase Storage. El backend nunca expone el objeto directamente: entrega una
URL firmada temporal cuando se solicita la descarga.

Base URL: `/api/v1`

## Reglas comunes

- Todas las operaciones requieren `Authorization: Bearer <Firebase ID token>`.
- Todas requieren además `production:read`.
- `POST` requiere `attachments:create`.
- Las tres operaciones `GET` requieren `attachments:read`.
- El actor se obtiene del token y del usuario local; nunca se recibe en el
  body.
- Las respuestas de error tienen la forma:

  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable message",
      "requestId": "uuid"
    }
  }
  ```

- `createdAt` se serializa como fecha ISO-8601 por la serialización JSON de
  `Date`.
- No existe endpoint HTTP `DELETE` para adjuntos.

## Valores reales de `entityType`

El valor debe ser exactamente uno de:

| `entityType` | Entidad objetivo |
| --- | --- |
| `GRAPE_RECEPTION` | `GrapeReception` |
| `PRODUCTION_WORK` | `ProductionWork` |
| `MEASUREMENT` | `ProductionMeasurement` |
| `TRANSFORMATION` | `Transformation` |
| `PRODUCTION_LOSS` | `ProductionLoss` |

`entityId` debe ser un UUID y la entidad objetivo debe existir. Un tipo no
soportado produce `ATTACHMENT_ENTITY_TYPE_UNSUPPORTED` (400); un objetivo
inexistente produce `ATTACHMENT_TARGET_NOT_FOUND` (404).

## POST `/api/v1/attachments`

### Objetivo

Subir un archivo, almacenar su objeto en Supabase privado y crear sus
metadatos/auditoría en PostgreSQL.

### Request

- Método: `POST`
- Autenticación: Firebase ID token
- Permisos: `production:read`, `attachments:create`
- Header: `Authorization`
- Content-Type: `multipart/form-data`
- Campos de texto:
  - `entityType` requerido.
  - `entityId` requerido.
  - `observations` opcional, texto de hasta 1000 caracteres después de
    recortar espacios.
- Campo de archivo:
  - `file` requerido; se acepta un único archivo.
- No se aceptan campos multipart adicionales.
- No aplica `Idempotency-Key` ni `operationKey` en este endpoint.

Límites multipart efectivos:

- Un archivo.
- Tamaño máximo: **10 MiB** (`10 * 1024 * 1024` bytes).
- Hasta 3 campos de texto, 4 partes y 4096 bytes por valor de campo.

MIME permitidos y validación de contenido:

| MIME | Firma validada |
| --- | --- |
| `image/jpeg` | bytes iniciales JPEG |
| `image/png` | firma PNG |
| `image/webp` | `RIFF` + `WEBP` |
| `application/pdf` | prefijo `%PDF-` |

El nombre se normaliza para impedir rutas y caracteres inseguros antes de
formar la clave de almacenamiento.

### Ejemplo

```bash
curl -X POST "$BASE_URL/api/v1/attachments" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -F "entityType=PRODUCTION_WORK" \
  -F "entityId=22222222-2222-4222-8222-222222222222" \
  -F "observations=Acta de trabajo" \
  -F "file=@acta.pdf;type=application/pdf"
```

### Respuesta exitosa

Status: `201 Created`

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "entityType": "PRODUCTION_WORK",
  "entityId": "22222222-2222-4222-8222-222222222222",
  "fileName": "acta.pdf",
  "mimeType": "application/pdf",
  "fileSize": 4821,
  "storageProvider": "SUPABASE",
  "uploadedByUserId": "11111111-1111-4111-8111-111111111111",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "observations": "Acta de trabajo"
}
```

El objeto se sube antes de persistir la fila. Si falla PostgreSQL o la
auditoría, el backend intenta eliminar el objeto para compensar. Si esa
limpieza también falla, responde `ATTACHMENT_ORPHANED_STORAGE` (500) y deja
constancia para limpieza operativa.

Errores contractuales adicionales:

- `ATTACHMENT_FILE_REQUIRED` (400)
- `ATTACHMENT_MULTIPART_INVALID` (400)
- `ATTACHMENT_MIME_NOT_ALLOWED` (400)
- `ATTACHMENT_CONTENT_MISMATCH` (400)
- `ATTACHMENT_TOO_LARGE` (413)
- `ATTACHMENT_INVALID_FILENAME` (400)
- `ATTACHMENT_INVALID_TARGET_ID` (400)
- `ATTACHMENT_INVALID_OBSERVATIONS` (400)
- `ATTACHMENTS_STORAGE_NOT_CONFIGURED` (503)
- `ATTACHMENTS_BUCKET_UNAVAILABLE` (503)
- `ATTACHMENTS_BUCKET_NOT_PRIVATE` (503)
- `ATTACHMENTS_STORAGE_UNAVAILABLE` (503)
- `ATTACHMENTS_STORAGE_UPLOAD_FAILED` (502)

## GET `/api/v1/attachments`

### Objetivo

Listar los adjuntos de una entidad objetivo.

### Request

- Método: `GET`
- Autenticación: Firebase ID token
- Permisos: `production:read`, `attachments:read`
- Query params requeridos:
  - `entityType`
  - `entityId`
- No tiene body ni paginación.
- No aplica `Idempotency-Key` ni `operationKey`.

Ejemplo:

```bash
curl "$BASE_URL/api/v1/attachments?entityType=PRODUCTION_WORK&entityId=22222222-2222-4222-8222-222222222222" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Respuesta exitosa: `200 OK`, un array de DTOs con la misma forma de la
respuesta de creación. Los elementos se ordenan por `createdAt` ascendente.

Errores relevantes: `ATTACHMENT_INVALID_TARGET_ID` (400),
`ATTACHMENT_ENTITY_TYPE_UNSUPPORTED` (400) y
`ATTACHMENT_TARGET_NOT_FOUND` (404).

## GET `/api/v1/attachments/:id`

### Objetivo

Obtener los metadatos de un adjunto, sin exponer el contenido binario ni una
URL pública.

- Método: `GET`
- Autenticación: Firebase ID token
- Permisos: `production:read`, `attachments:read`
- Path param: `id`, UUID del adjunto
- Body/query: ninguno

Ejemplo:

```bash
curl "$BASE_URL/api/v1/attachments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Respuesta exitosa: `200 OK`, DTO de metadatos.

Errores relevantes:

- `ATTACHMENT_INVALID_ID` (400)
- `ATTACHMENT_NOT_FOUND` (404)
- `ATTACHMENT_TARGET_NOT_FOUND` (404)

## GET `/api/v1/attachments/:id/download-url`

### Objetivo

Crear una URL firmada temporal para descargar un objeto existente del bucket
privado.

- Método: `GET`
- Autenticación: Firebase ID token
- Permisos: `production:read`, `attachments:read`
- Path param: `id`, UUID del adjunto
- Body/query: ninguno
- La duración se configura en `ATTACHMENTS_SIGNED_URL_SECONDS`; el valor por
  defecto real es 300 segundos.

Ejemplo:

```bash
curl "$BASE_URL/api/v1/attachments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/download-url" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

Respuesta exitosa: `200 OK`

```json
{
  "url": "https://storage.example/signed/path",
  "expiresIn": 300
}
```

Antes de firmar, el backend verifica que el bucket siga siendo privado y que
el objeto exista. Errores relevantes:

- `ATTACHMENT_INVALID_ID` (400)
- `ATTACHMENT_NOT_FOUND` (404)
- `ATTACHMENT_TARGET_NOT_FOUND` (404)
- `ATTACHMENT_STORAGE_NOT_FOUND` (404)
- `ATTACHMENTS_STORAGE_NOT_CONFIGURED` (503)
- `ATTACHMENTS_BUCKET_UNAVAILABLE` (503)
- `ATTACHMENTS_BUCKET_NOT_PRIVATE` (503)
- `ATTACHMENTS_STORAGE_UNAVAILABLE` (503)
- `ATTACHMENTS_SIGNED_URL_FAILED` (502)

## Configuración de almacenamiento

Variables usadas por el runtime:

- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_SECRET_KEY`: credencial backend-only para Storage; nunca debe
  enviarse al navegador, documentarse con su valor ni exponerse en respuestas.
- `ATTACHMENTS_BUCKET`: bucket usado, por defecto `winter-attachments`.
- `ATTACHMENTS_SIGNED_URL_SECONDS`: duración positiva de la URL firmada, por
  defecto `300`.

La implementación comprueba en cada operación de Storage que el bucket
responda y que `public` sea exactamente `false`. El bucket debe permanecer
privado; el acceso se concede únicamente mediante URLs firmadas temporales.
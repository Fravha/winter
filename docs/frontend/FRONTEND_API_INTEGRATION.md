# Integración Frontend ↔ Winter API

**Proyecto:** Winter  
**Frontend:** `artifacts/sistema-produccion`  
**Backend:** `logger`  
**Contrato HTTP:** `logger/docs/api/*`

---

# 1. Propósito

Este documento define cómo el frontend oficial de Winter debe consumir la API HTTP implementada por el backend.

Su objetivo es evitar que humanos o IAs:

- inventen endpoints;
- inventen payloads;
- inventen permisos;
- deduzcan contratos desde Prisma;
- creen clientes HTTP diferentes por módulo;
- transformen incorrectamente datos;
- oculten errores contractuales;
- modifiquen backend para acomodar supuestos del frontend.

Regla principal:

> El frontend se adapta al contrato HTTP real de Winter. El backend no se modifica para coincidir con suposiciones del frontend.

---

# 2. Fuente contractual oficial

La fuente principal para cualquier integración HTTP es:

```text
logger/docs/api/
```

Índice:

```text
logger/docs/api/README.md
```

Contratos disponibles:

```text
logger/docs/api/AUTH_API.md

logger/docs/api/USERS_ROLES_PERMISSIONS_API.md

logger/docs/api/ARTICULOS_API.md

logger/docs/api/COMPRAS_API.md

logger/docs/api/INVENTORY_API.md

logger/docs/api/PRODUCTION_API.md

logger/docs/api/ATTACHMENTS_API.md
```

Contexto general del backend:

```text
logger/docs/BACKEND_HANDOFF.md
```

---

# 3. Jerarquía de decisión

Cuando se construya una integración:

```text
Documento API del módulo
        ↓
logger/docs/api/README.md
        ↓
logger/docs/BACKEND_HANDOFF.md
        ↓
FRONTEND_API_INTEGRATION.md
        ↓
FRONTEND_ARCHITECTURE.md
        ↓
código frontend existente
```

Nunca:

```text
captura visual
>
contrato backend
```

Nunca:

```text
código histórico
>
contrato backend actual
```

---

# 4. Regla de no invención

Antes de implementar una llamada HTTP debe conocerse:

- método;
- URL;
- autenticación;
- permiso;
- path params;
- query params;
- body;
- Content-Type;
- status exitoso;
- formato de respuesta;
- errores contractuales;
- idempotencia;
- efectos secundarios.

Si alguno de estos puntos es necesario para implementar y no está documentado:

```text
DETENER
   ↓
revisar contrato backend
   ↓
identificar decisión faltante
   ↓
documentar/corregir
   ↓
continuar
```

No completar por inferencia.

---

# 5. Base URL

Durante el desarrollo inicial, Winter Frontend consumirá el backend local. La URL de producción no debe configurarse hasta la fase de despliegue/smoke test. VITE_WINTER_API_URL permitirá cambiar el destino sin modificar código.

El backend Winter escucha localmente por defecto en:

```text
http://localhost:3000
```

La API funcional utiliza:

```text
/api/v1
```

Por tanto:

```text
http://localhost:3000/api/v1
```

Health endpoints quedan fuera de `/api/v1`.

```text
GET /health
GET /health/ready
GET /health/db
```

---

# 6. Configuración frontend

La URL backend no debe escribirse directamente en componentes.

El frontend utilizará:

```text
VITE_WINTER_API_URL
```

Ejemplo local:

```text
VITE_WINTER_API_URL=http://localhost:3000
```

Ejemplo conceptual en producción:

```text
VITE_WINTER_API_URL=https://api-winter.example.com
```

El dominio definitivo será decisión de despliegue.

---

# 7. Variables públicas y privadas

El frontend puede utilizar únicamente configuración pública.

Ejemplos permitidos:

```text
VITE_WINTER_API_URL

VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Nunca deben incluirse en el frontend:

```text
WINTER_DATABASE_URL

FIREBASE_PRIVATE_KEY

FIREBASE_CLIENT_EMAIL

SUPABASE_SECRET_KEY
```

Las variables `VITE_*` terminan dentro del bundle del navegador y deben considerarse públicas.

---

# 8. Autenticación

Winter utiliza Firebase Authentication como proveedor de identidad.

Flujo:

```text
Usuario
   ↓
Firebase Authentication
   ↓
Firebase ID Token
   ↓
Winter API
```

Los endpoints protegidos reciben:

```http
Authorization: Bearer <firebase-id-token>
```

El frontend debe obtener el ID Token desde la sesión Firebase activa.

---

# 9. Usuario local Winter

Tener sesión Firebase no significa automáticamente estar autorizado en Winter.

Después de autenticar:

```text
GET /api/v1/auth/me
```

Flujo:

```text
Firebase ID Token
        ↓
backend verifica token
        ↓
busca User local
        ↓
verifica status ACTIVE
        ↓
resuelve rol
        ↓
resuelve permisos
        ↓
devuelve Current User
```

---

# 10. `/auth/me`

Contrato:

```http
GET /api/v1/auth/me
Authorization: Bearer <firebase-id-token>
```

Respuesta conceptual:

```json
{
  "id": "uuid",
  "firebaseUid": "firebase-uid",
  "email": "usuario@example.com",
  "displayName": "Usuario",
  "status": "ACTIVE",
  "lastLoginAt": "2026-09-21T14:00:00.000Z",
  "roles": ["operator"],
  "permissions": [
    "articulos:read",
    "inventory:read"
  ]
}
```

Este endpoint constituye la fuente de verdad frontend para:

- usuario actual;
- rol efectivo;
- permisos efectivos.

---

# 11. RBAC

Los permisos de interfaz deben utilizar exactamente los códigos entregados/documentados por backend.

Ejemplo correcto:

```ts
can('articulos:create')
```

Incorrecto:

```ts
can('admin')
```

salvo que ese sea explícitamente un código de permiso real.

Incorrecto:

```text
si puede leer Inventory
entonces probablemente puede ajustar Inventory
```

Cada acción utiliza su permiso contractual.

---

# 12. Password reset

Winter expone:

```text
POST /api/v1/auth/password-reset
```

Body:

```json
{
  "email": "usuario@example.com"
}
```

Respuesta:

```text
202 Accepted
```

El backend devuelve la misma respuesta aunque el correo no exista para evitar enumeración de cuentas.

Por tanto, el frontend debe mostrar un mensaje neutral:

```text
Si existe una cuenta asociada, recibirás las instrucciones correspondientes.
```

No:

```text
El usuario no existe.
```

No realizar reintentos automáticos de este endpoint.

---

# 13. Cliente HTTP único

Debe existir una única abstracción HTTP reutilizable.

Ubicación recomendada:

```text
src/lib/api/
├── client.ts
├── request.ts
├── api-error.ts
└── api.types.ts
```

Responsabilidades:

- resolver base URL;
- obtener token Firebase;
- añadir `Authorization`;
- preparar headers;
- serializar JSON;
- soportar multipart;
- parsear respuestas;
- soportar HTTP 204;
- soportar AbortSignal;
- normalizar errores;
- conservar `requestId`.

No debe conocer reglas de negocio.

---

# 14. Prohibición de fetch directo

Incorrecto:

```tsx
function ArticulosPage() {
  fetch('/api/v1/articulos');
}
```

Correcto:

```text
ArticulosPage
    ↓
useArticulosQuery()
    ↓
articulos.api.ts
    ↓
request()
    ↓
Winter API
```

La página no debe implementar transporte HTTP.

---

# 15. Organización por módulo

Ejemplo:

```text
features/articulos/
│
├── api/
│   ├── articulos.api.ts
│   ├── articulos.keys.ts
│   └── articulos.hooks.ts
│
├── components/
│
├── pages/
│
├── schemas/
│
└── types/
```

No todos los módulos necesitan exactamente esta cantidad de archivos.

Lo importante es separar:

```text
HTTP
Query
UI
Tipos
Validación
```

---

# 16. React Query

TanStack React Query será la capa estándar para estado remoto.

Debe utilizarse para:

- listados;
- detalles;
- catálogos;
- búsquedas;
- mutations;
- cache;
- invalidación;
- refetch.

No guardar duplicados de datos remotos en Context o stores globales sin justificación.

---

# 17. Query Keys

Cada módulo debe tener un namespace estable.

Ejemplo:

```ts
export const articuloKeys = {
  all: ['articulos'] as const,

  lists: () =>
    [...articuloKeys.all, 'list'] as const,

  list: (filters: ArticuloFilters) =>
    [...articuloKeys.lists(), filters] as const,

  details: () =>
    [...articuloKeys.all, 'detail'] as const,

  detail: (id: string) =>
    [...articuloKeys.details(), id] as const,
};
```

Todo parámetro que cambie la respuesta debe formar parte de la query key.

---

# 18. Loading

Primera carga sin datos:

```text
Skeleton
```

Datos ya existentes + refetch:

```text
mantener contenido
+
indicador discreto
```

No:

```text
refetch
→ borrar tabla
→ mostrar skeleton
→ volver a mostrar tabla
```

Esto genera parpadeos innecesarios.

---

# 19. Mutations

Ejemplos:

```text
create
update
activate
deactivate
receive
cancel
transfer
adjust
transform
```

Durante una mutación:

- impedir doble envío;
- mantener formulario;
- bloquear únicamente la acción afectada;
- mostrar estado de progreso;
- conservar errores contractuales.

---

# 20. Invalidación

Después de una mutación deben invalidarse sólo los datos afectados.

Ejemplo:

```text
Editar artículo
    ↓
invalidar:
- lista artículos
- detalle artículo
```

Una recepción de compra puede afectar:

```text
Compras
+
Inventory
```

La invalidación debe seguir efectos reales de la operación.

No hacer por defecto:

```ts
queryClient.invalidateQueries();
```

sobre toda la aplicación.

---

# 21. Optimistic updates

No se utilizarán optimistic updates por defecto en operaciones de dominio.

Especialmente evitar en:

- Inventory movements;
- transferencias;
- ajustes;
- recepción de compras;
- transformaciones;
- pérdidas;
- Production;
- cambios de clasificación;
- operaciones que afecten stock.

Estas operaciones deben esperar confirmación backend.

---

# 22. Política de retry

## Queries

Las lecturas pueden tener retry limitado para fallos técnicos recuperables.

No deben reintentarse indefinidamente.

## Mutations

No aplicar retry automático global.

Motivo:

una mutación puede:

- cambiar stock;
- crear movimientos;
- enviar correo;
- transformar producto;
- afectar varios agregados.

Sólo aplicar retry cuando el contrato específico haga seguro hacerlo.

---

# 23. Idempotencia

Winter no utiliza idempotencia global.

Algunos endpoints pueden documentar:

```text
Idempotency-Key
```

o:

```text
operationKey
```

Si el endpoint no lo documenta:

```text
NO ENVIAR
```

---

# 24. Regla para Idempotency-Key

Cuando un endpoint requiera una clave:

```text
un intento lógico
=
una clave
```

Si hay retry técnico del mismo intento:

```text
reutilizar misma clave
```

No generar una nueva automáticamente.

Nueva acción intencional del usuario:

```text
nueva clave
```

---

# 25. Formato común de error

Backend:

```json
{
  "error": {
    "code": "CONTRACT_ERROR_CODE",
    "message": "Descripción segura",
    "requestId": "uuid"
  }
}
```

En no producción pueden existir `details`.

El frontend debe preservar como mínimo:

```ts
export type WinterApiError = {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
};
```

---

# 26. `requestId`

El `requestId` permite correlacionar un error de usuario con logs backend.

Debe conservarse.

Cuando sea útil para soporte puede mostrarse discretamente:

```text
Código de referencia: 47cc...
```

No ocultarlo dentro de un error genérico.

---

# 27. Status HTTP

Tratamiento general:

```text
400 → request o validación inválida

401 → autenticación

403 → usuario/permisos

404 → recurso inexistente

409 → conflicto de dominio o idempotencia

413 → payload/archivo demasiado grande

422 → validación semántica donde aplique

500 → error interno

502 → dependencia

503 → servicio/dependencia no disponible
```

Los códigos de error contractuales específicos siempre son más importantes que esta clasificación general.

---

# 28. Manejo 401

Un `401` no debe producir un loop infinito de refresh.

El cliente puede:

```text
request
  ↓
401 relacionado con token
  ↓
obtener token actualizado
  ↓
retry una vez
```

Si vuelve a fallar:

```text
propagar error
```

No reintentar indefinidamente.

---

# 29. Manejo 403

Un `403` puede significar:

- usuario no registrado;
- usuario inactivo;
- permiso insuficiente.

La respuesta contractual debe determinar la UX.

No tratar todo `403` automáticamente como logout sin comprobar su código.

---

# 30. HTTP 204

Algunos comandos responden:

```text
204 No Content
```

El cliente debe manejarlo sin intentar:

```ts
response.json()
```

Ejemplos reales incluyen operaciones administrativas documentadas por backend.

---

# 31. JSON

Cuando el endpoint use JSON:

```http
Content-Type: application/json
```

No enviar este header automáticamente en multipart.

---

# 32. Multipart

Attachments utiliza carga de archivos.

No debe tratarse como JSON.

Flujo:

```text
FormData
  ↓
request multipart
  ↓
backend
  ↓
Supabase privado
```

El navegador debe gestionar el `Content-Type` con boundary correspondiente.

No establecer manualmente:

```text
multipart/form-data
```

sin boundary.

---

# 33. Attachments

La API de Attachments es la única vía frontend para archivos operativos.

El frontend no debe conectarse directamente al bucket privado de Supabase.

Prohibido:

```text
frontend
→ SUPABASE_SECRET_KEY
→ bucket privado
```

Correcto:

```text
frontend
→ Winter API
→ backend
→ Supabase Storage
```

---

# 34. URLs firmadas

Las descargas de archivos pueden utilizar URLs firmadas temporales generadas por backend.

Estas URLs:

- son temporales;
- no deben almacenarse permanentemente;
- deben solicitarse nuevamente cuando expiren.

---

# 35. Decimal

Los valores Decimal del backend deben conservarse como string.

Correcto:

```json
{
  "quantity": "1500.375"
}
```

Frontend:

```ts
type Quantity = string;
```

Evitar:

```ts
type Quantity = number;
```

cuando represente un Decimal contractual.

---

# 36. Razón

JavaScript utiliza IEEE-754 para `number`.

Convertir:

```text
Decimal → number
```

puede introducir errores de precisión.

Por tanto:

```text
API
→ string decimal
→ frontend
→ string decimal
→ API
```

La UI puede formatearlo para mostrarlo.

---

# 37. Fechas

Backend devuelve fechas ISO-8601.

Ejemplo:

```text
2026-09-21T14:00:00.000Z
```

Los contratos frontend deben mantener inicialmente:

```ts
createdAt: string;
```

Convertir a `Date` sólo cuando sea necesario para presentación o cálculo de interfaz.

---

# 38. UUID

Los IDs se tratan como strings opacos.

Ejemplo:

```ts
id: string;
```

No construir lógica basada en estructura interna del UUID.

---

# 39. Enums

Los enums backend son case-sensitive.

Ejemplo real:

```text
MATERIA_PRIMA
PRODUCTO_PROCESO
PRODUCTO_ENVASADO
PRODUCTO_TERMINADO
```

La UI puede mostrar:

```text
Materia prima
Producto en proceso
Producto envasado
Producto terminado
```

Pero debe enviar:

```text
PRODUCTO_TERMINADO
```

---

# 40. No inventar enums

No construir:

```text
BORRADOR
EN_PROCESO
FINALIZADO
```

si el backend no los define.

Si la UI necesita una representación visual:

```text
enum backend
→ label frontend
```

No:

```text
label frontend
→ nuevo estado backend
```

---

# 41. Paginación

No existe una única paginación universal asumida.

Cada endpoint debe revisarse individualmente.

Ejemplo real — Artículos:

```text
page
pageSize
search
clasificacion
activo
```

`pageSize`:

```text
1–100
```

No cargar todos los registros para paginar en navegador cuando existe paginación backend.

---

# 42. Ejemplo — Listar artículos

Contrato:

```http
GET /api/v1/articulos
Authorization: Bearer <firebase-id-token>
```

Permiso:

```text
articulos:read
```

Query:

```text
page
pageSize
search
clasificacion
activo
```

Respuesta:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

---

# 43. Artículos — permisos

Permisos reales documentados incluyen:

```text
articulos:read
articulos:create
articulos:update
articulos:activate
articulos:deactivate
```

No inferir:

```text
articulos:update
=
articulos:activate
```

Son operaciones independientes.

---

# 44. Artículos — activate/deactivate

Endpoints:

```text
POST /api/v1/articulos/:id/activate

POST /api/v1/articulos/:id/deactivate
```

No representar estas operaciones mediante:

```text
PATCH activo = true
```

si el backend expone comandos específicos.

---

# 45. Artículos — campos operativos

El backend protege determinados cambios cuando existen referencias operacionales.

Por ejemplo, clasificación y unidad pueden quedar bloqueadas después de uso.

Si backend responde:

```text
409 ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE
```

el frontend debe mostrar el conflicto.

No convertirlo en:

```text
No se pudo guardar.
```

---

# 46. Compras

Contrato:

```text
logger/docs/api/COMPRAS_API.md
```

El frontend debe distinguir:

```text
registrar compra

recibir compra

cancelar compra
```

según los commands reales.

No implementar recepción como simple edición del estado.

---

# 47. Compra → Inventory

Cuando backend documenta:

```text
Purchase Receive
      ↓
InventoryMovement
      ↓
InventoryStock
```

el frontend no debe crear por separado:

```text
receive purchase
+
manual inventory entry
```

Eso duplicaría la operación.

El frontend ejecuta el command público correspondiente.

---

# 48. Inventory

Contrato:

```text
logger/docs/api/INVENTORY_API.md
```

El frontend debe consumir resultados backend para:

- almacenes;
- lotes;
- stock;
- movimientos;
- transferencias;
- ajustes;
- clasificaciones.

No calcular stock real desde movimientos en navegador como fuente autoritativa.

---

# 49. Production

Contrato:

```text
logger/docs/api/PRODUCTION_API.md
```

Production contiene operaciones de dominio complejas.

Antes de integrar cualquier command deben revisarse:

- estado requerido;
- inputs;
- outputs;
- permisos;
- errores;
- idempotencia;
- efectos sobre Inventory.

No tratar Production como CRUD genérico.

---

# 50. Users

Contrato:

```text
logger/docs/api/USERS_ROLES_PERMISSIONS_API.md
```

Users utiliza un único rol efectivo.

Operaciones documentadas incluyen:

- listar;
- obtener;
- crear;
- editar;
- activar;
- suspender;
- reenviar configuración de contraseña;
- reemplazar rol.

No crear soporte frontend para múltiples roles simultáneos si backend no lo soporta.

---

# 51. Roles

Los roles permiten:

- listar;
- obtener;
- crear;
- editar;
- eliminar según reglas;
- reemplazar conjunto de permisos.

Asignar permisos utiliza una operación específica.

No realizar múltiples llamadas arbitrarias para agregar/quitar permiso si el contrato define reemplazo completo.

---

# 52. Permissions

El frontend debe seguir exactamente lo documentado por:

```text
USERS_ROLES_PERMISSIONS_API.md
```

No asumir que el catálogo es read-only si la API actual expone CRUD.

La UI final puede restringir acciones según permisos reales.

---

# 53. Health

Endpoints reales:

```text
GET /health

GET /health/ready

GET /health/db
```

El health check no requiere Firebase.

Puede utilizarse para:

- diagnóstico;
- disponibilidad;
- despliegues;
- soporte.

No debe utilizarse para determinar autorización del usuario.

---

# 54. Cliente generado existente

Actualmente existe:

```text
lib/api-client-react
```

con el package:

```text
@workspace/api-client-react
```

Fue generado mediante Orval.

Sin embargo, la especificación actual del paquete contiene un health check hacia:

```text
/api/healthz
```

que no corresponde al contrato actual Winter.

Por tanto:

> `@workspace/api-client-react` NO debe usarse como fuente de verdad para integrar Winter en su estado actual.

---

# 55. Opciones futuras del cliente

Hay dos estrategias válidas.

## Estrategia A — cliente tipado manual

Construir clientes explícitos basados en:

```text
logger/docs/api/*
```

Ventajas iniciales:

- transparente;
- fácil de auditar;
- contratos claros;
- control preciso.

---

## Estrategia B — cliente generado

Puede adoptarse cuando exista:

```text
OpenAPI Winter
```

que haya sido verificado contra:

```text
backend real
+
docs/api
```

Entonces podría regenerarse:

```text
@workspace/api-client-react
```

No crear un OpenAPI inventado sólo para generar el frontend.

---

# 56. Regla sobre el cliente generado

Incorrecto:

```text
/api-client dice /api/healthz
        ↓
cambiar backend para crear /api/healthz
```

Correcto:

```text
backend real dice /health
        ↓
actualizar especificación
        ↓
regenerar cliente
```

El contrato backend manda.

---

# 57. Tipos frontend

Los tipos frontend deben representar HTTP.

No importar:

```text
Prisma types
```

para modelar respuestas.

Ejemplo:

```ts
export interface ArticuloDto {
  id: string;
  codigo: string;
  codigoExterno: string | null;
  nombre: string;
  clasificacion: ArticuloClasificacion;
  unidadMedida: UnidadMedida;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Este tipo debe derivarse del contrato HTTP, no del schema Prisma.

---

# 58. Validación frontend

Zod puede representar constraints contractuales.

Ejemplo:

```text
campo requerido
longitud
email
enum
formato
```

No agregar reglas que backend no documente.

La validación frontend mejora UX.

La validación backend es autoritativa.

---

# 59. Response normalizada

No asumir que todos los endpoints devuelven:

```json
{
  "data": {}
}
```

Por ejemplo:

```text
/auth/me
```

tiene contrato propio.

Otros endpoints devuelven:

```json
{
  "data": {}
}
```

Listados paginados pueden devolver:

```json
{
  "data": [],
  "meta": {}
}
```

Cada función debe tiparse según el endpoint real.

---

# 60. AbortSignal

Las queries deben soportar cancelación cuando React Query proporcione `signal`.

Conceptualmente:

```ts
queryFn: ({ signal }) =>
  listArticulos(filters, { signal })
```

Esto evita mantener requests innecesarios al cambiar de ruta o filtros.

---

# 61. Filtros

Los filtros deben enviarse utilizando nombres contractuales.

No renombrar internamente el query HTTP de manera ambigua.

Ejemplo:

```text
UI: Clasificación
HTTP: clasificacion
```

Los labels pueden traducirse, los nombres HTTP no.

---

# 62. Búsqueda

Cuando backend expone:

```text
search
```

utilizar ese parámetro.

No descargar el catálogo completo y filtrar localmente salvo que el contrato/dataset justifique explícitamente hacerlo.

---

# 63. Debounce

Para búsquedas remotas puede utilizarse debounce.

Ejemplo:

```text
300–500 ms
```

si mejora UX.

Pero:

```text
input
→ debounce
→ query
```

no debe cambiar el contrato HTTP.

---

# 64. Cache

React Query puede conservar resultados entre navegaciones.

Esto mejora especialmente la sensación de esos 1–2 segundos de respuesta observados durante pruebas.

Flujo esperado:

```text
Primera visita
→ skeleton
→ API
→ datos

segunda visita
→ cache inmediata
→ refetch en background si corresponde
```

---

# 65. Stale Time

No establecer un único `staleTime` arbitrario para todo Winter.

Puede variar según tipo de dato.

Ejemplos conceptuales:

```text
catálogos relativamente estables
→ cache mayor

stock operativo
→ cache menor
```

Los valores concretos deben definirse cuando se implemente cada patrón.

---

# 66. Seguridad

El frontend nunca debe confiar en:

```text
oculté el botón
=
usuario no puede ejecutar
```

Un usuario puede realizar requests manualmente.

Por tanto:

```text
Frontend → UX
Backend → seguridad
```

---

# 67. Auditoría

El actor auditado proviene del token autenticado.

No enviar:

```json
{
  "userId": "...",
  "actorId": "...",
  "createdBy": "..."
}
```

si el endpoint no lo documenta.

El backend determina al actor.

---

# 68. CORS

Frontend y backend pueden ejecutarse en dominios distintos.

Conceptualmente:

```text
https://produccion.example.com
```

y:

```text
https://api-produccion.example.com
```

Backend debe permitir el origen frontend mediante su configuración CORS.

El frontend no puede resolver un CORS incorrecto mediante headers propios.

---

# 69. Entorno local

Conceptualmente:

```text
Frontend
http://localhost:<vite-port>

Backend
http://localhost:3000
```

El frontend consumirá:

```text
VITE_WINTER_API_URL=http://localhost:3000
```

No es obligatorio usar proxy Vite si CORS backend está correctamente configurado.

---

# 70. Integración en Replit

En Replit:

```text
Frontend
artifacts/sistema-produccion

Backend
logger
```

La URL efectiva depende de la configuración de runtime.

No hardcodear URLs temporales de Replit dentro del código.

Utilizar variables de entorno.

---

# 71. Integración en Vercel

El frontend se desplegará como proyecto independiente dentro de Vercel aunque permanezca en el mismo repo.

Ejemplo conceptual:

```text
Repo: Fravha/winter

Vercel Frontend
Root Directory:
artifacts/sistema-produccion
```

La API se configurará mediante:

```text
VITE_WINTER_API_URL
```

en el environment de Vercel.

---

# 72. Flujo obligatorio para implementar endpoint

Antes de programar:

## Paso 1

Abrir:

```text
logger/docs/api/<MODULE>_API.md
```

## Paso 2

Identificar:

```text
method
path
permission
auth
query
body
response
errors
idempotency
```

## Paso 3

Crear tipos HTTP.

## Paso 4

Crear función API.

## Paso 5

Crear query/mutation hook.

## Paso 6

Añadir permiso UX.

## Paso 7

Crear UI.

## Paso 8

Implementar:

```text
loading
success
empty
error
forbidden
```

cuando corresponda.

## Paso 9

Probar errores contractuales.

---

# 73. Checklist de integración

Antes de considerar integrado un endpoint:

```text
[ ] URL exacta
[ ] método exacto
[ ] permiso real
[ ] token Firebase cuando corresponde
[ ] query params correctos
[ ] body correcto
[ ] Content-Type correcto
[ ] respuesta tipada
[ ] 204 manejado
[ ] errores normalizados
[ ] requestId conservado
[ ] Decimal como string
[ ] enum exacto
[ ] idempotencia correcta
[ ] loading
[ ] skeleton
[ ] invalidación
[ ] double submit bloqueado
```

---

# 74. Definition of Done de integración

Una integración no está terminada porque el request responda `200`.

Debe comprobar:

```text
happy path
+
loading
+
error
+
permissions
+
invalid input
+
conflicto de negocio
+
cache
+
invalidación
+
responsive UX
```

según corresponda al endpoint.

---

# 75. Regla para Replit / IA

Antes de escribir código HTTP, Replit debe poder responder:

```text
¿Dónde está documentado este endpoint?

¿Qué método utiliza?

¿Qué permiso requiere?

¿Qué payload acepta?

¿Qué respuesta devuelve?

¿Qué errores debo contemplar?

¿Utiliza JSON o multipart?

¿Tiene idempotencia?

¿Afecta otro módulo?
```

Si no puede responder:

```text
NO IMPLEMENTAR AÚN
```

Debe revisar documentación.

---

# 76. Regla de modificación backend

Una tarea frontend no autoriza modificar:

```text
logger/src
```

para:

- agregar endpoints;
- relajar validaciones;
- renombrar campos;
- cambiar permisos;
- modificar estados;
- alterar workflows.

Si realmente se necesita un cambio backend:

```text
detectar necesidad
        ↓
documentarla
        ↓
evaluarla como decisión backend
        ↓
aprobar
        ↓
modificar contrato
        ↓
implementar backend
        ↓
actualizar frontend
```

---

# 77. Documentos relacionados

Este documento debe leerse junto con:

```text
FRONTEND_CURRENT_STATE.md

FRONTEND_ARCHITECTURE.md

FRONTEND_DESIGN_SYSTEM.md

FRONTEND_COMPONENTS.md

FRONTEND_SCREEN_PATTERNS.md

FRONTEND_MODULE_MAP.md

FRONTEND_IMPLEMENTATION_RULES.md

FRONTEND_REFERENCE_ANALYSIS.md
```

---

# 78. Regla final

> Toda llamada HTTP de Winter Frontend debe poder rastrearse hasta un contrato explícito dentro de `logger/docs/api/*`. Si no existe ese contrato, el frontend no debe inventarlo.
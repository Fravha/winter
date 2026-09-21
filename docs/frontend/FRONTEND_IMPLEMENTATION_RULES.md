# Reglas de implementación — Winter Frontend

**Versión:** 0.2  
**Fecha:** 2026-09-21  
**Estado:** contrato obligatorio de implementación  
**Frontend oficial:** `artifacts/sistema-produccion`  
**Proyecto:** Winter — Bodega Cruce del Zorro

---

# 1. Propósito

Este documento establece las reglas obligatorias que deben seguir humanos, Replit e IA al implementar el frontend de Winter.

Su objetivo es evitar:

- invención de contratos;
- duplicación de arquitectura;
- componentes paralelos;
- lógica de negocio en frontend;
- inconsistencias visuales;
- rutas arbitrarias;
- textos visibles en inglés;
- integraciones HTTP improvisadas;
- modificaciones accidentales del backend;
- reescrituras innecesarias.

Regla principal:

> **La IA implementa dentro de la arquitectura aprobada; no rediseña la arquitectura mientras desarrolla una pantalla.**

---

# 2. Alcance

Estas reglas aplican a:

```text
artifacts/sistema-produccion
```

y a la documentación frontend ubicada en:

```text
docs/frontend
```

Una tarea exclusivamente frontend no autoriza cambios en:

```text
logger/src
logger/prisma
migraciones backend
contratos HTTP backend
reglas de dominio
```

salvo aprobación explícita.

---

# 3. Fuentes de verdad

Antes de implementar una funcionalidad, utilizar esta jerarquía.

## Backend

```text
1. logger/docs/api/*
2. logger/docs/BACKEND_HANDOFF.md
3. contratos arquitectónicos de logger/docs/architecture/*
```

## Frontend

```text
1. FRONTEND_ARCHITECTURE.md
2. FRONTEND_API_INTEGRATION.md
3. FRONTEND_DESIGN_SYSTEM.md
4. FRONTEND_COMPONENTS.md
5. FRONTEND_SCREEN_PATTERNS.md
6. FRONTEND_MODULE_MAP.md
7. FRONTEND_IMPLEMENTATION_RULES.md
8. FRONTEND_CURRENT_STATE.md
9. FRONTEND_REFERENCE_ANALYSIS.md
```

Las capturas visuales y frontend históricos son referencia.

No son contrato funcional.

---

# 4. Regla de no invención

Está prohibido inventar:

- endpoints;
- métodos HTTP;
- request bodies;
- responses;
- campos;
- enums;
- estados;
- transiciones;
- permisos;
- relaciones;
- comandos;
- reglas de stock;
- conversiones;
- cálculos;
- métricas;
- workflows;
- capacidades backend.

Si algo necesario no está documentado:

```text
NO implementar por suposición
```

Debe identificarse como vacío contractual.

---

# 5. Backend como autoridad

El frontend administra:

- presentación;
- navegación;
- captura;
- formularios;
- filtros;
- loading;
- errores;
- cache;
- feedback;
- permisos visuales.

El backend administra:

- autorización real;
- invariantes;
- estados;
- stock;
- atomicidad;
- concurrencia;
- idempotencia;
- auditoría;
- reglas productivas;
- reglas de negocio.

Regla:

> **Una validación frontend nunca sustituye una validación backend.**

---

# 6. Stack oficial

Winter utiliza la base existente:

```text
React
TypeScript
Vite
Wouter
TanStack React Query
Tailwind CSS 4
Radix UI
patrón shadcn/ui existente
Lucide React
React Hook Form
Zod
Sonner / Toaster
Recharts
date-fns
Firebase Authentication
class-variance-authority
clsx
tailwind-merge
```

Estas tecnologías forman parte de la arquitectura aprobada.

---

# 7. Cambios de stack

No sustituir sin aprobación explícita:

```text
Wouter
→ React Router

React Query
→ Redux / Zustand

Tailwind
→ Material UI

Radix
→ otro sistema UI

Firebase Authentication
→ autenticación propia
```

Tampoco introducir un segundo sistema equivalente.

---

# 8. Dependencias nuevas

No agregar una dependencia simplemente por conveniencia.

Antes debe comprobarse:

1. si la capacidad ya existe;
2. si puede resolverse con el stack actual;
3. si la dependencia introduce otro patrón arquitectónico;
4. si realmente aporta valor.

Una dependencia nueva relevante requiere decisión explícita.

---

# 9. Estado actual del frontend

La aplicación oficial está en:

```text
artifacts/sistema-produccion
```

Actualmente constituye principalmente una **base técnica**.

No debe asumirse que ya existen oficialmente:

```text
AuthContext funcional
RBAC completo
AppShell final
Login final
módulos Winter funcionales
```

aunque existieran implementaciones históricas en otros frontends.

---

# 10. Frontend histórico

Las implementaciones previas de Logger/CDZ pueden utilizarse para:

- analizar UX;
- recuperar ideas;
- consultar comportamiento;
- reutilizar lógica compatible.

No deben copiarse automáticamente.

Especialmente:

```text
Products
Purchases histórico
AuthContext histórico
layouts históricos
```

no constituyen contratos del frontend actual.

---

# 11. Evolución incremental

Preferir:

```text
infraestructura compartida
↓
un módulo
↓
validación
↓
reutilización
↓
siguiente módulo
```

Evitar:

```text
reescribir toda la aplicación de una vez
```

No reorganizar masivamente carpetas sólo para cumplir una estructura teórica.

---

# 12. Idioma obligatorio

Toda interfaz visible de Winter debe estar en:

```text
Español
```

Localización:

```text
es-BO
```

No introducir textos visibles en inglés.

Incorrecto:

```text
Save
Cancel
Loading...
Inventory
Production
No data
```

Correcto:

```text
Guardar
Cancelar
Cargando...
Inventario
Producción
No se encontraron registros
```

---

# 13. Nombres visibles de módulos

Utilizar:

```text
Inicio
Artículos
Compras
Inventario
Producción
Usuarios
Roles
Permisos
```

No utilizar nombres visibles en inglés.

---

# 14. Código interno

Los conceptos técnicos del ecosistema pueden conservar inglés.

Ejemplos:

```text
useQuery
mutation
request
response
hook
props
children
className
```

No renombrar APIs de librerías externas.

La regla de español se aplica al producto visible.

---

# 15. Rutas frontend

Las nuevas rutas del producto deben estar en español.

Ejemplos:

```text
/articulos
/compras
/inventario
/produccion
/usuarios
/roles
/permisos
```

Las rutas HTTP backend **no se traducen**.

---

# 16. Localización

Configuración inicial:

```text
locale:
es-BO

timezone:
America/La_Paz

moneda principal:
BOB

representación habitual:
Bs
```

Los formatos visuales deben centralizarse.

No crear formatos distintos en cada página.

---

# 17. Fechas

La API conserva ISO-8601.

La UI puede representar:

```text
21/09/2026
```

o:

```text
21/09/2026 10:45
```

según contexto.

No alterar el valor contractual por motivos de presentación.

---

# 18. Decimal

Los valores Decimal del backend deben conservarse como:

```text
string
```

cuando así lo define el contrato.

Incorrecto:

```ts
Number(dto.quantity)
```

como conversión automática general.

Correcto:

```text
preservar string contractual
+
formatear sólo para presentación
```

---

# 19. Enums

Los enums backend se envían exactamente como el contrato indica.

Ejemplo:

```text
REGISTERED
```

UI:

```text
Registrada
```

Request:

```text
REGISTERED
```

No enviar `"Registrada"` si el backend espera `REGISTERED`.

---

# 20. Arquitectura por feature

Los módulos deben organizar su implementación funcionalmente.

Ejemplo:

```text
features/articulos/
├── api/
├── components/
├── pages/
├── schemas/
└── types/
```

No todos los módulos necesitan todas las carpetas.

Evitar estructura innecesaria.

---

# 21. Componentes existentes primero

Antes de crear cualquier componente, revisar:

```text
src/components/ui
```

La base ya contiene primitivas como:

```text
Button
Input
Textarea
Select
Card
Badge
Table
Dialog
AlertDialog
DropdownMenu
Sheet
Tabs
Tooltip
Form
Skeleton
Sonner / Toaster
```

No crear duplicados.

---

# 22. Prohibición de componentes paralelos

No crear:

```text
WinterButton
CdzButton
CustomButton
Button2
```

si `Button` cubre el caso.

Lo mismo aplica a:

```text
Dialog
Modal
Table
Select
Badge
Tooltip
Toast
Skeleton
```

---

# 23. Composición antes que duplicación

Si una necesidad puede resolverse mediante:

```text
primitiva
+
variante
+
composición
```

no crear otra biblioteca.

---

# 24. Componentes compartidos Winter

Los patrones compartidos pueden incluir:

```text
AppShell
Sidebar
Topbar
PageHeader
SectionHeader
Can
FilterBar
DataTable
Pagination
StatusBadge
EmptyState
ErrorState
TableSkeleton
ConfirmDialog
```

Deben construirse cuando aparezca la necesidad real.

No implementar todo por adelantado.

---

# 25. Componentes de dominio

Los componentes específicos deben vivir preferentemente dentro de su feature.

Ejemplos:

```text
StockIndicator
LotIdentifier
MovementTypeBadge
BatchSummary
TraceabilityTimeline
```

No mover a `shared` un componente usado una sola vez.

---

# 26. CSS

El frontend utiliza:

```text
Tailwind CSS 4
+
tokens semánticos
+
variantes de componentes
```

No crear un sistema CSS paralelo.

---

# 27. Tokens

Utilizar los tokens semánticos existentes:

```text
background
foreground
card
primary
secondary
muted
accent
destructive
border
input
ring
sidebar
chart-*
```

No crear un segundo sistema `--winter-*` que duplique los mismos roles.

---

# 28. Colores hardcoded

Evitar en componentes:

```text
#7A1234
rgb(...)
hsl(...)
```

cuando exista un token semántico equivalente.

Los valores físicos pertenecen al Design System, no a las páginas.

---

# 29. Theme

Toda implementación debe funcionar en:

```text
Light
Dark
```

No crear:

```text
ComponentLight
ComponentDark
```

para resolver el mismo componente.

La diferencia se implementa mediante tokens.

---

# 30. Estados visuales

Cada componente interactivo debe considerar cuando corresponda:

```text
default
hover
focus
active
disabled
loading
selected
error
```

---

# 31. Routing

Winter utiliza:

```text
Wouter
```

No introducir APIs de React Router como:

```text
Outlet
useNavigate
Routes
```

salvo cambio arquitectónico aprobado.

---

# 32. AppShell

Las rutas autenticadas deben compartir:

```text
AppShell
├── Sidebar
├── Topbar
└── MainContent
```

No construir un layout independiente por módulo.

---

# 33. Navegación

La Sidebar debe derivarse de configuración.

No repetir manualmente JSX por módulo.

Debe respetar:

- rutas;
- permisos;
- agrupaciones;
- estado activo.

---

# 34. Sidebar

Mapa principal:

```text
GENERAL
  Inicio

OPERACIONES
  Artículos
  Compras
  Inventario
  Producción

ADMINISTRACIÓN
  Usuarios
  Roles
  Permisos
```

No añadir cada entidad backend como item principal.

---

# 35. Autenticación

Winter utiliza Firebase Authentication.

Flujo:

```text
Firebase login
↓
Firebase ID Token
↓
GET /api/v1/auth/me
↓
Winter User
↓
permisos efectivos
```

No crear una sesión paralela.

---

# 36. Tokens de autenticación

No almacenar manualmente Firebase ID Tokens en:

```text
localStorage
sessionStorage
cookies personalizados
```

salvo decisión arquitectónica explícita.

Utilizar Firebase como autoridad de sesión.

---

# 37. AuthContext

Debe existir una única abstracción de autenticación.

Conceptualmente:

```text
firebaseUser
winterUser
permissions
loading
login()
logout()
refreshUser()
can()
```

No crear múltiples contextos de sesión.

---

# 38. RBAC

La UI puede utilizar:

```ts
can(permission)
```

para:

- navegación;
- rutas;
- botones;
- acciones;
- formularios.

Pero:

> **RBAC frontend es UX, no seguridad.**

El backend sigue autorizando cada request.

---

# 39. No autorizar por nombre de rol

Incorrecto:

```ts
if (user.role === "admin")
```

cuando la operación puede decidirse por permisos.

Preferir:

```ts
can("permiso-contractual")
```

---

# 40. Un usuario, un rol

El contrato vigente establece:

```text
1 usuario
→
1 rol
```

No reconstruir una UI histórica de múltiples roles.

---

# 41. API Layer

No realizar `fetch()` disperso en páginas.

Incorrecto:

```text
ArticulosPage
→ fetch(...)
```

Correcto:

```text
ArticulosPage
↓
useArticulosQuery()
↓
articulos.api.ts
↓
HTTP client común
↓
Winter API
```

---

# 42. Base URL

La URL se obtiene desde:

```text
VITE_WINTER_API_URL
```

No hardcodear una URL backend.

Durante desarrollo inicial:

```text
frontend local
→ backend local
```

Ejemplo:

```text
http://localhost:3000
```

La URL de producción se configura únicamente mediante variables del entorno de despliegue.

---

# 43. Cliente HTTP común

Debe centralizar:

- base URL;
- Firebase token;
- Authorization;
- JSON;
- multipart;
- AbortSignal;
- 204;
- errores;
- requestId.

No debe contener reglas de negocio.

---

# 44. Cliente generado actual

Existe:

```text
@workspace/api-client-react
```

pero actualmente no representa correctamente todo el contrato Winter.

Por tanto:

> **No utilizarlo como fuente de verdad.**

Sólo podrá convertirse en cliente principal si es regenerado desde una especificación validada contra la API Winter.

---

# 45. HTTP contract

Cada request implementado debe poder justificarse mediante:

```text
logger/docs/api/*
```

Antes de escribirlo deben identificarse:

- método;
- URL;
- auth;
- permiso;
- params;
- body;
- response;
- status;
- errores;
- idempotencia cuando aplique.

---

# 46. React Query

Los datos remotos pertenecen a:

```text
TanStack React Query
```

No duplicarlos innecesariamente en:

```text
Context
useState global
Redux
Zustand
```

---

# 47. Query Keys

Cada feature debe mantener keys consistentes.

Los filtros que modifiquen la respuesta deben formar parte de la query key.

---

# 48. Invalidación

Después de una mutación:

```text
invalidar únicamente queries afectadas
```

No invalidar toda la aplicación por defecto.

---

# 49. Optimistic updates

No usar por defecto en:

- stock;
- recepción de compras;
- transferencias;
- ajustes;
- movimientos;
- transformaciones;
- producción;
- consumos;
- salidas;
- mermas.

Estas operaciones esperan confirmación real del backend.

---

# 50. Retries

No configurar retries agresivos globales.

Queries pueden utilizar reintento técnico limitado cuando sea seguro.

Mutations no deben repetirse automáticamente sin revisar idempotencia.

---

# 51. Idempotencia

Sólo implementar idempotencia cuando el endpoint lo documente.

Puede utilizar:

```text
Idempotency-Key
```

o:

```text
operationKey
```

según contrato.

No inventar una estrategia uniforme.

---

# 52. Formularios

Herramientas oficiales:

```text
React Hook Form
+
Zod
```

cuando la complejidad lo justifique.

---

# 53. Validación frontend

Puede validar:

- requerido;
- longitud;
- formato;
- sintaxis;
- enum;
- reglas contractuales explícitas.

No inventar:

- reglas productivas;
- reglas de stock;
- compatibilidades;
- transiciones;
- conversiones.

---

# 54. Submit

Todo formulario debe utilizar:

```html
<form>
```

cuando represente un formulario real.

Debe:

- usar submit semántico;
- impedir doble envío;
- conservar valores tras error;
- mostrar errores cerca del campo;
- diferenciar error cliente/backend.

---

# 55. Mutation loading

Durante una mutación:

```text
Guardar
→
Guardando...
```

La acción afectada se deshabilita.

No bloquear toda la aplicación salvo necesidad real.

---

# 56. Commands

Operaciones como:

```text
Recibir compra
Transferir
Registrar ajuste
Confirmar transformación
Cerrar orden
```

son comandos de dominio.

No representarlos como:

```text
editar campo estado
```

si backend los modela como endpoints específicos.

---

# 57. Confirmaciones

No utilizar:

```ts
window.confirm()
```

Utilizar:

```text
AlertDialog
```

o:

```text
ConfirmDialog
```

según el patrón aprobado.

---

# 58. Dialog

Utilizar las primitivas Radix existentes.

No construir overlays manuales si `Dialog`, `AlertDialog` o `Sheet` cubren el caso.

---

# 59. Loading inicial

Cuando una vista no tiene datos cacheados:

```text
Skeleton estructural
```

No:

```text
spinner central gigante
```

---

# 60. Skeleton

Ya existe:

```text
src/components/ui/skeleton.tsx
```

Debe reutilizarse.

El Skeleton debe aproximar la estructura final.

---

# 61. Refetch

Si ya existen datos:

```text
mantener contenido visible
+
indicador discreto
```

No reemplazar datos por Skeleton.

---

# 62. Empty State

Sólo mostrar después de una respuesta exitosa vacía.

Incorrecto:

```text
loading
→ No hay datos
```

Correcto:

```text
loading
→ Skeleton

success + []
→ EmptyState
```

---

# 63. Errores API

Normalizar mediante:

```ts
type WinterApiError = {
  status: number;
  code: string;
  message: string;
  requestId?: string;
};
```

No perder:

```text
requestId
```

cuando backend lo proporciona.

---

# 64. Error de campo

Mostrar cerca del campo.

---

# 65. Error de región

Utilizar:

```text
ErrorState
```

con reintento cuando tenga sentido.

---

# 66. Error de mutation

Puede utilizar:

- error local;
- Alert;
- Toast;
- Dialog;

dependiendo del contexto.

No reducir todos los errores a:

```text
Ocurrió un error
```

si existe un error contractual más útil.

---

# 67. HTTP 401

Debe tratarse como problema de autenticación.

Puede intentarse recuperar token según la estrategia definida.

No crear loops infinitos de refresh/retry.

---

# 68. HTTP 403

Significa autorización insuficiente.

No asumir automáticamente que:

```text
403
→ cerrar sesión
```

El usuario puede estar correctamente autenticado pero no autorizado para esa operación.

---

# 69. HTTP 409

Debe tratarse como conflicto.

Especialmente importante en:

- estados;
- concurrencia;
- comandos;
- reglas de dominio.

No ocultarlo bajo un mensaje genérico.

---

# 70. HTTP 204

No intentar ejecutar:

```ts
response.json()
```

sobre una respuesta sin contenido.

---

# 71. Tablas

Usar tabla semántica cuando la información sea tabular.

No sustituir por cards sólo por estética.

---

# 72. DataTable

`DataTable` no debe hacer requests directamente.

Correcto:

```text
Page
↓
query hook
↓
DataTable
```

---

# 73. Paginación

Si backend pagina:

```text
utilizar paginación servidor
```

No descargar miles de registros para paginar en cliente.

---

# 74. Filtros

Sólo implementar filtros soportados por el endpoint.

No asumir que todo campo visible en la tabla puede filtrarse remotamente.

---

# 75. Búsqueda

Cuando sea remota y corresponda:

```text
Input
→ debounce
→ query
```

Evitar request por pulsación sin estrategia.

---

# 76. Dashboard

No inventar:

- métricas;
- tendencias;
- alertas;
- gráficos;
- promedios.

Un KPI debe tener origen real.

No cargar masivamente registros para calcular un Dashboard si backend no lo soporta.

---

# 77. Inventario

Reglas frontend obligatorias:

- no editar stock como campo;
- no recalcular stock como fuente de verdad;
- no duplicar movimientos;
- usar commands backend;
- esperar confirmación servidor.

---

# 78. Compras

Registrar compra y recibir compra son conceptos distintos cuando así lo define el backend.

No asumir:

```text
registrar compra
=
ingresar stock
```

---

# 79. Producción

No implementar como CRUD genérico.

Debe respetar conceptos como:

- órdenes;
- Lotes;
- trabajos;
- transformaciones;
- mediciones;
- recipientes;
- consumos;
- salidas;
- mermas;
- trazabilidad.

No inventar un wizard obligatorio si el dominio no exige secuencia.

---

# 80. Artículos

Artículos es el maestro único.

No crear catálogos paralelos para categorías que pertenecen a su clasificación.

---

# 81. Adjuntos

El frontend debe consumir únicamente:

```text
API Winter
```

para operaciones de adjuntos.

No conectar directamente el cliente al bucket privado.

---

# 82. Secrets

Nunca incluir en frontend:

```text
DATABASE_URL
FIREBASE_PRIVATE_KEY
SUPABASE_SECRET_KEY
service role keys
credenciales privadas
```

Sólo variables públicas `VITE_*` apropiadas para cliente.

---

# 83. Accesibilidad

Todo código nuevo debe contemplar:

- teclado;
- focus visible;
- labels;
- ARIA;
- nombres accesibles;
- contraste;
- `prefers-reduced-motion`;
- estados no expresados sólo mediante color.

---

# 84. Icon-only

Todo botón únicamente con icono requiere:

```text
aria-label
```

Tooltip cuando aporte claridad.

---

# 85. Responsive

Cada pantalla debe funcionar como mínimo en:

```text
móvil
desktop
```

y adaptarse correctamente en tablet.

Winter es desktop-first operativo, no desktop-only.

---

# 86. Mobile

No resolver móvil simplemente:

```text
reduciendo la fuente
```

Debe adaptarse:

- navegación;
- columnas;
- formularios;
- filtros;
- tablas;
- acciones.

---

# 87. Light / Dark

Una funcionalidad visual no está terminada si sólo funciona en un tema.

Validar:

- background;
- foreground;
- border;
- hover;
- focus;
- selected;
- disabled;
- error;
- success;
- warning;
- dialogs;
- tablas.

---

# 88. Performance

Priorizar:

- cache React Query;
- paginación backend;
- invalidación selectiva;
- skeletons;
- AbortSignal;
- evitar requests duplicados;
- evitar renders innecesarios.

No optimizar prematuramente mediante arquitectura compleja.

---

# 89. Código TypeScript

Código nuevo debe:

- tipar props;
- tipar DTOs;
- tipar respuestas;
- evitar `any`;
- evitar casts para esconder errores.

No utilizar:

```ts
as unknown as SomeType
```

únicamente para hacer desaparecer un error de compilación.

---

# 90. Tipos backend

El frontend trabaja con:

```text
DTOs HTTP
```

No con:

```text
modelos Prisma
```

Está prohibido importar Prisma como contrato frontend.

---

# 91. Zod

Zod puede validar:

- formularios;
- estructuras contractuales cuando sea útil.

No utilizar Zod para crear reglas de negocio que el backend no ha definido.

---

# 92. Estado local

Utilizar estado local para:

- Dialog abierto;
- Sheet;
- tab activa;
- formulario;
- selección;
- filtros temporales;
- confirmaciones.

No elevar todo a estado global.

---

# 93. Estado remoto

Pertenece a React Query.

No copiarlo a Context únicamente para tenerlo disponible en varias pantallas.

---

# 94. Manejo de permisos visuales

Acciones no autorizadas normalmente deben ocultarse.

Puede utilizarse disabled cuando conocer la existencia de la acción aporte contexto.

La decisión es UX.

La seguridad permanece backend.

---

# 95. Componentes enormes

Evitar archivos que combinen simultáneamente:

- API;
- reglas;
- tabla;
- formulario;
- múltiples dialogs;
- layout;
- navegación;
- estados globales.

Separar cuando mejore comprensión y reutilización.

No fragmentar trivialmente sólo para aumentar cantidad de archivos.

---

# 96. Nombres

Los nombres deben describir responsabilidad.

Correcto:

```text
ArticulosPage
ArticuloForm
TableSkeleton
StatusBadge
StockIndicator
```

Evitar:

```text
Component1
GeneralModal
NewTable
PrettyCard
Utils2
```

---

# 97. Comentarios

No llenar el código de comentarios que repitan lo obvio.

Documentar principalmente:

- decisiones no evidentes;
- restricciones contractuales;
- workaround necesario;
- razones arquitectónicas.

---

# 98. No modificar backend para facilitar UI

Está prohibido decidir unilateralmente:

```text
"este endpoint es incómodo, lo cambio"
```

El frontend debe consumir el contrato existente.

Si el contrato no permite resolver correctamente el caso, reportar el vacío.

---

# 99. No modificar contratos silenciosamente

No editar documentación backend únicamente para hacer coincidir una implementación frontend.

Una modificación contractual requiere una decisión separada.

---

# 100. No inventar datos demo permanentes

Los mocks pueden utilizarse temporalmente sólo cuando la tarea lo autorice claramente.

No dejar:

- usuarios falsos;
- artículos falsos;
- stock falso;
- métricas inventadas;

como comportamiento final.

---

# 101. Datos reales vs placeholders

Placeholder visual:

```text
permitido durante construcción
```

Dato funcional inventado:

```text
no permitido
```

La diferencia debe ser clara.

---

# 102. Código antiguo

Antes de reutilizar código histórico comprobar:

1. stack;
2. contrato API;
3. modelo RBAC;
4. tipos;
5. rutas;
6. idioma;
7. Design System.

No copiar por similitud visual.

---

# 103. Flujo obligatorio antes de implementar

Para cada tarea:

```text
1. identificar módulo

2. leer documentos frontend relevantes

3. leer contrato HTTP correspondiente

4. inspeccionar código actual

5. identificar componentes reutilizables

6. identificar rutas/permisos/endpoints

7. determinar patrón de pantalla

8. implementar sólo el alcance solicitado
```

---

# 104. Durante implementación

La IA debe:

- conservar arquitectura;
- hacer cambios pequeños;
- reutilizar primitivas;
- mantener tipos;
- mantener idioma;
- respetar contratos;
- no expandir alcance sin necesidad.

---

# 105. Después de implementar

Debe revisar:

```text
routing
permisos
loading
empty
error
refetch
mutation loading
responsive
Light
Dark
accesibilidad
```

según corresponda.

---

# 106. Validación técnica

Como mínimo ejecutar:

```bash
pnpm --filter @workspace/sistema-produccion run typecheck
```

y:

```bash
pnpm --filter @workspace/sistema-produccion run build
```

antes de considerar una entrega frontend terminada.

---

# 107. No ocultar fallos

Si:

```text
typecheck falla
```

o:

```text
build falla
```

la tarea no debe reportarse como completada correctamente.

Debe informar:

- error;
- causa conocida;
- archivo;
- bloqueo pendiente.

---

# 108. Warnings

No introducir warnings nuevos relevantes.

Un warning existente puede documentarse si está fuera del alcance.

No esconder warnings importantes únicamente para obtener una salida limpia.

---

# 109. Alcance Git

Los cambios de una tarea frontend deben mantenerse preferentemente dentro de:

```text
artifacts/sistema-produccion
```

y:

```text
docs/frontend
```

cuando corresponda.

Cambios fuera de ese alcance deben justificarse.

---

# 110. Rama de frontend

El desarrollo frontend se realiza sobre:

```text
feature/frontend-winter
```

salvo decisión posterior del flujo Git.

No realizar trabajo funcional directamente sobre `main`.

---

# 111. `.replit`

La configuración local `.replit` no forma parte del contrato funcional del frontend.

No debe modificarse o versionarse accidentalmente como parte de una tarea visual o funcional no relacionada.

---

# 112. Cambios pequeños y verificables

Preferir entregas como:

```text
Auth
↓
AppShell
↓
Artículos
↓
Compras
```

en lugar de:

```text
implementar todos los módulos en una sola tarea
```

---

# 113. Orden recomendado

La implementación objetivo sigue:

```text
1. Tokens visuales

2. Autenticación

3. AppShell

4. Sidebar

5. Topbar

6. Inicio básico

7. Artículos

8. Compras

9. Inventario

10. Producción

11. Usuarios

12. Roles

13. Permisos

14. Inicio operativo final
```

Puede modificarse por una decisión explícita de prioridad.

---

# 114. Artículos como módulo piloto

Artículos debe ayudar a consolidar:

- routing;
- API Layer;
- Query Keys;
- permisos;
- DataTable;
- FilterBar;
- Pagination;
- Skeleton;
- EmptyState;
- ErrorState;
- formularios;
- commands;
- Dialog;
- Toast;
- Light/Dark;
- `es-BO`.

Los demás módulos deben reutilizar los patrones resultantes.

---

# 115. Regla de detención

La IA debe detener la implementación específica y reportar el vacío si encuentra:

- endpoint inexistente;
- endpoint contradictorio;
- campo requerido no definido;
- enum ambiguo;
- permiso desconocido;
- transición no documentada;
- relación necesaria ausente;
- requerimiento que altera dominio;
- necesidad real de dependencia nueva;
- cambio necesario de stack;
- cambio de autenticación;
- cambio de routing;
- contradicción entre contratos.

No debe resolverlo mediante una suposición silenciosa.

---

# 116. Qué no requiere detenerse

No detenerse por decisiones locales triviales ya cubiertas por el Design System.

Ejemplos:

- usar 16 o 18 px de icono dentro del rango permitido;
- elegir `Dialog` para un formulario corto;
- elegir Skeleton con 6 u 8 filas;
- distribuir un formulario aprobado en 1 o 2 columnas según espacio.

La IA debe utilizar criterio dentro de los contratos existentes.

---

# 117. Definition of Done — componente

```text
[ ] reutiliza primitivas
[ ] está tipado
[ ] no duplica lógica
[ ] usa tokens
[ ] Light/Dark
[ ] accesible
[ ] responsive cuando aplique
[ ] no contiene reglas backend
```

---

# 118. Definition of Done — pantalla

```text
[ ] patrón definido
[ ] ruta correcta
[ ] español
[ ] permiso real
[ ] endpoint real
[ ] loading inicial
[ ] Skeleton
[ ] datos
[ ] EmptyState
[ ] ErrorState
[ ] refetch
[ ] mutation loading
[ ] doble submit prevenido
[ ] errores contractuales
[ ] cache/invalidation
[ ] responsive
[ ] accesibilidad
[ ] Light
[ ] Dark
[ ] Design System
```

---

# 119. Definition of Done — módulo

```text
[ ] navegación
[ ] rutas
[ ] permisos
[ ] contratos
[ ] pantallas necesarias
[ ] componentes reutilizados
[ ] integración API
[ ] React Query
[ ] formularios
[ ] commands
[ ] estados completos
[ ] es-BO
[ ] responsive
[ ] accesibilidad
[ ] typecheck
[ ] build
```

---

# 120. Prohibiciones resumidas

La IA no debe:

- inventar API;
- inventar permisos;
- inventar estados;
- inventar métricas;
- modificar backend sin autorización;
- crear otro router;
- crear otro sistema de estado remoto;
- crear otro Design System;
- duplicar primitivas;
- usar Prisma como contrato;
- hardcodear URL de producción;
- guardar tokens manualmente;
- editar stock directamente;
- modelar commands como edición simple;
- usar optimistic updates en operaciones complejas;
- crear rutas frontend nuevas en inglés;
- introducir textos visibles en inglés;
- usar `window.confirm`;
- mostrar EmptyState durante loading;
- borrar datos durante refetch;
- introducir secretos al bundle;
- reportar éxito con typecheck/build fallando.

---

# 121. Regla final para IA / Replit

Antes de escribir código, la IA debe poder responder:

```text
¿Qué módulo estoy implementando?

¿Qué patrón de pantalla corresponde?

¿Qué endpoint real consume?

¿Qué permiso real requiere?

¿Qué componentes existentes puedo reutilizar?

¿Qué estados de UI necesita?

¿Qué ocurre durante loading?

¿Qué ocurre durante error?

¿Qué ocurre durante refetch?

¿Qué ocurre durante mutation?

¿Cómo se ve en móvil?

¿Cómo funciona en Light/Dark?

¿Todo texto visible está en español?

¿Estoy introduciendo alguna decisión que no me corresponde?
```

Si las respuestas están respaldadas por los contratos:

```text
IMPLEMENTAR
```

Si falta una decisión contractual relevante:

```text
DETENER ESA PARTE
+
REPORTAR EL VACÍO
```

---

# 122. Principio final

> **Winter Frontend debe evolucionar mediante cambios pequeños, contractuales y verificables. Replit o cualquier IA puede acelerar la implementación, pero no puede sustituir las decisiones de arquitectura, dominio ni contratos del proyecto.**
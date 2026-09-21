# Arquitectura del Frontend — Winter

**Proyecto:** Winter  
**Sistema:** Gestión de Producción, Trazabilidad e Inventario  
**Empresa:** Bodega Cruce del Zorro  
**Frontend oficial:** `artifacts/sistema-produccion`

---

## 1. Propósito

Este documento define la arquitectura técnica oficial del frontend de Winter.

Su objetivo es establecer una estructura común para humanos e IA antes de desarrollar módulos funcionales.

Debe evitar que cada módulo implemente de forma independiente:

- autenticación;
- autorización visual;
- navegación;
- consumo HTTP;
- caché;
- loading;
- manejo de errores;
- formularios;
- componentes;
- estilos;
- layouts;
- reglas de integración con backend.

La arquitectura debe permitir agregar nuevos módulos sin introducir nuevas formas de resolver los mismos problemas.

---

## 2. Principio arquitectónico

Winter Frontend es una aplicación web empresarial desacoplada del dominio backend.

Conceptualmente:

```text
Usuario
   ↓
Winter Frontend
   ↓
Firebase Authentication
   ↓
Winter HTTP API
   ↓
Backend / Dominio
   ↓
PostgreSQL / Supabase Storage
```

El frontend administra:

- experiencia de usuario;
- navegación;
- representación de información;
- formularios;
- filtros;
- estados de carga;
- feedback;
- caché remota;
- visibilidad de acciones según permisos.

El backend administra:

- reglas de negocio;
- autorización real;
- invariantes;
- transacciones;
- stock;
- estados;
- concurrencia;
- idempotencia;
- auditoría;
- consistencia.

Regla:

> El frontend nunca sustituye las validaciones ni reglas del backend.

---

# 3. Fuente de verdad

Para construir frontend se utilizará la siguiente jerarquía:

```text
DOMINIO Y API
logger/docs/api/*
logger/docs/BACKEND_HANDOFF.md
logger/docs/architecture/*

ARQUITECTURA FRONTEND
FRONTEND_ARCHITECTURE.md

INTEGRACIÓN HTTP
FRONTEND_API_INTEGRATION.md

REGLAS DE IMPLEMENTACIÓN
FRONTEND_IMPLEMENTATION_RULES.md

MÓDULOS, NAVEGACIÓN Y RUTAS
FRONTEND_MODULE_MAP.md

DISEÑO VISUAL
FRONTEND_DESIGN_SYSTEM.md

COMPONENTES
FRONTEND_COMPONENTS.md

COMPOSICIÓN DE PANTALLAS
FRONTEND_SCREEN_PATTERNS.md

ESTADO REAL DEL CÓDIGO
FRONTEND_CURRENT_STATE.md

REFERENCIA VISUAL / HISTÓRICA
FRONTEND_REFERENCE_ANALYSIS.md
```

Cada documento es autoridad dentro de su ámbito. Ningún documento frontend puede contradecir los contratos backend.

---

# 4. Stack oficial

El frontend mantendrá la base existente.

Stack:

- React;
- TypeScript;
- Vite;
- Wouter;
- TanStack React Query;
- Tailwind CSS 4;
- Radix UI;
- patrón de componentes tipo shadcn/ui;
- Lucide React;
- React Hook Form;
- Zod;
- Sonner / Toaster;
- Recharts;
- date-fns;
- Firebase Authentication.

No reemplazar estas tecnologías por alternativas equivalentes sin una decisión explícita del proyecto.

Ejemplos de cambios que requieren aprobación:

```text
Wouter → React Router
React Query → Redux
Tailwind → Material UI
Radix → otro sistema de componentes
Firebase Auth → autenticación propia
```

---

# 5. Ubicación

Frontend:

```text
artifacts/sistema-produccion
```

Backend:

```text
logger
```

Documentación frontend:

```text
docs/frontend
```

Documentación HTTP backend:

```text
logger/docs/api
```

---

# 6. Arquitectura conceptual

El frontend se organizará por capas.

```text
Application
│
├── App / Providers / Routing
│
├── Authentication
│
├── Layout
│
├── Shared UI
│
├── Features
│   ├── Dashboard
│   ├── Artículos
│   ├── Compras
│   ├── Inventory
│   ├── Production
│   ├── Attachments
│   └── Access Management
│
├── API Layer
│
├── Query Layer
│
└── Design System
```

---

# 7. Estructura objetivo

La estructura recomendada es:

```text
src/
│
├── app/
│   ├── App.tsx
│   ├── providers.tsx
│   └── routes.tsx
│
├── auth/
│   ├── AuthContext.tsx
│   ├── firebase.ts
│   ├── permissions.ts
│   └── auth.types.ts
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
│
├── features/
│   ├── dashboard/
│   ├── articulos/
│   ├── compras/
│   ├── inventory/
│   ├── production/
│   ├── attachments/
│   └── access-management/
│
├── lib/
│   ├── api/
│   ├── query/
│   ├── errors/
│   └── utils/
│
├── hooks/
│
├── types/
│
├── main.tsx
└── index.css
```

Esta estructura es objetivo, no obligación de reorganizar todo inmediatamente.

Regla:

> La evolución debe ser incremental. No realizar una migración masiva de archivos sólo para cumplir una estructura teórica.

---

# 8. Organización por feature

Los módulos funcionales deben agrupar su propia implementación.

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
│   ├── ArticuloForm.tsx
│   └── ArticuloTable.tsx
│
├── pages/
│   ├── ArticulosPage.tsx
│   └── ArticuloDetailPage.tsx
│
├── schemas/
│   └── articulo.schema.ts
│
└── types/
    └── articulo.types.ts
```

No todos los features requieren todas las carpetas.

Evitar estructura innecesariamente profunda cuando el módulo sea simple.

---

# 9. Providers

La raíz de la aplicación debe mantener providers únicos y claramente definidos.

Composición conceptual:

```text
ErrorBoundary
└── QueryClientProvider
    └── AuthProvider
        └── TooltipProvider
            └── Router
                └── App
            └── Toaster
```

No duplicar:

- QueryClient;
- AuthProvider;
- Firebase instance;
- Router;
- Toaster;
- Theme provider.

---

# 10. Routing

Winter utilizará Wouter.

Tipos de rutas:

```text
Public
Protected
Permission-aware
Not Found
```

---

## 10.1 Rutas públicas

Inicialmente:

```text
/iniciar-sesion
/recuperar-contrasena
```

Sólo deben existir cuando el flujo real esté implementado.

---

## 10.2 Rutas protegidas

Una ruta protegida requiere:

```text
Firebase Session
        ↓
Winter Local User
        ↓
status ACTIVE
```

Si no existe sesión Firebase:

```text
→ Login
```

Si existe Firebase pero `/auth/me` rechaza al usuario:

```text
→ tratar estado contractual
```

No asumir que un Firebase User equivale automáticamente a un Winter User autorizado.

---

# 11. App Shell

Toda ruta autenticada utiliza un shell común.

```text
AppShell
│
├── Sidebar
├── Topbar
└── MainContent
```

---

## 11.1 Sidebar

Responsabilidad:

- navegación principal;
- agrupación funcional;
- iconografía;
- ruta activa;
- permisos;
- responsive;
- identidad CDZ.

La Sidebar no contiene lógica de negocio.

Los items deben ocultarse o mostrarse según permisos reales.

---

## 11.2 Topbar

Responsabilidad:

- usuario actual;
- contexto general;
- acciones globales;
- logout;
- controles secundarios estrictamente necesarios.

No debe convertirse en otra navegación principal.

---

## 11.3 Main Content

Debe administrar:

- scroll;
- padding;
- ancho;
- responsive;
- tablas;
- formularios;
- dashboards.

---

# 12. Autenticación

Winter utiliza Firebase Authentication.

Flujo:

```text
Login Firebase
     ↓
Firebase ID Token
     ↓
GET /api/v1/auth/me
     ↓
Winter User
     ↓
Roles + Permissions
     ↓
Frontend operativo
```

Estados mínimos:

```text
initializing
authenticated
unauthenticated
error
```

No crear una segunda sesión manual.

No guardar tokens manualmente en localStorage.

---

# 13. AuthContext

Debe existir una única abstracción central de autenticación.

Responsabilidades conceptuales:

```text
firebaseUser
winterUser
permissions
loading
login()
logout()
refreshUser()
can(permission)
```

No debe:

- contener reglas de inventario;
- contener reglas de producción;
- hacer consultas de módulos;
- almacenar datos empresariales no relacionados con sesión.

---

# 14. Permisos

Los permisos son strings contractuales provenientes del backend.

Ejemplo:

```text
articulos:read
articulos:create
inventory:read
```

El frontend puede proporcionar:

```ts
can('articulos:create')
```

para controlar UX.

Puede aplicarse en:

- rutas;
- menús;
- botones;
- comandos;
- acciones de tabla.

Regla:

> Ocultar una acción no equivale a protegerla.

El backend sigue siendo autoridad.

---

# 15. API Layer

No debe existir código `fetch()` disperso en páginas.

Incorrecto:

```text
ArticulosPage.tsx
→ fetch('/api/v1/articulos')
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

La integración HTTP completa se define en:

```text
FRONTEND_API_INTEGRATION.md
```

---

# 16. Cliente HTTP

Debe existir un cliente común.

Responsabilidades:

- base URL;
- token Firebase;
- Authorization header;
- JSON;
- multipart;
- AbortSignal;
- responses;
- 204;
- errores;
- requestId.

Debe ser neutral respecto al dominio.

No debe implementar reglas como:

```text
si stock < 0 entonces...
si compra está recibida entonces...
si lote está cerrado entonces...
```

Eso pertenece al backend.

---

# 17. Cliente generado existente

Existe:

```text
@workspace/api-client-react
```

Sin embargo, actualmente no representa el contrato HTTP completo de Winter.

Mientras continúe esa situación:

```text
NO usarlo como fuente de verdad
```

Puede reutilizarse posteriormente sólo si se regenera desde una especificación OpenAPI validada contra el backend Winter real.

---

# 18. Estado remoto

TanStack React Query será responsable de los datos remotos.

Ejemplos:

```text
Artículos
Compras
Stock
Lotes
Usuarios
Roles
Órdenes
Lotes de producción
```

No copiar innecesariamente datos de React Query hacia:

- Context;
- Redux;
- Zustand;
- useState global.

---

# 19. Query Keys

Cada feature debe definir keys consistentes.

Ejemplo:

```ts
const articuloKeys = {
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

Los filtros que cambien la respuesta deben formar parte de la key.

---

# 20. Mutations

React Query manejará:

- create;
- update;
- commands;
- transitions;
- delete cuando exista;
- activate/deactivate;
- receive;
- movements.

Después de una mutation:

```text
invalidate affected queries
```

No invalidar toda la aplicación automáticamente.

---

# 21. Optimistic Updates

Pueden utilizarse únicamente cuando la operación sea simple, reversible y segura.

No aplicar optimistic update por defecto a:

- stock;
- compras recibidas;
- transferencias;
- transformaciones;
- producción;
- pérdidas;
- movimientos;
- clasificación de lotes.

Esos comandos pueden afectar múltiples agregados y deben esperar confirmación real del backend.

---

# 22. Loading

Winter debe priorizar rendimiento percibido.

Estados:

```text
Initial Loading
Refetch
Mutation Loading
```

---

## 22.1 Primera carga

Cuando no existe información cacheada:

```text
Skeleton
```

No pantalla vacía.

---

## 22.2 Refetch

Cuando ya existen datos:

```text
mantener datos
+
indicador discreto de refresco
```

No sustituir todo el contenido por skeleton.

---

## 22.3 Mutaciones

Bloquear sólo el área afectada.

Ejemplo:

```text
Guardar compra
→ botón Guardando...
```

No:

```text
Guardar compra
→ bloquear toda la aplicación
```

---

# 23. Skeleton Loading

Debe existir un patrón consistente.

Componentes recomendados:

```text
TableSkeleton
DashboardSkeleton
DetailSkeleton
FormSkeleton
PageHeaderSkeleton
```

El skeleton debe representar aproximadamente el layout real.

Ejemplo tabla:

```text
████████     ████████     ██████
███████      █████████    █████
████████     ███████      ██████
```

Evitar spinners grandes como único estado de una pantalla empresarial.

---

# 24. Estado local

Usar `useState` o estado de componente para:

- modal abierto;
- drawer;
- selección visual;
- filtros temporales;
- formulario;
- pestaña activa;
- confirmaciones.

No utilizar estado global para información local.

---

# 25. Formularios

Herramientas preferidas:

```text
React Hook Form
+
Zod
```

Aplicar cuando el formulario tenga complejidad suficiente.

El frontend puede validar:

- requerido;
- longitud;
- formato;
- enum;
- sintaxis;
- reglas explícitamente contractuales.

No debe inventar:

- reglas de stock;
- transiciones;
- invariantes;
- compatibilidades no documentadas.

---

# 26. Errores

El frontend debe normalizar errores HTTP.

Modelo mínimo:

```ts
type WinterApiError = {
  status: number;
  code: string;
  message: string;
  requestId?: string;
};
```

El `requestId` debe preservarse cuando venga del backend.

---

## 26.1 Error de campo

Mostrar cerca del input.

---

## 26.2 Error de región

Utilizar:

```text
ErrorState
```

---

## 26.3 Error de mutation

Mostrar:

- contexto local;
- mensaje entendible;
- toast cuando corresponda.

---

## 26.4 Error de render

Utilizar:

```text
ErrorBoundary
```

---

# 27. HTTP status

Tratamiento general:

```text
400 → validación/request
401 → autenticación
403 → autorización
404 → recurso inexistente
409 → conflicto
413 → payload demasiado grande
422 → validación semántica
500+ → servidor/dependencia
```

Los errores contractuales específicos tienen prioridad.

---

# 28. Diseño visual

Toda UI debe utilizar tokens del Design System.

Fuente:

```text
FRONTEND_DESIGN_SYSTEM.md
```

No usar:

- colores directos arbitrarios;
- nuevos design systems;
- Bootstrap;
- Material UI;
- CSS aislado por módulo sin justificación.

---

# 29. Identidad Cruce del Zorro

Winter debe mantener:

```text
estructura empresarial
+
identidad premium CDZ
```

La identidad visual debe aparecer mediante:

- bordó;
- dorado;
- tipografía editorial limitada;
- sidebar;
- branding;
- detalles de superficies.

No debe perjudicar:

- tablas;
- formularios;
- lectura;
- densidad operativa.

---

# 30. Tablas

Las tablas serán el patrón principal para información comparable.

Deben soportar según necesidad:

- loading;
- empty;
- error;
- paginación;
- filtros;
- búsqueda;
- acciones;
- responsive.

No reemplazar una tabla por cards cuando la comparación entre filas sea importante.

---

# 31. Responsive

El sistema será desktop-first por el contexto operativo, sin abandonar móvil.

### Desktop

```text
Sidebar fija
Topbar
Tablas densas
Formularios de 2–3 columnas
```

### Tablet

```text
layout adaptado
menos columnas
```

### Mobile

```text
Sidebar off-canvas
Formulario 1 columna
Tablas scroll/adaptadas
Filtros en drawer cuando corresponda
```

---

# 32. Accesibilidad

Como mínimo:

- labels reales;
- navegación por teclado;
- focus visible;
- ARIA donde corresponda;
- contraste suficiente;
- targets táctiles adecuados;
- `prefers-reduced-motion`.

No depender únicamente del color para transmitir estados.

---

# 33. Performance

Prioridades:

- cache React Query;
- paginación backend;
- skeleton;
- invalidación selectiva;
- lazy loading cuando aporte valor;
- evitar requests duplicados;
- evitar renders innecesarios.

No cargar miles de registros en cliente si existe paginación backend.

---

# 34. Dashboard

Debe ser operativo.

Puede mostrar:

- KPIs;
- alertas;
- actividad;
- accesos rápidos;
- información relevante.

No debe convertirse en una página de marketing.

No calcular KPIs cargando masivamente datos cuando el backend no lo soporta.

---

# 35. Production

Production no debe diseñarse como un CRUD genérico.

Debe reflejar:

- órdenes;
- batches;
- trabajos;
- recipientes;
- transformaciones;
- mediciones;
- pérdidas;
- trazabilidad.

La UI debe seguir el dominio documentado.

---

# 36. Inventory

Inventory debe representar:

- almacenes;
- stock;
- lotes;
- movimientos;
- transferencias;
- ajustes;
- clasificaciones.

El frontend nunca calcula el stock real como fuente de verdad.

---

# 37. Compras

Compras debe distinguir:

```text
registro
recepción
cancelación
```

según los endpoints reales.

Recibir una compra no es simplemente editar un campo.

Debe representarse como command cuando el backend lo define así.

---

# 38. Artículos

Artículos es un maestro administrativo.

Pantallas esperadas:

```text
listado
crear
editar
detalle
activar/desactivar
```

Siempre utilizando permisos y enums reales.

---

# 39. Access Management

Comprende:

```text
Usuarios
Roles
Permisos
```

La sesión y permisos de UX deben derivarse del backend.

No crear un modelo alternativo de RBAC en frontend.

---

# 40. Attachments

Los archivos deben consumirse exclusivamente mediante el backend Winter.

No conectar directamente el frontend al bucket privado de Supabase.

No incluir:

```text
SUPABASE_SECRET_KEY
```

en el cliente.

---

# 41. Variables de entorno

El frontend sólo debe recibir configuración pública.

Ejemplo:

```text
VITE_WINTER_API_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
...
```

Nunca:

```text
WINTER_DATABASE_URL
FIREBASE_PRIVATE_KEY
SUPABASE_SECRET_KEY
```

---

# 42. Convenciones de idioma

UI:

```text
Español
```

Código:

```text
puede mantener nombres técnicos en inglés
```

Enums:

```text
no traducir al enviar
```

Ejemplo:

```text
PRODUCTO_TERMINADO
```

puede visualizarse como:

```text
Producto terminado
```

pero el request debe conservar:

```text
PRODUCTO_TERMINADO
```

---

# 43. Definition of Done

Una pantalla funcional no se considera terminada sólo porque muestra información.

Debe tener:

- contrato API real;
- permisos reales;
- routing;
- loading;
- skeleton;
- empty state;
- error state;
- responsive;
- accesibilidad básica;
- estados disabled;
- prevención de doble submit;
- cache/invalidation;
- Design System;
- typecheck;
- build.

---

# 44. Validación técnica mínima

Antes de cerrar cambios frontend:

```bash
pnpm --filter @workspace/sistema-produccion run typecheck
pnpm --filter @workspace/sistema-produccion run build
```

También deben ejecutarse pruebas manuales o automáticas del flujo modificado.

---

# 45. Orden de implementación recomendado

La implementación inicial seguirá:

```text
1. Tokens visuales
2. Autenticación + Inicio de sesión
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

El orden puede cambiar por dependencias reales del backend.

---

# 46. Regla para IA

Antes de implementar una pantalla, la IA debe revisar:

```text
FRONTEND_CURRENT_STATE.md
FRONTEND_ARCHITECTURE.md
FRONTEND_API_INTEGRATION.md
FRONTEND_DESIGN_SYSTEM.md
FRONTEND_COMPONENTS.md
FRONTEND_SCREEN_PATTERNS.md
FRONTEND_MODULE_MAP.md
FRONTEND_IMPLEMENTATION_RULES.md
```

y el contrato backend correspondiente.

Si falta una decisión:

```text
detener
↓
identificar decisión
↓
documentar
↓
aprobar
↓
implementar
```

---

# 47. Prohibiciones

No:

- inventar endpoints;
- inventar permisos;
- inventar enums;
- duplicar auth;
- duplicar API client;
- duplicar QueryClient;
- crear reglas de negocio frontend;
- modificar backend para simplificar una pantalla sin aprobación;
- copiar el frontend histórico como implementación oficial;
- introducir otro sistema de diseño;
- utilizar Prisma como contrato frontend.

---

# 48. Idioma y localización

## Idioma oficial

Winter es un sistema empresarial desarrollado inicialmente para operaciones de **Bodega Cruce del Zorro en Bolivia**.

El idioma oficial de la interfaz es:

```text
Español
```

La interfaz no debe mezclar español e inglés.

Esto aplica a:

* módulos;
* navegación;
* títulos;
* botones;
* formularios;
* tablas;
* filtros;
* estados visibles;
* validaciones;
* errores;
* confirmaciones;
* notificaciones;
* ayudas;
* tooltips;
* empty states;
* mensajes de carga;
* accesibilidad visible para el usuario.

Ejemplos:

```text
Articles      ❌
Artículos     ✅

Purchases     ❌
Compras       ✅

Inventory     ❌
Inventario    ✅

Production    ❌
Producción    ✅

Users         ❌
Usuarios      ✅

Roles         ❌
Roles         ✅

Permissions   ❌
Permisos      ✅
```

---

## Terminología funcional

Los nombres visibles deben utilizar la terminología real de la operación de Cruce del Zorro y no traducciones literales generadas por una IA.

Ejemplos:

```text
Artículo
Compra
Proveedor
Almacén
Inventario
Lote
Movimiento
Existencia / Stock
Producción
Orden de producción
Trabajo de producción
Transformación
Recipiente
Medición
Pérdida / Merma
Usuario
Rol
Permiso
```

Cuando exista duda sobre un término de negocio, se debe revisar la documentación de dominio antes de inventar una denominación.

---

## Código interno

El requisito de español corresponde principalmente al **lenguaje del producto y del dominio visible**.

No es obligatorio traducir conceptos técnicos estándar del ecosistema:

```text
useState
useQuery
mutation
request
response
hook
props
children
className
```

Tampoco deben renombrarse APIs de librerías externas.

Sin embargo, los conceptos propios del dominio Winter deben mantener una nomenclatura coherente con el dominio establecido por el backend.

---

## Rutas frontend

Las rutas visibles del producto utilizarán español.

Preferir:

```text
/articulos
/compras
/inventario
/produccion
/usuarios
/roles
/permisos
```

Evitar:

```text
/articles
/purchases
/inventory
/production
/users
/permissions
```

Esto no modifica las rutas HTTP del backend.

Las rutas API continúan utilizando exactamente el contrato definido en:

```text
logger/docs/api/*
```

aunque internamente alguna ruta o identificador contractual utilice otra nomenclatura.

---

## Estados y enums

Los valores contractuales del backend no deben traducirse antes de enviarlos.

Ejemplo:

```text
Backend:
REGISTERED

UI:
Registrada
```

```text
Backend:
RECEIVED

UI:
Recibida
```

```text
Backend:
CANCELLED

UI:
Cancelada
```

Regla:

```text
valor contractual
        ↓
mapeo de presentación
        ↓
texto español
```

Nunca:

```text
"Recibida"
→ enviar directamente como enum
```

si el backend espera `RECEIVED`.

---

## Configuración regional

La configuración inicial del producto será:

```text
Locale:
es-BO

País:
Bolivia

Zona horaria operativa:
America/La_Paz
```

La presentación de fechas, horas y números debe considerar esta configuración.

---

## Fechas

La API conserva ISO-8601.

Ejemplo:

```text
2026-09-21T14:30:00.000Z
```

La interfaz puede presentarlo según contexto:

```text
21/09/2026

21/09/2026 10:30

21 de septiembre de 2026
```

No modificar el valor contractual almacenado únicamente para presentarlo.

---

## Números

La presentación debe ser adecuada para usuarios de Bolivia.

Los valores contractuales Decimal continúan siendo strings cuando así lo defina la API.

El formateo visual se realiza únicamente en presentación.

Ejemplo conceptual:

```text
API:
"1250.375"

UI:
1.250,375
```

La representación exacta puede depender del tipo de dato y contexto operativo.

---

## Moneda

Cuando Winter represente importes monetarios de la operación boliviana, la moneda principal será:

```text
Boliviano
Código ISO: BOB
Símbolo visible habitual: Bs
```

Ejemplo:

```text
Bs 1.250,00
```

No asumir USD como moneda predeterminada.

Si en el futuro existen operaciones multimoneda, deberán modelarse explícitamente.

---

## Textos técnicos

Los mensajes dirigidos al usuario deben estar en español.

Incorrecto:

```text
Loading...
Save
Cancel
Something went wrong
No data found
```

Correcto:

```text
Cargando...
Guardar
Cancelar
Ocurrió un error
No se encontraron registros
```

Los errores técnicos internos pueden conservar códigos contractuales como:

```text
ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE
```

pero la UI debe acompañarlos con una explicación comprensible en español.

---

## Regla para IA / Replit

Replit no debe introducir textos visibles en inglés por defecto.

Antes de completar una pantalla debe comprobar:

```text
[ ] navegación en español
[ ] títulos en español
[ ] campos en español
[ ] acciones en español
[ ] estados visibles en español
[ ] errores en español
[ ] empty states en español
[ ] loading en español
[ ] confirmaciones en español
[ ] rutas frontend en español
[ ] fechas/números adecuados para es-BO
[ ] moneda BOB/Bs cuando corresponda
```

---

# 49. Regla final

> **Winter Frontend debe crecer como una única plataforma empresarial coherente, donde cada nuevo módulo reutilice la misma arquitectura de autenticación, API, permisos, caché, loading, errores, componentes y diseño visual.**

> **Winter es un sistema empresarial en español, inicialmente localizado para Bolivia (`es-BO`). Los contratos técnicos pueden conservar identificadores internos definidos por el backend, pero toda interacción visible para el usuario debe utilizar español y la terminología real del negocio.**
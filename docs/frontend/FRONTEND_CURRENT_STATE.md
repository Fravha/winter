# Estado actual del frontend — Winter

**Fecha de inspección:** 2026-09-21
**Alcance:** implementación presente en `artifacts/sistema-produccion`, rama `feature/frontend-winter`. Inspección técnica del estado real antes de iniciar la implementación funcional.

## 1. Panorama real

El frontend actual de Winter es una base técnica React/Vite preparada para construir la aplicación empresarial definitiva de Bodega Cruce del Zorro.

No debe confundirse con el frontend administrativo de pruebas utilizado anteriormente sobre Logger.

Actualmente la aplicación no contiene todavía los módulos funcionales de Winter. Su estado es principalmente infraestructura frontend:

* React;
* TypeScript;
* Vite;
* Wouter;
* TanStack React Query;
* Tailwind CSS 4;
* Radix UI;
* componentes con patrón shadcn/ui;
* Lucide React;
* React Hook Form;
* Zod;
* Sonner / Toaster;
* Recharts;
* date-fns;
* Framer Motion.

La aplicación dispone de una base de componentes reutilizables, routing mínimo, manejo de errores y sistema de estilos preparado para recibir el Design System oficial de Winter.

Framer Motion está disponible actualmente como dependencia, pero no constituye el mecanismo obligatorio de animación del sistema. Para interacciones habituales se priorizan CSS/Tailwind y las capacidades de las primitivas existentes.

---

## 2. Ubicación y estructura

Frontend:

```text
artifacts/sistema-produccion
```

Repositorio:

```text
Fravha/winter
```

Rama actual:

```text
feature/frontend-winter
```

El frontend forma parte del mismo monorepo que el backend.

Flujo Git acordado:

```text
feature/frontend-winter
        ↓
dev/winter-replit
        ↓
main
        ↓
Vercel
```

---

## 3. Entry points y navegación

`src/main.tsx`:

* monta React mediante `createRoot`;
* importa `index.css`;
* envuelve la aplicación con `ErrorBoundary`;
* registra manejo de errores capturados durante desarrollo.

`src/App.tsx`:

* crea un `QueryClient`;
* monta `QueryClientProvider`;
* monta `TooltipProvider`;
* utiliza `WouterRouter`;
* monta `Toaster`;
* utiliza `RoutedErrorBoundary`, reiniciado cuando cambia la ruta.

Actualmente sólo existen:

```text
/ → Home placeholder
* → NotFound
```

La página principal muestra todavía un placeholder de construcción.

No existen todavía rutas funcionales de Login, Dashboard, Artículos, Compras, Inventory, Production o Administración.

---

## 4. Autenticación y RBAC

La autenticación definitiva continuará utilizando Firebase Authentication, coherente con el backend Winter.

Sin embargo, en la base actual de `artifacts/sistema-produccion` todavía no están implementados:

* `AuthContext`;
* login Firebase;
* logout;
* `onAuthStateChanged`;
* obtención del Firebase ID Token;
* llamada a `/api/v1/auth/me`;
* guards de autenticación;
* guards visuales por permisos;
* función `can(permission)`.

Estos elementos deben implementarse respetando:

```text
logger/docs/api/AUTH_API.md
logger/docs/api/USERS_ROLES_PERMISSIONS_API.md
```

El backend continúa siendo la autoridad final de permisos y autorización.

---

## 5. Estado funcional actual

Actualmente no están implementadas las pantallas funcionales de:

* Inicio de sesión
* Inicio
* Inventario
* Producción
* Adjuntos
* Usuarios
* Permisos
* Compras

Tampoco existe todavía el App Shell definitivo con:

* Sidebar;
* Topbar;
* área principal de trabajo;
* navegación por módulos.

Por tanto, este frontend debe considerarse una base técnica preparada para comenzar el desarrollo funcional.

---

## 6. Componentes UI disponibles

Existe una base reutilizable bajo:

```text
src/components/ui/
```

Entre los componentes verificados se encuentran:

* `Button`;
* `Table`;
* `TableHeader`;
* `TableBody`;
* `TableRow`;
* `TableHead`;
* `TableCell`;
* `Skeleton`;
* `Tooltip`;
* `Toaster`.

El proyecto también incluye primitivas Radix para:

* Dialog;
* Alert Dialog;
* Dropdown Menu;
* Select;
* Popover;
* Tabs;
* Accordion;
* Checkbox;
* Switch;
* Radio Group;
* Navigation Menu;
* Toast;
* entre otros.

Regla:

> Antes de crear un componente primitivo nuevo debe verificarse si ya existe uno reutilizable dentro de `src/components/ui`.

---

## 7. Estado remoto, carga y caché

TanStack React Query ya está instalado y `QueryClientProvider` ya forma parte de la aplicación.

Todavía no se han definido formalmente:

* query keys por módulo;
* hooks de query;
* hooks de mutation;
* invalidación;
* caché;
* política de retry;
* prefetch;
* estrategia común de errores.

Estas reglas se definirán en `FRONTEND_ARCHITECTURE.md`.

### Skeleton Loading

El componente `Skeleton` ya existe.

Winter utilizará skeleton loading para la primera carga cuando todavía no existe información disponible.

Ejemplos:

```text
Tabla cargando
→ skeleton de encabezados y filas

Dashboard cargando
→ skeleton de KPIs y paneles

Detalle cargando
→ skeleton de encabezado y secciones
```

Cuando ya existen datos y React Query está realizando un `refetch`, se debe mantener la información visible y utilizar un indicador discreto de actualización.

No debe reemplazarse una tabla ya cargada por skeleton durante cada refetch.

---

## 8. Manejo de errores

Existe un `ErrorBoundary` funcional que:

* captura errores de render;
* mantiene aislado el fallo;
* permite recuperación;
* se reinicia al cambiar de ruta.

El fallback actual utiliza todavía textos y estilos genéricos en inglés.

Deberá adaptarse posteriormente al Design System Winter.

Los errores HTTP se definirán mediante una capa común de integración con la API.

Debe conservarse especialmente:

```text
status
code
message
requestId
```

cuando el backend proporcione esos valores.

---

## 9. Sistema visual actual

`src/index.css` utiliza Tailwind CSS 4 y ya contiene una infraestructura de tokens semánticos para:

* background;
* foreground;
* card;
* popover;
* primary;
* secondary;
* muted;
* accent;
* destructive;
* charts;
* sidebar;
* tipografía;
* bordes;
* radios;
* sombras.

Actualmente muchos valores están todavía definidos como placeholders:

```css
--background: red;
--foreground: red;
--primary: red;
...
```

Esto no representa una decisión visual.

Los valores definitivos deberán obtenerse de:

```text
FRONTEND_DESIGN_SYSTEM.md
```

No se debe crear un segundo sistema de colores paralelo.

---

## 10. Tipografía

La infraestructura actual contempla:

```text
Sans → Inter
Serif → Georgia como fallback temporal
Mono → Menlo
```

La dirección visual aprobada para Winter utiliza:

* tipografía sans serif para operación y datos;
* serif editorial limitada para identidad Cruce del Zorro.

La tipografía serif no debe utilizarse en tablas, filtros, inputs ni información operativa densa.

---

## 11. Responsive

La base Tailwind permite construir el sistema responsive sin introducir otra solución.

La dirección acordada es:

```text
Desktop
→ Sidebar permanente
→ alta densidad operativa

Tablet
→ layout adaptado

Mobile
→ sidebar off-canvas
→ formularios a una columna
→ tablas con scroll/adaptación
```

La interfaz debe priorizar desktop por el contexto de operación empresarial, pero seguir siendo funcional en tablet y móvil.

---

## 12. Configuración Vite

`vite.config.ts` requiere actualmente:

```text
PORT
BASE_PATH
```

El servidor de desarrollo:

* escucha en `0.0.0.0`;
* utiliza `strictPort`;
* permite hosts de Replit;
* incorpora plugins específicos de Replit sólo en desarrollo.

El build se genera en:

```text
dist/public
```

La URL de la API todavía debe formalizarse mediante una variable específica del frontend Winter.

---

## 13. Integración API

La fuente contractual de endpoints del frontend será exclusivamente:

```text
logger/docs/api/README.md
logger/docs/api/AUTH_API.md
logger/docs/api/USERS_ROLES_PERMISSIONS_API.md
logger/docs/api/ARTICULOS_API.md
logger/docs/api/COMPRAS_API.md
logger/docs/api/INVENTORY_API.md
logger/docs/api/PRODUCTION_API.md
logger/docs/api/ATTACHMENTS_API.md
logger/docs/BACKEND_HANDOFF.md
```

La integración se desarrollará según:

```text
FRONTEND_API_INTEGRATION.md
```

El frontend no debe deducir endpoints desde Prisma ni desde implementaciones internas del backend.

---

## 14. Cliente generado existente

Existe en el monorepo:

```text
lib/api-client-react
```

y el frontend declara:

```text
@workspace/api-client-react
```

como dependencia.

Actualmente ese cliente generado contiene un health check hacia:

```text
/api/healthz
```

Ese endpoint no coincide con el contrato backend actual de Winter:

```text
/health
/health/ready
/health/db
/api/v1/*
```

Por tanto:

> `@workspace/api-client-react` no debe considerarse actualmente fuente contractual de la API Winter.

Puede reutilizarse en el futuro únicamente si se regenera explícitamente desde una especificación OpenAPI validada contra la API Winter real.

---

## 15. Diferencias con el frontend de pruebas anterior

El antiguo frontend administrativo contenía:

* React Router;
* AuthContext;
* Login;
* Dashboard;
* Users;
* Roles;
* Permissions;
* Products;
* Purchases;
* cliente API manual;
* CSS específico CDZ.

Ese código debe tratarse únicamente como referencia funcional o histórica.

No constituye la implementación actual de `artifacts/sistema-produccion`.

No deben copiarse automáticamente sus rutas, permisos, endpoints ni estructura.

---

## 16. Estado de preparación

La base actual ya dispone de suficiente infraestructura para comenzar el desarrollo formal:

* React/Vite;
* TypeScript;
* Wouter;
* React Query;
* Tailwind;
* componentes UI;
* tablas;
* Skeleton;
* ErrorBoundary;
* Toaster;
* iconografía;
* formularios;
* validación.

Antes de implementar módulos funcionales deben quedar definidos:

```text
FRONTEND_ARCHITECTURE.md
FRONTEND_API_INTEGRATION.md
FRONTEND_DESIGN_SYSTEM.md
FRONTEND_IMPLEMENTATION_RULES.md
```

---

## 17. Alcance de esta fotografía

Este documento describe únicamente el estado técnico actual.

No define:

* diseño definitivo;
* rutas definitivas;
* permisos nuevos;
* endpoints nuevos;
* reglas de negocio;
* comportamiento futuro no documentado.

---

## 18. Regla final

> Winter Frontend debe evolucionar sobre `artifacts/sistema-produccion`. El frontend administrativo anterior de Logger/CDZ puede utilizarse como referencia, pero no como contrato vigente.
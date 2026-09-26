# Mapa de módulos del frontend — Winter

**Versión:** 0.2  
**Fecha:** 2026-09-21  
**Estado:** contrato modular del frontend  
**Frontend:** `artifacts/sistema-produccion`

---

# 1. Propósito

Este documento define cómo los módulos funcionales de Winter se representan en el frontend.

Establece:

- módulos visibles;
- agrupación de navegación;
- rutas frontend;
- responsabilidades de cada módulo;
- pantallas principales;
- patrones de pantalla;
- límites entre módulos;
- relación con contratos backend;
- capacidades transversales.

Este documento **no redefine el dominio**.

Las entidades, estados, comandos, permisos y reglas de negocio continúan perteneciendo al backend y a sus contratos.

---

# 2. Fuentes de verdad

Para definir un módulo frontend se debe revisar, en este orden:

```text
logger/docs/api/*
logger/docs/BACKEND_HANDOFF.md

FRONTEND_ARCHITECTURE.md
FRONTEND_API_INTEGRATION.md
FRONTEND_DESIGN_SYSTEM.md
FRONTEND_COMPONENTS.md
FRONTEND_SCREEN_PATTERNS.md
FRONTEND_MODULE_MAP.md
```

Cuando exista contradicción:

```text
contrato backend
>
documentación frontend
>
código histórico
>
capturas/referencias
```

---

# 3. Idioma

La interfaz de Winter se presenta en:

```text
Español
```

Localización inicial:

```text
es-BO
```

Los nombres visibles de módulos serán:

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

No utilizar en navegación:

```text
Dashboard
Articles
Purchases
Inventory
Production
Users
Permissions
```

---

# 4. Nombres internos vs nombres visibles

El código puede conservar nombres técnicos cuando sea conveniente.

Ejemplo:

```text
feature folder:
inventory

UI:
Inventario
```

```text
feature folder:
production

UI:
Producción
```

Las APIs y tipos contractuales tampoco deben traducirse arbitrariamente.

La regla de español aplica principalmente al producto visible.

---

# 5. Mapa principal

Winter se organiza visualmente de la siguiente manera:

```text
WINTER
│
├── Inicio
│
├── Operaciones
│   ├── Artículos
│   ├── Compras
│   ├── Inventario
│   └── Producción
│
└── Administración
    ├── Usuarios
    ├── Roles
    └── Permisos
```

Este será el mapa principal de navegación.

---

# 6. Capacidades transversales

Existen capacidades que pueden ser utilizadas por varios módulos pero no necesariamente aparecen como opción principal en Sidebar.

Ejemplos:

```text
Adjuntos
Autenticación
Auditoría
Notificaciones
```

Estas capacidades no deben convertirse automáticamente en módulos visibles.

---

# 7. Navegación principal

La Sidebar autenticada utilizará grupos.

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

Los nombres de grupos también deben mostrarse en español.

---

# 8. Visibilidad por permisos

La navegación debe adaptarse a los permisos efectivos del usuario.

Conceptualmente:

```text
usuario
   ↓
GET /api/v1/auth/me
   ↓
permisos efectivos
   ↓
navegación visible
```

Cada módulo debe utilizar el permiso real de lectura definido por su contrato backend.

No inventar:

```text
operations:read
administration:read
```

únicamente para controlar grupos visuales.

---

# 9. Grupos sin elementos

Si un usuario no posee permiso para ninguna opción de un grupo:

```text
OPERACIONES
```

o:

```text
ADMINISTRACIÓN
```

el grupo completo debe ocultarse.

No mostrar encabezados vacíos.

---

# 10. Rutas frontend

Las rutas visibles de Winter utilizarán español.

Mapa base:

```text
/                       Inicio

/articulos              Artículos

/compras                Compras

/inventario             Inventario

/produccion             Producción

/usuarios               Usuarios

/roles                  Roles

/permisos               Permisos
```

Estas rutas pertenecen al frontend.

No modifican los endpoints HTTP del backend.

---

# 11. Rutas públicas

El objetivo para nuevas rutas públicas es utilizar español.

```text
/iniciar-sesion

/recuperar-contrasena
```

La implementación debe mantenerse alineada con `FRONTEND_ARCHITECTURE.md`.

Si una ruta histórica existe realmente antes de esta migración, no debe romperse sin revisar navegación y redirecciones.

Actualmente la nueva base todavía no posee un flujo funcional consolidado que obligue a conservar rutas históricas del prototype.

---

# 12. Inicio

Ruta:

```text
/
```

Nombre visible:

```text
Inicio
```

Internamente el feature puede seguir denominándose:

```text
dashboard
```

si resulta técnicamente conveniente.

---

# 13. Objetivo de Inicio

Inicio debe proporcionar contexto operativo.

Puede incluir, cuando existan datos reales:

- alertas;
- compras pendientes;
- información de inventario;
- órdenes abiertas;
- actividad reciente;
- accesos rápidos;
- indicadores relevantes.

No debe convertirse en una página promocional.

---

# 14. Restricciones de Inicio

No:

- inventar KPIs;
- calcular grandes métricas cargando todos los registros;
- mostrar gráficos únicamente por estética;
- duplicar pantallas completas de otros módulos.

Inicio debe resumir.

El módulo correspondiente permite profundizar.

---

# 15. Patrón de Inicio

Patrón principal:

```text
Dashboard operativo
```

Definido en:

```text
FRONTEND_SCREEN_PATTERNS.md
```

---

# 16. Artículos

Ruta principal:

```text
/articulos
```

Contrato backend:

```text
logger/docs/api/ARTICULOS_API.md
```

Objetivo:

> Administrar el maestro único de artículos utilizado por Winter.

---

# 17. Responsabilidad de Artículos

Artículos representa elementos utilizados en:

- Compras;
- Inventario;
- Producción.

No crear módulos independientes para:

```text
Insumos
Materias primas
Productos intermedios
Productos terminados
Botellas
Etiquetas
```

si todos pertenecen al maestro Artículos y se distinguen mediante clasificación.

---

# 18. Pantallas de Artículos

Pantallas conceptuales:

```text
Listado de artículos

Crear artículo

Detalle de artículo

Editar artículo
```

Commands cuando corresponda:

```text
Activar

Desactivar
```

---

# 19. Rutas de Artículos

Ruta obligatoria del módulo:

```text
/articulos
```

Cuando se utilicen páginas dedicadas pueden existir:

```text
/articulos/nuevo

/articulos/:id

/articulos/:id/editar
```

No es obligatorio crear una ruta separada si una operación corta se resuelve mejor mediante `Dialog`.

---

# 20. Patrones de Artículos

Principalmente:

```text
Listado administrativo
Formulario
Detalle de recurso
Comando operativo
```

Artículos será el primer módulo recomendado para consolidar los patrones compartidos del frontend.

---

# 21. Compras

Ruta principal:

```text
/compras
```

Contrato backend:

```text
logger/docs/api/COMPRAS_API.md
```

Objetivo:

> Registrar y consultar adquisiciones sin confundir la compra administrativa con la existencia física en Inventario.

---

# 22. Responsabilidad de Compras

Compras administra información como:

- compra;
- proveedor;
- líneas;
- cantidades;
- marca cuando corresponda;
- precio referencial;
- estado;
- datos históricos asociados.

Los campos exactos deben provenir del contrato backend.

---

# 23. Compra vs Inventario

Regla crítica:

```text
Compra registrada
≠
Stock ingresado
```

cuando el contrato backend separa ambas operaciones.

El frontend debe representar esa diferencia claramente.

---

# 24. Pantallas de Compras

Conceptualmente:

```text
Listado de compras

Registrar compra

Detalle de compra
```

Commands contractuales:

```text
Recibir compra

Cancelar compra
```

cuando el backend y los permisos lo permitan.

---

# 25. Rutas de Compras

Principal:

```text
/compras
```

Posibles rutas dedicadas:

```text
/compras/nueva

/compras/:id
```

La recepción no debe representarse necesariamente como una página `/editar`.

Es un command de dominio.

---

# 26. Patrón de Compras

Principalmente:

```text
Listado administrativo
Formulario de registro
Detalle de recurso
Comando operativo
```

---

# 27. Inventario

Ruta principal:

```text
/inventario
```

Contrato backend:

```text
logger/docs/api/INVENTORY_API.md
```

Nombre visible:

```text
Inventario
```

No mostrar `Inventory` al usuario.

---

# 28. Objetivo de Inventario

Debe permitir responder:

> ¿Qué tenemos?

> ¿Cuánto tenemos?

> ¿Dónde está?

> ¿En qué lote está?

> ¿Cómo llegó hasta ahí?

cuando la API exponga esos datos.

---

# 29. Áreas de Inventario

Conceptualmente:

```text
Inventario
│
├── Stock
├── Almacenes
├── Lotes
├── Movimientos
├── Transferencias
└── Ajustes
```

No todas estas áreas requieren un item independiente en la Sidebar principal.

---

# 30. Navegación interna de Inventario

La entrada principal seguirá siendo:

```text
/inventario
```

Dentro del módulo puede existir navegación secundaria para:

```text
Stock
Almacenes
Lotes
Movimientos
```

según la implementación aprobada.

---

# 31. Subrutas de Inventario

Cuando ayuden a navegación directa pueden utilizarse rutas como:

```text
/inventario/stock

/inventario/almacenes

/inventario/lotes

/inventario/movimientos
```

Sólo deben implementarse cuando exista la pantalla correspondiente.

---

# 32. Transferencias y ajustes

Transferir y ajustar no son maestros.

Son:

```text
Commands
```

Por tanto, no necesitan convertirse automáticamente en módulos independientes.

Pueden iniciarse desde:

- Stock;
- Lote;
- Almacén;
- Movimiento;
- acción contextual.

---

# 33. Stock

El frontend representa el stock informado por backend.

No calcula la existencia oficial sumando o restando movimientos localmente.

Regla:

> El backend es autoridad sobre stock.

---

# 34. Lotes

Los lotes deben priorizar:

- identificación;
- artículo;
- clasificación;
- cantidad;
- almacén;
- relaciones;
- trazabilidad.

Los campos concretos dependen del contrato HTTP.

---

# 35. Movimientos

Los movimientos representan historial operativo.

La UI debe permitir distinguir claramente:

- tipo;
- artículo;
- lote;
- cantidad;
- origen;
- destino;
- fecha;
- referencia;

cuando estén disponibles.

---

# 36. Patrones de Inventario

Principalmente:

```text
Listado administrativo
Detalle de recurso
Comando operativo
Tabla + detalle contextual
Trazabilidad
```

---

# 37. Producción

Ruta principal:

```text
/produccion
```

Contrato backend:

```text
logger/docs/api/PRODUCTION_API.md
```

Nombre visible:

```text
Producción
```

No mostrar `Production`.

---

# 38. Objetivo de Producción

Producción representa el proceso real de bodega.

No debe reducirse a:

```text
CRUD de órdenes
```

Debe preservar contexto y trazabilidad entre operaciones productivas.

---

# 39. Áreas conceptuales de Producción

Según el contrato del dominio:

```text
Producción
│
├── Órdenes de producción
├── Lotes producción
├── Trabajos de producción
├── Transformaciones
├── Mediciones
├── Recipientes
├── Consumos
├── Salidas
└── Mermas
```

Estos conceptos no implican automáticamente nueve rutas.

---

# 40. Navegación interna de Producción

La navegación debe partir del contexto operativo.

Especialmente:

```text
Orden de producción
        ↓
operaciones relacionadas
```

No crear una Sidebar secundaria enorme sólo porque existan muchas entidades backend.

---

# 41. Órdenes de producción

La orden debe funcionar como contexto.

Una pantalla de orden puede concentrar:

- identificación;
- estado;
- lotes de producción;
- trabajos;
- transformaciones;
- mediciones;
- recipientes;
- consumos;
- salidas;
- mermas;
- historial.

Sólo cuando la API exponga dichos datos.

---

# 42. Transformaciones

Una transformación no debe representarse como una edición normal de un lote.

Debe reflejar:

```text
entradas
↓
transformación
↓
salidas
+
pérdidas cuando corresponda
```

respetando el contrato backend.

---

# 43. Trabajos de producción

Un trabajo representa algo que ocurrió en producción.

La interfaz debe permitir registrar el hecho sin imponer un flujo visual no respaldado por el dominio.

---

# 44. Mediciones

Las mediciones pertenecen al contexto productivo correspondiente.

Su interfaz debe derivarse del contrato real de:

- tipo;
- unidad;
- recurso;
- momento;
- relación.

No inventar campos de laboratorio.

---

# 45. Recipientes

Los recipientes pueden representarse dentro del contexto de Producción.

No deben convertirse automáticamente en módulo principal si su uso es principalmente contextual.

---

# 46. Patrones de Producción

Principalmente:

```text
Detalle de recurso
Comando operativo
Flujo productivo complejo
Trazabilidad
```

Producción debe implementarse después de estabilizar los patrones comunes.

---

# 47. Administración

La sección visible:

```text
ADMINISTRACIÓN
```

agrupa:

```text
Usuarios
Roles
Permisos
```

No constituye necesariamente una ruta `/administracion`.

Es principalmente una agrupación de navegación.

---

# 48. Usuarios

Ruta:

```text
/usuarios
```

Contrato:

```text
logger/docs/api/USERS_ROLES_PERMISSIONS_API.md
```

Responsabilidad:

- listar usuarios;
- consultar usuario;
- crear/editar cuando el contrato lo permita;
- administrar acceso;
- activar/suspender;
- gestionar rol según contrato vigente.

---

# 49. Un usuario, un rol

Winter actualmente utiliza el modelo:

```text
1 usuario
→
1 rol
```

El frontend no debe reconstruir una interfaz de múltiples roles heredada de versiones anteriores.

La UI debe seguir el contrato backend vigente.

---

# 50. Patrones de Usuarios

Principalmente:

```text
Listado administrativo
Formulario
Detalle
Comando
```

---

# 51. Roles

Ruta:

```text
/roles
```

Responsabilidad:

- listar;
- consultar;
- crear;
- editar;
- administrar permisos;
- aplicar las operaciones contractuales disponibles.

---

# 52. Permisos por rol

La UI puede agrupar permisos por módulo.

Ejemplo visual:

```text
ARTÍCULOS

☑ Leer
☑ Crear
☐ Editar
☐ Desactivar
```

Internamente conserva los códigos exactos backend.

---

# 53. Permisos

Ruta:

```text
/permisos
```

Objetivo:

representar el catálogo de permisos según las capacidades reales del backend.

Puede ser:

- consulta;
- administración;

dependiendo del contrato vigente.

El frontend no decide por sí mismo si un permiso puede crearse o eliminarse.

---

# 54. Adjuntos

Contrato:

```text
logger/docs/api/ATTACHMENTS_API.md
```

Adjuntos es una capacidad transversal.

No debe aparecer inicialmente como:

```text
ADJUNTOS
```

en la Sidebar principal.

---

# 55. Uso de Adjuntos

Puede integrarse dentro de recursos como:

```text
Compra
Producción
Lote
u otro recurso autorizado
```

cuando el backend soporte dicha relación.

Ejemplo:

```text
Compra COMP-00125

Resumen | Detalle | Adjuntos
```

---

# 56. Adjuntos y almacenamiento

El frontend sólo interactúa con el backend Winter.

No debe conectarse directamente al bucket privado de almacenamiento.

---

# 57. Auditoría

Winter posee capacidades de auditoría backend.

Sin embargo:

> La existencia de auditoría interna no significa que deba existir automáticamente una pantalla “Auditoría”.

Sólo debe agregarse como módulo visible cuando exista:

- caso de uso aprobado;
- API pública suficiente;
- permisos definidos;
- diseño de consulta necesario.

---

# 58. Módulos históricos de Logger

Las pantallas históricas:

```text
Products

Purchases
```

del frontend Logger son referencias/prototipos.

No son módulos oficiales de Winter.

---

# 59. Products histórico

No debe convertirse simplemente en:

```text
Products
→ renombrar
→ Artículos
```

La implementación oficial de Artículos debe construirse sobre:

```text
ARTICULOS_API.md
```

y los contratos actuales.

---

# 60. Purchases histórico

Lo mismo aplica a `Purchases`.

Puede servir como referencia de interacción o código.

No constituye el contrato del módulo Compras.

---

# 61. Mapa visual completo

```text
WINTER

GENERAL
│
└── Inicio
    └── /

OPERACIONES
│
├── Artículos
│   └── /articulos
│
├── Compras
│   └── /compras
│
├── Inventario
│   └── /inventario
│       ├── Stock
│       ├── Almacenes
│       ├── Lotes
│       └── Movimientos
│
└── Producción
    └── /produccion
        ├── Órdenes
        ├── Lote de Producción
        ├── Trabajos
        ├── Transformaciones
        ├── Mediciones
        └── Trazabilidad


ADMINISTRACIÓN
│
├── Usuarios
│   └── /usuarios
│
├── Roles
│   └── /roles
│
└── Permisos
    └── /permisos


TRANSVERSALES

Adjuntos
Autenticación
Auditoría interna
```

Los elementos internos de Inventario y Producción no implican automáticamente items de Sidebar.

---

# 62. Configuración conceptual de navegación

La navegación debe poder expresarse como datos.

Ejemplo conceptual:

```ts
const navigation = [
  {
    label: "General",
    items: [
      {
        label: "Inicio",
        href: "/",
      },
    ],
  },
  {
    label: "Operaciones",
    items: [
      {
        label: "Artículos",
        href: "/articulos",
        permission: "<permiso real de lectura>",
      },
      {
        label: "Compras",
        href: "/compras",
        permission: "<permiso real de lectura>",
      },
      {
        label: "Inventario",
        href: "/inventario",
        permission: "<permiso real de lectura>",
      },
      {
        label: "Producción",
        href: "/produccion",
        permission: "<permiso real de lectura>",
      },
    ],
  },
];
```

Los placeholders de permisos deben sustituirse únicamente después de revisar el contrato backend correspondiente.

---

# 63. No hardcodear por rol

Incorrecto:

```ts
if (user.role === "admin") {
  showInventory = true;
}
```

Correcto:

```text
permisos efectivos
→ navegación
```

El nombre del rol no debe sustituir el sistema de permisos.

---

# 64. Navegación móvil

En móvil se conserva la misma arquitectura de módulos.

Cambia únicamente la presentación:

```text
Sidebar fija
→
Sheet / navegación off-canvas
```

No crear un mapa funcional distinto para móvil.

---

# 65. Orden de implementación

Orden recomendado:

```text
1. Design Tokens

2. Autenticación

3. AppShell

4. Inicio básico

5. Sidebar

6. Topbar

7. Artículos

8. Compras

9. Inventario

10. Producción

11. Usuarios

12. Roles

13. Permisos

14. Inicio operativo final
```

---

# 66. Por qué Artículos primero

Artículos permite validar en un módulo relativamente controlado:

- autenticación;
- permisos;
- routing;
- API client;
- React Query;
- listado;
- filtros;
- DataTable;
- paginación;
- Skeleton;
- EmptyState;
- ErrorState;
- formulario;
- Dialog;
- commands;
- Toast;
- Light/Dark;
- español `es-BO`.

Los patrones resultantes se reutilizan después.

---

# 67. Inicio inicial vs Inicio final

Puede existir un Inicio básico durante desarrollo.

Ejemplo:

```text
Bienvenido a Winter
```

con accesos disponibles.

Después de estabilizar los módulos puede evolucionar a un Dashboard operativo real.

No retrasar Artículos únicamente por construir primero un Dashboard complejo.

---

# 68. Límites entre módulos

## Artículos

Define el maestro.

No administra stock.

---

## Compras

Registra adquisición.

No administra directamente el saldo.

---

## Inventario

Administra movimientos, lotes y existencia.

No redefine artículos.

---

## Producción

Administra operaciones productivas.

No recalcula manualmente el stock final del frontend.

---

## Administración

Administra acceso.

No contiene reglas operativas de Producción o Inventario.

---

# 69. Comunicación visual entre módulos

Los módulos pueden enlazarse.

Ejemplo:

```text
Compra
→ movimiento generado
→ Inventario
```

o:

```text
Producción
→ salida
→ lote de Inventario
```

Pero cada pantalla debe respetar la propiedad del dato.

No duplicar la misma entidad editable en varios módulos.

---

# 70. Deep links

Cuando sea útil, una referencia puede navegar al recurso responsable.

Ejemplo:

```text
Detalle de compra
→ Ver movimiento de inventario
```

o:

```text
Lote
→ Ver orden de producción relacionada
```

sólo cuando el backend proporcione una relación identificable.

---

# 71. Estados visibles

Los módulos deben traducir estados contractuales a español.

Ejemplo:

```text
REGISTERED
→ Registrada

RECEIVED
→ Recibida

CANCELLED
→ Cancelada

OPEN
→ Abierta

CLOSED
→ Cerrada
```

El valor enviado al backend no cambia.

---

# 72. Terminología de Producción

Cuando existan términos del dominio como:

```text
Lote de Producción
```

la denominación visible definitiva debe seguir la terminología aprobada por el proyecto.

No realizar traducciones automáticas que puedan cambiar el significado operativo.

Cuando sea necesario conservar un término técnico utilizado por Producción, debe documentarse.

---

# 73. Sidebar y profundidad

La Sidebar principal no debe contener todas las entidades del sistema.

Debe responder principalmente:

> ¿A qué área quiero entrar?

Las navegaciones internas responden:

> ¿Qué quiero hacer dentro de esa área?

---

# 74. Sidebar prohibida

Evitar:

```text
Artículos
Compras
Stock
Almacenes
Lotes
Movimientos
Transferencias
Ajustes
Órdenes
Lotes
Trabajos
Transformaciones
Mediciones
Recipientes
Usuarios
Roles
Permisos
```

como una única lista plana.

Generaría exceso de opciones y pérdida de jerarquía.

---

# 75. Sidebar objetivo

Preferir:

```text
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

Simple y estable.

---

# 76. Añadir un módulo futuro

Un nuevo módulo sólo debe incorporarse a la navegación principal cuando tenga:

```text
[ ] responsabilidad de dominio definida

[ ] API pública

[ ] permiso de acceso

[ ] caso de uso independiente

[ ] pantallas propias

[ ] justificación para navegación de primer nivel
```

No crear módulos de Sidebar para cada tabla backend.

---

# 77. Reglas para Replit / IA

Antes de construir un módulo debe comprobar:

```text
1. ¿Cuál es el nombre visible en español?

2. ¿Cuál es su ruta frontend?

3. ¿Cuál es su contrato backend?

4. ¿Qué permiso permite entrar?

5. ¿Qué pantallas necesita?

6. ¿Qué patrones de pantalla utiliza?

7. ¿Qué componentes compartidos reutiliza?

8. ¿Qué comandos existen realmente?

9. ¿Qué información pertenece a otro módulo?

10. ¿Está introduciendo una nueva entidad o ruta sin contrato?
```

---

# 78. Prohibiciones

Replit/IA no debe:

- inventar módulos;
- crear rutas en inglés para nuevos módulos;
- añadir cada entidad a Sidebar;
- inventar permisos;
- duplicar Artículos dentro de Compras;
- editar stock directamente;
- tratar commands como simple cambio de estado;
- convertir Producción en CRUD genérico;
- asumir que Adjuntos necesita módulo propio;
- reconstruir el frontend Logger como si fuera Winter;
- modificar backend para facilitar una pantalla sin aprobación.

---

# 79. Definition of Done de un módulo frontend

Un módulo se considera integrado cuando:

```text
[ ] nombre visible en español

[ ] ruta frontend definida

[ ] navegación por permisos

[ ] contrato API real

[ ] pantallas necesarias definidas

[ ] patrones de pantalla respetados

[ ] componentes compartidos reutilizados

[ ] loading inicial

[ ] Skeleton

[ ] EmptyState

[ ] ErrorState

[ ] refetch

[ ] comandos correctamente representados

[ ] responsive

[ ] accesibilidad

[ ] Light

[ ] Dark

[ ] es-BO

[ ] typecheck

[ ] build
```

---

# 80. Regla final

> **Winter debe presentar una arquitectura modular simple para el usuario: Inicio, Artículos, Compras, Inventario, Producción y Administración. La complejidad interna del dominio debe organizarse dentro de estos módulos, no trasladarse directamente a la navegación principal.**
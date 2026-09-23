# Componentes de interfaz — Winter Frontend

**Versión:** 0.2  
**Fecha:** 2026-09-21  
**Estado:** contrato de componentes frontend  
**Frontend:** `artifacts/sistema-produccion`

---

# 1. Propósito

Este documento define cómo deben construirse, reutilizarse y organizarse los componentes de interfaz de Winter.

Regla principal:

> **Las páginas componen componentes; no reinventan primitivas ni patrones.**

Antes de crear un componente nuevo se debe comprobar:

1. si ya existe en `src/components/ui`;
2. si puede resolverse mediante una variante;
3. si ya existe un patrón compartido;
4. si realmente será reutilizable;
5. si contiene lógica que debería permanecer fuera de la capa visual.

---

# 2. Principios

## 2.1 Reutilización antes que creación

No crear un segundo:

- Button;
- Dialog;
- Input;
- Select;
- Table;
- Tooltip;
- Toast;
- Sheet;
- Badge;

si ya existe una implementación compatible.

---

## 2.2 Componentes pequeños y composables

Preferir:

```text
PageHeader
+
FilterBar
+
DataTable
+
Pagination
```

en lugar de:

```text
ArticuloCompletePageMegaComponent
```

con toda la lógica dentro.

---

## 2.3 Sin reglas de negocio

Un componente visual puede representar un estado o un dato.

No debe decidir reglas como:

```text
si stock < 0 entonces rechazar movimiento
```

o:

```text
si compra está recibida entonces cambiar estado
```

Eso pertenece al backend.

---

## 2.4 Tipado estricto

Los componentes deben utilizar TypeScript.

Evitar:

```ts
any
```

cuando el tipo pueda conocerse.

---

## 2.5 Design System único

Todo componente debe respetar:

```text
FRONTEND_DESIGN_SYSTEM.md
```

No introducir colores o estilos independientes.

---

# 3. Capas de componentes

Winter distingue tres niveles.

```text
Primitives
    ↓
Shared Application Components
    ↓
Domain Components
```

---

# 4. Primitivas UI

Ubicación:

```text
src/components/ui/
```

Son controles visuales genéricos.

Ejemplos existentes verificados:

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

Además existen otras primitivas Radix disponibles en la base actual.

Regla:

> Antes de crear una primitiva debe revisarse `src/components/ui`.

---

# 5. Componentes compartidos de aplicación

Ubicación recomendada:

```text
src/components/shared/
```

o:

```text
src/components/layout/
```

según responsabilidad.

Estos componentes combinan primitivas para crear patrones propios de Winter.

Ejemplos:

```text
AppShell
Sidebar
Topbar
PageHeader
SectionHeader
FilterBar
DataTable
Pagination
EmptyState
ErrorState
TableSkeleton
ConfirmDialog
StatusBadge
```

---

# 6. Componentes de dominio

Deben vivir preferentemente dentro de su feature.

Ejemplo:

```text
features/inventory/components/
```

o:

```text
features/production/components/
```

Ejemplos conceptuales:

```text
StockIndicator
LotIdentifier
MovementTypeBadge
ProductionBatchSummary
ContainerOccupancy
TraceabilityTimeline
```

Sólo se crean cuando una representación de dominio se repite realmente.

---

# 7. Organización recomendada

```text
src/
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
│
└── features/
    ├── articulos/
    │   └── components/
    ├── compras/
    │   └── components/
    ├── inventory/
    │   └── components/
    ├── production/
    │   └── components/
    └── access-management/
        └── components/
```

No es necesario mover todos los archivos inmediatamente.

---

# 8. AppShell

Componente compartido para rutas autenticadas.

Estructura:

```text
AppShell
├── Sidebar
├── Topbar
└── MainContent
```

Responsabilidades:

- layout general;
- `100dvh`;
- navegación;
- scroll principal;
- responsive;
- composición del contenido.

Debe renderizar contenido mediante `children` o composición compatible con Wouter.

No utilizar patrones dependientes de React Router como `Outlet`.

---

# 9. Sidebar

Responsabilidad:

- marca Winter / CDZ;
- navegación principal;
- grupos;
- estado activo;
- permisos;
- comportamiento responsive.

Los items deben declararse como configuración.

Ejemplo conceptual:

```ts
type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
};
```

No repetir manualmente JSX para cada módulo.

---

# 10. Sidebar y permisos

Los items pueden filtrarse mediante:

```ts
can(permission)
```

Ejemplo:

```text
Artículos
permission:
articulos:read
```

No inventar permisos para organizar la navegación.

Los permisos deben existir en:

```text
logger/docs/api/*
```

---

# 11. Topbar

Responsabilidades:

- usuario actual;
- contexto general;
- logout;
- navegación móvil;
- acciones globales aprobadas.

No debe convertirse en una segunda Sidebar.

---

# 12. PageHeader

Componente compartido obligatorio para páginas principales.

API conceptual:

```ts
type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};
```

Ejemplo:

```text
ARTÍCULOS

Maestro de artículos                 [+ Nuevo artículo]

Administra los artículos utilizados
por compras, inventario y producción.
```

---

# 13. SectionHeader

Para subsecciones dentro de una página.

Puede contener:

- título;
- descripción;
- acción secundaria.

Debe tener menor jerarquía que `PageHeader`.

---

# 14. Button

Ya existe una primitiva:

```text
src/components/ui/button.tsx
```

Las variantes actuales son:

```text
default
destructive
outline
secondary
ghost
link
```

Tamaños:

```text
default
sm
lg
icon
```

El Design System interpreta:

```text
default
→ acción primaria

destructive
→ operación destructiva
```

No crear variantes `primary` o `danger` paralelas si sólo duplican las existentes.

---

# 15. Loading en Button

Una acción asíncrona debe poder mostrar estado de ejecución.

Ejemplo:

```text
[ Guardar ]
```

pasa a:

```text
[ ⟳ Guardando... ]
```

Durante ese estado:

```text
disabled = true
```

para impedir doble envío.

El loading puede implementarse mediante composición sobre `Button`; no requiere otro componente visual completo.

---

# 16. IconButton

No es obligatorio crear una primitiva separada.

Preferencia:

```tsx
<Button
  variant="ghost"
  size="icon"
  aria-label="Editar artículo"
>
  <Pencil />
</Button>
```

Todo botón icon-only debe tener:

```text
aria-label
```

y Tooltip cuando mejore comprensión.

---

# 17. DropdownMenu / ActionMenu

`DropdownMenu` ya existe como primitiva.

Debe utilizarse para agrupar acciones secundarias.

Ejemplo:

```text
Artículo
─────────────────
Editar
Ver detalle
─────────────
Desactivar
```

Evitar:

```text
[Editar] [Detalle] [Activar] [Desactivar] [Más...]
```

en cada fila.

---

# 18. Input

Ya existe:

```text
src/components/ui/input.tsx
```

Debe reutilizar:

- tokens;
- focus;
- disabled;
- errores;
- tema Light/Dark.

Tipos HTML pueden incluir:

```text
text
email
password
date
search
```

según contrato.

---

# 19. Form

Existe infraestructura:

```text
src/components/ui/form.tsx
```

Winter utilizará:

```text
React Hook Form
+
Zod
+
componentes UI existentes
```

cuando la complejidad del formulario lo justifique.

---

# 20. Field

No crear un sistema de formulario paralelo.

Los campos deben componerse sobre la infraestructura existente de formularios.

Un campo funcional debe poder representar:

```text
Label
Control
Description
Error
Required
```

y asociación accesible.

---

# 21. Textarea

Ya existe como primitiva.

Usar para:

- observaciones;
- comentarios;
- descripción;
- justificación.

No utilizar un `<textarea>` estilizado manualmente dentro de una página si la primitiva oficial cubre el caso.

---

# 22. Select

Ya existe como componente basado en Radix.

Utilizar para:

- enums;
- estados permitidos;
- clasificaciones;
- unidades;
- opciones cerradas.

El label mostrado puede traducirse.

El valor enviado debe conservar el enum backend.

Ejemplo:

```text
UI:
Producto terminado

API:
PRODUCTO_TERMINADO
```

---

# 23. Checkbox

Usar para:

- selección múltiple;
- grupos de opciones;
- selección explícita.

Ejemplo:

```text
Permisos de un rol
```

---

# 24. Switch

Usar sólo para estados booleanos simples cuando el cambio sea inmediato, reversible y conceptualmente claro.

No usar Switch para:

- cancelar compra;
- recibir compra;
- cerrar producción;
- operaciones destructivas;
- comandos que requieren confirmación.

---

# 25. QuantityField

Winter necesita una representación coherente para cantidades.

Puede construirse como composición de:

```text
Input
+
unidad visible
+
Form
```

Debe trabajar contractualmente con:

```text
string decimal
```

cuando corresponda.

No convertir automáticamente el valor a `number` si backend utiliza Decimal.

---

# 26. FormActions

Patrón compartido de acciones de formulario.

Ejemplo:

```text
[Cancelar]       [Guardar]
```

Para command:

```text
[Cancelar]       [Confirmar recepción]
```

La acción dominante aparece a la derecha en desktop.

En móvil puede adaptarse al ancho disponible.

---

# 27. Card

Existe:

```text
src/components/ui/card.tsx
```

Debe utilizarse para agrupaciones reales.

No crear una Card diferente por módulo.

Correcto:

```text
<Card>
  <CardHeader />
  <CardContent />
</Card>
```

y personalizar contenido.

---

# 28. StatCard

Puede construirse como componente compartido sobre `Card`.

Uso:

- KPIs;
- métricas;
- alertas cuantificables.

Estructura:

```text
LABEL                ICON

1.250 L

Stock disponible
```

Los datos deben provenir de fuentes reales.

---

# 29. Table

Existe la primitiva:

```text
src/components/ui/table.tsx
```

Incluye:

```text
Table
TableHeader
TableBody
TableFooter
TableHead
TableRow
TableCell
TableCaption
```

Debe constituir la base de tablas Winter.

---

# 30. DataTable

`DataTable` será un componente compartido construido sobre las primitivas existentes cuando se implemente el primer listado real.

No debe convertirse inmediatamente en una mega-abstracción.

Capacidades base:

- columnas;
- filas;
- row key;
- acciones;
- empty;
- loading;
- scroll horizontal;
- alineación numérica.

Capacidades optativas:

- ordenamiento;
- selección;
- paginación;
- filtros;
- sticky header.

Sólo agregar una capacidad cuando exista una necesidad real.

---

# 31. Server-side data

`DataTable` no es responsable de obtener datos.

Correcto:

```text
ArticulosPage
    ↓
useArticulosQuery()
    ↓
DataTable
```

Incorrecto:

```text
DataTable
    ↓
fetch('/api/v1/articulos')
```

El componente recibe datos y estado.

---

# 32. FilterBar

Componente compartido para listados.

Puede contener:

- búsqueda;
- clasificación;
- estado;
- fecha;
- almacén;
- filtros reales del endpoint.

Ejemplo:

```text
[ Buscar artículo... ] [ Clasificación ▼ ] [ Estado ▼ ] [Limpiar]
```

No inventar filtros que el contrato no soporte.

---

# 33. SearchInput

Puede ser una composición reutilizable de `Input`.

Debe soportar:

- icono;
- clear;
- debounce cuando la búsqueda sea remota.

No realizar request directamente dentro del componente visual.

---

# 34. Pagination

Debe representar la paginación del backend.

Ejemplo conceptual:

```text
Mostrando 1–20 de 147

[Anterior]  Página 1 de 8  [Siguiente]
```

No cargar todos los registros y simular paginación cliente cuando el backend ya pagina.

---

# 35. Badge

Existe:

```text
src/components/ui/badge.tsx
```

Debe ser la base de estados y pequeñas categorías.

---

# 36. StatusBadge

Puede crearse como componente compartido sobre `Badge`.

Responsabilidad:

```text
estado backend
        ↓
label
+
tono semántico
```

Ejemplo:

```text
ACTIVE
→ Activo
→ success
```

No derivar el estado a partir del color.

---

# 37. Semántica de Badge

Tonos necesarios:

```text
neutral
info
success
warning
destructive
accent
```

Si la primitiva actual no posee todos estos tonos, se podrá ampliar su sistema de variantes de forma centralizada.

No resolverlo con clases arbitrarias dentro de cada página.

---

# 38. KeyValueList

Componente compartido útil para vistas de detalle.

Ejemplo:

```text
Código           UVA-MOSCATEL
Clasificación    Materia prima
Unidad           KG
Estado           Activo
```

Adecuado para información compacta.

---

# 39. Skeleton

Ya existe:

```text
src/components/ui/skeleton.tsx
```

Debe reutilizarse.

No crear un segundo Skeleton.

---

# 40. Skeleton estructural

No colocar bloques aleatorios.

Debe representar el contenido esperado.

Ejemplo:

```text
PageHeader
████████████
████████

Table
██████   ███████   █████
██████   ███████   █████
██████   ███████   █████
```

---

# 41. TableSkeleton

Componente compartido recomendado.

Debe permitir aproximadamente:

```ts
<TableSkeleton
  columns={5}
  rows={8}
/>
```

sin necesitar reproducir exactamente cada celda.

Objetivo:

- percepción inmediata de estructura;
- evitar pantalla blanca;
- reducir layout shift.

---

# 42. PageSkeleton

Para pantallas cuya estructura completa todavía está cargando.

Debe componerse de skeletons específicos.

No utilizarlo durante refetch si ya hay datos visibles.

---

# 43. EmptyState

Componente compartido.

Debe responder:

```text
¿Qué está vacío?

¿Por qué?

¿Qué puede hacer el usuario?
```

Ejemplo:

```text
No hay artículos registrados

Crea el primer artículo para comenzar a utilizar
Compras, Inventory y Production.

[ Nuevo artículo ]
```

La acción sólo aparece si el usuario tiene permiso.

---

# 44. ErrorState

Componente compartido para fallo de una región.

Debe permitir:

- título;
- mensaje;
- reintentar;
- `requestId`;
- icono.

No mostrar stack traces en producción.

---

# 45. Loading vs Empty

Nunca:

```text
isLoading
→ []
→ EmptyState
```

Correcto:

```text
loading
→ Skeleton

success + []
→ EmptyState
```

Son estados diferentes.

---

# 46. RefreshIndicator

Cuando existe cache y React Query está haciendo `isFetching`:

```text
contenido permanece visible
+
indicador discreto
```

Puede ser:

- texto;
- icono pequeño;
- spinner discreto;
- estado en toolbar.

No sustituir toda la pantalla por Skeleton.

---

# 47. Toast

La infraestructura Sonner/Toaster ya existe.

Usar para feedback no bloqueante.

Ejemplos:

```text
Artículo creado correctamente.

Compra actualizada.

Movimiento registrado.
```

No utilizar Toast como único feedback para errores de validación que requieren acción del usuario.

---

# 48. Alert

Componente compartido o primitiva existente cuando aplique.

Tonos:

```text
info
success
warning
destructive
```

Puede contener:

- icono;
- título;
- descripción;
- acción.

---

# 49. Dialog

Existe:

```text
src/components/ui/dialog.tsx
```

Debe utilizarse para:

- formulario corto;
- edición contextual;
- detalle simple;
- selección;
- confirmación no destructiva cuando aplique.

No crear un modal manual con `position: fixed`.

Radix ya aporta:

- portal;
- gestión de foco;
- Escape;
- overlay;
- semántica accesible.

---

# 50. AlertDialog

Existe:

```text
src/components/ui/alert-dialog.tsx
```

Debe utilizarse para confirmaciones relevantes o destructivas.

Ejemplo:

```text
Desactivar artículo

El artículo dejará de estar disponible para nuevas
operaciones, pero conservará su historial.

[Cancelar] [Desactivar]
```

---

# 51. ConfirmDialog

Puede existir un componente compartido construido sobre `AlertDialog`.

Props conceptuales:

```ts
type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
};
```

Sustituye:

```ts
window.confirm()
```

---

# 52. Sheet

Existe:

```text
src/components/ui/sheet.tsx
```

Uso recomendado:

- filtros en móvil;
- sidebar móvil;
- detalle contextual;
- formulario secundario cuando beneficie el flujo.

No usar Sheet como solución por defecto para toda creación/edición.

---

# 53. Drawer

Si se necesita comportamiento equivalente a Drawer y `Sheet` cubre el caso:

```text
usar Sheet
```

No crear otra primitiva sólo por cambiar el nombre.

---

# 54. Tabs

Existe:

```text
src/components/ui/tabs.tsx
```

Utilizar para vistas hermanas del mismo contexto.

Ejemplo:

```text
Resumen | Movimientos | Historial
```

No utilizar Tabs para ocultar pasos obligatorios de un workflow secuencial.

---

# 55. Tooltip

Existe:

```text
src/components/ui/tooltip.tsx
```

Usar especialmente en:

- acciones icon-only;
- información auxiliar;
- Sidebar colapsada si posteriormente existe.

No usar Tooltip para esconder información necesaria para completar un formulario.

---

# 56. Breadcrumbs

Puede incorporarse cuando exista navegación profunda.

Especialmente útil en:

- Production;
- lotes;
- trazabilidad;
- recursos relacionados.

No obligatorio en páginas de primer nivel.

---

# 57. Permission-aware UI

Después de implementar Auth/RBAC puede existir un componente:

```tsx
<Can permission="articulos:create">
  <Button>Nuevo artículo</Button>
</Can>
```

o una función equivalente.

Responsabilidad:

```text
UX
```

No:

```text
seguridad backend
```

---

# 58. Can

API conceptual:

```ts
type CanProps = {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};
```

Debe utilizar:

```text
AuthContext
```

y permisos efectivos provenientes de:

```text
GET /api/v1/auth/me
```

No debe consultar permisos por su cuenta.

---

# 59. Componentes de dominio

Pueden existir cuando aporten consistencia.

Ejemplos:

```text
ArticleClassificationBadge
QuantityDisplay
WarehouseLabel
InventoryLotIdentifier
StockIndicator
MovementTypeBadge
ProductionOrderStatus
ProductionBatchSummary
TraceabilityTimeline
```

No es obligatorio crearlos todos.

Se crean conforme aparezca repetición real.

---

# 60. QuantityDisplay

Útil para representar Decimal + unidad.

Ejemplo:

```text
1.250,375 L
```

o según reglas de formato aprobadas.

Debe recibir el Decimal como string.

No debe modificar el valor contractual.

---

# 61. StockIndicator

Debe representar información devuelta por backend.

Puede utilizar:

- valor;
- unidad;
- semántica visual;
- alerta documentada.

No debe recalcular stock desde movimientos.

---

# 62. TraceabilityTimeline

Sólo debe construirse cuando el backend proporcione los datos suficientes.

No fabricar una línea de tiempo combinando timestamps aislados que no tengan relación contractual.

---

# 63. Componentes de Production

Production puede requerir componentes especializados como:

```text
ProductionOrderHeader
BatchSummary
WorkEntry
MeasurementList
ContainerAssignment
TransformationSummary
LossSummary
```

Se definirán cuando se implemente el módulo.

No anticipar toda la UI antes de revisar `PRODUCTION_API.md`.

---

# 64. Page vs Dialog

Usar Dialog para:

- tareas cortas;
- pocos campos;
- contexto simple;
- operación rápida.

Usar página completa para:

- formularios largos;
- múltiples secciones;
- trazabilidad;
- relaciones;
- procesos complejos;
- contexto que debe permanecer visible.

---

# 65. Page vs Sheet

Sheet funciona bien para:

- filtros;
- edición contextual;
- detalle secundario;
- navegación móvil.

No utilizarlo para órdenes o workflows productivos complejos.

---

# 66. Componentes y API

Las primitivas visuales:

```text
NO hacen requests
```

Ejemplos:

```text
Button
Table
Badge
Dialog
Input
```

Los componentes de feature pueden consumir hooks cuando actúan como contenedores.

Aun así se prefiere:

```text
Page / Container
→ hook
→ presentational component
```

cuando la separación aporta claridad.

---

# 67. Componentes y Prisma

Prohibido importar tipos Prisma dentro de componentes frontend.

Los componentes trabajan con:

```text
DTOs HTTP
+
tipos frontend
```

según `FRONTEND_API_INTEGRATION.md`.

---

# 68. Componentes y permisos

No hardcodear lógica como:

```tsx
if (user.role === 'admin')
```

para determinar acciones si el backend ya expone permisos efectivos.

Preferir:

```tsx
can('articulos:update')
```

---

# 69. Componentes y responsive

Todo componente compartido debe verificarse al menos en:

```text
mobile
desktop
```

y tablet cuando el layout lo requiera.

Los componentes no deben asumir un ancho fijo de escritorio.

---

# 70. Componentes y temas

Todo componente debe funcionar con:

```text
Light
Dark
```

No escribir estilos específicos de un único tema dentro de páginas.

---

# 71. Componentes y accesibilidad

Obligatorio según tipo:

- keyboard;
- focus visible;
- ARIA;
- label;
- descripción;
- error asociado;
- icon-only accessible name;
- diálogo accesible;
- tabla semántica.

Preferir capacidades de Radix existentes sobre implementaciones manuales.

---

# 72. Componentes y loading

Un componente que inicia una operación debe poder representar:

```text
idle
loading
disabled
```

cuando corresponda.

No permitir doble submit accidental.

---

# 73. Componentes y error

Un componente visual no debe decidir cómo interpretar todo error backend.

La capa API normaliza:

```text
WinterApiError
```

La página o feature decide qué representación visual corresponde:

```text
field error
ErrorState
Alert
Toast
Dialog
```

---

# 74. Nombres

Primitivas:

```text
Button
Table
Dialog
Badge
Input
```

Shared:

```text
PageHeader
DataTable
FilterBar
EmptyState
ErrorState
TableSkeleton
StatusBadge
```

Domain:

```text
StockIndicator
LotIdentifier
BatchSummary
```

Evitar nombres como:

```text
PrettyCard
FancyButton
NewButton2
GeneralComponent
```

---

# 75. Regla de variantes

Si dos componentes se diferencian únicamente en apariencia:

```text
crear variante
```

Ejemplo:

```text
Button default
Button destructive
```

No:

```text
SaveButton
DeleteButton
```

salvo que encapsulen comportamiento realmente reutilizable y específico.

---

# 76. Regla para IA / Replit

Antes de crear un componente Replit debe comprobar:

```text
1. ¿Ya existe en src/components/ui?

2. ¿Puede componerse desde una primitiva?

3. ¿Puede resolverse con una variante?

4. ¿Se repetirá realmente?

5. ¿Pertenece a shared o al feature?

6. ¿Está intentando introducir lógica backend?

7. ¿Funciona en Light/Dark?

8. ¿Tiene loading/error/disabled cuando corresponde?

9. ¿Es accesible?

10. ¿Respeta FRONTEND_DESIGN_SYSTEM.md?
```

---

# 77. No duplicar

Prohibido crear paralelamente:

```text
CustomButton
CdzButton
WinterButton
Button2
```

si `Button` ya cubre el caso.

Lo mismo aplica a:

```text
Modal
Dialog
Select
Table
Badge
Tooltip
Toast
```

---

# 78. Referencias históricas

Los componentes:

```text
CdzCard
CdzButton
CdzField
CdzBadge
CdzStatCard
CdzDataTable
```

extraídos anteriormente sirvieron como referencia visual.

No son la implementación oficial actual.

Sus ideas útiles deben trasladarse a:

```text
src/components/ui
+
src/components/shared
```

sin mantener dos sistemas de componentes paralelos.

---

# 79. Componentes prioritarios a construir

La base ya contiene muchas primitivas.

Los primeros componentes propios de Winter que probablemente necesitaremos son:

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

No es necesario crearlos todos antes de comenzar.

Se implementan conforme al orden funcional del frontend.

---

# 80. Orden recomendado

Primero:

```text
Design Tokens
↓
Auth
↓
AppShell
↓
Sidebar / Topbar
↓
PageHeader
```

Luego, con Artículos:

```text
FilterBar
DataTable
Pagination
StatusBadge
TableSkeleton
EmptyState
ErrorState
ConfirmDialog
```

Esto permite que Artículos funcione como primer módulo que consolide los patrones reutilizables para los demás.

---

# 81. Definition of Done de un componente

Un componente compartido se considera terminado cuando:

```text
[ ] reutiliza primitivas existentes
[ ] está tipado
[ ] evita any
[ ] usa tokens semánticos
[ ] funciona Light/Dark
[ ] funciona mobile/desktop
[ ] tiene focus visible
[ ] es accesible
[ ] maneja disabled si corresponde
[ ] maneja loading si corresponde
[ ] no contiene reglas backend
[ ] no realiza HTTP arbitrario
[ ] no depende de Prisma
[ ] no duplica otro componente
```

---

# 82. Regla final

> **Winter debe tener un solo conjunto coherente de primitivas y componentes compartidos. Cada nuevo módulo debe reutilizar ese lenguaje en vez de crear su propia biblioteca de interfaz.**
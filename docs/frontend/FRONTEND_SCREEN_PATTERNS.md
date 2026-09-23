# Patrones de pantalla — Winter Frontend

**Versión:** 0.2  
**Fecha:** 2026-09-21  
**Estado:** contrato de composición de pantallas  
**Frontend:** `artifacts/sistema-produccion`

---

# 1. Propósito

Este documento define cómo deben componerse las pantallas completas del frontend de Winter.

Su objetivo es evitar que cada módulo resuelva de manera diferente problemas equivalentes como:

- listados;
- formularios;
- detalles;
- filtros;
- comandos;
- trazabilidad;
- dashboards;
- carga;
- errores;
- confirmaciones;
- permisos.

Regla principal:

> **Las pantallas de Winter deben construirse mediante patrones repetibles y componentes compartidos, no mediante layouts improvisados por módulo.**

Una pantalla puede combinar varios patrones, pero debe existir un patrón dominante.

---

# 2. Documentos relacionados

Este documento debe interpretarse junto con:

```text
FRONTEND_ARCHITECTURE.md
FRONTEND_API_INTEGRATION.md
FRONTEND_DESIGN_SYSTEM.md
FRONTEND_COMPONENTS.md
FRONTEND_MODULE_MAP.md
FRONTEND_IMPLEMENTATION_RULES.md
```

Los contratos HTTP continúan siendo responsabilidad de:

```text
logger/docs/api/*
```

---

# 3. Idioma de las pantallas

Toda interfaz visible debe estar en:

```text
Español
```

Localización inicial:

```text
es-BO
```

País:

```text
Bolivia
```

Zona horaria operativa:

```text
America/La_Paz
```

Por tanto, los ejemplos visibles en este documento utilizarán:

```text
Artículos
Compras
Inventario
Producción
Usuarios
Roles
Permisos
Almacenes
Lotes
Movimientos
```

y no nombres visibles en inglés.

Los nombres técnicos internos pueden conservar su nomenclatura contractual cuando corresponda.

---

# 4. Anatomía general de una pantalla

Una pantalla autenticada de Winter utiliza:

```text
AppShell
│
├── Sidebar
├── Topbar
│
└── MainContent
    │
    ├── PageHeader
    │
    ├── PageToolbar / FilterBar
    │
    └── PageContent
```

No todas las pantallas requieren `FilterBar`.

No todas las pantallas requieren acciones.

---

# 5. Estado general de una pantalla

Toda pantalla que depende de información remota debe contemplar explícitamente:

```text
Carga inicial
Datos
Vacío
Error
Actualizando
Sin permiso
```

cuando corresponda.

Una pantalla no está completa si únicamente funciona cuando la API responde correctamente.

---

# 6. Carga inicial

Cuando no existen datos en cache:

```text
Skeleton estructural
```

Ejemplo:

```text
PageHeaderSkeleton

████████████████
████████

TableSkeleton
██████    ███████    █████
██████    ███████    █████
██████    ███████    █████
```

No utilizar:

```text
pantalla vacía
```

ni:

```text
spinner grande centrado
```

como patrón principal de carga empresarial.

---

# 7. Refetch

Cuando ya existen datos y React Query realiza una actualización:

```text
mantener datos visibles
+
indicador discreto
```

Ejemplo:

```text
Artículos                         Actualizando…
```

No:

```text
datos
→ skeleton
→ datos
```

porque genera parpadeo y pérdida de contexto.

---

# 8. Patrón A — Listado administrativo

Uso principal:

- Artículos;
- Compras;
- Usuarios;
- Roles;
- Almacenes;
- Lotes;
- Movimientos;
- órdenes;
- catálogos.

Estructura:

```text
PageHeader                              [Acción primaria]
Descripción

FilterBar

DataTable

Pagination / resumen
```

Ejemplo:

```text
ARTÍCULOS

Maestro de artículos                   [+ Nuevo artículo]

Administra artículos utilizados
por Compras, Inventario y Producción.

[ Buscar... ] [ Clasificación ▼ ] [ Estado ▼ ]

┌─────────────┬────────────────┬──────────────┬─────────┐
│ Código      │ Nombre         │ Clasificación│ Estado  │
├─────────────┼────────────────┼──────────────┼─────────┤
│ UVA-MOSC    │ Uva Moscatel   │ Materia prima│ Activo  │
└─────────────┴────────────────┴──────────────┴─────────┘

Mostrando 1–20 de 147      Anterior  1 / 8  Siguiente
```

---

# 9. Reglas del listado administrativo

La acción principal debe representar una acción real.

Ejemplos:

```text
Nuevo artículo
Registrar compra
Nuevo usuario
Nuevo almacén
```

No mostrar la acción si el usuario no posee el permiso correspondiente.

Los filtros:

- aparecen antes de la tabla;
- utilizan parámetros reales de API;
- pueden limpiarse;
- deben reflejar su estado actual.

La tabla:

- muestra Skeleton durante carga inicial;
- muestra EmptyState después de una respuesta exitosa sin resultados;
- muestra ErrorState ante fallo;
- conserva datos durante refetch.

---

# 10. Empty State de listado

Ejemplo:

```text
No hay artículos registrados

Todavía no existen artículos disponibles.

[ Nuevo artículo ]
```

Si existen filtros activos:

```text
No se encontraron artículos

No existen resultados para los filtros seleccionados.

[ Limpiar filtros ]
```

Estos son estados distintos.

---

# 11. Acciones por fila

Preferencia:

```text
acción frecuente
+
menú adicional
```

Ejemplo:

```text
UVA-MOSC    Uva Moscatel       [Editar] [⋮]
```

Menú:

```text
Ver detalle
Editar
─────────────
Desactivar
```

No mostrar múltiples botones grandes por fila.

---

# 12. Patrón B — Maestro + formulario contextual

Uso:

- catálogos pequeños;
- configuración;
- administración;
- datos donde conviene mantener lista y edición simultáneamente visibles.

Desktop:

```text
┌───────────────────────────────┬────────────────────────┐
│ Listado                       │ Crear / editar         │
│                               │                        │
│ DataTable                     │ Formulario             │
│                               │                        │
└───────────────────────────────┴────────────────────────┘
```

No utilizarlo automáticamente.

Es adecuado sólo cuando el formulario es corto.

---

# 13. Maestro + formulario en móvil

En móvil:

```text
Listado
```

y la creación/edición puede abrirse mediante:

```text
Dialog
Sheet
o página
```

según complejidad.

No comprimir lista y formulario uno junto al otro en pantalla estrecha.

---

# 14. Patrón C — Formulario de registro

Uso:

- nuevo artículo;
- registrar compra;
- crear usuario;
- crear rol;
- almacén;
- operación administrativa sencilla.

Estructura:

```text
PageHeader

Form
│
├── Sección principal
│   └── campos
│
├── Sección secundaria
│   └── campos
│
└── Observaciones

FormActions
```

Ejemplo:

```text
Registrar compra

DATOS GENERALES
Proveedor             Fecha
[____________]        [__________]

DETALLE
Artículo              Cantidad
[____________]        [__________]

REFERENCIA
Marca                 Precio referencial
[____________]        [__________]

Observaciones
[_______________________________]

                     [Cancelar] [Registrar compra]
```

---

# 15. Reglas de formulario

Debe utilizar:

```text
<form>
```

y submit semántico.

Durante submit:

```text
[ Registrar compra ]
```

pasa a:

```text
[ Registrando... ]
```

y queda deshabilitado.

No permitir doble submit.

---

# 16. Errores de formulario

Error asociado a campo:

```text
Cantidad
[__________]

La cantidad es obligatoria.
```

Error general de dominio:

```text
No fue posible registrar la compra.

El servidor rechazó la operación debido a…
```

Los valores ingresados no deben desaparecer después de un error de API.

---

# 17. Formulario desktop

Preferencia:

```text
1 columna
```

para formularios simples.

```text
2 columnas
```

para formularios medios.

Hasta:

```text
3 columnas
```

cuando sean campos cortos y relacionados.

No utilizar 3 columnas solamente para ahorrar espacio.

---

# 18. Formulario móvil

En móvil:

```text
1 columna
```

La claridad es prioritaria.

---

# 19. Patrón D — Detalle de recurso

Uso:

- Artículo;
- Compra;
- Lote;
- Movimiento;
- Almacén;
- Orden de producción;
- Lote de producción;
- Usuario;
- Rol.

Estructura:

```text
Breadcrumb opcional

PageHeader                              [Acciones]

SummaryPanel

Contenido relacionado

Tabs opcionales
```

Ejemplo:

```text
Compras / COMP-000184

Compra COMP-000184                     [⋮]

Registrada el 21/09/2026

┌─────────────────────────────────────┐
│ Proveedor        ABC SRL            │
│ Estado           Registrada         │
│ Fecha            21/09/2026         │
│ Total items      4                  │
└─────────────────────────────────────┘

Resumen | Detalle | Historial
```

---

# 20. Tabs en detalles

Utilizar cuando existan vistas hermanas.

Ejemplo:

```text
Resumen
Movimientos
Historial
Adjuntos
```

No utilizar tabs simplemente para dividir arbitrariamente un formulario largo.

---

# 21. Acción principal en detalle

La acción depende del estado y permisos reales.

Ejemplo Compra:

```text
REGISTERED
+
compras:receive
```

puede permitir:

```text
[ Recibir compra ]
```

No convertir automáticamente cada estado en una acción si el backend no define el command.

---

# 22. Patrón E — Dashboard operativo

Uso:

```text
Inicio de Winter
```

o overview específico de módulo cuando exista información real.

Estructura:

```text
PageHeader

KPI Grid

┌──────────────────────────────┬──────────────────────┐
│ Tendencia / resumen          │ Alertas              │
│                              │                      │
└──────────────────────────────┴──────────────────────┘

Paneles secundarios
```

---

# 23. Dashboard Winter

Debe responder preguntas operativas.

Ejemplos potenciales:

```text
¿Hay alertas de stock?

¿Qué compras están pendientes?

¿Qué órdenes de producción están abiertas?

¿Qué movimientos ocurrieron recientemente?
```

Sólo si existen endpoints o datos adecuados.

No inventar KPIs.

---

# 24. KPIs

Cantidad visual razonable:

```text
móvil:
1–2

desktop:
3–4

pantallas amplias:
hasta 6 cuando aporte valor
```

No mostrar seis tarjetas sólo porque hay espacio.

---

# 25. Dashboard Skeleton

Durante carga inicial:

```text
[████] [████] [████] [████]

████████████████████      ███████
████████████████████      ███████
```

No usar un spinner central.

---

# 26. Patrón F — Comando operativo

Un command de negocio es una operación explícita.

Ejemplos:

- recibir compra;
- transferir inventario;
- registrar ajuste;
- registrar consumo;
- registrar salida;
- registrar transformación;
- registrar pérdida;
- cerrar orden.

No debe tratarse visualmente como:

```text
editar status
```

---

# 27. Estructura de command

```text
Contexto
    ↓
Datos necesarios
    ↓
Advertencias
    ↓
Impacto
    ↓
Confirmación
    ↓
Resultado backend
```

Ejemplo:

```text
Recibir compra COMP-000184

Esta operación ingresará los artículos de la compra
al Inventario.

Almacén destino
[ Almacén principal ▼ ]

Resumen
4 artículos
1.245,500 KG

[Cancelar]                    [Confirmar recepción]
```

---

# 28. Comandos críticos

Para operaciones de impacto relevante puede requerirse:

```text
AlertDialog
```

o una pantalla específica.

No utilizar `window.confirm`.

---

# 29. Command loading

Durante ejecución:

```text
[ Confirmando recepción... ]
```

La acción debe bloquearse.

No aplicar optimistic update por defecto en:

- recepción de compras;
- movimientos;
- transferencias;
- ajustes;
- producción;
- transformaciones;
- pérdidas.

Esperar confirmación backend.

---

# 30. Command success

Después de éxito:

```text
Operación completada
```

puede utilizar:

- Toast;
- actualización de datos;
- navegación al recurso;
- mensaje contextual.

Debe invalidar únicamente queries relacionadas.

---

# 31. Command error

Los errores de dominio deben mantenerse específicos.

Ejemplo:

```text
409
```

no debe convertirse siempre en:

```text
Ocurrió un error.
```

Debe utilizar el código contractual para determinar un mensaje comprensible.

---

# 32. Patrón G — Tabla + detalle contextual

Uso:

- Movimientos;
- Lotes;
- permisos;
- trazabilidad;
- investigación de registros;
- operaciones donde navegar constantemente entre rutas reduce productividad.

Desktop:

```text
┌──────────────────────────────────┬────────────────────────┐
│ Resultados                       │ Detalle                │
│                                  │                        │
│ DataTable                        │ KeyValueList           │
│                                  │ acciones               │
└──────────────────────────────────┴────────────────────────┘
```

---

# 33. Responsive del detalle contextual

Tablet:

```text
Tabla
+
Sheet
```

Mobile:

```text
Listado
→ detalle completo o Sheet
```

No forzar dos columnas estrechas.

---

# 34. Patrón H — Flujo productivo complejo

Producción no debe modelarse como CRUD genérico.

Puede contener contexto de:

```text
Orden de producción
│
├── Lotes de producción
├── Recipientes
├── Trabajos
├── Mediciones
├── Transformaciones
├── Insumos
├── Consumos
├── Salidas
├── Movimientos
└── Mermas
```

La pantalla debe reflejar el dominio real.

---

# 35. Contexto productivo persistente

Cuando un usuario trabaja dentro de una orden de producción debe mantener visibles datos esenciales como:

- orden;
- lote de producción;
- producto;
- recipiente;
- cantidades relevantes;
- estado cuando exista.

No obligarlo a recordar identificadores entre pantallas.

---

# 36. Producción no es un wizard obligatorio

No crear automáticamente:

```text
Paso 1
→ Paso 2
→ Paso 3
→ Paso 4
```

si el workflow backend permite registrar trabajos en distinto orden.

Un wizard sólo se utilizará si existe una secuencia real obligatoria.

---

# 37. Lectura vs operación en Producción

Debe diferenciarse claramente:

```text
Historial
```

de:

```text
Registrar nuevo trabajo
```

y:

```text
Ejecutar transformación
```

No mezclar eventos existentes con formularios de captura de manera confusa.

---

# 38. Patrón I — Trazabilidad

Objetivo:

responder preguntas como:

```text
¿De dónde viene?

¿Qué ocurrió?

¿Cuándo ocurrió?

¿Qué cantidad estuvo involucrada?

¿Dónde estaba?

¿En qué se transformó?

¿Quién registró la operación?
```

cuando esos datos existan.

---

# 39. Representaciones de trazabilidad

Preferencia inicial:

```text
tabla
timeline
lista jerárquica simple
```

Sólo utilizar:

```text
grafo complejo
```

si existe una necesidad real y datos suficientes.

No crear visualizaciones espectaculares que dificulten la lectura.

---

# 40. Timeline

Ejemplo conceptual:

```text
21/09/2026 10:40
Recepción de compra
+ 500 KG

21/09/2026 11:05
Transferencia
Almacén Principal → Producción

22/09/2026 08:15
Consumo de producción
- 120 KG
```

Debe provenir de información real.

No reconstruir eventos inexistentes.

---

# 41. Patrón J — Administración de usuarios y RBAC

Uso:

- Usuarios;
- Roles;
- Permisos.

Debe ser:

```text
compacto
claro
administrativo
```

No necesita la misma expresividad visual que Dashboard.

---

# 42. Usuarios

Patrón:

```text
PageHeader

FilterBar

DataTable

Pagination
```

Detalle/edición puede utilizar:

```text
Dialog
Sheet
o página
```

según complejidad.

---

# 43. Roles

Listado:

```text
Rol
Descripción
Usuarios
Estado
Acciones
```

Detalle puede incluir:

```text
Información
Permisos asignados
```

La modificación de permisos debe respetar el contrato real.

---

# 44. Permisos

Cuando se administren permisos puede utilizarse:

```text
grupos por módulo
+
checkboxes
+
búsqueda
```

Ejemplo:

```text
ARTÍCULOS

☑ Leer artículos
☑ Crear artículos
☐ Editar artículos
☐ Desactivar artículos
```

Los códigos contractuales no cambian.

---

# 45. Patrón K — Estado sin permiso

Cuando el usuario accede directamente a una ruta para la cual no tiene autorización:

```text
No tienes permiso para acceder a esta sección.
```

Debe existir una salida clara:

```text
[ Volver ]
```

o navegación válida.

No mostrar datos parcialmente antes de determinar autorización.

---

# 46. Ocultar vs deshabilitar

Cuando una acción no forma parte de las capacidades del usuario:

preferir:

```text
ocultarla
```

Ejemplo:

usuario sin:

```text
articulos:create
```

no necesita ver:

```text
Nuevo artículo
```

En casos donde conocer la existencia de la acción aporte contexto puede utilizarse `disabled`, pero debe ser una decisión UX explícita.

---

# 47. Patrón L — Error de pantalla

Cuando la carga principal falla:

```text
No pudimos cargar los artículos.

Intenta nuevamente.

[ Reintentar ]

Referencia: 4f8c...
```

El `requestId` puede mostrarse discretamente.

---

# 48. Error parcial

Si falla sólo una región:

```text
Dashboard
├── KPI OK
├── KPI OK
└── Actividad reciente → ErrorState
```

No necesariamente bloquear toda la pantalla.

---

# 49. Patrón M — Archivo / adjunto

Cuando un recurso soporte adjuntos:

```text
Adjuntos

archivo.pdf
Factura proveedor
21/09/2026
[Ver] [Descargar]
```

Carga:

```text
Seleccionar archivo
Descripción
Subir
```

Debe utilizar únicamente la API de Attachments.

No acceder directamente a Supabase Storage.

---

# 50. Upload loading

Durante upload:

```text
Subiendo archivo...
```

Debe:

- impedir doble carga;
- mostrar error de tamaño/formato cuando el backend lo reporte;
- mantener contexto.

---

# 51. Filtros

Todo filtro debe corresponder a una capacidad real del endpoint.

Ejemplo Artículos:

```text
Buscar
Clasificación
Estado
```

si están definidos por la API.

No construir filtros únicamente porque el campo aparece en la tabla.

---

# 52. Búsqueda

Para búsqueda remota:

```text
Input
→ debounce
→ query
```

cuando corresponda.

Referencia:

```text
300–500 ms
```

No disparar requests innecesarios en cada pulsación si puede evitarse.

---

# 53. Filtros activos

Cuando haya varios filtros puede indicarse:

```text
Clasificación: Materia prima ×
Estado: Activo ×
```

y ofrecer:

```text
Limpiar filtros
```

---

# 54. Filtros en móvil

Cuando el conjunto es complejo:

```text
[Filtros]
```

abre:

```text
Sheet
```

No reducir los controles hasta volverlos inutilizables.

---

# 55. Paginación

Cuando el backend pagina:

```text
DataTable
+
Pagination
```

Ejemplo:

```text
Mostrando 21–40 de 147

[Anterior]     Página 2 de 8     [Siguiente]
```

No simular paginación en cliente cargando todos los registros.

---

# 56. Rutas visibles

Las rutas frontend nuevas utilizarán español.

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

Esto no modifica los endpoints backend.

---

# 57. Navegación lista → detalle

Ejemplo:

```text
/articulos
```

→

```text
/articulos/:id
```

Crear:

```text
/articulos/nuevo
```

cuando se decida usar página dedicada.

Editar:

```text
/articulos/:id/editar
```

cuando el flujo utilice página.

No es obligatorio crear todas estas rutas si Dialog o Sheet cubren mejor la tarea.

---

# 58. Dialog vs página

Usar `Dialog` cuando:

- el formulario es corto;
- la operación es rápida;
- conservar contexto es útil;
- no existen varias secciones complejas.

Ejemplo:

```text
Crear almacén
Editar nombre de rol
```

---

# 59. Página dedicada

Usar página cuando:

- existen muchas secciones;
- hay relaciones;
- requiere varios minutos;
- necesita contexto persistente;
- hay riesgo de pérdida de trabajo;
- existe trazabilidad.

Ejemplos potenciales:

```text
Registrar compra compleja
Orden de producción
Transformación
```

---

# 60. Sheet

Usar para:

- filtros móviles;
- navegación móvil;
- detalle contextual;
- edición secundaria.

No utilizarlo como solución predeterminada para cualquier formulario.

---

# 61. AlertDialog

Usar para:

- confirmación destructiva;
- operación de alto impacto;
- command que requiere decisión explícita.

Ejemplo:

```text
Desactivar artículo
```

No para:

```text
Abrir detalle
```

---

# 62. PageHeader

Toda pantalla de primer nivel debe utilizar un patrón consistente.

Ejemplo:

```text
INVENTARIO

Stock actual por almacén              [Registrar ajuste]

Consulta existencias disponibles
y movimientos recientes.
```

---

# 63. Jerarquía de acciones

Orden visual:

```text
1. Acción primaria de página

2. Acciones secundarias

3. Acción principal del recurso

4. Menú de acciones adicionales

5. Operación destructiva
```

No permitir que todas las acciones tengan la misma prominencia.

---

# 64. Confirmaciones

No pedir confirmación para cada acción trivial.

Sí considerar confirmación para:

- cancelaciones;
- desactivaciones;
- movimientos importantes;
- cierre de órdenes;
- recepción;
- pérdida;
- transformaciones;
- operaciones irreversibles.

La necesidad final depende del dominio.

---

# 65. Texto de acciones

Los botones deben describir acciones concretas.

Preferir:

```text
Registrar compra
Recibir compra
Transferir
Registrar ajuste
Confirmar transformación
Cerrar orden
```

Evitar:

```text
Aceptar
OK
Procesar
Continuar
```

cuando no expliquen qué ocurrirá.

---

# 66. Terminología visible

Utilizar vocabulario real del negocio:

```text
Artículo
Proveedor
Compra
Almacén
Inventario
Lote
Movimiento
Producción
Orden de producción
Trabajo de producción
Transformación
Recipiente
Medición
Merma
```

No utilizar traducciones literales que no correspondan al lenguaje operativo de la bodega.

---

# 67. Estados backend

Los enums internos se traducen sólo para presentación.

Ejemplo:

```text
REGISTERED
→ Registrada
```

```text
RECEIVED
→ Recibida
```

```text
CANCELLED
→ Cancelada
```

El frontend sigue enviando el valor contractual.

---

# 68. Fechas y horas

Presentación inicial:

```text
es-BO
```

Ejemplo:

```text
21/09/2026
```

o:

```text
21/09/2026 10:45
```

según contexto.

La API conserva ISO-8601.

---

# 69. Cantidades

Datos Decimal siguen siendo strings contractuales.

La UI puede mostrar:

```text
1.250,375 KG
```

sin modificar el valor interno.

Los valores comparables deben utilizar números tabulares cuando sea posible.

---

# 70. Moneda

Cuando se muestre moneda boliviana:

```text
Bs
```

Ejemplo:

```text
Bs 1.250,00
```

No utilizar USD por defecto.

---

# 71. Aplicación por módulo — Artículos

Patrones principales:

```text
A — Listado
C — Formulario
D — Detalle
F — Commands
```

Pantallas esperadas:

```text
Artículos
Crear artículo
Detalle de artículo
Editar artículo
```

Commands:

```text
Activar
Desactivar
```

según contrato backend.

---

# 72. Aplicación por módulo — Compras

Patrones:

```text
A — Listado
C — Registro
D — Detalle
F — Command
```

Flujo conceptual:

```text
Listado
    ↓
Registrar compra
    ↓
Detalle
    ↓
Recibir / Cancelar
```

según permisos y estado.

Registrar y recibir son operaciones distintas.

---

# 73. Aplicación por módulo — Inventario

Patrones:

```text
A — Listados
D — Detalle
F — Commands
G — Detalle contextual
I — Trazabilidad
```

Subáreas potenciales:

```text
Stock
Almacenes
Lotes
Movimientos
Transferencias
Ajustes
```

No calcular stock en frontend.

---

# 74. Aplicación por módulo — Producción

Patrones:

```text
D — Detalle
F — Commands
H — Flujo complejo
I — Trazabilidad
```

Debe reflejar:

```text
Órdenes
Batches
Trabajos
Recipientes
Transformaciones
Mediciones
Consumos
Salidas
Mermas
```

según contrato real.

---

# 75. Aplicación por módulo — Usuarios

Patrones:

```text
A — Listado
C — Formulario
D — Detalle
```

Acciones según contrato:

```text
Crear
Editar
Activar
Suspender
Asignar/reemplazar rol
```

---

# 76. Aplicación por módulo — Roles y Permisos

Patrones:

```text
A
B
D
J
```

La selección de permisos debe mostrar labels en español, manteniendo internamente los códigos exactos backend.

---

# 77. Primera pantalla piloto

El primer módulo funcional recomendado para consolidar estos patrones es:

```text
Artículos
```

Porque permite validar:

- rutas;
- permisos;
- PageHeader;
- FilterBar;
- DataTable;
- Pagination;
- Skeleton;
- EmptyState;
- ErrorState;
- formulario;
- Dialog/Page;
- confirmación;
- Toast;
- React Query;
- integración API.

Sin comenzar todavía por la complejidad de Producción.

---

# 78. Reglas para Replit / IA

Antes de implementar una pantalla debe responder:

```text
¿Qué patrón domina?

¿Qué endpoint usa?

¿Qué permiso requiere?

¿Qué estados tiene?

¿Qué componente existente reutiliza?

¿Qué ocurre durante loading?

¿Qué ocurre con lista vacía?

¿Qué ocurre si falla?

¿Qué ocurre durante una mutación?

¿Necesita Dialog, Sheet o página?

¿Cómo funciona en móvil?

¿Todo texto visible está en español?
```

---

# 79. Anti-patrones

No:

- inventar un layout diferente por módulo;
- convertir listados en cards sin razón;
- usar spinner central para toda carga;
- mostrar EmptyState mientras carga;
- vaciar datos durante refetch;
- usar `window.confirm`;
- utilizar optimistic updates en commands complejos;
- introducir textos visibles en inglés;
- crear rutas nuevas en inglés;
- mezclar acciones destructivas con primarias;
- ocultar errores contractuales;
- inventar estados;
- inventar workflows;
- usar Dialog para procesos largos;
- usar página completa para operaciones triviales;
- duplicar componentes compartidos.

---

# 80. Definition of Done de una pantalla

Una pantalla se considera terminada cuando cumple:

```text
[ ] patrón definido
[ ] ruta correcta
[ ] textos en español
[ ] permisos reales
[ ] contrato API real
[ ] PageHeader consistente
[ ] loading inicial
[ ] Skeleton estructural
[ ] datos
[ ] EmptyState
[ ] ErrorState
[ ] refetch sin perder datos
[ ] mutation loading
[ ] prevención de doble submit
[ ] manejo de errores contractuales
[ ] cache/invalidation
[ ] responsive
[ ] accesibilidad
[ ] Light
[ ] Dark
[ ] Design System
[ ] componentes compartidos
[ ] typecheck
[ ] build
```

---

# 81. Regla final

> **Winter debe sentirse como un solo sistema, aunque esté compuesto por muchos módulos. Los mismos problemas de interfaz deben resolverse mediante los mismos patrones, con lenguaje visible en español y respetando siempre el contrato real del dominio.**
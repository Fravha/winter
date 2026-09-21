# Winter Frontend Design System

**Versión:** 0.2  
**Fecha:** 2026-09-21  
**Estado:** contrato visual del frontend  
**Frontend:** `artifacts/sistema-produccion`

---

# 1. Propósito

Este documento define el lenguaje visual oficial de Winter.

Winter debe combinar:

- estructura y densidad de una plataforma empresarial;
- claridad de un sistema operativo/administrativo;
- identidad visual de Bodega Cruce del Zorro;
- percepción boutique/premium controlada;
- necesidades reales de inventario, compras, producción, trazabilidad y administración.

La interfaz no debe depender de decisiones visuales improvisadas por módulo.

Regla principal:

> **Winter es una plataforma empresarial de producción y trazabilidad con identidad premium Cruce del Zorro.**

No es:

- un ERP genérico sin identidad;
- una landing page de vinos;
- una copia del sistema empresarial antiguo;
- una colección de estilos independientes.

---

# 2. Fuentes visuales

El Design System se deriva de dos referencias principales.

## 2.1 Referencia empresarial

Aporta:

- organización;
- densidad;
- navegación;
- formularios;
- tablas;
- filtros;
- dashboards operativos;
- distribución de información.

## 2.2 Cruce del Zorro

Aporta:

- bordó/vino;
- dorado envejecido;
- carbón;
- marfil;
- jerarquía editorial;
- acabados premium;
- bordes finos;
- iconografía lineal;
- identidad.

La referencia empresarial determina principalmente **cómo se organiza el trabajo**.

Cruce del Zorro determina principalmente **cómo se presenta ese trabajo**.

---

# 3. Principios

## 3.1 Operación primero

La UI debe optimizar:

- lectura;
- registro;
- búsqueda;
- comparación;
- control;
- seguimiento;
- ejecución de tareas.

La decoración nunca debe dificultar una operación.

---

## 3.2 Identidad controlada

CDZ debe reconocerse sin convertir cada pantalla en una pieza promocional.

La identidad se expresa principalmente mediante:

- color;
- tipografía;
- acabados;
- navegación;
- microdetalles;
- jerarquía visual.

---

## 3.3 Una sola gramática visual

Los módulos no crean sus propios:

- botones;
- radios;
- colores;
- tablas;
- modales;
- inputs;
- badges;
- sombras.

Los componentes compartidos constituyen la base visual.

---

## 3.4 Densidad útil

Winter es una herramienta empresarial.

Debe mostrar suficiente información para trabajar sin obligar al usuario a abrir múltiples pantallas para comprender un registro.

La densidad objetivo es:

> **media / compacta**

---

## 3.5 Estados explícitos

Toda región con datos debe poder representar:

```text
Loading
Data
Empty
Error
Refreshing
Disabled
Unauthorized
```

cuando corresponda.

---

## 3.6 Accesibilidad

La interfaz debe considerar desde el inicio:

- foco visible;
- teclado;
- labels;
- ARIA;
- contraste;
- reducción de movimiento;
- targets táctiles;
- estados no dependientes únicamente del color.

---

# 4. Stack visual oficial

La implementación visual oficial utiliza la base técnica existente:

```text
Tailwind CSS 4
Radix UI
patrón shadcn/ui existente
Lucide React
class-variance-authority
clsx
tailwind-merge
```

Estos elementos no deben sustituirse por otro Design System sin aprobación.

No introducir paralelamente:

```text
Material UI
Bootstrap
Ant Design
otro sistema completo de componentes
```

---

# 5. Tokens semánticos

El frontend actual ya dispone en `src/index.css` de tokens como:

```text
--background
--foreground

--card
--card-foreground
--card-border

--popover
--popover-foreground
--popover-border

--primary
--primary-foreground

--secondary
--secondary-foreground

--muted
--muted-foreground

--accent
--accent-foreground

--destructive
--destructive-foreground

--border
--input
--ring

--sidebar
--sidebar-foreground
--sidebar-border
--sidebar-primary
--sidebar-accent

--chart-1
...
--chart-5
```

Estos serán los tokens visuales oficiales.

## Regla

> No crear un segundo sistema paralelo `--winter-*` para representar los mismos roles.

Winter define **los valores** de los tokens existentes.

Los componentes consumen roles semánticos:

```text
primary
accent
muted
destructive
background
```

no nombres físicos de color.

---

# 6. Tema claro

Valores base aprobados:

```css
:root {
  --background: 40 33% 98%;
  --foreground: 30 14% 13%;

  --card: 0 0% 100%;
  --card-foreground: 30 14% 13%;
  --card-border: 36 20% 87%;

  --popover: 0 0% 100%;
  --popover-foreground: 30 14% 13%;
  --popover-border: 36 20% 87%;

  --primary: 345 68% 28%;
  --primary-foreground: 40 30% 97%;

  --secondary: 36 22% 93%;
  --secondary-foreground: 30 14% 18%;

  --muted: 36 22% 94%;
  --muted-foreground: 30 8% 40%;

  --accent: 38 60% 38%;
  --accent-foreground: 40 30% 97%;

  --destructive: 347 64% 44%;
  --destructive-foreground: 0 0% 100%;

  --border: 36 20% 87%;
  --input: 36 20% 85%;
  --ring: 42 60% 45%;
}
```

La base es:

```text
marfil
+
blanco cálido
+
carbón
+
bordó
+
dorado
```

---

# 7. Tema oscuro

```css
.dark {
  --background: 30 8% 4%;
  --foreground: 40 25% 94%;

  --card: 30 6% 7%;
  --card-foreground: 40 25% 94%;
  --card-border: 36 10% 14%;

  --popover: 30 7% 8%;
  --popover-foreground: 40 25% 94%;
  --popover-border: 36 10% 14%;

  --primary: 345 71% 21%;
  --primary-foreground: 40 25% 96%;

  --secondary: 36 10% 11%;
  --secondary-foreground: 40 20% 90%;

  --muted: 30 6% 10%;
  --muted-foreground: 36 12% 65%;

  --accent: 42 55% 55%;
  --accent-foreground: 30 8% 6%;

  --destructive: 347 53% 46%;
  --destructive-foreground: 0 0% 100%;

  --border: 36 10% 14%;
  --input: 0 0% 15%;
  --ring: 46 64% 53%;
}
```

El dark mode debe usar negros cálidos y carbón.

Evitar:

```text
#000000
+
#FFFFFF
```

como combinación predominante.

---

# 8. Sidebar tokens

La Sidebar puede tener mayor identidad CDZ que el área operativa.

Debe disponer de sus propios tokens existentes:

```text
--sidebar
--sidebar-foreground
--sidebar-border
--sidebar-primary
--sidebar-primary-foreground
--sidebar-accent
--sidebar-accent-foreground
--sidebar-ring
```

No hardcodear bordó/dorado directamente dentro de `Sidebar.tsx`.

---

# 9. Colores semánticos adicionales

Winter necesita distinguir además:

```text
info
success
warning
```

Si estos roles requieren tokens adicionales, pueden incorporarse al sistema base porque representan semántica distinta y no duplican `primary`.

Valores de referencia:

```text
INFO

Light:
209 51% 28%

Dark:
207 45% 58%
```

```text
SUCCESS

Light:
145 44% 36%

Dark:
145 42% 52%
```

```text
WARNING

Light:
38 72% 44%

Dark:
42 65% 55%
```

---

# 10. Uso del bordó

El bordó representa:

- marca;
- acción primaria;
- selección relevante;
- énfasis controlado.

Usarlo en:

- botón principal;
- indicadores principales;
- branding;
- algunos elementos activos.

No utilizarlo para colorear:

- todos los títulos;
- todos los inputs;
- todas las tarjetas;
- fondos grandes del área operativa.

---

# 11. Uso del dorado

El dorado es acento premium.

Usarlo para:

- focus ring;
- indicador activo;
- pequeños separadores;
- iconos seleccionados;
- métricas puntuales;
- detalles de marca.

No usarlo:

- como gran superficie;
- para párrafos;
- para largas columnas de texto;
- como color principal de botones;
- como texto pequeño sobre fondo claro sin validar contraste.

---

# 12. Azul informativo

El azul de la referencia empresarial puede mantenerse exclusivamente como semántica:

```text
información
capacidad
referencia
enlaces
visualizaciones informativas
```

No sustituye al bordó como color principal.

---

# 13. Estados semánticos

Preferencia conceptual:

```text
Activo / correcto       → success
Pendiente / atención    → warning
Información             → info
Error                   → destructive
```

El estado debe acompañarse mediante:

- texto;
- badge;
- icono cuando sea útil.

No utilizar únicamente color.

---

# 14. Charts

Tokens existentes:

```text
--chart-1
--chart-2
--chart-3
--chart-4
--chart-5
```

Dirección recomendada:

```text
chart-1 → bordó
chart-2 → dorado
chart-3 → verde
chart-4 → ámbar
chart-5 → rosado/vino
```

Los gráficos deben representar información útil.

No crear visualizaciones únicamente para llenar el Dashboard.

---

# 15. Tipografía

## 15.1 Sans serif

Fuente principal:

```text
Inter
```

Fallback:

```css
Inter, system-ui, -apple-system, "Segoe UI", sans-serif
```

Usar en:

- tablas;
- filtros;
- formularios;
- botones;
- navegación;
- badges;
- contenido;
- ayudas;
- valores operativos.

---

## 15.2 Serif editorial

Fuente objetivo:

```text
Playfair Display
```

Fallback:

```text
Georgia, serif
```

Uso limitado a:

- identidad;
- Login;
- PageHeader;
- determinados títulos;
- algunos KPIs;
- áreas editoriales de Dashboard.

No usar en:

- tablas;
- labels;
- inputs;
- filtros;
- botones;
- texto operacional denso.

---

# 16. Números

Cantidades, importes y valores comparables deben utilizar números tabulares cuando sea posible.

Ejemplo:

```css
font-variant-numeric: tabular-nums;
```

Particularmente útil para:

- cantidades;
- litros;
- kilogramos;
- precios;
- stock;
- mediciones;
- fechas tabulares.

---

# 17. Escala tipográfica

Referencia:

| Uso | Tamaño |
|---|---:|
| Eyebrow | 10–11 px |
| Metadata | 11–12 px |
| UI compacta | 13 px |
| Texto base | 14 px |
| Texto destacado | 16 px |
| Título panel | 18–20 px |
| Título sección | 20–24 px |
| Título página | 28–36 px |
| KPI | 28–36 px |

No utilizar títulos enormes propios de landing pages.

---

# 18. Eyebrow

Puede utilizarse para pequeñas categorías o contexto.

Ejemplo:

```text
INVENTARIO

Stock por almacén
```

Características:

- 10–11 px;
- uppercase;
- tracking amplio;
- baja prominencia.

No utilizarlo indiscriminadamente en cada bloque.

---

# 19. Espaciado

Unidad base:

```text
4 px
```

Escala principal:

```text
4
8
12
16
20
24
32
40
```

Reglas:

- controles: 8–12 px;
- paneles: 16–24 px;
- secciones: 24–32 px;
- grandes separaciones: 32–40 px.

Evitar valores arbitrarios cuando exista un token cercano.

---

# 20. Radios

Base:

```text
sm       6px
default  8px
lg       12px
pill     999px
```

Uso:

```text
input/button    6–8px
card            12px
dialog          12px
badge           pill
```

Winter no debe sentirse como una aplicación de consumo con radios excesivamente grandes.

---

# 21. Profundidad

Prioridad visual:

```text
1. contraste de superficie
2. borde
3. sombra mínima
4. blur cuando sea realmente útil
```

No utilizar sombras grandes detrás de cada card.

---

# 22. Transparencia y blur

El frontend CDZ de referencia utiliza transparencias y `backdrop-filter`.

Winter puede utilizarlos de manera controlada en:

- Login;
- Topbar;
- overlays;
- determinados paneles visuales.

En tablas y formularios operativos debe preferirse una superficie sólida y legible.

La identidad premium no debe reducir contraste.

---

# 23. Motion

Duración base:

```text
150 ms
```

Curva:

```text
cubic-bezier(.4, 0, .2, 1)
```

Animar únicamente:

- hover;
- focus;
- dialogs;
- dropdowns;
- sidebar móvil;
- feedback breve.

Respetar:

```text
prefers-reduced-motion
```

---

# 24. App Shell

Estructura:

```text
AppShell
├── Sidebar
├── Topbar / MobileHeader
└── MainContent
```

Toda ruta autenticada utiliza este shell.

---

# 25. Desktop Shell

Referencia:

```text
height: 100dvh

Sidebar:
256 px

Topbar:
56–64 px

Main:
scroll independiente
```

Padding:

```text
tablet       24 px
desktop      24–32 px
wide         32 px
```

Winter debe aprovechar el ancho de pantalla.

No imponer un `max-width` estrecho a páginas empresariales.

---

# 26. Mobile Shell

En móvil:

```text
Sidebar
→ off-canvas

Mobile Header
→ 56 px

Content
→ padding 16 px
```

Targets importantes:

```text
>= 44 px
```

---

# 27. Sidebar

Debe contener:

1. marca Winter / Cruce del Zorro;
2. grupos funcionales;
3. navegación filtrada por permisos;
4. estado activo;
5. contexto de usuario cuando corresponda.

Item activo:

- fondo sutil;
- mayor contraste;
- pequeño indicador dorado;
- icono consistente.

No utilizar grandes bloques bordó/dorado para cada item.

---

# 28. Topbar

Responsabilidades:

- contexto;
- usuario;
- acciones globales;
- acceso a sesión;
- navegación móvil.

No debe duplicar la Sidebar.

---

# 29. PageHeader

Estructura:

```text
Eyebrow opcional

Título                         Acción primaria
Descripción                    Acciones secundarias
```

El título puede utilizar serif cuando la jerarquía lo justifique.

No usar serif para información operativa ubicada debajo.

---

# 30. PageToolbar

Ubicada entre PageHeader y contenido cuando sea necesaria.

Puede contener:

- búsqueda;
- filtros;
- rango de fechas;
- estado;
- clasificación;
- acciones de vista.

Debe evitar convertirse en una segunda cabecera de página.

---

# 31. Cards

Una Card debe representar una agrupación lógica.

Variantes conceptuales:

```text
Card
StatCard
InteractiveCard
WarningCard
```

No utilizar una Card para cada fila de datos si una tabla representa mejor la información.

Padding:

```text
20–24 px
```

---

# 32. Dashboard

Debe sentirse ejecutivo/operativo.

Puede utilizar:

- KPIs;
- alertas;
- tablas resumidas;
- tendencias;
- actividad;
- accesos rápidos.

No debe parecer un dashboard de plantilla.

## Grid de KPIs

Referencia:

```text
móvil      1–2 columnas
desktop    3–4 columnas
wide       hasta 6 cuando exista espacio real
```

No forzar seis KPIs en pantallas pequeñas.

---

# 33. Tablas

Las tablas son un componente central de Winter.

Deben priorizar:

- comparación;
- lectura;
- densidad;
- velocidad.

Estándar:

```text
Header           12–13 px
Body             13–14 px
Fila             44–48 px
```

Características:

- header claro;
- hover discreto;
- bordes suaves;
- cifras alineadas correctamente;
- acciones al extremo derecho;
- badges para estados;
- scroll horizontal cuando sea necesario.

---

# 34. Sticky headers

Para tablas largas puede utilizarse encabezado sticky cuando el contenedor permita un comportamiento claro.

Evitar sticky cuando produzca superposiciones confusas.

---

# 35. Acciones por fila

No mostrar seis botones grandes en cada fila.

Preferencia:

```text
acción contextual principal
+
menu de acciones adicionales
```

Las acciones frecuentes pueden permanecer visibles.

---

# 36. Formularios

## Desktop

```text
simple       → 1 columna
medio        → 2 columnas
administrativo compacto
             → hasta 3 columnas
```

Sólo usar 3 columnas para campos:

- cortos;
- relacionados;
- fácilmente comparables.

Observaciones y textos largos:

```text
full width
```

---

# 37. Formularios móviles

En móvil:

```text
1 columna
```

No comprimir múltiples campos pequeños únicamente para mantener el layout desktop.

---

# 38. Inputs

Altura:

```text
36–40 px desktop
>=44 px para acciones táctiles críticas en móvil
```

Todo campo debe contemplar:

- label;
- valor;
- placeholder cuando corresponda;
- helper text;
- error;
- disabled;
- focus;
- required cuando aplique.

Placeholder no reemplaza label.

---

# 39. Botones

Variantes oficiales existentes/adaptables:

```text
default / primary
secondary
outline
ghost
destructive
link
icon
```

Regla:

> Dentro de una región debe existir como máximo una acción primaria dominante.

---

# 40. Botón primario

Representa la acción principal.

Ejemplos:

```text
Registrar compra
Nuevo artículo
Guardar
Confirmar recepción
```

Color:

```text
primary / bordó
```

No utilizar dorado como botón principal habitual.

---

# 41. Destructive

Para operaciones realmente destructivas o peligrosas:

- eliminar;
- cancelar irreversible;
- determinadas pérdidas;
- acciones de alto impacto.

No utilizar `destructive` sólo porque una acción sea secundaria.

---

# 42. Badges

Usar para:

- estado;
- clasificación;
- resumen breve;
- contexto.

Características:

```text
10–12 px
compacto
pill o radio alto
```

No sustituir información compleja por una colección excesiva de badges.

---

# 43. Dialogs y overlays

Utilizar las primitivas Radix disponibles.

Deben soportar:

- portal;
- overlay;
- Escape;
- focus trap;
- devolución de foco;
- título accesible;
- descripción cuando corresponda.

No crear un modal manual paralelo si la infraestructura Radix cubre la necesidad.

---

# 44. Toast

Uso:

- operación guardada;
- actualización exitosa;
- confirmación no bloqueante.

No usar toast como único lugar para un error que el usuario debe corregir dentro de un formulario.

---

# 45. Empty State

Debe responder:

```text
¿Qué falta?
¿Por qué no hay información?
¿Qué puede hacer el usuario?
```

No requiere ilustraciones grandes.

Puede utilizar:

- icono;
- título;
- descripción;
- acción primaria cuando aplique.

---

# 46. Error State

Para errores de carga:

- mensaje claro;
- acción de reintento cuando corresponda;
- `requestId` disponible para soporte;
- tono visual semántico.

No mostrar stack traces en producción.

---

# 47. Skeleton Loading

Skeleton es el estado visual principal de **primera carga de datos sin cache**.

Ya existe:

```text
src/components/ui/skeleton.tsx
```

Debe reutilizarse.

---

# 48. Regla de Skeleton

El skeleton debe parecerse aproximadamente a la estructura que reemplazará.

No utilizar bloques aleatorios.

---

# 49. Table Skeleton

Ejemplo conceptual:

```text
████████     ████████     ██████
███████      █████████    █████
████████     ███████      ██████
██████       ████████     █████
```

Debe conservar dimensiones aproximadas de la tabla real para evitar layout shift.

---

# 50. Dashboard Skeleton

Debe representar:

- KPI cards;
- regiones principales;
- tablas/listas resumidas.

No usar un spinner gigante en el centro.

---

# 51. Refetch

Cuando ya existen datos:

```text
NO:
datos → skeleton → datos

SÍ:
datos permanecen
+
indicador discreto de actualización
```

Skeleton corresponde principalmente a carga inicial.

---

# 52. Iconografía

Librería oficial:

```text
lucide-react
```

Referencia:

```text
16 px habitual
15–18 px navegación
stroke 1.5–2
```

Los iconos deben tener significado funcional.

Evitar múltiples librerías de iconos.

---

# 53. Icon-only actions

Todo botón icon-only debe tener:

```text
aria-label
```

y tooltip cuando mejore comprensión.

---

# 54. Responsive breakpoints

Tailwind sigue siendo la autoridad técnica de breakpoints.

Referencias principales:

```text
640 px
768 px
1024 px
1280 px
1536 px
```

No crear breakpoints custom por cada módulo sin necesidad.

---

# 55. Desktop-first operativo

Winter se diseñará principalmente para el contexto operativo de escritorio.

Esto no significa ignorar mobile.

Significa:

```text
desktop
→ máxima productividad y densidad

mobile
→ funcionalidad completa adaptada
```

---

# 56. Accesibilidad

Obligatorio:

- foco visible;
- teclado;
- labels;
- ARIA cuando corresponda;
- contraste;
- `aria-invalid`;
- diálogo semántico;
- nombres accesibles para iconos;
- tablas correctamente estructuradas;
- `prefers-reduced-motion`.

---

# 57. Temas

Winter debe soportar:

```text
Light
Dark
```

Ambos consumen los mismos tokens semánticos.

No deben existir componentes “sólo light” o “sólo dark”.

---

# 58. Preferencia de tema

La persistencia y comportamiento inicial del tema pertenecen a la arquitectura de aplicación.

El Design System sólo establece que:

- ambos temas son obligatorios;
- ambos deben estar completos;
- los componentes no deben asumir uno específico.

No cambiar silenciosamente el tema por defecto únicamente por motivos estéticos.

---

# 59. Branding

La marca Cruce del Zorro puede tener mayor presencia en:

- Login;
- Sidebar;
- PageHeader;
- determinados KPIs;
- Empty States;
- separadores;
- focus;
- acción primaria.

Debe ser más discreta en:

- tablas;
- formularios;
- historiales;
- movimientos;
- trazabilidad.

---

# 60. Imágenes y decoración

Winter no debe depender de fotografías de vino, viñedos o botellas dentro de los flujos operativos.

Las imágenes de marca pueden utilizarse donde tengan propósito:

```text
Login
pantallas institucionales
estado inicial seleccionado
```

No como fondo detrás de tablas o formularios.

---

# 61. CSS

La infraestructura visual actual vive principalmente en:

```text
src/index.css
+
src/components/ui/*
```

No es obligatorio crear una estructura adicional `src/styles` mientras `index.css` siga siendo mantenible.

Puede dividirse posteriormente por necesidad real.

---

# 62. Código visual

Preferir:

```text
tokens semánticos
+
Tailwind
+
variantes de componentes
```

Evitar:

```text
style={{...}}
hex arbitrarios
CSS duplicado por pantalla
```

---

# 63. Referencias históricas

Los siguientes elementos fueron útiles para extraer el lenguaje CDZ:

```text
STYLE_GUIDE.md
cdz-base.css
CdzComponents.jsx
capturas styleCDZ
```

Pero no constituyen dependencias obligatorias del frontend final.

En particular:

> Winter no debe depender de una copia local no versionada de `cdz-base.css` o `CdzComponents.jsx`.

Sus decisiones relevantes se incorporan a este Design System y a los componentes oficiales de `artifacts/sistema-produccion`.

---

# 64. Anti-patrones

No:

- copiar un dashboard template;
- convertir todo en cards;
- cambiar azul por bordó y considerar terminado el diseño;
- usar Playfair en tablas;
- utilizar oro en grandes superficies;
- crear estilos distintos por módulo;
- inventar colores;
- llenar Dashboard con gráficos sin utilidad;
- usar sombras grandes;
- utilizar componentes duplicados;
- sacrificar densidad por decoración;
- renderizar una tabla vacía durante loading;
- utilizar un spinner central para toda carga remota.

---

# 65. Criterio de aceptación visual

Una pantalla cumple el Design System cuando:

- utiliza componentes compartidos;
- usa tokens semánticos;
- funciona en Light y Dark;
- mantiene estructura empresarial;
- conserva identidad CDZ;
- prioriza legibilidad;
- tiene estados completos;
- maneja loading mediante el patrón definido;
- es responsive;
- es accesible;
- mantiene densidad coherente;
- no introduce otro lenguaje visual.

---

# 66. Prioridad ante dudas

Cuando exista conflicto entre estética y operación:

```text
1. Usabilidad
2. Claridad
3. Consistencia
4. Densidad operativa
5. Identidad CDZ
6. Ornamentación
```

La marca debe enriquecer la experiencia.

Nunca perjudicarla.

---

# 67. Resultado esperado

El usuario debe sentir:

> “Estoy utilizando una plataforma empresarial profesional construida específicamente para la operación de Bodega Cruce del Zorro.”

No:

> “Estoy utilizando una plantilla administrativa.”

Y tampoco:

> “Estoy navegando por una página promocional de una bodega.”
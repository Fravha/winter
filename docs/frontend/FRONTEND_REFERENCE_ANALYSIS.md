# Análisis de referencias visuales — Winter Frontend

**Versión:** 0.2  
**Fecha:** 2026-09-21  
**Estado:** referencia visual aprobada  
**Frontend oficial:** `artifacts/sistema-produccion`

---

# 1. Propósito

Este documento registra las referencias visuales utilizadas para definir la identidad del frontend de Winter.

Su función es explicar:

- qué referencias fueron analizadas;
- qué elementos se adoptaron;
- qué elementos se descartaron;
- cómo se fusionaron las referencias;
- qué intención visual debe conservar Winter.

Este documento **no define directamente estilos, tokens o componentes**.

Las decisiones visuales implementables pertenecen principalmente a:

```text
FRONTEND_DESIGN_SYSTEM.md
FRONTEND_COMPONENTS.md
FRONTEND_SCREEN_PATTERNS.md
```

---

# 2. Rol de este documento

`FRONTEND_REFERENCE_ANALYSIS.md` responde:

> ¿De dónde viene la dirección visual de Winter?

`FRONTEND_DESIGN_SYSTEM.md` responde:

> ¿Cómo se implementa esa dirección?

Por tanto, cuando exista una diferencia entre una referencia histórica y el Design System vigente:

```text
FRONTEND_DESIGN_SYSTEM.md
>
referencia visual histórica
```

---

# 3. Fuentes analizadas

La dirección visual de Winter se construyó principalmente a partir de:

1. capturas de la carpeta `muestra`;
2. capturas de la carpeta `styleCDZ`;
3. `STYLE_GUIDE.md`;
4. `cdz-base.css`;
5. `CdzComponents.jsx`;
6. frontend actual de `artifacts/sistema-produccion`;
7. documentación funcional y arquitectónica de Winter.

También se consideró:

```text
FRONTEND_CURRENT_STATE.md
```

para comprender la base técnica disponible.

---

# 4. Naturaleza de las referencias

Las capturas y frontend anteriores son:

```text
referencias
```

No son:

```text
contratos funcionales
```

Por tanto, no deben utilizarse para inferir:

- endpoints;
- estados;
- permisos;
- comandos;
- campos;
- reglas de negocio;
- workflows;
- relaciones de dominio.

La apariencia de una captura nunca sustituye un contrato backend.

---

# 5. Objetivo de la fusión

Winter debe percibirse como:

> **Una plataforma empresarial de operación y trazabilidad de bodega, construida específicamente para Cruce del Zorro.**

La intención visual combina dos fuentes principales:

```text
ESTRUCTURA Y PRODUCTIVIDAD
Sistema empresarial
          +
IDENTIDAD Y ACABADO
Cruce del Zorro
          ↓
       WINTER
```

---

# 6. Principio central

La referencia empresarial define principalmente:

```text
cómo se organiza el trabajo
```

Cruce del Zorro define principalmente:

```text
cómo se presenta ese trabajo
```

La fusión no consiste en copiar dos interfaces y mezclarlas.

Consiste en asignar a cada referencia una responsabilidad diferente.

---

# 7. Referencia empresarial — `muestra`

La referencia empresarial presenta una interfaz administrativa orientada a operación.

Características observadas:

- Sidebar;
- barra superior;
- navegación agrupada;
- áreas amplias de trabajo;
- formularios densos;
- tablas como elemento central;
- filtros;
- paneles;
- dashboards;
- indicadores;
- acciones jerarquizadas;
- alta cantidad de información visible.

---

# 8. Principal aporte empresarial

El valor principal de esta referencia es:

```text
estructura
+
densidad
+
productividad
```

Winter adopta especialmente:

- navegación estable;
- jerarquía clara de módulos;
- tablas para información comparable;
- formularios eficientes;
- distribución en columnas;
- filtros visibles;
- acciones claramente diferenciadas;
- uso eficiente del ancho disponible;
- dashboards operativos.

---

# 9. Tablas

Una de las decisiones más importantes heredadas de la referencia empresarial es:

> **La tabla es el patrón principal para conjuntos de datos comparables.**

Winter no debe transformar automáticamente todos los registros en cards.

Especialmente en:

- Artículos;
- Compras;
- Inventario;
- Movimientos;
- Usuarios;
- Roles;
- trazabilidad tabular.

---

# 10. Formularios

La referencia empresarial demuestra que un sistema operativo puede utilizar densidad sin perder claridad.

Winter adopta:

```text
1 columna
2 columnas
hasta 3 columnas
```

según longitud y relación de los campos.

No se copiará el layout exacto de ninguna captura.

---

# 11. Uso del espacio

Winter debe utilizar adecuadamente pantallas de escritorio.

No debe limitar todo el sistema a:

```text
una columna central estrecha
```

Tablas, formularios y operaciones complejas pueden aprovechar gran parte del viewport.

---

# 12. Elementos empresariales descartados

No se adoptan literalmente:

- identidad azul como color principal;
- apariencia genérica de intranet;
- controles excesivamente utilitarios;
- bordes visualmente pesados;
- tipografía completamente neutra;
- ausencia de identidad de marca.

---

# 13. Azul empresarial

El azul observado en la referencia no se convierte en color principal.

Puede utilizarse únicamente como:

```text
color semántico de información
```

cuando corresponda.

El color principal de Winter continúa siendo el bordó definido por el Design System.

---

# 14. Referencia Cruce del Zorro — `styleCDZ`

La referencia CDZ aporta la personalidad visual de la plataforma.

Características observadas:

- bordó/vino;
- dorado envejecido;
- carbón;
- marfil;
- serif editorial;
- sans serif funcional;
- bordes finos;
- sombras suaves;
- superficies discretas;
- iconografía lineal;
- Sidebar con mayor carácter de marca;
- modo claro y oscuro;
- microdetalles premium.

---

# 15. Principal aporte CDZ

El valor principal de esta referencia es:

```text
identidad
+
jerarquía
+
acabado premium
```

Winter debe sentirse propio de Cruce del Zorro sin convertirse en una experiencia promocional.

---

# 16. Paleta adoptada

La dirección general utiliza:

```text
bordó
dorado envejecido
carbón
marfil
neutros cálidos
```

más colores semánticos para:

```text
información
éxito
advertencia
error
```

Los valores concretos pertenecen a:

```text
FRONTEND_DESIGN_SYSTEM.md
```

---

# 17. Bordó

El bordó se adopta principalmente como:

- acción primaria;
- identidad;
- selección;
- detalle destacado.

No debe colorear toda la interfaz.

---

# 18. Dorado

El dorado se adopta como acento.

Especialmente:

- focus;
- navegación activa;
- detalles;
- determinados indicadores;
- pequeños elementos de marca.

No como:

- fondo dominante;
- texto largo;
- color general de botones.

---

# 19. Tipografía

La combinación conceptual adoptada es:

```text
Inter
→ operación

Playfair Display / serif equivalente
→ identidad y jerarquía editorial
```

Inter domina la aplicación.

La serif se utiliza de manera controlada.

---

# 20. Dónde utilizar serif

Puede aparecer en:

- Login;
- títulos seleccionados;
- encabezados de alto nivel;
- algunos KPIs;
- elementos de identidad.

No utilizar en:

- tablas;
- inputs;
- labels;
- filtros;
- botones;
- texto operativo denso.

---

# 21. Iconografía

La referencia CDZ confirma el uso de iconografía:

```text
lineal
simple
monocroma
funcional
```

La librería oficial actual es:

```text
lucide-react
```

No introducir iconos decorativos sin función.

---

# 22. Cards

CDZ aporta un acabado premium de Card.

Winter conserva:

- bordes suaves;
- radio controlado;
- superficies diferenciadas;
- sombra mínima;
- contraste sutil.

Pero:

> Una Card sólo debe existir cuando representa una agrupación real.

No utilizar Card para reemplazar indiscriminadamente tablas o estructura.

---

# 23. Dark Mode

La referencia CDZ demuestra que la identidad funciona correctamente en Dark.

Por ello Winter debe soportar:

```text
Light
Dark
```

como variantes completas del mismo Design System.

---

# 24. Tema inicial

Este documento no determina cuál tema debe ser el predeterminado.

La política de:

```text
tema inicial
preferencia del usuario
persistencia
```

pertenece a la arquitectura de aplicación.

No asumir Dark como predeterminado únicamente porque una referencia histórica lo utilizaba.

---

# 25. Fusión resultante

| Área | Referencia empresarial | Referencia CDZ | Winter |
|---|---|---|---|
| Shell | estructura | identidad | shell empresarial CDZ |
| Sidebar | navegación | marca/acento | navegación compacta de marca |
| Topbar | contexto | acabado | sobria y funcional |
| Dashboard | KPIs/tablas | jerarquía | dashboard operativo |
| Formularios | densidad | foco/acabado | formularios empresariales premium |
| Tablas | comparación | tokens/bordes | componente central |
| Cards | agrupación | acabado | uso selectivo |
| Botón primario | jerarquía | bordó | bordó |
| Acción secundaria | neutra | superficie | discreta |
| Información | azul | — | azul semántico |
| Éxito | verde | tratamiento | verde semántico |
| Advertencia | ámbar | tratamiento | ámbar semántico |
| Error | rojo | destructive | rojo semántico |
| Tipografía | sans | serif + sans | Inter dominante |
| Espaciado | compacto | ritmo visual | escala única |
| Responsive | funcionalidad | shell adaptativo | desktop-first operativo y responsive |

---

# 26. Arquitectura visual resultante

Winter se organiza conceptualmente como:

```text
AppShell
│
├── Sidebar
├── Topbar
│
└── MainContent
    ├── PageHeader
    ├── filtros / acciones
    └── contenido operativo
```

La identidad CDZ se aplica sobre esta estructura.

No al revés.

---

# 27. Jerarquía de prioridad

La interfaz debe priorizar:

```text
1. Usabilidad
2. Claridad
3. Consistencia
4. Densidad operativa
5. Identidad CDZ
6. Ornamentación
```

La estética nunca debe perjudicar la operación.

---

# 28. Densidad

La densidad objetivo es:

```text
media / compacta
```

Adecuada para un sistema empresarial utilizado principalmente en escritorio.

Las medidas concretas pertenecen al Design System.

---

# 29. Desktop-first operativo

Winter se utiliza principalmente como herramienta administrativa y productiva.

Por tanto:

```text
desktop
→ máxima productividad

mobile
→ experiencia completamente funcional y adaptada
```

Esto no significa desktop-only.

---

# 30. Responsive

Las referencias deben adaptarse, no copiarse.

En móvil:

- Sidebar pasa a navegación off-canvas;
- formularios pasan normalmente a una columna;
- filtros pueden utilizar Sheet;
- tablas pueden utilizar scroll horizontal;
- acciones conservan targets táctiles apropiados.

No eliminar información crítica simplemente para hacerla entrar.

---

# 31. Identidad visible con mayor intensidad

CDZ puede expresarse con mayor fuerza en:

- Login;
- Sidebar;
- branding;
- PageHeader;
- Inicio;
- determinados KPIs;
- botones primarios;
- foco;
- empty states;
- pequeños detalles.

---

# 32. Identidad visible con menor intensidad

Debe ser más discreta en:

- tablas;
- movimientos;
- historiales;
- trazabilidad;
- formularios extensos;
- permisos;
- operaciones críticas.

Estas áreas priorizan productividad.

---

# 33. Login

Login es uno de los lugares donde Winter puede tener mayor expresión de marca.

Puede utilizar:

- serif;
- bordó;
- dorado;
- branding CDZ;
- superficies premium.

Sin sacrificar claridad o accesibilidad.

---

# 34. Sidebar

Sidebar puede tener más personalidad que el área central de trabajo.

Esto permite que el usuario perciba Cruce del Zorro permanentemente sin colorear excesivamente las pantallas operativas.

---

# 35. Dashboard

Inicio puede incorporar mayor jerarquía visual.

Pero sus datos deben ser reales.

No utilizar:

- números ficticios;
- charts decorativos;
- métricas sin endpoint;
- estadísticas calculadas de manera ineficiente.

---

# 36. Producción

Las pantallas de Producción deben sentirse especialmente operativas.

La estética debe ayudar a comprender:

- contexto;
- lotes;
- recipientes;
- trabajos;
- transformaciones;
- mediciones;
- trazabilidad.

No convertir Producción en un dashboard decorativo.

---

# 37. Inventario

Inventario debe priorizar:

```text
cantidad
ubicación
lote
movimiento
trazabilidad
```

El acabado premium debe permanecer en segundo plano frente a la claridad de los datos.

---

# 38. Administración

Usuarios, Roles y Permisos deben tener una estética más utilitaria.

No requieren la misma expresividad visual de Login o Inicio.

Esto forma parte deliberada de la jerarquía del producto.

---

# 39. Lenguaje visible

Winter se desarrolla inicialmente para:

```text
Bolivia
```

Idioma visible:

```text
Español
```

Localización:

```text
es-BO
```

Las referencias en inglés, si existieran, no justifican introducir texto visible en inglés en la aplicación.

---

# 40. Terminología

La interfaz debe utilizar vocabulario real de la operación.

Ejemplos:

```text
Artículos
Compras
Inventario
Producción
Almacenes
Lotes
Movimientos
Órdenes de producción
Trabajos de producción
Transformaciones
Mediciones
Recipientes
Mermas
Usuarios
Roles
Permisos
```

La terminología funcional prevalece sobre traducciones literales de referencias externas.

---

# 41. Referencias históricas CDZ

Los archivos:

```text
STYLE_GUIDE.md
cdz-base.css
CdzComponents.jsx
```

fueron útiles para extraer:

- paleta;
- tipografía;
- componentes;
- jerarquía;
- comportamiento visual.

No constituyen la implementación oficial actual.

---

# 42. No dependencia de referencias históricas

Winter no debe requerir:

```text
cdz-base.css
```

ni:

```text
CdzComponents.jsx
```

como dependencias paralelas obligatorias.

Las decisiones útiles ya deben materializarse mediante:

```text
src/index.css
src/components/ui
src/components/shared
FRONTEND_DESIGN_SYSTEM.md
```

---

# 43. Frontend empresarial anterior

La referencia empresarial tampoco constituye código a migrar literalmente.

Debe utilizarse principalmente para observar:

- estructura;
- densidad;
- jerarquía;
- flujo de trabajo.

No para copiar su implementación técnica.

---

# 44. Capturas

Las capturas sirven para contestar:

```text
¿Cómo debería sentirse?
```

No:

```text
¿Qué endpoint existe?
¿Qué permiso usa?
¿Qué estado tiene?
¿Qué campos guarda?
```

---

# 45. Anti-patrón — recolorear

No:

```text
copiar sistema empresarial
+
cambiar azul por bordó
=
Winter
```

La fusión debe incluir también:

- tipografía;
- jerarquía;
- superficies;
- navegación;
- interacción;
- densidad;
- componentes.

---

# 46. Anti-patrón — landing page

No convertir Winter en:

- fotografías grandes;
- bloques promocionales;
- títulos gigantes;
- exceso de serif;
- animaciones decorativas;
- espacios vacíos propios de marketing.

Winter es una herramienta de trabajo.

---

# 47. Anti-patrón — interfaz genérica de IA

Evitar:

- gradientes arbitrarios;
- glow innecesario;
- cards flotando por todas partes;
- iconos decorativos sin contexto;
- sombras exageradas;
- colores no pertenecientes al sistema;
- exceso de radios;
- dashboards genéricos;
- diseño distinto por módulo.

La interfaz debe sentirse intencional y propia de CDZ.

---

# 48. Anti-patrón — exceso de marca

No:

```text
bordó en todo
oro en todo
Playfair en todo
```

La identidad funciona precisamente porque existe contraste entre:

```text
base empresarial neutra
+
acentos CDZ
```

---

# 49. Anti-patrón — sacrificar operación

Nunca sacrificar:

- legibilidad;
- densidad;
- velocidad;
- comparación;
- accesibilidad;

para hacer la interfaz más “bonita”.

---

# 50. Fuente definitiva de diseño

Cuando una IA implemente una pantalla no debe interpretar nuevamente las referencias desde cero.

Debe consultar:

```text
FRONTEND_DESIGN_SYSTEM.md
FRONTEND_COMPONENTS.md
FRONTEND_SCREEN_PATTERNS.md
```

Este documento explica el razonamiento histórico.

No sustituye dichos contratos.

---

# 51. Regla para IA / Replit

Replit no debe recibir una captura y reconstruir la aplicación libremente.

Debe seguir:

```text
referencia
↓
decisiones documentadas
↓
Design System
↓
componentes compartidos
↓
patrones de pantalla
↓
implementación
```

No:

```text
captura
↓
CSS improvisado
```

---

# 52. Validación de una pantalla

Al revisar visualmente una pantalla, preguntar:

```text
¿Se siente empresarial?

¿Es suficientemente compacta para trabajar?

¿La información importante domina sobre la decoración?

¿Se percibe identidad CDZ?

¿El bordó está controlado?

¿El dorado funciona como acento?

¿La serif está limitada?

¿Las tablas siguen siendo legibles?

¿Funciona tanto en Light como en Dark?

¿Todo texto visible está en español?

¿Parece parte del mismo sistema que los otros módulos?
```

---

# 53. Resultado esperado

Winter debe transmitir:

> **“Estoy utilizando una plataforma empresarial seria de producción, inventario y trazabilidad construida específicamente para Bodega Cruce del Zorro.”**

Debe evitar transmitir:

> “Estoy utilizando una intranet genérica.”

También debe evitar:

> “Estoy utilizando una página promocional de vinos.”

Y especialmente:

> “Estoy utilizando una plantilla administrativa generada automáticamente.”

---

# 54. Principio final

> **La estructura empresarial hace que Winter sea eficiente. La identidad Cruce del Zorro hace que Winter sea propio. Ninguna de las dos debe existir a costa de la otra.**
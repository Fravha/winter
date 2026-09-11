## Decisiones aprobadas para el módulo Artículos

Se aprueba continuar con el módulo Artículos considerando las siguientes reglas de dominio.

### 1. Identidad del artículo

El código maestro de Winter será:

`Codigo de Articulo - ODDO`

Este valor corresponde a `Articulo.codigo` y debe ser único.

`Codigo IZI - PT` no será utilizado como identificador único. Se conservará únicamente como código externo/alias cuando exista.

---

### 2. Alcance de Artículos

Winter administrará artículos que tengan impacto en:

- Producción.
- Inventario.
- Trazabilidad.
- Almacenamiento.
- Control operativo de planta.

Winter no pretende inicialmente reemplazar el inventario general administrativo de toda la empresa.

Los activos, equipos y recipientes permanentes de producción no deben modelarse como Articulo cuando correspondan al módulo Activo/Equipo.

---

### 3. Clasificaciones base

Se mantienen inicialmente las siguientes clasificaciones:

- `MATERIA_PRIMA`
- `INSUMO_ENOLOGICO`
- `MATERIAL_ENVASE`
- `MATERIAL_EMPAQUE`
- `PRODUCTO_PROCESO`
- `PRODUCTO_ENVASADO`
- `PRODUCTO_TERMINADO`

Se autoriza analizar la incorporación de:

- `INSUMO_LABORATORIO`
- `INSUMO_LIMPIEZA`

No crear por ahora clasificaciones genéricas como `OTRO_INVENTARIABLE`.

---

### 4. Homologación de exportación

Las categorías de exportación del Excel no constituyen una clasificación distinta de Articulo.

`Producto terminado de Exportación`
→ `PRODUCTO_TERMINADO`

`Material de envase y empaque de Exportacion`
→ debe dividirse entre `MATERIAL_ENVASE` y `MATERIAL_EMPAQUE` según cada artículo.

La condición de exportación se modelará posteriormente mediante lote, presentación, destino comercial u otra relación correspondiente.

---

### 5. Categorías pendientes

No homologar automáticamente:

- Otro inventariable.
- Material de laboratorio.
- Productos agroquímicos.
- Material comercial.
- Insumos de laboratorio.
- Insumos de limpieza.
- Material auxiliar.

Estos registros deberán pasar por una tabla de homologación.

Cada registro podrá terminar como:

- Clasificación Winter aprobada.
- Activo/Equipo.
- Fuera del alcance de Winter.
- Pendiente de validación.

---

### 6. Barricas

Las barricas actualmente clasificadas como materia prima no deben cargarse automáticamente como `MATERIA_PRIMA`.

Deben revisarse contra el maestro `Activo-Equipo`.

Una barrica utilizada como recipiente de producción deberá pertenecer al modelo de activos/recipientes.

---

### 7. Uva procesada

Los registros:

- Uva blanca despalillada y estrujada.
- Uva moscatel despalillada y estrujada.
- Uva tinta despalillada y estrujada.

no deben cargarse automáticamente como materia prima.

La uva recibida corresponde a `MATERIA_PRIMA`.

Después de una transformación como despalillado/estrujado, debe analizarse como `PRODUCTO_PROCESO` y estar asociada al proceso productivo correspondiente.

---

### 8. Unidades

Se aceptan como unidades base iniciales:

- `KG`
- `G`
- `L`
- `UNIDAD`
- `M`

Homologación:

- `kg` → `KG`
- `g` → `G`
- `L` → `L`
- `Units` → `UNIDAD`
- `m` → `M`

No implementar todavía conversiones automáticas para caja, paquete, rollo u otras presentaciones.

---

### 9. Estado

Para Articulo utilizar inicialmente:

`activo: boolean`

Un artículo nuevo se crea activo.

Desactivar un artículo impide su utilización en nuevas operaciones, pero no elimina ni modifica registros históricos.

No implementar eliminación física de artículos que ya tengan referencias.

---

### 10. Duplicados

La unicidad será únicamente por `codigo`.

`nombre` no será único.

Los posibles duplicados detectados en Odoo no deben fusionarse automáticamente.

Podrán marcarse durante la homologación como:

- Duplicado probable.
- Distinta presentación.
- Distinto uso.
- Distinta unidad.
- Registro histórico.
- Registro válido independiente.

---

## Siguiente paso

Antes de realizar la carga masiva, crear una tabla/documento de homologación de los 492 registros.

El módulo Articulos puede continuar desarrollándose con estas reglas, pero la importación inicial de datos debe esperar hasta que la homologación quede validada.
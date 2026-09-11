# Decisión de Diseño — Módulo Articulos

## 1. Propósito

`Articulos` será el maestro único y transversal de elementos utilizados por los módulos de Winter.

Los módulos `Inventory`, `Compras` y `Production` deberán referenciar artículos mediante la API pública de este módulo y no mantener catálogos duplicados.

---

## 2. Entidad Articulo

El modelo mínimo será:

- `id`
- `codigo`
- `nombre`
- `clasificacion`
- `unidadMedida`
- `activo`
- campos técnicos de auditoría/fechas establecidos por la arquitectura existente.

No se implementará un campo `estado`.

La disponibilidad operativa del artículo se representa únicamente mediante:

`activo: boolean`

### Reglas

- Un artículo nuevo se crea con `activo = true`.
- Un artículo inactivo no puede utilizarse en nuevas operaciones.
- Un artículo inactivo conserva todo su historial.
- No se implementará eliminación física de artículos utilizados por el sistema.

---

## 3. Clasificaciones

La clasificación será inicialmente un conjunto cerrado:

- `MATERIA_PRIMA`
- `INSUMO_ENOLOGICO`
- `MATERIAL_ENVASE`
- `MATERIAL_EMPAQUE`
- `PRODUCTO_PROCESO`
- `PRODUCTO_ENVASADO`
- `PRODUCTO_TERMINADO`

La condición `PRODUCTO_TERMINADO_EXPORTACION` no pertenece al maestro Articulos. Corresponde a la clasificación de `InventoryLot`.

---

## 4. Unidad de medida

Inicialmente se utilizará un catálogo cerrado:

- `KG`
- `G`
- `L`
- `ML`
- `UNIDAD`

No se implementarán conversiones automáticas de unidades durante esta etapa.

Cada artículo tendrá una unidad base.

---

## 5. Código del artículo

El código:

- Es obligatorio.
- Debe ser único.
- Debe normalizar espacios al inicio y final.
- Su validación de unicidad debe ser case-insensitive.
- No podrá modificarse después de crear el artículo.

No se establece todavía una estructura obligatoria de nomenclatura.

---

## 6. Modificación

Podrán modificarse inicialmente:

- `nombre`
- `clasificacion`
- `unidadMedida`

Una vez que el artículo tenga referencias operativas en Winter:

- `clasificacion` no podrá modificarse.
- `unidadMedida` no podrá modificarse.

El nombre podrá continuar siendo editable.

---

## 7. Activación y desactivación

Se implementarán operaciones explícitas:

- `activateArticulo`
- `deactivateArticulo`

No se utilizará un update genérico de `activo`.

Desactivar un artículo impide su uso en nuevas operaciones pero no afecta registros históricos.

---

## 8. Contrato administrativo

El módulo deberá soportar:

- `createArticulo`
- `updateArticulo`
- `activateArticulo`
- `deactivateArticulo`
- `getArticulo`
- `listArticulos`

Los endpoints HTTP correspondientes deberán respetar RBAC, auditoría y las convenciones de Logger.

---

## 9. API pública intermodular

La API pública de Articulos deberá exponer como mínimo:

- `getArticulo`
- `listArticulos`
- `validateArticulo`

Los demás módulos no accederán directamente al repository o tablas de Articulos.

---

## 10. validateArticulo

`validateArticulo` validará como mínimo:

1. Que el artículo exista.
2. Que esté activo.

Podrá recibir opcionalmente una lista de clasificaciones permitidas.

Ejemplo conceptual:

`validateArticulo(articleId, allowedClassifications?)`

Si se proporcionan clasificaciones permitidas, validará que el artículo pertenezca a una de ellas.

Articulos no contendrá una matriz global de compatibilidad entre módulos.

Cada módulo consumidor será responsable de declarar las clasificaciones que admite para cada operación.

---

## 11. Listado y paginación

`listArticulos` soportará inicialmente:

- `page`
- `pageSize`
- `search`
- `clasificacion`
- `activo`

Reglas:

- `page` inicia en `1`.
- `pageSize` por defecto será `20`.
- `pageSize` máximo será `100`.
- Orden predeterminado: `codigo ASC`.

La respuesta deberá utilizar el envelope estándar del proyecto e incluir metadata de paginación.

---

## 12. Restricciones

No implementar:

- Entidad independiente de estados.
- Eliminación física de artículos con historial.
- Conversiones de unidades.
- Clasificaciones dinámicas administrables.
- Matrices de compatibilidad global.
- Nomenclatura automática de códigos.
- Reglas no especificadas en esta decisión.

Las decisiones puramente técnicas necesarias para Prisma, índices, constraints o implementación física quedan permitidas siempre que no alteren este contrato funcional.
# DECISION — Clasificaciones reales de Artículos CDZ

Fecha: 2026-09-26
Proyecto: Winter / Sistema de Producción CDZ
Estado: APROBADA PARA IMPLEMENTACIÓN

## 1. Contexto

La fuente maestra `listaMaestros_v1.1` contiene 492 artículos reales de Bodega Cruce del Zorro y utiliza 14 clasificaciones operativas distintas.

La implementación actual de Winter modela `Articulo.clasificacion` mediante el enum cerrado `ArticuloClassification` en PostgreSQL/Prisma y replica los valores válidos en backend y frontend.

Como el sistema ya está desplegado, el cambio debe realizarse mediante una migración aditiva y no destructiva.

## 2. Decisión de negocio

Las siguientes 14 clasificaciones pasan a ser las clasificaciones oficiales visibles para altas y edición de Artículos en CDZ:

| Etiqueta CDZ | Código técnico |
|---|---|
| Materia prima | `MATERIA_PRIMA` |
| Insumo enológico | `INSUMO_ENOLOGICO` |
| Material de envase y empaque | `MATERIAL_ENVASE_EMPAQUE` |
| Material de envase y empaque de Exportacion | `MATERIAL_ENVASE_EMPAQUE_EXPORTACION` |
| Material de laboratorio | `MATERIAL_LABORATORIO` |
| Insumos de laboratorio | `INSUMO_LABORATORIO` |
| Productos agroquímicos | `PRODUCTO_AGROQUIMICO` |
| Material comercial | `MATERIAL_COMERCIAL` |
| Otro inventariable | `OTRO_INVENTARIABLE` |
| Producto en proceso | `PRODUCTO_PROCESO` |
| Producto terminado | `PRODUCTO_TERMINADO` |
| Producto terminado de Exportación | `PRODUCTO_TERMINADO_EXPORTACION` |
| Material auxiliar | `MATERIAL_AUXILIAR` |
| Insumos de limpieza | `INSUMO_LIMPIEZA` |

Las etiquetas anteriores conservan la terminología de la fuente maestra. No corregir silenciosamente nombres de clasificación durante la migración.

## 3. Compatibilidad con la implementación actual

Actualmente existen además estos valores técnicos de `ArticuloClassification`:

- `MATERIAL_ENVASE`
- `MATERIAL_EMPAQUE`
- `PRODUCTO_ENVASADO`

Para evitar una migración destructiva en el sistema en vivo:

1. no se eliminan ni renombran en esta etapa;
2. se consideran valores legacy técnicos;
3. no deben mostrarse como opciones para nuevas altas o edición en el frontend;
4. no deben utilizarse en la carga de los 492 artículos reales;
5. una limpieza futura requerirá una decisión y migración independiente.

## 4. Regla importante: Artículo vs InventoryLot

No modificar `InventoryLotClassification`.

Las clasificaciones de lote de Inventory continúan siendo:

- `PRODUCTO_ENVASADO`
- `PRODUCTO_TERMINADO`
- `PRODUCTO_TERMINADO_EXPORTACION`

`ArticuloClassification.PRODUCTO_TERMINADO_EXPORTACION` y `InventoryLotClassification.PRODUCTO_TERMINADO_EXPORTACION` pueden compartir el mismo literal, pero representan conceptos diferentes:

- Artículo: categoría maestra del artículo.
- InventoryLot: situación/clasificación operativa del lote físico.

## 5. Cambios requeridos

### Base de datos / Prisma

Ampliar `ArticuloClassification` mediante una migración PostgreSQL aditiva con los nuevos valores faltantes. No modificar migraciones históricas ya ejecutadas.

Agregar al enum Prisma:

```text
MATERIAL_ENVASE_EMPAQUE
MATERIAL_ENVASE_EMPAQUE_EXPORTACION
MATERIAL_LABORATORIO
INSUMO_LABORATORIO
PRODUCTO_AGROQUIMICO
MATERIAL_COMERCIAL
OTRO_INVENTARIABLE
PRODUCTO_TERMINADO_EXPORTACION
MATERIAL_AUXILIAR
INSUMO_LIMPIEZA
```

### Backend

Actualizar `articuloClassifications` y toda validación/documentación que enumere explícitamente las clasificaciones de Artículo.

No eliminar todavía los tres valores legacy del contrato técnico para no introducir un cambio destructivo.

### Frontend

La lista visible `CLASIFICACION_OPTIONS` debe contener exclusivamente las 14 clasificaciones oficiales CDZ definidas en esta decisión.

Los tres valores legacy no deben aparecer como opciones seleccionables para nuevas altas o edición.

### Tests

Agregar cobertura para:

- creación de Artículo con cada nueva clasificación;
- filtros por nuevas clasificaciones;
- rechazo de valores inexistentes;
- frontend mostrando exactamente las 14 opciones oficiales;
- ausencia de regresiones en Artículos, Inventory y Production.

## 6. Migración de datos

La fuente preparada es `articulos_migracion_winter_v1.xlsx`.

Mapeo de unidades:

| Fuente | Winter |
|---|---|
| Units | `UNIDAD` |
| L | `L` |
| kg | `KG` |
| g | `G` |
| m | `M` |

Antes de importar, resolver registros marcados como `REVISAR` y excluir los marcados como `NO_CARGAR`.

## 7. Definition of Done

- migración aplicada correctamente en entorno de desarrollo/staging;
- Prisma Client regenerado;
- backend compila;
- tests de Artículos pasan;
- frontend muestra las 14 opciones oficiales;
- creación y edición funcionan con nuevas clasificaciones;
- `InventoryLotClassification` permanece sin cambios;
- carga de artículos reales todavía no ejecutada hasta aprobar el archivo de migración.
# Contrato API — Artículos

## Alcance

Artículos administra bienes con impacto en producción, inventario, trazabilidad,
almacenamiento o control operativo de planta. No reemplaza el inventario general
administrativo ni modela activos, equipos o recipientes permanentes.

No existe carga masiva desde Odoo en este módulo. Los datos del archivo de
referencia deben homologarse y depurarse antes de cualquier importación.

## Modelo

```ts
interface Articulo {
  id: string;                  // UUID técnico
  codigo: string;              // identidad maestra, única sin distinguir mayúsculas
  codigoExterno: string | null; // alias opcional, no único
  nombre: string;              // puede repetirse
  clasificacion:
    | "MATERIA_PRIMA"
    | "INSUMO_ENOLOGICO"
    | "MATERIAL_ENVASE"
    | "MATERIAL_EMPAQUE"
    | "PRODUCTO_PROCESO"
    | "PRODUCTO_ENVASADO"
    | "PRODUCTO_TERMINADO";
  unidadMedida: "KG" | "G" | "L" | "M" | "UNIDAD";
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
```

`codigoExterno` conserva referencias como `Codigo IZI - PT`; no participa en la
identidad y puede repetirse. En creación puede omitirse. En actualización se
envía `null` para eliminarlo.

No hay conversiones automáticas de unidades ni clasificaciones adicionales.
La condición de exportación no es una clasificación de Artículo.

La migración que reemplaza `ML` por `M` no convierte valores existentes. Antes
de aplicarla en otro entorno se debe confirmar que no existan artículos con
`unidad_medida = 'ML'`; si existen, su homologación requiere una decisión
explícita.

## Autenticación y errores

Todas las rutas requieren `Authorization: Bearer <Firebase ID Token>` y el
permiso indicado. Las respuestas exitosas usan `{ "data": ... }`; los listados
agregan `meta`. Los errores usan el envelope común:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "requestId": "uuid"
  }
}
```

Errores propios:

| Código | HTTP | Motivo |
|---|---:|---|
| `ARTICULO_NOT_FOUND` | 404 | No existe el UUID solicitado. |
| `ARTICULO_CODE_ALREADY_EXISTS` | 409 | El código ya existe, incluso con otras mayúsculas. |
| `VALIDATION_ERROR` | 400 | Parámetros, query o body inválidos. |

## Endpoints

### Listar artículos

`GET /api/v1/articulos`

Permiso: `articulos:read`

Query opcional:

| Campo | Regla |
|---|---|
| `page` | Entero desde 1; default 1. |
| `pageSize` | Entero entre 1 y 100; default 20. |
| `search` | Texto no vacío; busca por código o nombre. |
| `clasificacion` | Uno de los valores cerrados del modelo. |
| `activo` | `true` o `false`. |

El orden es `codigo` ascendente.

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### Obtener un artículo

`GET /api/v1/articulos/:id`

Permiso: `articulos:read`. `id` debe ser UUID.

### Crear un artículo

`POST /api/v1/articulos`

Permiso: `articulos:create`

```json
{
  "codigo": "ISCDZ - 000001",
  "codigoExterno": "LVD",
  "nombre": "Botella 750 ml",
  "clasificacion": "MATERIAL_ENVASE",
  "unidadMedida": "UNIDAD"
}
```

El artículo se crea activo. `codigoExterno` es opcional. No se aceptan `activo`,
`id` ni fechas en el body.

### Actualizar un artículo

`PATCH /api/v1/articulos/:id`

Permiso: `articulos:update`

Acepta al menos uno de:

```json
{
  "codigoExterno": "ALIAS-EXTERNO",
  "nombre": "Nombre actualizado",
  "clasificacion": "MATERIAL_EMPAQUE",
  "unidadMedida": "M"
}
```

`codigo` es inmutable. `activo` solo cambia mediante los comandos dedicados.
`codigoExterno: null` elimina el alias.

### Activar

`POST /api/v1/articulos/:id/activate`

Permiso: `articulos:activate`

### Desactivar

`POST /api/v1/articulos/:id/deactivate`

Permiso: `articulos:deactivate`

La desactivación es lógica. El artículo y sus referencias históricas se
conservan; un artículo inactivo no es válido para nuevas operaciones.

## API intermodular

Los demás módulos consumen exclusivamente `articulos.api.ts`:

- `getArticulo({ articuloId })`
- `listArticulos(filters)`
- `validateArticulo({ articuloId, allowedClassifications? })`

`validateArticulo` devuelve `valid: false` si el artículo no existe, está
inactivo o no pertenece a una clasificación permitida.
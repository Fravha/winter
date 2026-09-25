# Reports API — Block 7

## Propósito y ownership

Reports genera exportaciones operativas XLSX bajo demanda. No es propietario
de artículos, compras, inventario ni producción, no persiste resultados y no
altera registros de negocio. Obtiene información exclusivamente a través de
las APIs públicas `ArticulosApi`, `InventoryApi`, `CompraApi` y `ProductionApi`; las queries
masivas de lectura permanecen implementadas en sus módulos propietarios.
Reports depende de Articulos, Compras, Inventory y Production.

Todos los endpoints requieren autenticación, usuario local activo y
`reports:export`. Después de desplegar backend deberá ejecutarse
`npm run db:seed` una vez contra producción para provisionar `reports:export`.
El seed no se ejecuta desde Replit contra producción.

Las descargas registran `REPORT_EXPORTED` mediante la auditoría compartida, con
tipo de reporte y filtros (sin contenido del archivo).

## Contrato común

- Respuesta: workbook XLSX binario, nunca base64/JSON.
- `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `Content-Disposition`: `attachment; filename="<nombre>.xlsx"`.
- CORS expone `Content-Disposition` para que clientes web puedan leer el nombre
  sugerido del archivo.
- Los workbooks congelan la primera fila, incluyen autofiltro, encabezados
  humanos y hojas vacías con sus encabezados. Valores decimales se escriben como
  texto para preservar todos sus dígitos, sin cálculos en punto flotante.
- IDs técnicos se incluyen como columnas secundarias.
- `from` y `to`, cuando estén disponibles, aceptan únicamente `YYYY-MM-DD`.
  Son días UTC inclusivos: `from` empieza a las 00:00:00 UTC y `to` termina
  justo antes del siguiente día UTC. Se rechazan fechas inexistentes y `from >
  to`. Las fechas/horas exportadas son celdas de fecha-hora UTC.
- No se admite paginación en las exportaciones y no se truncan resultados. El
  libro admite hasta 25.000 filas de datos en total. Las consultas planas de
  Inventory están limitadas a 25.000 filas; las consultas estructuradas limitan
  cada resultado a 1.000 registros raíz y 25 registros relacionados por raíz.
  Si algún límite se excede, se responde HTTP 413
  (`REPORT_RESULT_TOO_LARGE`) sin generar un archivo parcial.
- Solo se genera una exportación simultánea por proceso. Una segunda solicitud
  concurrente recibe HTTP 429 (`REPORT_EXPORT_BUSY`) y puede reintentarse cuando
  termine la primera.

Errores de validación responden HTTP 400 (`VALIDATION_ERROR`); falta de
autenticación responde 401 y falta de permiso 403. Otros errores usan el
contrato estándar Logger `{ error: { code, message, requestId, details? } }`.

## Endpoints

### `GET /api/v1/reports/stock/export`

Filtros opcionales: `warehouseId` (UUID), `articuloId` (UUID),
`classification` (`PRODUCTO_ENVASADO`, `PRODUCTO_TERMINADO`,
`PRODUCTO_TERMINADO_EXPORTACION`).

Fuente: `InventoryApi.queryReportStock`, la existencia materializada vigente
en InventoryStock. Nombre: `stock_actual_YYYY-MM-DD.xlsx`.

Hoja `Stock actual`: Almacén código, Almacén, Artículo código, Artículo,
Unidad, Lote de inventario, Clasificación, Cantidad actual, Warehouse ID,
Artículo ID, Inventory lot ID, Inventory stock ID.

### `GET /api/v1/reports/inventory-movements/export`

Filtros opcionales: `from`, `to`, `warehouseId` (UUID), `articuloId` (UUID),
`movementType` (`INBOUND`, `OUTBOUND`, `TRANSFER`, `ADJUSTMENT`). Un almacén
seleccionado coincide con almacén origen o destino.

Fuente: `InventoryApi.queryReportMovements`. Nombre:
`movimientos_inventario_<from|todas>_<to|todas>.xlsx`.

Hoja `Movimientos`: Fecha/hora (UTC), Tipo movimiento, Artículo código,
Artículo, Unidad, Cantidad, Almacén origen código/nombre, Almacén destino
código/nombre, Lote, Referencia/origen, Motivo/observaciones, Actor, Actor ID,
Movement ID, Artículo ID, Almacén origen ID, Almacén destino ID, Inventory lot
ID. No hay una relación pública movimiento-idempotency-key; por ello no se
fabrican ni se exportan claves de operación.

### `GET /api/v1/reports/purchases/export`

Filtros opcionales: `from`, `to`, `status` (`REGISTERED`, `RECEIVED`,
`CANCELLED`), `supplier` (búsqueda parcial, insensible a mayúsculas),
`articuloId` (UUID).

Fuente: `CompraApi.queryForReport`. Compra con varios artículos se exporta una
fila por ítem. La fecha es `documentDate`, y usa `createdAt` si no hay fecha
documental. `Fecha recepción del ítem (UTC)` es la fecha del movimiento de
recepción más reciente asociado a ese ítem; es `null` cuando no tiene recepción.
No es una fecha por línea de recepción parcial. Nombre:
`compras_<from|todas>_<to|todas>.xlsx`.

Hoja `Compras`: Fecha, Código/referencia compra, Estado, Proveedor, Artículo
código, Artículo, Marca, Cantidad, Unidad, Precio referencial, Subtotal
referencial, Moneda, Fecha recepción, Purchase ID, Artículo ID. El subtotal
se multiplica con aritmética entera decimal exacta; no modifica stock ni costos.

### `GET /api/v1/reports/production-works/export`

Filtros opcionales: `productionOrderId`, `transformationOrderId`, `from`, `to`,
`workTypeId`, `productionBatchId`, `containerId` (todos los IDs son UUID).

Fuente: `ProductionApi.queryWorksForReport`. Nombre:
`trabajos_produccion_<from|todas>_<to|todas>.xlsx`.

Hojas:

- `Trabajos`: fecha/hora UTC, órdenes, tipo de trabajo, observaciones, actor,
  Work ID y referencias.
- `Batches`: una fila por vínculo trabajo/batch.
- `Recipientes`: una fila por vínculo trabajo/recipiente.
- `Participantes`: una fila por vínculo trabajo/participante/rol.
- `Insumos`: una fila por insumo, cantidad, unidad, lote, estado y referencias
  de movimiento/operación.

Las relaciones N:N no se concatenan ni se colapsan.

### `GET /api/v1/reports/transformations/export`

Filtros opcionales: `productionOrderId`, `transformationOrderId`, `from`, `to`,
`productionBatchId` (IDs UUID).

Fuente: `ProductionApi.queryTransformationsForReport`. Nombre:
`transformaciones_<from|todas>_<to|todas>.xlsx`.

Hojas `Transformaciones`, `Entradas`, `Salidas` y `Pérdidas`. Las hojas
relacionales contienen una fila por entrada, salida o pérdida, con cantidades y
unidades originales; no se suman unidades potencialmente incompatibles.

### `GET /api/v1/reports/traceability/export`

Filtro obligatorio: `productionBatchId` (UUID).

Fuente: `ProductionApi.getBatchTrace`, el motor de trazabilidad existente.
Nombre: `trazabilidad_<código-batch>.xlsx` (caracteres no seguros se
normalizan).

Hojas: `Resumen`, `Genealogía`, `Libro de lotes`, `Recepciones`, `Correcciones`,
`Trabajos`, `Vínculos de trabajo`, `Insumos de trabajo`, `Transformaciones`,
`Entradas tr.`, `Salidas tr.`, `Mediciones`, `Recipientes`, `Ocupaciones`,
`Mov. recipiente`, `Pérdidas`, `Inventario relacionado`, `Advertencias`. La
exportación expone únicamente relaciones y datos ya presentes en la traza;
identificadores de productor/variedad/medición se mantienen como referencias
cuando no hay etiqueta humana en el DTO de trazabilidad.

## Selectores de filtros (JSON)

Los siguientes endpoints auxiliares requieren la misma autenticación, usuario
local activo y permiso `reports:export`; no generan archivos ni auditorías
`REPORT_EXPORTED`:

- `GET /api/v1/reports/options/articles`: artículos activos; elementos
  `{ id, codigo, nombre, clasificacion, unidadMedida }`.
- `GET /api/v1/reports/options/warehouses`: almacenes activos; elementos
  `{ id, codigo, nombre }`.
- `GET /api/v1/reports/options/production-orders`: elementos
  `{ id, code, status }`.
- `GET /api/v1/reports/options/transformation-orders`: elementos
  `{ id, code, status }`.
- `GET /api/v1/reports/options/batches`: elementos
  `{ id, code, productionOrderId, articuloId }`.
- `GET /api/v1/reports/options/work-types`: tipos de trabajo activos; elementos
  `{ id, code, name }`.
- `GET /api/v1/reports/options/containers`: elementos
  `{ id, code, name, status }`.

Todos aceptan `page` (por defecto 1), `pageSize` (por defecto 20, máximo 100) y
`search` opcional (búsqueda parcial insensible a mayúsculas). Responden
`{ data: [...], meta: { page, pageSize, total, totalPages } }`. Los IDs devueltos
son los valores que deben enviarse a los filtros UUID de las exportaciones; los
campos de presentación permiten renderizar etiquetas sin consultas privadas al
repositorio.
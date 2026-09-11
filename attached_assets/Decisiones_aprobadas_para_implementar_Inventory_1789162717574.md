# Decisiones aprobadas — Inventory

Se aprueban las siguientes decisiones como contrato para continuar el desarrollo del módulo Inventory.

## Stock

- `InventoryMovement` es la fuente histórica de verdad.
- `InventoryStock` será un saldo materializado.
- Movimiento y actualización de stock deben realizarse en la misma transacción.
- Está prohibido cualquier saldo negativo.
- No existen reservas de stock en esta versión.
- Cantidades: PostgreSQL `DECIMAL(18,3)`.
- No utilizar tipos floating point para cantidades.

## Unidades

Toda operación debe utilizar exactamente la unidad base definida en Articulo.

No realizar conversiones automáticas.

Unidades permitidas:

- `KG`
- `G`
- `L`
- `M`
- `UNIDAD`

Si la unidad es `UNIDAD`, la cantidad debe ser entera.

Las demás unidades admiten cantidades decimales.

## InventoryLot

Un lote representa identidad y trazabilidad, no ubicación física ni saldo.

Modelo conceptual:

- `id`
- `lotCode`
- `articuloId`
- `originProductionBatchId?`
- `classification`
- `fechaIngreso`
- `observations?`
- `createdAt`
- `updatedAt`

No persistir un campo `status`.

No utilizar `warehouseId` ni `quantity` dentro de InventoryLot como fuente de ubicación o saldo.

La existencia por almacén pertenece a `InventoryStock`.

Un mismo InventoryLot puede tener saldo simultáneamente en varios almacenes.

### lotCode

Cuando existe InventoryLot, `lotCode` es obligatorio.

La unicidad será:

`articuloId + lotCode`

No será global.

Production Output debe generar o proporcionar un lote válido.

No agregar todavía `requiereLote` a Articulo.

Inicialmente:

- Production Output siempre trabaja con lote.
- Producto envasado y producto terminado administrado desde Production debe mantener lote.
- Materia prima, insumos y materiales pueden manejarse sin lote cuando la operación no proporcione uno.

## InventoryStock

Representa la posición actual de inventario.

Conceptualmente:

- `warehouseId`
- `articuloId`
- `inventoryLotId?`
- `quantity`
- `unit`
- timestamps necesarios

Debe existir una única posición lógica para la combinación correspondiente.

InventoryMovement sigue siendo la fuente histórica que permite reconstruir el saldo.

## Warehouse

Modelo inicial:

- `id`
- `codigo`
- `nombre`
- `ubicacion?`
- `encargadoUserId?`
- `activo`
- `observaciones?`
- `createdAt`
- `updatedAt`

Reglas:

- `codigo` obligatorio.
- trim obligatorio.
- único case-insensitive.
- código inmutable.
- nombre obligatorio.
- nuevo almacén nace activo.
- baja lógica.
- no existe DELETE físico.
- no se puede desactivar un almacén que tenga stock distinto de cero.

No implementar todavía:

- `type`
- interno/externo
- temporal/permanente
- capacidad
- reglas restrictivas de contenido

Estas características quedan pendientes hasta que exista necesidad funcional aprobada.

La información de “contenido permitido” del Excel será descriptiva y no debe bloquear movimientos.

No importar los almacenes del Excel.

## InventoryMovement

Los tipos estructurales serán únicamente:

- `INBOUND`
- `OUTBOUND`
- `TRANSFER`
- `ADJUSTMENT`

Conceptos como:

- compra
- consumo de producción
- salida de producción
- merma
- daño
- vencimiento
- análisis
- manual
- otro

deben representarse mediante `source` y/o `reason`, no creando nuevos tipos estructurales innecesarios.

Ejemplos:

`INBOUND + PURCHASE`

`INBOUND + PRODUCTION_OUTPUT`

`OUTBOUND + PRODUCTION_CONSUMPTION`

`OUTBOUND + MERMA`

`OUTBOUND + DAMAGE`

Los movimientos confirmados son inmutables.

No existe UPDATE ni DELETE de movimientos.

Una corrección debe realizarse mediante un movimiento compensatorio o ajuste y conservar referencia al movimiento original cuando corresponda.

## Transferencias

Una transferencia debe ser atómica.

Debe descontar origen e incrementar destino dentro de la misma transacción.

No debe crear un nuevo InventoryLot.

Debe conservar exactamente la misma identidad del lote cuando exista.

No puede transferirse una cantidad superior a la disponible.

## Clasificación de InventoryLot

Clasificaciones:

- `PRODUCTO_ENVASADO`
- `PRODUCTO_TERMINADO`
- `PRODUCTO_TERMINADO_EXPORTACION`

No son estados.

Transiciones permitidas:

`PRODUCTO_ENVASADO → PRODUCTO_TERMINADO`

`PRODUCTO_TERMINADO → PRODUCTO_TERMINADO_EXPORTACION`

No permitir transición directa:

`PRODUCTO_ENVASADO → PRODUCTO_TERMINADO_EXPORTACION`

La transición de clasificación:

- no cambia stock;
- no crea movimiento físico de entrada;
- no crea otro lote;
- conserva la identidad del lote;
- debe quedar auditada.

## Concurrencia

Las operaciones que modifican inventario deben ejecutarse mediante Unit of Work y transacción PostgreSQL.

Utilizar aislamiento `Serializable` o mecanismo equivalente que garantice que dos operaciones concurrentes no puedan consumir el mismo saldo.

Los conflictos de serialización pueden tener reintento controlado.

Nunca realizar una validación de stock fuera de la transacción y actualizarlo posteriormente en otra operación independiente.

## Idempotencia

Todos los commands que modifican inventario deben soportar `idempotencyKey`.

La misma clave no debe provocar dos modificaciones de stock.

Aplicar a:

- `registerInbound`
- `registerOutbound`
- `registerTransfer`
- `registerAdjustment`
- `registerProductionConsumption`
- `registerProductionOutput`
- `transitionInventoryLotClassification`

Para HTTP utilizar `Idempotency-Key`.

Para llamadas intermodulares incluirla en el command correspondiente.

## Permisos

Implementar:

- `inventory:read`
- `inventory:inbound`
- `inventory:outbound`
- `inventory:transfer`
- `inventory:adjust`
- `inventory:lot_classify`
- `inventory:warehouse_create`
- `inventory:warehouse_update`
- `inventory:warehouse_activate`
- `inventory:warehouse_deactivate`

`registerProductionConsumption` y `registerProductionOutput` son operaciones intermodulares utilizadas por Production.

No convertirlas en operaciones manuales genéricas del frontend de Inventory.

El actor autenticado debe conservarse para auditoría.

## API pública

Mantener:

### Queries

- `getWarehouse`
- `listWarehouses`
- `getInventoryLot`
- `getStock`
- `getAvailableQuantity`

### Commands

- `registerInbound`
- `registerOutbound`
- `registerTransfer`
- `registerAdjustment`
- `registerProductionConsumption`
- `registerProductionOutput`
- `transitionInventoryLotClassification`

## Respuestas

Los commands que modifican stock deben devolver como mínimo:

- `movementId`
- `articuloId`
- `inventoryLotId?`
- `quantity`
- `unit`
- `resultingStock`
- `createdAt`

`registerProductionOutput` debe devolver además el lote creado o utilizado.

`registerTransfer` debe devolver los saldos resultantes de origen y destino.

`registerAdjustment` debe devolver el saldo resultante.

`transitionInventoryLotClassification` debe devolver:

- `inventoryLotId`
- `previousClassification`
- `classification`
- `updatedAt`

## Listados

Utilizar la convención ya establecida en Artículos:

- página inicial: 1
- tamaño predeterminado: 20
- mínimo: 1
- máximo: 100

## Datos

No realizar ninguna migración de información proveniente de `listaMaestros_v1.1.xlsx`.

No insertar:

- almacenes
- lotes
- stock
- movimientos
- artículos

El Excel continúa siendo únicamente una fuente de análisis.

---

Con estas decisiones, revisar nuevamente si queda algún bloqueo estrictamente necesario para implementar Inventory.

Si no existen nuevos conflictos con los documentos de arquitectura, continuar con la implementación completa del módulo.

Al finalizar entregar un reporte equivalente al realizado para Artículos indicando:

1. Archivos creados y modificados.
2. Modelo Prisma final.
3. Entidades y enums implementados.
4. Commands y queries.
5. Endpoints HTTP.
6. Permisos.
7. Validaciones.
8. Manejo de concurrencia.
9. Manejo de idempotencia.
10. Auditoría.
11. Pruebas realizadas.
12. Resultado de typecheck y build.
13. Migraciones aplicadas.
14. Confirmación de que no se importaron datos del Excel.
15. Cualquier interpretación adicional realizada.

Crear además:

`docs/inventory-api.md`

como contrato definitivo del módulo para su posterior consumo por otros módulos y por el frontend.

No introducir reglas de dominio adicionales que no estén contenidas en los documentos o en estas decisiones.
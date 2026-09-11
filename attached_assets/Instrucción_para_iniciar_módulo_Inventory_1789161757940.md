# Siguiente módulo: Inventory

El módulo **Artículos** ya se considera completado a nivel backend.

Antes de escribir código del siguiente módulo, quiero continuar con **Inventory**.

## Objetivo de esta etapa

Todavía **NO implementar inmediatamente**.

Primero realiza una revisión completa del dominio y contrato de Inventory utilizando como fuentes obligatorias:

- `ARCHITECTURE.md`
- `AI_IMPLEMENTATION_RULES.md`
- `MODULE_CONTRACT.md`
- `MODULE_MAP.md`
- `DOMAIN_MODEL.md`
- `AGGREGATES_AND_ENTITIES.md`
- `WORKFLOWS.md`
- `API_CONTRACTS.md`
- `articulos-api.md`
- `listaMaestros_v1.1.xlsx`

La implementación debe seguir las reglas existentes de Logger y Winter.

No inventes nuevas entidades, estados, relaciones, tipos de almacén, movimientos ni reglas de stock.

---

# 1. Revisar responsabilidad del módulo

Inventory debe responder principalmente:

> ¿Qué existencia física hay y qué movimiento de inventario ocurrió?

Según los documentos actuales, Inventory es propietario de:

- `Warehouse`
- `InventoryLot`
- `InventoryStock`
- `InventoryMovement`

Inventory es la única fuente de verdad para cambios de stock.

Production y Compras no pueden modificar directamente tablas o repositories de Inventory.

---

# 2. Revisar dependencias

Inventory puede utilizar exclusivamente la API pública de Artículos para validar artículos.

Debe utilizar:

`ArticulosPublicApi`

y nunca acceder directamente a:

- `ArticuloRepository`
- `ArticuloService`
- Prisma de Artículos
- tablas internas de Artículos

Revisar el `DocType` y contrato existente de Artículos antes de definir la dependencia.

---

# 3. Revisar contratos públicos existentes

Analizar especialmente las operaciones definidas en `API_CONTRACTS.md`:

## Queries

- `getWarehouse`
- `listWarehouses`
- `getInventoryLot`
- `getStock`
- `getAvailableQuantity`

## Commands

- `registerInbound`
- `registerOutbound`
- `registerTransfer`
- `registerAdjustment`
- `registerProductionConsumption`
- `registerProductionOutput`
- `transitionInventoryLotClassification`

No agregar nuevas operaciones públicas salvo que los documentos las requieran explícitamente.

---

# 4. Stock

Revisar y confirmar la regla:

`InventoryMovement` debe ser la fuente de verdad histórica del stock.

Determinar, según los documentos, si `InventoryStock`:

- se persiste como saldo materializado;
- se calcula desde movimientos;
- o combina ambas estrategias.

No tomar esta decisión si no está explícitamente respaldada.

También revisar:

- política de stock negativo;
- precisión decimal;
- unidad de medida;
- validación contra la unidad base del Artículo;
- concurrencia;
- transacciones;
- auditoría.

Si alguna regla no está definida, reportarla antes de implementar.

---

# 5. InventoryLot

Revisar:

- cuándo se crea;
- cómo se identifica;
- si `lotCode` es obligatorio;
- alcance de unicidad de `lotCode`;
- relación con Artículo;
- relación con Warehouse;
- cantidad;
- unidad;
- clasificación;
- historial.

Según las decisiones actuales, `InventoryLot` no debe tener un estado de ciclo de vida inventado si este no está documentado.

La clasificación:

- `PRODUCTO_ENVASADO`
- `PRODUCTO_TERMINADO`
- `PRODUCTO_TERMINADO_EXPORTACION`

no debe confundirse con estado.

Debe modificarse únicamente mediante la operación de dominio correspondiente.

---

# 6. Warehouse

Revisar el maestro de almacenes de `listaMaestros_v1.1.xlsx`.

Existe una decisión pendiente en el documento respecto a si categorías como:

- temporal / permanente;
- interno / externo;

representan realmente tipos de almacén o solamente características.

No crear enums ni reglas nuevas basándose únicamente en el Excel.

Determinar qué puede implementarse con seguridad según los documentos actuales y qué requiere decisión adicional.

---

# 7. Movimientos

Revisar los tipos de movimiento necesarios según el dominio.

El sistema debe soportar conceptualmente:

- entradas;
- salidas;
- transferencias;
- ajustes;
- consumo de producción;
- ingreso de producto producido.

No asumir que toda salida pertenece a Production.

Los movimientos relacionados con Production deben conservar la referencia necesaria para trazabilidad, pero Inventory no debe depender de repositories internos de Production.

---

# 8. Integridad y transacciones

Revisar especialmente:

- impedir inconsistencias entre movimiento y saldo;
- operaciones atómicas;
- concurrencia;
- auditoría;
- idempotencia si corresponde;
- stock insuficiente;
- transferencias entre almacenes;
- ajustes positivos y negativos.

Una transferencia no debe producir estados intermedios inconsistentes.

---

# 9. No migrar datos todavía

No importar:

- almacenes;
- stock;
- lotes;
- movimientos;
- artículos;

desde `listaMaestros_v1.1.xlsx`.

El Excel debe utilizarse solamente para detectar compatibilidad, inconsistencias y decisiones pendientes.

La carga inicial será realizada posteriormente de forma controlada.

---

# 10. Resultado esperado de esta revisión

Antes de desarrollar Inventory, entregar un reporte indicando:

1. Entidades que ya están completamente definidas.
2. Campos propuestos para cada entidad basados exclusivamente en los documentos.
3. Relaciones.
4. Invariantes.
5. Commands.
6. Queries.
7. Permisos.
8. Auditoría requerida.
9. Dependencias intermodulares.
10. Estados o clasificaciones existentes.
11. Política de eliminación.
12. Reglas de stock.
13. Reglas de lotes.
14. Reglas de almacenes.
15. Conflictos entre documentos.
16. Decisiones faltantes que impedirían implementar correctamente.
17. Qué partes del módulo pueden implementarse sin tomar nuevas decisiones.

## Importante

No escribir código todavía.

Si detectas contradicciones entre documentos, reportarlas.

Si una regla necesaria no está definida, detener esa parte y solicitar decisión en lugar de inventarla.
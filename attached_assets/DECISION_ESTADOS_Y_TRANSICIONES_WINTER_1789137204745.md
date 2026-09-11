# Decisión de Estados y Transiciones --- Winter

## Estado de la decisión

**APROBADO PARA IMPLEMENTACIÓN**

Este documento define la decisión inicial de Winter respecto al manejo
de estados de las principales entidades de Production, Compras e
Inventory.

El objetivo es iniciar con los estados mínimos necesarios para
representar correctamente las reglas actuales del negocio, evitando
agregar estados que puedan derivarse de cantidades, movimientos u otros
registros.

## 1. Principio general

Winter utilizará estados persistidos únicamente cuando representen una
**decisión explícita del negocio que cambie las operaciones permitidas
sobre una entidad**.

No se persistirán estados que puedan derivarse confiablemente de
cantidades disponibles, movimientos, transformaciones o registros
relacionados.

Los estados definidos aquí constituyen el conjunto inicial requerido por
Winter. Si aparece una necesidad real de negocio, podrán incorporarse
nuevos estados mediante una modificación explícita del modelo y sus
transiciones.

**La posibilidad de agregar estados en el futuro no autoriza a la
implementación a inventar estados no documentados.**

## 2. Estados definidos

  -------------------------------------------------------------------------------------------
  Entidad                 Estados           Quién cambia      Condición / regla
  ----------------------- ----------------- ----------------- -------------------------------
  `ProductionOrder`       `OPEN`, `CLOSED`  Usuario           Se crea `OPEN`. Pasa a `CLOSED`
                                            autorizado de     cuando ya no se registrarán
                                            Producción        nuevas operaciones bajo esa
                                                              orden. Cerrada bloquea nuevos
                                                              trabajos y transformaciones.

  `TransformationOrder`   `OPEN`, `CLOSED`  Usuario           Se crea `OPEN`. Se cierra
                                            autorizado de     cuando termina el período o
                                            Producción        transformación administrativa
                                                              que representa y ya no deben
                                                              agregarse registros.

  `ProductionBatch`       Sin estado        ---               Su situación se deriva de su
                          persistido                          cantidad disponible y de sus
                                                              transformaciones/movimientos.
                                                              Un batch con cantidad `0` sigue
                                                              existiendo históricamente.

  `Purchase`              `REGISTERED`,     Usuario           Se registra como `REGISTERED`.
                          `RECEIVED`,       autorizado de     Pasa a `RECEIVED` únicamente si
                          `CANCELLED`       Compras           el ingreso a Inventory termina
                                                              correctamente. Puede cancelarse
                                                              antes de ser recibido.

  `Transformation`        Sin estado        ---               Representa un hecho real ya
                          persistido                          ejecutado. Se registra
                                                              atómicamente con inputs,
                                                              outputs, pérdidas y nuevos
                                                              batches. No necesita
                                                              `PENDING`/`COMPLETED`.

  `InventoryLot`          Sin estado        ---               Su existencia/cantidad se
                          persistido                          deriva de `InventoryMovement`.
                                                              Tiene una clasificación de
                                                              inventario, no un estado de
                                                              lifecycle.
  -------------------------------------------------------------------------------------------

## 3. ProductionOrder

Estados iniciales:

``` text
OPEN
CLOSED
```

Se crea en `OPEN`. Puede registrar operaciones productivas mientras
permanezca abierta. Al pasar a `CLOSED`, no permite nuevos trabajos o
transformaciones. El cierre no elimina ni modifica su historial.

## 4. TransformationOrder

Estados iniciales:

``` text
OPEN
CLOSED
```

Se crea en `OPEN`. Pasa a `CLOSED` cuando finaliza el período o contexto
administrativo que representa y ya no deben agregarse nuevos registros
operativos.

## 5. ProductionBatch

`ProductionBatch` no tendrá un estado persistido.

Su situación se obtiene de su cantidad disponible y de su historial de
transformaciones. Un batch cuya cantidad disponible llegue a `0`
continúa existiendo porque forma parte de la trazabilidad.

No se crearán estados redundantes como `ACTIVE`, `PARTIAL`, `CONSUMED` o
`CLOSED` cuando esa información pueda derivarse de los datos.

## 6. Purchase

Estados iniciales:

``` text
REGISTERED
RECEIVED
CANCELLED
```

Transiciones iniciales:

``` text
              ┌──→ CANCELLED
              │
REGISTERED ────┤
              │
              └──→ RECEIVED
```

`REGISTERED` indica que la compra está registrada pero todavía no
produjo un ingreso definitivo a Inventory.

`RECEIVED` se asigna únicamente cuando la recepción y el ingreso
correspondiente a Inventory terminan correctamente. Si falla una parte
crítica, debe ejecutarse rollback y la compra no debe quedar recibida.

`CANCELLED` puede utilizarse antes de que la compra sea recibida.

No se define inicialmente `RECEIVED → CANCELLED`. Una eventual reversión
de una compra recibida deberá definirse como un proceso de negocio
específico antes de implementarse.

## 7. Transformation

`Transformation` no tendrá estado persistido.

Representa un hecho productivo ya ejecutado y debe registrarse
atómicamente junto con sus inputs, outputs, nuevos `ProductionBatch`,
cambios de cantidades, pérdidas cuando correspondan y auditoría.

Si falla cualquier parte crítica, toda la operación debe realizar
rollback.

Por ello no se requieren inicialmente estados `PENDING`, `IN_PROGRESS` o
`COMPLETED`.

## 8. InventoryLot

`InventoryLot` no tendrá estado persistido de lifecycle.

La cantidad disponible se deriva de `InventoryMovement`, que constituye
la fuente de verdad de Inventory. No se almacenarán estados como
`ACTIVE`, `EMPTY` o `CLOSED` si pueden determinarse desde los
movimientos.

### Clasificación

La clasificación es diferente de un estado:

``` text
PRODUCTO_ENVASADO
        ↓
PRODUCTO_TERMINADO
        ↓
PRODUCTO_TERMINADO_EXPORTACION
```

Solo puede modificarse mediante:

``` text
transitionInventoryLotClassification()
```

No mediante edición directa del lote.

## 9. Evolución futura de estados

Winter debe poder evolucionar cuando aparezcan nuevas reglas reales del
negocio. Sin embargo, **no se define inicialmente una entidad genérica
de estados ni un catálogo dinámico de estados**.

Un estado no es solamente un nombre configurable: normalmente implica
transiciones permitidas, permisos, validaciones, efectos sobre otros
módulos y auditoría.

Por tanto, cualquier nuevo estado deberá incorporarse como una
**decisión explícita de dominio**, actualizando sus reglas y
transiciones.

## 10. Regla para implementación asistida por IA

La herramienta de desarrollo:

1.  No debe inventar estados adicionales.
2.  No debe inventar transiciones.
3.  No debe convertir estados derivados en columnas persistidas sin
    decisión explícita.
4.  No debe crear una entidad genérica `Status` para permitir estados
    dinámicos.
5.  Debe implementar únicamente los estados y transiciones documentados.
6.  Si una operación requiere un estado o transición no contemplado,
    debe reportarlo antes de implementarlo.

## Decisión final

``` text
ProductionOrder
OPEN → CLOSED

TransformationOrder
OPEN → CLOSED

ProductionBatch
SIN ESTADO PERSISTIDO

Purchase
REGISTERED → RECEIVED
REGISTERED → CANCELLED

Transformation
SIN ESTADO PERSISTIDO

InventoryLot
SIN ESTADO PERSISTIDO
+
classification controlada mediante
transitionInventoryLotClassification()
```

Esta definición es suficiente para continuar con la implementación
inicial de Winter sin impedir que el modelo evolucione cuando aparezcan
nuevas necesidades reales del negocio.

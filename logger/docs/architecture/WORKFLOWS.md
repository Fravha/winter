# WORKFLOWS.md

## 1. Propósito

Este documento define los workflows operativos del MVP de Winter para
Bodega Cruce del Zorro, construido sobre la base técnica Logger.

Describe **cómo fluye la operación real** entre módulos y entidades,
incluyendo:

-   planificación de vendimia;
-   recepción de uva;
-   transformación de uva a producto en proceso;
-   trabajos productivos;
-   controles y mediciones;
-   decisiones enológicas;
-   movimientos entre recipientes;
-   transformaciones;
-   mermas;
-   crianza;
-   singani;
-   envasado;
-   ingreso de producto a inventario;
-   compras de insumos e ingreso a inventario.

Este documento complementa:

``` text
ARCHITECTURE.md
AI_IMPLEMENTATION_RULES.md
MODULE_CONTRACT.md
DOMAIN_MODEL.md
AGGREGATES_AND_ENTITIES.md
MODULE_MAP.md
```

------------------------------------------------------------------------

# 2. Principio fundamental

El sistema no obliga al proceso productivo a seguir una receta rígida.

Los procesos maestros y las rutas sirven como **referencia de lo que
puede ocurrir**. La operación real se registra mediante trabajos,
transformaciones, controles y decisiones.

La regla funcional es:

``` text
Proceso / Ruta
      ↓
indica qué puede ocurrir

Trabajo / Transformación / Control / Decisión
      ↓
registra qué ocurrió realmente
```

La ruta debe seguir al enólogo o maestro destilador, no al contrario.

------------------------------------------------------------------------

# 3. Reglas globales de todos los workflows

## 3.1 Fechas y cantidades

Toda operación física debe registrar como mínimo:

-   fecha/hora efectiva;
-   cantidad;
-   unidad;
-   actor autenticado, obtenido exclusivamente del contexto de autenticación,
    cuando la operación se registra en el sistema;
-   documento causal cuando corresponda.

Cuando un trabajo requiera registrar personas o equipos que participaron
    físicamente, se conservan como `ProductionParticipant`, entidad operativa
    independiente del actor autenticado. Puede relacionarse opcionalmente con
    un `User`, pero no es el actor del sistema.

La unidad depende del contexto:

``` text
Uva recibida       → kg / quintales según captura
Producto líquido   → L
Insumos            → unidad definida por el Articulo
Botellas           → unidades
Cajas              → unidades
```

La conversión entre unidades debe ser explícita y no inferirse
silenciosamente.

## 3.2 Trazabilidad

Todo registro productivo relevante debe poder relacionarse con su
producción y, cuando corresponda, con lotes y transformaciones.

Los traslados conservan la identidad del lote de producción.

Las transformaciones generan resultados nuevos.

No se requiere una genealogía excesivamente detallada de cada litro una
vez que el producto ha sido transformado; sí debe conservarse el vínculo
suficiente para responder de dónde nació y qué transformaciones
atravesó.

## 3.3 Inventario

`Inventory` es el único módulo que confirma cambios de stock.

Production no mantiene saldos independientes de almacén.

``` text
Producción en tanque/barrica
        ↓
Production

Existencia física en almacén
        ↓
Inventory
```

## 3.4 Insumos

El consumo real de un insumo se registra en el trabajo donde realmente
fue utilizado.

La compra no constituye el consumo.

## 3.5 Auditoría

Las operaciones críticas deben quedar auditadas con el mecanismo central
de Logger.

## 3.6 Estado y cierre

Los estados deben representar la situación real y no permitir saltos
arbitrarios.

No se crean trabajos que no ocurrieron.

`ProductionOrder` y `TransformationOrder` solo utilizan `OPEN` y `CLOSED`.
`CLOSED` es irreversible y no existe reapertura. Una `ProductionOrder` no
puede cerrarse con `TransformationOrder` abiertas, trabajos pendientes o
transformaciones incompletas; puede cerrarse aunque queden batches con saldo.
Una `TransformationOrder` no puede cerrarse con trabajos, transformaciones u
operaciones productivas incompletas.

------------------------------------------------------------------------

# 4. Workflow A --- Planificación de Vendimia

## Objetivo

Preparar la campaña antes de que comience físicamente la cosecha.

La vendimia existe como entidad propia y se identifica por año.

Una sola vendimia corresponde a cada año.

## Flujo

``` text
Planificación anual
      ↓
Crear Vendimia
      ↓
Analizar productores
      ↓
Estimar cantidades disponibles
      ↓
Mantener información de negociación/compromiso
      ↓
Esperar recepción física
```

## Importante

La planificación no crea inventario ni lotes de uva.

La cantidad planificada no se considera existencia física.

Cuando llega la uva, comienza el workflow de recepción.

------------------------------------------------------------------------

# 5. Workflow B --- Recepción de Uva

## Objetivo

Registrar el ingreso físico de una cantidad de uva a la bodega.

## Entrada

``` text
Producer (`producerId`)
Una o varias variedades (`varieties[]`, cada una con su cantidad)
Fecha/hora
Peso solicitado
Peso recibido
Grado alcohólico / Brix
Calidad
Estado
Observaciones
(El actor se obtiene del contexto autenticado)
```

## Flujo

``` text
Camión / productor llega
        ↓
Registro de recepción
        ↓
Pesaje
        ↓
Controles iniciales
        ↓
Evaluación de calidad
        ↓
Aceptar
        │
        ├── ACEPTADA
        └── ACEPTADA_CON_OBSERVACIONES
        ↓
Crear lote de uva
        ↓
Enviar a proceso
```

No existe una recepción rechazada como operación registrada dentro del
MVP.

Si la uva no se acepta físicamente, no se crea la recepción.

## Regla de negocio

Una recepción corresponde a un solo productor y puede contener una o varias
variedades. Cada variedad y cantidad recibida genera su propio `ProductionBatch`
inicial.

Una nueva entrega realizada otro día constituye una nueva recepción, aunque
corresponda al mismo productor o a las mismas variedades.

Ejemplo:

``` text
12/02
Productor A
100 qq
    ↓
Recepción R-001

13/02
Productor A
30 qq
    ↓
Recepción R-002
```

------------------------------------------------------------------------

# 6. Workflow C --- Lote de Uva

Cada variedad y cantidad de una recepción genera su propio batch inicial. La
separación posterior por características relevantes puede generar batches hijos
cuando corresponda.

La diferenciación puede considerar:

-   variedad;
-   calidad;
-   tiempo;
-   características de la recepción;
-   destino productivo;
-   otros criterios definidos operacionalmente.

## Regla

La uva se controla inicialmente en peso.

Después de entrar al proceso de prensa, la trazabilidad productiva del
líquido se gestiona en litros mediante `ProductionBatch`.

------------------------------------------------------------------------

# 7. Workflow D --- Prensa y creación del producto en proceso

Este workflow marca la frontera entre:

``` text
materia prima de uva
```

y

``` text
producto líquido en proceso
```

## Flujo conceptual

``` text
GrapeLot
   │
   ▼
Prensa
   │
   ├── vino / mosto principal
   ├── otros resultados
   └── merma cuando corresponda
   │
   ▼
ProductionBatch
   │
   ▼
Articulo = PP TINTA 1
Cantidad en litros
```

La conversión de kg de uva a litros es un resultado real del proceso.

No debe asumirse un rendimiento fijo.

Ejemplo:

``` text
5000 kg uva
      ↓
Prensa
      ↓
2000 L PP TINTA 1
```

Otro lote puede producir:

``` text
5000 kg
      ↓
2200 L PP TINTA 1
```

Las diferencias deben quedar registradas según el resultado real y,
cuando corresponda, como merma.

------------------------------------------------------------------------

# 8. Workflow E --- Producción diaria

Una `ProductionOrder` representa la producción general.

Dentro de ella se registran trabajos, transformaciones, controles,
movimientos, decisiones y pérdidas.

## Flujo base

``` text
ProductionOrder
      ↓
ProductionBatch
      ↓
ProductionWork
      ↓
Measurements / Inputs / Movements / Losses
      ↓
TransformationOrder
      ↓
nuevo ProductionBatch
```

Una producción puede avanzar por diferentes artículos intermedios:

``` text
PP TINTA 1
    ↓
PP TINTA 2
    ↓
PP TINTA 3
    ↓
PP TINTA 4
    ↓
Producto definido
```

------------------------------------------------------------------------

# 9. Workflow F --- Trabajo de Producción

## Objetivo

Registrar una actividad que realmente se realizó.

## Flujo

``` text
Determinar trabajo realizado
        ↓
Registrar ProductionWork
        ↓
Registrar el actor desde el contexto autenticado
        ↓
Registrar `ProductionParticipant` cuando aplique, separado del actor
        ↓
Relacionar uno o varios ProductionBatch y/o Container cuando aplique
        ↓
Registrar insumos cuando aplique
        ↓
Registrar controles cuando aplique
        ↓
Registrar movimientos cuando aplique
        ↓
Registrar merma del trabajo cuando corresponda
        ↓
Cerrar el registro
```

Un trabajo no se registra si no ocurrió.

Las relaciones directas con `ProductionBatch` y `Container` son opcionales
según el tipo de trabajo y pueden ser múltiples. Las cantidades, mediciones,
movimientos y mermas siguen registrándose en sus entidades específicas.

No existe cancelación posterior como comportamiento normal del MVP.

Si se debe corregir información de un trabajo ya registrado, la
modificación debe quedar auditada.

------------------------------------------------------------------------

# 10. Workflow G --- Consumo de insumos durante producción

No todos los trabajos consumen insumos.

Cuando un trabajo los necesita:

``` text
ProductionWork
      ↓
Consumo real asociado al `ProductionWork`
      ↓
Inventory API
      ↓
Salida de inventario
```

## Ejemplo

``` text
Trabajo: Clarificación

Artículo:
Bentonita

Cantidad:
X kg

Lote:
InventoryLot correspondiente
```

La dosis recomendada por enología puede ser una referencia.

El consumo real es lo que debe quedar registrado.

Las listas de materiales/recetas existentes pueden servir como
sugerencias, pero no deben bloquear el consumo real en el MVP.

------------------------------------------------------------------------

# 11. Workflow H --- Controles y mediciones

Los controles pertenecen a la operación real.

Tipos iniciales:

``` text
Temperatura
Brix
Grado alcohólico
pH
Acidez
Densidad
SO₂
Volumen
Grado Baumé
Otros
```

## Flujo

``` text
Realizar control
      ↓
Registrar ProductionMeasurement
      ↓
Asociar a ProductionBatch y/o Container y/o Work
      ↓
Registrar:
  valor
  unidad
  fecha/hora
  persona
  observación
```

La configuración de tipos de medición debe poder crecer sin modificar la
estructura principal.

------------------------------------------------------------------------

# 12. Workflow I --- Movimiento entre recipientes

## Ejemplos

``` text
Tanque A → Tanque B
Tanque A → Barrica
Barrica → Tanque
Tanque A → varios destinos
```

## Flujo

``` text
ProductionWork
      ↓
Definir movimiento
      ↓
Verificar capacidad / disponibilidad
      ↓
Registrar ProcessMovement
      ↓
Cerrar ocupación origen
      o disminuir volumen
      ↓
Crear/actualizar ocupación destino
```

Un traslado total entre recipientes mantiene el mismo `ProductionBatch`. Un
traslado parcial crea batches hijos; los hijos no vuelven a convertirse en el
batch original. Un recipiente no contiene dos batches independientes
simultáneamente.

Ejemplo:

``` text
3000 L

TK-01 → 1000 L (batch hijo)
TK-02 → 800 L (batch hijo)
TK-03 → 1200 L (batch hijo)
```

El sistema debe soportar estas distribuciones.

------------------------------------------------------------------------

# 13. Workflow J --- Movimiento parcial

Un recipiente puede contener más producto del necesario para una
operación.

Por tanto, se debe poder retirar una cantidad parcial sin eliminar la
ocupación restante.

Ejemplo:

``` text
TK-04
2000 L

Retiro:
600 L

Queda:
1400 L
```

El retiro puede dirigirse a:

-   otro tanque;
-   barrica;
-   otra transformación;
-   envasado;
-   merma, cuando corresponda.

No se debe exigir vaciar el recipiente completo.

------------------------------------------------------------------------

# 14. Workflow K --- Transformación

La OP de transformación responde:

> ¿Qué hicimos con determinada cantidad durante este período?

## Flujo

``` text
TransformationOrder
        ↓
Transformation
        ↓
Inputs
        ↓
Proceso
        ↓
Outputs
        ↓
ProductionBatch de salida
        ↓
actualizar ocupaciones
        ↓
registrar merma si corresponde
```

Una transformación puede tener múltiples entradas y múltiples salidas. Todas
las entradas son `ProductionBatch` trazables y todo output reutilizable se
representa mediante `ProductionBatch`; no se crea una entidad independiente de
subproducto/output por defecto.

No debe asumirse que:

``` text
input = output
```

porque existen pérdidas normales del proceso.

Tampoco toda diferencia debe clasificarse automáticamente como merma sin
una decisión operacional.

------------------------------------------------------------------------

# 15. Workflow L --- Cadena de PP TINTA

La cadena operativa puede representarse así:

``` text
Uva
 ↓
Prensa
 ↓
PP TINTA 1
 ↓
Trabajos / controles
 ↓
PP TINTA 2
 ↓
Trabajos / controles
 ↓
PP TINTA 3
 ↓
Trabajos / controles
 ↓
PP TINTA 4
 ↓
Decisión de producto
```

Los nombres y códigos de estos artículos pertenecen a `Articulos`.

Production solamente utiliza sus identificadores.

------------------------------------------------------------------------

# 16. Workflow M --- Decisión de estilo del vino

Una vez suficientemente estabilizado el vino, el equipo enológico
determina su destino.

## Posibles ramas

``` text
PP TINTA 4
    │
    ├───────────────┐
    ▼               ▼
  JOVEN           CRIANZA
    │               │
    ▼               ▼
Fraccionado      Barrica / duela
    │               │
    │          controles y crianza
    │               │
    │          decisión / corte
    │               │
    │          preparación final
    │               │
    └───────┬───────┘
            ▼
         Envasado
```

La decisión debe quedar registrada.

El sistema no debe predecir automáticamente el destino final.

------------------------------------------------------------------------

# 17. Workflow N --- Vino joven

En la línea joven:

``` text
PP TINTA 4
    ↓
Decisión de vino joven
    ↓
PP TINTA 5.4 / artículo de vino fraccionado
    ↓
Filtrado final según corresponda
    ↓
Embotellado
    ↓
Inventory = PRODUCTO_ENVASADO
    ↓
Etiquetado
    ↓
Control final
    ↓
transitionInventoryLotClassification
    ↓
Inventory = PRODUCTO_TERMINADO
```

La lista exacta de trabajos depende de la ruta y de las decisiones del
equipo.

------------------------------------------------------------------------

# 18. Workflow O --- Vino con crianza

## Inicio

``` text
PP TINTA 4
      ↓
Decisión de crianza
      ↓
Seleccionar barrica(s)
      ↓
ContainerOccupancy
      ↓
Crianza
```

Durante crianza pueden existir:

``` text
Controles periódicos
Mediciones
Adiciones
Retiros
Mermas
Decisiones
```

La barrica no cambia durante el proceso de crianza según la regla actual
del negocio, salvo que una futura decisión de negocio modifique esta
regla.

## Final

``` text
Crianza
   ↓
Evaluación enológica
   ↓
Cortes / ensamble si corresponde
   ↓
Estabilización
   ↓
Preparación final
   ↓
Filtrado
   ↓
Embotellado
   ↓
Inventory = PRODUCTO_ENVASADO
   ↓
Etiquetado
   ↓
Control final
   ↓
transitionInventoryLotClassification
   ↓
Inventory = PRODUCTO_TERMINADO
```

------------------------------------------------------------------------

# 19. Workflow P --- Corte / Ensamble

El corte se registra como una transformación con varias entradas.

Ejemplo:

``` text
Lote A
Lote B
Lote C
   ↓
Corte / Ensamble
   ↓
Nuevo ProductionBatch
```

El sistema debe registrar:

-   entradas;
-   cantidades;
-   salida;
-   fecha;
-   actor obtenido del contexto autenticado;
-   observaciones;
-   transformación asociada.

No se exige registrar porcentajes teóricos.

La decisión de mezcla es una decisión enológica/gerencial.

------------------------------------------------------------------------

# 20. Workflow Q --- Adición o retiro de producto

Debe poder representarse:

``` text
Quitar 500 L
```

o:

``` text
Agregar 300 L
```

sin destruir el historial.

Estos movimientos deben quedar asociados a su trabajo, transformación o
decisión correspondiente.

La operación debe afectar las ocupaciones y cantidades de forma
consistente.

------------------------------------------------------------------------

# 21. Workflow R --- Merma

## Objetivo

Registrar pérdidas reales sin obligar al personal a registrar cada
pérdida mínima en cada operación.

## Flujo

``` text
Trabajo / transformación
        ↓
Identificar pérdida
        ↓
ProductionLoss
        ↓
Tipo de merma
        ↓
Cantidad
        ↓
Unidad
        ↓
Proceso / trabajo
        ↓
Responsable
```

Tipos iniciales:

``` text
OPERATIVA
EVAPORACION
TRASIEGO
FILTRACION
VENCIMIENTO
DERRAME
ANALISIS
DESCARTE
BORRA
COLA
OTRO
```

La merma puede corresponder a un trabajo o transformación y debe quedar
asociada al proceso productivo.

No debe usarse para borrar diferencias sin explicación.

------------------------------------------------------------------------

# 22. Workflow S --- Singani: materia prima

La rama de Singani utiliza exclusivamente uva Moscatel de Alejandría.

## Flujo

``` text
Recepción de Moscatel
      ↓
Lote de uva
      ↓
Selección / molienda
      ↓
Mosto
      ↓
Fermentación
      ↓
Vino base
```

Durante la fermentación pueden registrarse:

-   levaduras;
-   nutrientes;
-   controles;
-   temperatura;
-   densidad/Baumé;
-   otros parámetros definidos por el equipo.

------------------------------------------------------------------------

# 23. Workflow T --- Singani: vino base

Después de la fermentación:

``` text
Vino base
    ↓
Descube
    ↓
Prensado
    ↓
Separación de resultados
    ↓
Estabilización
    ↓
Clarificación
    ↓
Desborre
    ↓
Preparación para destilación
```

Las borras retiradas se registran como pérdida/resultado del proceso
según las reglas de merma.

------------------------------------------------------------------------

# 24. Workflow U --- Singani: destilación

## Flujo

``` text
Vino base
      ↓
Primer destilado
      ↓
Controles
      ↓
Segundo destilado
      ↓
├── Cabezas
├── Corazón
└── Colas
```

Cada resultado relevante debe registrar:

``` text
volumen
grado alcohólico
fecha
actor obtenido del contexto autenticado
destino
observaciones
```

## Regla

``` text
Cabezas → pueden almacenarse y reutilizarse en segunda destilación
Corazón → resultado principal
Colas → descarte
```

Las cabezas reutilizadas deben entrar nuevamente al proceso mediante una
operación trazable.

------------------------------------------------------------------------

# 25. Workflow V --- Singani: rebaje y remontado

Después de la destilación:

``` text
Singani base
      ↓
Medir grado alcohólico
      ↓
Determinar necesidad de agua
      ↓
Agregar agua / realizar rebaje
      ↓
Remontado
      ↓
Control de grado alcohólico
```

La Reposada y la Húngara pueden entrar a barrica a grado alto y, según
la decisión definida por el negocio, no realizar rebaje en ese momento.

La decisión concreta debe quedar registrada.

------------------------------------------------------------------------

# 26. Workflow W --- Singani: decisión de línea

Después de los procesos iniciales:

``` text
Singani
   │
   ├───────────────┐
   ▼               ▼
Sin reposo      Crianza/reposo
   │               │
   ▼               ▼
Filtrado          Barricas
   │               │
   ▼               ▼
Envasado          Controles
                   │
                   ▼
                Rebaje/
                remontado
                   │
                   ▼
                Filtrado
                   │
                   ▼
                Envasado
```

La ruta elegida queda determinada por la decisión productiva.

------------------------------------------------------------------------

# 27. Workflow X --- Crianza/reposo de Singani

Para los singanis que requieren reposo:

``` text
Singani
   ↓
Selección de barricas
   ↓
ContainerOccupancy
   ↓
Crianza / reposo
   ↓
Controles periódicos
   ↓
Decisión
   ↓
Rebaje / remontado cuando corresponda
   ↓
Filtrado
   ↓
Envasado
```

En el caso de la línea Húngara debe poder registrarse el tipo de tostado
de las barricas utilizadas.

------------------------------------------------------------------------

# 28. Workflow Y --- Envasado

El envasado es un `ProductionWork`. La salida de Production hacia Inventory es
atómica y tipada: reducción del `ProductionBatch`, registro del output,
`InventoryLot` con `originProductionBatchId`, movimiento, stock y auditorías
forman una única transacción lógica. Cualquier fallo revierte la operación
completa.

## Flujo

``` text
Producto líquido listo
      ↓
Preparación de envasado
      ↓
Consumo de materiales
      ↓
Filtrado final cuando corresponda
      ↓
Embotellado
      ↓
Registrar:
  volumen de entrada
  botellas
  formato
  personas
  mermas
  observaciones
      ↓
Inventory API: salida Production → Inventory
       ↓
Inventory crea/reutiliza `InventoryLot` y actualiza stock
      ↓
Clasificación inicial: PRODUCTO_ENVASADO
      ↓
Stock de producto envasado
```

Los materiales pueden incluir:

``` text
Botellas
Tapones / corchos
Cápsulas
Cajas
Cinta
Placas filtrantes
Otros
```

Los artículos exactos provienen del maestro `Articulo`.

------------------------------------------------------------------------

# 29. Workflow Z --- Etiquetado

El etiquetado también es un `ProductionWork`.

## Flujo

``` text
Producto envasado
      ↓
Etiquetado
      ↓
Consumo de:
  etiquetas
  contraetiquetas
  cápsulas
  collarines
  cinta
      ↓
Registrar personas
      ↓
Registrar cantidad etiquetada
      ↓
Registrar merma
      ↓
Producto etiquetado
      ↓
Permanece en Inventory como PRODUCTO_ENVASADO hasta Control Final
```

La operación puede registrarse por día para reflejar la ejecución real.
El etiquetado por sí solo no modifica directamente la clasificación del
`InventoryLot`.

------------------------------------------------------------------------

# 30. Workflow AA --- Control final

Todos los productos destinados a comercialización pasan por control
final.

Debe verificarse:

``` text
Lote
Presentación
Cantidad
```

El control debe quedar asociado al lote de producto correspondiente.

Cuando el control final sea satisfactorio, el workflow solicita a Inventory:

``` text
transitionInventoryLotClassification(
  PRODUCTO_ENVASADO -> PRODUCTO_TERMINADO
)
```

La transición valida el estado/clasificación actual y queda auditada.

------------------------------------------------------------------------

# 31. Workflow AB --- Producto envasado → producto terminado

El producto ya pertenece a Inventory desde el embotellado.

``` text
InventoryLot = PRODUCTO_ENVASADO
      ↓
ProductionWork: ETIQUETADO
      ↓
ProductionWork: CONTROL_FINAL
      ↓
Inventory.transitionInventoryLotClassification
      ↓
InventoryLot = PRODUCTO_TERMINADO
```

No se crea un nuevo ingreso físico y no se edita directamente el lote. El
mismo `InventoryLot` conserva su trazabilidad. Inventory puede ubicar producto
envasado y producto terminado en almacenes lógicos distintos aunque
físicamente se encuentren en el mismo lugar.

------------------------------------------------------------------------

# 32. Workflow AC --- Transición de producto envasado a producto terminado

No existe un segundo ingreso a Inventory después del control final porque el
producto ingresó al inventario durante el envasado.

``` text
InventoryLot PRODUCTO_ENVASADO
      ↓
Etiquetado + Control final completados
      ↓
Inventory.transitionInventoryLotClassification
      ↓
InventoryLot PRODUCTO_TERMINADO
      ↓
Stock disponible como producto terminado
```

El lote generado durante el envasado se conserva sin duplicar existencia ni
movimiento de entrada.

------------------------------------------------------------------------

# 33. Workflow AD --- Clasificación para exportación

Exportación no representa necesariamente una nueva producción física.

Puede representar una nueva clasificación/estado de stock:

``` text
PT CDZ
   ↓
PT CDZ EXPORTACION
```

o:

``` text
Producto envasado
   ↓
PT CDZ EXPORTACION
```

La existencia física continúa siendo administrada por Inventory. El cambio
se ejecuta mediante `transitionInventoryLotClassification`, con validación y
auditoría, sin editar directamente el lote ni crear una nueva producción.

------------------------------------------------------------------------

# 34. Workflow AE --- Compra de insumos

## Flujo

``` text
Administración
      ↓
Crear Purchase
      ↓
Seleccionar Articulo
      ↓
Registrar proveedor / cantidad / datos
      ↓
Recepción administrativa/física de compra
      ↓
Inventory API
      ↓
InventoryMovement de entrada
      ↓
InventoryLot
      ↓
Stock
```

Compras no mantiene el stock.

Inventory es el responsable de la existencia física.

------------------------------------------------------------------------

# 35. Workflow AF --- Consumo de inventario por producción

``` text
ProductionWork
      ↓
Seleccionar Articulo
      ↓
Seleccionar lote de inventario
      ↓
Registrar cantidad real utilizada
      ↓
Inventory API
      ↓
InventoryMovement de salida
      ↓
Actualizar existencia
```

La referencia al trabajo permite explicar posteriormente:

> ¿En qué operación se consumió este insumo?

------------------------------------------------------------------------

# 36. Workflow AG --- Ajuste de inventario

Los ajustes no forman parte de Production.

## Flujo

``` text
Diferencia física
      ↓
Inventory
      ↓
Registrar ajuste
      ↓
Motivo
      ↓
Responsable / autorización según permisos
      ↓
InventoryMovement
      ↓
Nuevo saldo
```

El historial no se borra.

------------------------------------------------------------------------

# 37. Workflow AH --- Trazabilidad de producto terminado

Desde un producto terminado, el sistema debe poder navegar hacia atrás:

``` text
Producto terminado
      ↓
Lote de inventario
      ↓
Envasado
      ↓
Producción
      ↓
TransformationOrders
      ↓
ProductionBatches
      ↓
Recepciones
      ↓
Lotes de uva
      ↓
Vendimia
      ↓
Productor
```

No se pretende mantener una genealogía infinitamente detallada de cada
litro, pero sí la relación suficiente para explicar el origen y las
transformaciones principales.

------------------------------------------------------------------------

# 38. Workflow AI --- Caso complejo de movimiento parcial y decisión

El modelo debe soportar este caso:

``` text
Lote / Batch
3000 L

       ↓
TK-04
3000 L

Enólogo decide:
"Retirar 600 L"

       ↓

600 L → otro recipiente
2400 L → permanecen en TK-04

Luego:
Agregar 300 L de otro lote

       ↓

Nuevo resultado productivo
2700 L
```

Cada operación debe quedar registrada por separado.

No se modifica retrospectivamente el origen.

------------------------------------------------------------------------

# 39. Workflow AJ --- Cierre de OP de transformación

Una `TransformationOrder` se cierra cuando se registra el resultado
productivo de ese período.

Debe existir suficiente información para conocer:

``` text
entradas
salidas
mermas
trabajos
controles
responsables
recipientes
```

El cierre no significa necesariamente que el producto terminado haya
sido embotellado.

Puede cerrarse una transformación y continuar otra etapa posteriormente.

------------------------------------------------------------------------

# 40. Workflow AK --- Cierre de OP Maestra

La `ProductionOrder` puede continuar a través de varias transformaciones
y productos intermedios.

Se cierra cuando la producción que representa alcanza el resultado
definido por el negocio para esa orden.

Puede terminar en:

``` text
Producto intermedio
```

o:

``` text
Producto terminado
```

según el caso.

La relación entre OP Maestra y OP de Transformación debe conservarse.

------------------------------------------------------------------------

# 41. Regla especial: el sistema sigue la operación real

El usuario no debe verse obligado a ejecutar:

``` text
Paso 1
Paso 2
Paso 3
Paso 4
```

solo porque una ruta maestra lo define.

En cambio:

``` text
Ruta sugerida
      ↓
Trabajo realmente realizado
      ↓
Registro
      ↓
Nueva situación productiva
      ↓
Decisión del responsable
      ↓
Siguiente trabajo
```

Esto es especialmente importante para vino y singani porque las
decisiones dependen de análisis y evaluación enológica.

------------------------------------------------------------------------

# 42. Reglas de integridad transversal

Cada workflow que produzca una operación física debe preservar:

``` text
Quién
Qué
Cuánto
Cuándo
Dónde
Por qué
Documento causal
```

Cuando corresponda:

``` text
Lote
Recipiente
Articulo
Transformación
Merma
Destino
```

No se permite:

-   movimiento físico sin cantidad;
-   consumo sin artículo;
-   consumo sin lote de inventario cuando el control de lotes lo
    requiera;
-   movimiento de proceso sin origen/destino cuando aplique;
-   transformación sin entradas/salidas;
-   modificación silenciosa de operaciones cerradas;
-   escritura directa en las tablas internas de otro módulo.

------------------------------------------------------------------------

# 43. Interacción entre módulos

## Compra

``` text
Compras
   ├── Articulos API
   └── Inventory API
```

## Producción

``` text
Production
   ├── Articulos API
   ├── Inventory API
   └── Core / Access
```

## Inventario

``` text
Inventory
   ├── Articulos API
   └── Core / Access
```

La comunicación entre módulos se realiza exclusivamente mediante las
APIs públicas definidas por la arquitectura de Logger.

------------------------------------------------------------------------

# 44. Transacciones

Las operaciones que afectan más de un módulo y deban confirmarse como una
sola unidad utilizan el `UnitOfWork` compartido de infraestructura definido en
la arquitectura. El mismo contexto transaccional se propaga a Production,
Inventory y Audit sin trasladar reglas de negocio al UnitOfWork.

Ejemplo:

``` text
Consumir insumo
    ↓
registrar trabajo
    ↓
registrar consumo
    ↓
afectar Inventory
    ↓
auditar
```

Debe evitarse un estado donde Production confirme el trabajo pero
Inventory no registre el consumo, salvo que el workflow explícitamente
admita un estado pendiente.

------------------------------------------------------------------------

# 45. Fuera del alcance del MVP

No son necesarios para implementar estos workflows:

``` text
Costeo completo
Depreciación contable
Planificación avanzada de personal
Agenda de trabajos
LIMS completo
Mantenimiento preventivo
Ventas
Despacho comercial completo
Automatización contable completa
```

Pueden incorporarse posteriormente sin romper las fronteras definidas.

------------------------------------------------------------------------

# 46. Casos que deben usarse como pruebas funcionales

Antes de considerar Production terminado, el sistema debe poder
representar al menos:

### Caso 1 --- Vino joven

``` text
Vendimia
→ Recepción
→ Lote
→ Prensa
→ PP TINTA 1
→ Trabajos/controles
→ PP TINTA 2
→ PP TINTA 3
→ PP TINTA 4
→ Decisión joven
→ Envasado
→ Inventory (PRODUCTO_ENVASADO)
→ Etiquetado
→ Control final
→ transitionInventoryLotClassification
→ Inventory (PRODUCTO_TERMINADO)
```

### Caso 2 --- Vino crianza

``` text
Vendimia
→ Recepción
→ Producción
→ PP TINTA 4
→ Decisión crianza
→ Barricas
→ Controles
→ Corte
→ Preparación
→ Envasado
→ Inventory (PRODUCTO_ENVASADO)
→ Etiquetado
→ Control final
→ transitionInventoryLotClassification
→ Inventory (PRODUCTO_TERMINADO)
```

### Caso 3 --- Singani sin reposo

``` text
Moscatel
→ Mosto
→ Fermentación
→ Vino base
→ Destilación
→ Cabezas / Corazón / Colas
→ Rebaje/remontado
→ Filtrado
→ Envasado
→ Inventory (PRODUCTO_ENVASADO)
→ Etiquetado
→ Control final
→ transitionInventoryLotClassification
→ Inventory (PRODUCTO_TERMINADO)
```

### Caso 4 --- Singani con reposo

``` text
Moscatel
→ Vino base
→ Destilación
→ Corazón
→ Barricas
→ Crianza/reposo
→ Rebaje/remontado
→ Filtrado
→ Envasado
→ Inventory (PRODUCTO_ENVASADO)
→ Etiquetado
→ Control final
→ transitionInventoryLotClassification
→ Inventory (PRODUCTO_TERMINADO)
```

### Caso 5 --- Consumo de insumo

``` text
Compra
→ Inventory
→ ProductionWork
→ consumo real
→ InventoryMovement
```

### Caso 6 --- Movimiento parcial

``` text
3000 L en TK-04
→ retirar 600 L
→ 2400 L permanecen
→ 600 L pasan a otro recipiente
```

### Caso 7 --- Merma

``` text
Trabajo
→ pérdida identificada
→ ProductionLoss
→ motivo
→ cantidad
→ responsable
```

------------------------------------------------------------------------

# 47. Regla para IA

Una implementación no debe inventar pasos, estados o automatizaciones
que no estén definidos aquí o en los documentos superiores.

Si el caso real requiere una operación no cubierta:

``` text
detener implementación
        ↓
identificar decisión faltante
        ↓
documentarla
        ↓
validarla
        ↓
continuar implementación
```

La prioridad de decisión continúa siendo:

``` text
Business specification
>
AI rules
>
Architecture
>
Module contract
>
Public APIs
>
Reference implementation
>
Tests
>
Generic conventions
```

# 44. Production P5.5A–D — contrato operativo vigente

Esta sección prevalece sobre los workflows conceptuales anteriores que nombran
entidades retiradas o rutas abreviadas. `ProductionWorkInput` es propiedad de
Production, pero el consumo/reversal de stock usa primitives confiables de
Inventory dentro de `SharedUnitOfWork`; Inventory conserva ownership de lotes,
movimientos, stock y la política de stock negativo. Ambos comandos son
idempotentes y append-only.

Los comandos públicos de recipientes son:

```text
POST /api/v1/production/containers/:id/assign
POST /api/v1/production/containers/:sourceId/transfers
POST /api/v1/production/containers/:sourceId/transfers/partial
```

Usan `production:container_assign` o `production:container_transfer` (el
maestro usa `production:container_manage`), registran ocupaciones y los hechos
`ASSIGNED`, `TRANSFERRED` y `PARTIAL_TRANSFERRED`. Un traslado parcial crea un
batch hijo y lineage. No existe merge-back ni reversión destructiva automática
en el MVP; se corrige mediante una nueva operación productiva válida.

La trazabilidad pública es
`GET /api/v1/production/batches/:batchId/trace` y conecta recepción, batches,
lineage, works, inputs, mediciones, containers, transformaciones, pérdidas,
releases y reversals, con límites y warnings. La salida a Inventory es
`POST /api/v1/production/batches/:batchId/release-to-inventory`, permiso
`production:inventory_release`, clasificación inicial fija
`PRODUCTO_ENVASADO`; su reversal es
`POST /api/v1/production/batches/:batchId/releases/:releaseId/reverse`, permiso
`production:inventory_release_reverse`. El hash canónico se calcula en servidor,
la reversión es completa, rechaza estados inseguros, no autoriza stock negativo
y conserva historia/auditoría append-only.

# MODULE_MAP.md

## 1. Propósito

Este documento define la organización modular de Winter, sistema de negocio
construido sobre la base técnica Logger, para el dominio de producción de
Bodega Cruce del Zorro.

Su objetivo es establecer:

-   qué responsabilidad tiene cada módulo;
-   qué entidades pertenecen a cada módulo;
-   qué Aggregate Roots existen;
-   qué módulos pueden comunicarse entre sí;
-   qué responsabilidades NO pertenecen a cada módulo;
-   qué contratos públicos deben exponerse;
-   cómo se relacionan Artículos, Compras, Producción e Inventario.

Este documento complementa:

1.  `ARCHITECTURE.md`
2.  `AI_IMPLEMENTATION_RULES.md`
3.  `MODULE_CONTRACT.md`
4.  `DOMAIN_MODEL.md`
5.  `AGGREGATES_AND_ENTITIES.md`

------------------------------------------------------------------------

# 2. Principio principal de modularidad

Los módulos se organizan por **responsabilidad de negocio**, no por
tablas ni por los módulos utilizados como prototipos.

Products y Purchases pertenecieron al proyecto Logger y fueron retirados del
runtime de Winter una vez implementados Articulos y Compras. Winter define
únicamente los módulos oficiales `Articulos` y `Compras`.

La estructura conceptual final para este dominio será:

``` text
Winter (sobre Logger)
│
├── Core / Access Management
│
├── Articulos
│
├── Compras
│
├── Production
│
└── Inventory
```

La arquitectura debe permitir agregar posteriormente otros módulos sin
romper estas fronteras.

------------------------------------------------------------------------

# 3. Mapa general

``` text
┌─────────────────────────────────────────────────────────┐
│                 CORE / ACCESS MANAGEMENT                 │
│                                                         │
│ Users · Roles · Permissions · Audit                     │
└──────────────────────────┬──────────────────────────────┘
                           │
                           │ referencias
                           ▼
┌─────────────────────────────────────────────────────────┐
│                       ARTICULOS                          │
│                                                         │
│ Maestro único de artículos                              │
│ Insumos · Materias primas · PP · PT · Materiales        │
└───────────────┬───────────────────────┬─────────────────┘
                │                       │
                │ articuloId            │ articuloId
                ▼                       ▼
┌────────────────────────┐    ┌───────────────────────────┐
│        COMPRAS         │    │       PRODUCTION          │
│                        │    │                           │
│ Compra de insumos      │    │ Vendimia                  │
│ Recepción administrativa│   │ Recepción de uva          │
│ Ingreso al sistema     │    │ Procesos                  │
└────────────┬───────────┘    │ OP                        │
             │                │ Lotes de producción      │
             │                │ Trabajos                  │
             │                │ Transformaciones          │
             │                │ Mediciones                │
             │                │ Decisiones                │
             │                │ Tanques/Barricas          │
             │                │ Mermas                    │
             │                └────────────┬──────────────┘
             │                             │
             │                             │ consume /
             │                             │ produce
             ▼                             ▼
        ┌────────────────────────────────────────┐
        │                INVENTORY                │
        │                                        │
        │ Almacenes · Lotes · Stock · Movimientos│
        └────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 4. Core / Access Management

## Responsabilidad

Gestionar las capacidades transversales de Logger.

Incluye:

-   usuarios;
-   roles;
-   permisos;
-   autenticación/autorización;
-   auditoría;
-   mecanismos comunes definidos por Logger.

## Entidades principales

Las entidades concretas ya existentes en Access Management permanecen
bajo su módulo propietario.

Production, Compras, Articulos e Inventory no deben duplicarlas.

## Aggregate Roots

Los definidos por el módulo Core/Access Management.

## Production utiliza

Production utiliza `User.id` como identificador del actor autenticado que
registra o modifica información.

Puede conservar referencias técnicas de autoría como:

``` text
userId
createdByUserId
updatedByUserId
```

según corresponda al contrato existente de Logger.

No debe crear un sistema paralelo de usuarios o permisos. Las personas que
participan físicamente se modelan como `ProductionParticipant`, independiente
del actor autenticado.

## Regla

La identidad de una persona que participa en producción no implica que
Production deba convertirse en un módulo de Recursos Humanos.

Para el MVP no se crea un agregado `Person`. Los equipos o personas que
participan físicamente en determinados trabajos se conservan en una lista
operativa del trabajo, separada del `User.id` del actor autenticado.

------------------------------------------------------------------------

# 5. Articulos

## Responsabilidad

Administrar el **maestro único de artículos de la bodega**.

Un artículo representa aquello que la organización reconoce y utiliza
como elemento de negocio.

No se deben crear entidades maestras separadas para:

-   insumos;
-   productos intermedios;
-   productos terminados;
-   materiales;
-   productos para exportación;
-   botellas;
-   etiquetas;
-   cajas;
-   otros artículos.

Todo pertenece al maestro:

``` text
Articulo
```

## Ejemplos

``` text
Uva Syrah
Metabisulfito
Clarificante
PP TINTA 1
PP TINTA 2
PP TINTA 3
PP TINTA 4
PP TINTA CRIANZA 5.4
Vino La Curiosa Tannat
Vino CDZ Blend
Botella 750 ml
Etiqueta La Curiosa
Caja
...
```

## Entidad principal

``` text
Articulo
```

Las demás entidades del catálogo se mantienen según la implementación
final del módulo de Artículos.

## Aggregate Root

``` text
Articulo
```

## Production consume

Production solamente necesita referencias:

``` text
articuloId
```

Por ejemplo:

``` text
ProductionBatch.articuloId
ProductionConsumption.productionBatchId / inventoryLotId
ProductionOutput.productionBatchId
```

Production no debe modificar directamente Articulo.

## Inventory consume

Inventory también referencia artículos mediante:

``` text
articuloId
```

Inventory no crea su propio catálogo.

## Compras consume

Compras referencia:

``` text
articuloId
```

para determinar qué artículo se está adquiriendo.

## Regla crítica

> `Articulo` es el maestro único de artículos. Ningún módulo de negocio
> debe crear una entidad paralela que represente el mismo concepto.

------------------------------------------------------------------------

# 6. Compras

## Responsabilidad

Registrar las compras realizadas por la administración y representar la
adquisición de artículos para la bodega.

Una compra puede incluir insumos y otros artículos que deban ingresar
físicamente al inventario.

## Entidades

La estructura exacta podrá evolucionar, pero conceptualmente incluye:

``` text
 Compra
 CompraItem
```

o sus equivalentes definitivos en español.

## Aggregate Root

``` text
 Compra
```

## Flujo principal

``` text
Administración
      │
      ▼
Compra
      │
      ├── artículo
      ├── cantidad
      ├── proveedor
      └── datos de adquisición
      │
      ▼
Ingreso al Inventory
      │
      ▼
Stock
```

## Responsabilidad de Inventory

Compras **no administra directamente el stock**.

Cuando una compra genera ingreso físico, Compras debe utilizar el
contrato público de Inventory para registrar el ingreso correspondiente.

Conceptualmente:

``` text
Compras
   │
   │ receipt / inventory entry
   ▼
Inventory
```

## Regla

> Una compra registrada no significa automáticamente que Compras sea
> dueño del inventario. Compras registra la adquisición; Inventory
> registra la existencia física.

La operación de ingreso debe ser coherente con el estado real de la
recepción de la compra y con las reglas de Inventory.

## Dependencias

``` text
Compras
├── Articulos API
├── Inventory API
└── Core / Access
```

No debe importar directamente repositorios internos de estos módulos.

------------------------------------------------------------------------

# 7. Inventory

## Responsabilidad

Administrar las existencias físicas almacenadas en almacenes.

Inventory responde:

> ¿Qué tenemos almacenado, cuánto tenemos, en qué lote y dónde está?

## Entidades

``` text
Warehouse
InventoryLot
InventoryStock
InventoryMovement
```

## Aggregate Roots

Inicialmente:

``` text
Warehouse
InventoryLot
InventoryMovement
```

`InventoryStock` puede funcionar como representación/balance derivado de
los movimientos según el diseño final.

## Inventory administra

``` text
Almacenes
Existencias
Lotes de inventario
Entradas
Salidas
Transferencias
Ajustes
Pérdidas
Clasificaciones de stock
Transiciones de clasificación de InventoryLot
```

La clasificación de un lote no se modifica directamente. Inventory expone el
command `transitionInventoryLotClassification`, utilizado inicialmente para
`PRODUCTO_ENVASADO -> PRODUCTO_TERMINADO` y reutilizable para exportación.

## Frontera con Production

La frontera es fundamental:

``` text
Producto líquido dentro de tanque/barrica
              ↓
          PRODUCTION
```

No es Inventory.

Cuando el producto es envasado y pasa a una existencia física
almacenable:

``` text
Production
     │
     │ envasado
     ▼
Inventory
     │
     ▼
InventoryLot
```

## Artículos de inventario

Inventory referencia:

``` text
articuloId
```

hacia Articulos.

No duplica `Articulo`.

## Compras

Cuando Compras registra una adquisición que debe ingresar físicamente:

``` text
Compras
    │
    ▼
Inventory API
    │
    ▼
InventoryMovement
    │
    ▼
InventoryLot / Stock
```

## Production

Production puede solicitar/registrar mediante el contrato público de
Inventory operaciones como:

-   consumo de insumos;
-   ingreso de producto envasado;
-   movimientos de inventario relacionados con producción;
-   otras operaciones autorizadas por Inventory.

Production nunca modifica:

``` text
InventoryStock
InventoryLot
InventoryMovement
```

directamente.

------------------------------------------------------------------------

# 8. Production

## Responsabilidad

Administrar la transformación productiva desde la recepción de la
materia prima hasta el momento en que el producto pasa a inventario.

Production responde:

> ¿Qué estamos produciendo, en qué etapa está, qué ocurrió, quién lo
> hizo, qué medimos, qué decidió el responsable y dónde se encuentra
> físicamente el producto en proceso?

## Entidades

``` text
Producer
GrapeVariety
Harvest
GrapeReception
GrapeLot

ProductionProcess
ProductionLine
ProductionWorkType (administrado con `production:work_type_manage`)
TransformationType
MeasurementType (administrado con `production:measurement_type_manage`)
LossType

ProductionOrder
TransformationOrder
ProductionBatch
ProductionWork
ProductionWorkInput
ProductionMeasurement
ProductionDecision

Container
ContainerOccupancy
ProcessMovement

Transformation
TransformationInput
TransformationOutput

ProductionLoss
```

------------------------------------------------------------------------

# 9. Aggregate Roots de Production

Los Aggregate Roots definidos para el MVP son:

``` text
Harvest
GrapeReception
ProductionOrder
TransformationOrder
ProductionBatch
Container
```

No todas las entidades anteriores son Aggregate Roots.

Las entidades operativas dependientes deben respetar el límite del
Aggregate al que pertenecen.

------------------------------------------------------------------------

# 9.1. Catálogos Producer y GrapeVariety

## Responsabilidad

`Producer` y `GrapeVariety` pertenecen a Production y son las referencias
maestras utilizadas por `GrapeReception`.

``` text
GrapeReception.producerId      -> Producer
GrapeReception.varieties[]     -> GrapeVariety + cantidad
```

No pertenecen a Articulos ni Core y no deben almacenarse como texto libre.
Los campos exactos de ambos catálogos deben definirse dentro del diseño de
Production antes de crear su esquema Prisma; no pueden ser inventados durante
la implementación.

------------------------------------------------------------------------

# 10. Harvest / Vendimia

## Responsabilidad

Representar una campaña de vendimia.

Una vendimia:

-   existe una sola vez por año;
-   puede comenzar a planificarse antes de la cosecha;
-   agrupa las recepciones de uva de ese año.

Puede incluir información de planificación futura de proveedores, pero
la planificación detallada de contratos no se convierte automáticamente
en una entidad del MVP.

## Relación

``` text
Harvest
   1
   │
   N
GrapeReception
```

------------------------------------------------------------------------

# 11. GrapeReception / Recepción de Uva

## Responsabilidad

Representar un ingreso físico de uva a la bodega.

Una recepción:

-   pertenece a una vendimia;
-   referencia un `Producer` por `producerId`;
-   contiene una o varias variedades, cada una con su cantidad;
-   corresponde a un único productor;
-   registra peso solicitado y recibido;
-   registra mediciones iniciales;
-   registra calidad;
-   registra responsable;
-   puede quedar aceptada o aceptada con observaciones.

No existe una recepción rechazada como estado operativo del MVP.

------------------------------------------------------------------------

# 12. GrapeLot / Lote de Uva

## Responsabilidad

Representar la unidad de trazabilidad de la uva proveniente de una
recepción.

La uva se mide en kg durante la recepción.

Después de la prensa, la producción pasa a manejar el producto líquido
en litros.

No se pretende conservar una genealogía exhaustiva de cada litro durante
toda la producción.

------------------------------------------------------------------------

# 13. ProductionOrder / OP Maestra

## Responsabilidad

Representar la producción general.

Responde:

> ¿De dónde nació este producto?

Una OP Maestra puede:

-   utilizar varias recepciones/lotes;
-   producir diferentes productos intermedios;
-   avanzar desde PP TINTA 1 hasta producto terminado;
-   tener órdenes de transformación hijas.

Ejemplo:

``` text
ProductionOrder
│
├── TransformationOrder 1
├── TransformationOrder 2
├── TransformationOrder 3
└── TransformationOrder 4
```

------------------------------------------------------------------------

# 14. TransformationOrder / OP de Transformación

## Responsabilidad

Representar una transformación productiva realizada durante un período.

Responde:

> ¿Qué hicimos con determinada cantidad de producto durante este
> período?

Una OP de transformación pertenece a una OP Maestra.

``` text
ProductionOrder
       │
       └── N TransformationOrder
```

No debe confundirse con `ProductionWork`.

Una OP de transformación agrupa el resultado productivo de un período;
los trabajos registran las acciones concretas realizadas.

------------------------------------------------------------------------

# 15. ProductionBatch / Lote de Producción

## Responsabilidad

Representar una cantidad concreta de un `Articulo` dentro de una
producción.

Ejemplo:

``` text
ProductionBatch
Articulo: PP TINTA 1
Cantidad: 900 L
ProductionOrder: OP-2026-001
```

Es diferente de `Articulo`.

``` text
Articulo
    = qué es

ProductionBatch
    = qué cantidad concreta estamos procesando
```

Esto permite que un mismo artículo exista en diferentes producciones.

El lote de producción puede estar distribuido en múltiples recipientes.

------------------------------------------------------------------------

# 16. ProductionWork / Trabajo de Producción

## Responsabilidad

Registrar una acción productiva que realmente ocurrió.

Ejemplo:

``` text
Trasiego
Filtración
Clarificación
Descube
Embotellado
Etiquetado
Control final
Destilación
...
```

Un trabajo:

-   pertenece a una producción;
-   tiene fecha/hora;
-   registra como actor al `User.id` autenticado;
-   puede conservar una lista operativa de participantes;
-   puede relacionarse directamente con uno o varios `ProductionBatch`;
-   puede relacionarse directamente con uno o varios `Container`;
-   puede consumir insumos;
-   puede producir movimientos de proceso;
-   puede generar información de merma.

Las relaciones con batches y recipientes son opcionales según el tipo de
trabajo. La persistencia N:N se definirá técnicamente en Prisma sin cambiar
este contrato funcional.

No existe el concepto de trabajo cancelado en el MVP.

Si el trabajo no se realizó, no se registra.

------------------------------------------------------------------------

# 17. ProductionWorkInput

## Responsabilidad

Registrar los artículos/insumos utilizados durante determinados
trabajos.

No todos los trabajos tienen insumos.

Ejemplo:

``` text
Trabajo: Clarificación

Artículo: Clarificante X
Cantidad: 500 g
```

Production registra el consumo como parte del trabajo y utiliza el
contrato de Inventory para afectar la existencia física.

------------------------------------------------------------------------

# 18. ProductionMeasurement

## Responsabilidad

Registrar controles y mediciones productivas.

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

El catálogo de tipos debe poder extenderse.

Una medición puede relacionarse con:

-   ProductionBatch;
-   Container;
-   ProductionWork;

según el contexto.

Debe conservar:

``` text
valor
unidad
fecha/hora
persona
observaciones
```

------------------------------------------------------------------------

# 19. ProductionDecision

## Responsabilidad

Registrar decisiones productivas realizadas por el responsable
enológico/destilación.

Ejemplos:

``` text
Cambio de ruta
Cambio de producto objetivo
Enviar a crianza
Enviar a joven
Realizar corte
Agregar insumo
Quitar
Agregar
Cambiar recipiente
Detener proceso
Continuar proceso
```

El sistema registra la decisión.

No debe asumir que una decisión significa automáticamente ejecutar toda
la operación física.

La decisión puede ser registrada por el responsable o por una persona
autorizada para registrarla, según los permisos definidos.

------------------------------------------------------------------------

# 20. Container

## Responsabilidad

Representar los recipientes productivos.

Incluye:

``` text
Tanques
Barricas
```

Datos relevantes:

``` text
code
capacity
type
material
location
owner
status
toastType
usageCount
acquisitionDate
observations
```

Estados iniciales:

``` text
DISPONIBLE
OCUPADO
FUERA_DE_SERVICIO
```

El límite de usos de una barrica no debe convertirse en un bloqueo
automático.

El responsable enológico determina si puede continuar utilizándose.

------------------------------------------------------------------------

# 21. ContainerOccupancy

## Responsabilidad

Registrar el historial de ocupación de un recipiente.

Permite conocer:

``` text
qué lote estuvo
en qué recipiente
cuándo entró
cuándo salió
cuánto volumen tenía inicialmente
cuánto volumen quedó/finalizó
```

Un recipiente no puede contener dos batches independientes simultáneamente.
Introducir otro batch constituye una mezcla/transformación y genera un batch
nuevo.

Un lote de producción puede estar distribuido en varios recipientes.

Por lo tanto, esta relación debe soportar esa distribución.

------------------------------------------------------------------------

# 22. ProcessMovement

## Responsabilidad

Registrar movimientos físicos del producto en proceso.

Ejemplos:

``` text
Tanque A → Tanque B
Tanque A → Barrica
Barrica → Tanque
Tanque A → Tanque B
```

Debe registrar:

``` text
fecha/hora
origen
destino
cantidad
unidad
motivo
trabajo relacionado
persona
observación
```

Production controla estos movimientos.

No son movimientos de inventario.

------------------------------------------------------------------------

# 23. Transformation

## Responsabilidad

Registrar qué transformación física ocurrió dentro de una
`TransformationOrder`.

Puede tener:

``` text
ProductionConsumption inputs (uno o varios ProductionBatch)
ProductionOutput outputs (uno o varios ProductionBatch)
```

y asociarse a:

``` text
ProductionBatch
cantidad
unidad
```

No se utilizará una genealogía recursiva exhaustiva.

La trazabilidad debe responder al negocio:

> Este producto proviene de esta producción y fue transformado mediante
> estos registros.

------------------------------------------------------------------------

# 24. TransformationInput / TransformationOutput

Permiten representar múltiples entradas y salidas.

Ejemplo:

``` text
Input
PP TINTA 2 → 1500 L

Output
PP TINTA 3 → 1380 L
```

O:

``` text
Input
Cabernet
Tannat
Merlot

Output
Nuevo lote de vino para corte
```

No se exige una fórmula matemática de mezcla.

------------------------------------------------------------------------

# 25. ProductionLoss

## Responsabilidad

Registrar pérdidas de producción.

Ejemplos:

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

La merma debe poder asociarse al trabajo y al proceso correspondiente.

El objetivo es conocer dónde se pierde volumen sin obligar al usuario a
registrar pequeñas pérdidas gota por gota en cada trabajo.

No se utilizará una entidad independiente de subproducto para el MVP.

------------------------------------------------------------------------

# 26. Singani dentro de Production

Singani no requiere un módulo separado.

Utiliza las mismas estructuras de Production.

Las transformaciones de destilación pueden producir:

``` text
CABEZA
CORAZON
COLA
```

con:

``` text
volumen
grado alcohólico
destino
```

Reglas:

``` text
Cabezas → pueden almacenarse/reutilizarse
Corazón → producto principal
Colas → descarte
```

------------------------------------------------------------------------

# 27. Crianza dentro de Production

Crianza no requiere una entidad `Crianza`.

Se representa mediante:

``` text
ProductionBatch
ContainerOccupancy
ProductionMeasurement
ProductionWork
ProductionDecision
ProcessMovement
ProductionLoss
```

La decisión de finalizar la crianza corresponde al responsable
enológico.

------------------------------------------------------------------------

# 28. Envasado y etiquetado

No requieren Aggregate Roots independientes en el MVP.

Se representan como `ProductionWork`.

Ejemplos:

``` text
EMBOTELLADO
ETIQUETADO
CONTROL_FINAL
```

El embotellado puede registrar:

``` text
fecha
producto
volumen de entrada
botellas producidas
formato
merma
personas
observaciones
```

Después del envasado, el producto pasa a la frontera de Inventory.

------------------------------------------------------------------------

# 29. Comunicación entre módulos

## Articulos → otros módulos

Articulos expone la información necesaria de los artículos mediante su
API pública.

``` text
Production ──→ Articulos API
Compras ─────→ Articulos API
Inventory ───→ Articulos API
```

Ninguno accede directamente al repositorio interno de Articulos.

------------------------------------------------------------------------

## Compras → Inventory

Cuando una compra genera una entrada física:

``` text
Compras
   │
   │ public Inventory API
   ▼
Inventory
```

Inventory crea/registra:

``` text
InventoryMovement
InventoryLot
Stock
```

según sus reglas internas.

------------------------------------------------------------------------

## Production → Inventory

Cuando Production consume un insumo:

``` text
Production
   │
   │ consumo
   ▼
Inventory
```

Cuando Production termina el envasado:

``` text
Production
   │
   │ ingreso de producto envasado
   ▼
Inventory
```

Production no escribe directamente en las tablas de Inventory.

------------------------------------------------------------------------

# 30. Frontera de inventario

Esta regla es fundamental para la implementación:

``` text
                PRODUCTION
                     │
       producto líquido en proceso
                     │
             tanque / barrica
                     │
                     ▼
                 ENVASADO
                     │
                     ▼
                INVENTORY
                     │
              producto físico
                     │
              almacén / stock
```

Por tanto:

``` text
900 L PP TINTA 1 en tanque
→ Production

3000 L vino en 3 tanques
→ Production

2400 botellas en almacén
→ Inventory

500 kg de insumo en almacén
→ Inventory
```

------------------------------------------------------------------------

# 31. Reglas de dependencia

La dirección permitida de dependencias será conceptualmente:

``` text
Core
  ↑
Articulos
  ↑
Production
  ↑
Inventory
```

Sin embargo, esta representación no significa dependencia técnica rígida
ni importaciones directas.

Los módulos se comunican mediante contratos públicos.

En particular:

``` text
Compras → Articulos API
Compras → Inventory API

Production → Articulos API
Production → Inventory API
Production → Core/Access API

Inventory → Articulos API
Inventory → Core/Access API
```

Nunca:

``` text
Production → InventoryRepository
Production → ArticuloRepository
Compras → Inventory tables
Inventory → Production tables
```

------------------------------------------------------------------------

# 32. Transacciones entre módulos

Cuando una operación atraviese módulos, se debe respetar el mecanismo
transaccional/UoW definido por la arquitectura.

Ejemplo conceptual:

``` text
Registrar compra recibida
        │
        ├── Compra válida
        │
        └── Registrar ingreso en Inventory
```

No debe quedar una compra confirmada como recibida sin que se procese
correctamente su impacto de inventario, salvo que el flujo de negocio
explícitamente contemple estados intermedios.

De igual manera:

``` text
Consumir insumo en Production
        │
        └── Inventory registra la salida
```

La atomicidad intermodular se resuelve mediante un único `UnitOfWork`
compartido de infraestructura. Este componente propaga el mismo contexto
transaccional a las operaciones de Production, Inventory y Audit que deban
confirmarse o revertirse juntas. No contiene reglas de negocio ni habilita
acceso directo a repositories de otros módulos.

------------------------------------------------------------------------

# 33. Permisos

Los permisos pertenecen al módulo que posee la operación.

Ejemplos conceptuales:

``` text
ARTICULOS
├── article:read
├── article:create
├── article:update
└── article:manage

COMPRAS
├── purchase:read
├── purchase:create
├── purchase:update
└── purchase:receive

PRODUCTION
├── production:read
├── production:harvest_create
├── production:reception_create
├── production:work_create
├── production:measurement_create
├── production:work_type_manage
├── production:measurement_type_manage
├── production:decision_create
├── production:transformation_create
└── production:loss_create

INVENTORY
├── inventory:read
├── inventory:movement_create
├── inventory:adjust
├── inventory:transfer
└── inventory:lot_manage
```

Los permisos de Winter siguen la convención estable `<module>:<action>` y
utilizan el sistema RBAC existente de Logger.

No deben implementarse permisos paralelos.

------------------------------------------------------------------------

# 34. Auditoría

Las operaciones críticas deben generar auditoría mediante el mecanismo
central de Logger.

Especialmente:

``` text
Creación/modificación de artículos
Compras
Entradas de inventario
Salidas de inventario
Transformaciones
Decisiones
Mermas
Movimientos de proceso
Cambios de estado
Cambios de recipiente
Consumos de insumos
```

Production y Inventory no deben implementar sistemas de auditoría
independientes.

------------------------------------------------------------------------

# 35. Qué NO pertenece a Production

Production no debe administrar:

``` text
Usuarios
Roles
Permisos
Maestro de artículos
Compras
Stock de almacenes
Movimientos de inventario
Contabilidad
Costos de producción
Depreciación de activos
RRHH
```

------------------------------------------------------------------------

# 36. Qué NO pertenece a Inventory

Inventory no debe administrar:

``` text
Procesos productivos
Trabajos de producción
Decisiones del enólogo
Fermentación
Crianza
Transformaciones de vino
Tanques como proceso productivo
Mediciones enológicas
```

Inventory solamente administra la existencia física que cruza su
frontera.

------------------------------------------------------------------------

# 37. Qué NO pertenece a Compras

Compras no debe:

``` text
Modificar stock directamente
Crear artículos
Modificar ProductionBatch
Crear transformaciones
Administrar tanques
Registrar decisiones enológicas
```

Compras registra adquisiciones y utiliza Inventory para su impacto
físico.

------------------------------------------------------------------------

# 38. Qué NO pertenece a Articulos

Articulos no debe:

``` text
Administrar existencias
Registrar compras
Registrar producción
Registrar mermas
Administrar almacenes
Administrar tanques
```

Articulos responde:

> ¿Qué es este artículo?

Inventory responde:

> ¿Cuánto tenemos?

Production responde:

> ¿Qué estamos haciendo con él?

Compras responde:

> ¿Qué adquirimos?

------------------------------------------------------------------------

# 39. Flujo de compra de insumos

El flujo esperado es:

``` text
Administración
      │
      ▼
Crear compra
      │
      ▼
Seleccionar Articulo
      │
      ▼
Registrar cantidad/proveedor/datos
      │
      ▼
Compra recibida
      │
      ▼
Inventory API
      │
      ▼
InventoryMovement
      │
      ▼
InventoryLot / Stock
```

Esto reemplaza la idea anterior de que el módulo legacy de compras fuera un
módulo aislado
sin conexión real con Inventory.

------------------------------------------------------------------------

# 40. Flujo productivo

``` text
Vendimia
   ↓
Recepción de uva
   ↓
Lote de uva
   ↓
Prensa
   ↓
ProductionBatch
   ↓
PP TINTA 1
   ↓
Trabajos + mediciones + insumos + mermas
   ↓
TransformationOrder
   ↓
PP TINTA 2
   ↓
PP TINTA 3
   ↓
PP TINTA 4
   ↓
Decisión enológica
   ├───────────────┐
   ▼               ▼
 Joven           Crianza
   │               │
   └───────┬───────┘
           ▼
      Envasado
           │
           ▼
      Inventory
```

------------------------------------------------------------------------

# 41. Decisiones técnicas pendientes de implementación

`WORKFLOWS.md` y `API_CONTRACTS.md` ya forman parte del contrato funcional del
MVP. No deben volver a diseñarse durante la programación.

Los puntos que continúan siendo decisiones técnicas son principalmente:

-   nombres físicos de tablas y relaciones Prisma;
-   tablas asociativas necesarias para relaciones N:N;
-   reutilización de utilidades existentes de fechas, decimales, paginación y errores;
-   ubicación física del `UnitOfWork` compartido dentro de la infraestructura;
-   índices y restricciones derivadas de invariantes ya documentadas.

Estas decisiones técnicas no pueden modificar ownership, workflows, commands,
permisos ni reglas de negocio.

------------------------------------------------------------------------

# 42. Regla para implementación por IA

Antes de modificar o crear código de cualquier módulo, la IA debe
consultar:

``` text
ARCHITECTURE.md
AI_IMPLEMENTATION_RULES.md
MODULE_CONTRACT.md
DOMAIN_MODEL.md
AGGREGATES_AND_ENTITIES.md
MODULE_MAP.md
WORKFLOWS.md
API_CONTRACTS.md
```

Si una implementación propuesta requiere:

-   una nueva entidad;
-   un nuevo Aggregate Root;
-   una nueva dependencia entre módulos;
-   una nueva regla de negocio;
-   una modificación de ownership;

debe detenerse y señalar la decisión antes de inventarla.

------------------------------------------------------------------------

# 43. Definición de cierre de este documento

Con este `MODULE_MAP.md` queda establecida la siguiente estructura
conceptual para el MVP:

``` text
Logger
│
├── Core / Access Management
│
├── Articulos
│   └── Articulo
│
├── Compras
│   └── Compra
│
├── Production
│   ├── Vendimia
│   ├── Recepción
│   ├── Lotes de uva
│   ├── Procesos
│   ├── OP Maestra
│   ├── OP Transformación
│   ├── Lotes de producción
│   ├── Trabajos
│   ├── Mediciones
│   ├── Decisiones
│   ├── Transformaciones
│   ├── Tanques/Barricas
│   ├── Ocupaciones
│   ├── Movimientos de proceso
│   └── Mermas
│
└── Inventory
    ├── Almacenes
    ├── Lotes de inventario
    ├── Stock
    └── Movimientos
```

Esta estructura sustituye el mapa provisional donde Products y Purchases
aparecían como módulos finales. El maestro oficial es `Articulos`, mientras
que `Compras` queda como módulo de adquisición integrado con Inventory.

---

# 37. Alineación contractual de Production

Production es propietario de `ProductionBatch`, `Container`,
`ProductionParticipant`, consumos, outputs, transformaciones y su trazabilidad.
`ProductionParticipant` es independiente de Core/User; el actor de cada comando
proviene exclusivamente del contexto autenticado.

`GrapeReception` puede contener múltiples variedades y cantidades, generando un
batch inicial por cada variedad. `Transformation` consume uno o varios
`ProductionBatch` (nunca un `Articulo` sin identidad de batch) y genera uno o
varios `ProductionOutput`; todo output reutilizable es otro `ProductionBatch`.
Los consumos y outputs son canónicos y no se duplican dentro de
`ProductionWorkInput`.

La disponibilidad de un batch se deriva de su historial y nunca puede ser
negativa. Las divisiones crean hijos irreversibles; las mezclas crean un batch
nuevo trazable a todos sus orígenes. Un `Container` no contiene dos batches
independientes: introducir otro es una mezcla/transformación.

`ProductionOrder` y `TransformationOrder` solo tienen estados `OPEN` y
`CLOSED`; el cierre es irreversible y no existe reapertura. Los Custom Fields
son configurables, auditables y preservan valores históricos, con tipos
`TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE` y `SELECT`.

La frontera con Inventory empieza cuando el producto sale de Production. La
salida es atómica mediante `SharedUnitOfWork`: reducción del batch, output,
`InventoryLot.originProductionBatchId`, `InventoryMovement`,
`InventoryStock` y auditorías se confirman o revierten juntos. El producto en
proceso dentro de recipientes no es stock de Inventory.

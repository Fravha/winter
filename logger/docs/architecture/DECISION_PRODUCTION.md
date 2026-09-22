# Decisiones contractuales del módulo Production

## 1. Propósito y alcance

Este documento consolida las decisiones aprobadas para el diseño futuro del
módulo Production de Winter.

Production coordina transformación física, trazabilidad, cantidades de producto
en proceso, trabajos ejecutados, recipientes, mediciones, pérdidas y la salida
final hacia Inventory.

Este documento es contractual. No constituye una implementación, migración,
schema Prisma ni definición técnica final de endpoints.

Production no asume ownership de:

- `Articulo`, que pertenece a Artículos;
- `InventoryLot`, `InventoryMovement`, `InventoryStock` y almacenes, que
  pertenecen a Inventory;
- usuarios, autenticación y permisos, que pertenecen a Core/Auth;
- infraestructura central de auditoría, que pertenece a Core/Audit.

## 2. ProductionBatch

`ProductionBatch` representa una cantidad identificable y trazable de un
`Articulo` dentro del proceso productivo.

Reglas:

- Cada batch referencia un `Articulo`.
- Las etapas del proceso productivo se representan mediante Artículos, tomando
  como referencia el catálogo de Procesos y Código de Artículo de
  `listaMaestros_v1.1.xlsx`.
- Cada transformación que cambia el producto crea un nuevo `ProductionBatch`.
- Si una operación no cambia el producto, puede mantenerse el mismo batch.
- No tiene estado persistido.
- Su situación se deriva de sus cantidades y su historial.
- Puede consumirse parcialmente en distintos momentos.
- El remanente conserva la identidad del batch original.
- Nunca puede tener cantidad disponible negativa.
- Si su cantidad disponible llega a cero, continúa existiendo históricamente.
- Puede ser consumido por `ProductionOrder` posteriores sin perder su identidad
  ni trazabilidad.

### 2.1 División

- Una división física crea nuevos batches hijos.
- Los batches hijos no vuelven a convertirse en el batch original.
- Si posteriormente se mezclan, la mezcla crea un nuevo batch.

### 2.2 Mezcla

- La unión de dos o más batches genera un nuevo `ProductionBatch`.
- El nuevo batch conserva trazabilidad hacia todos sus batches de origen.
- Un recipiente nunca contiene dos batches independientes simultáneamente.

## 3. Cantidad disponible

La cantidad disponible de un `ProductionBatch` se deriva del historial
productivo.

Conceptualmente:

```text
cantidadDisponible =
  cantidadGenerada
  - cantidadConsumida
  - cantidadSeparada
  - pérdidas que afecten al batch
  - cantidad transferida fuera de Production
```

Invariante obligatorio:

```text
cantidadDisponible >= 0
```

Production nunca utiliza cantidades negativas.

## 4. Container

`Container` es una entidad propia de Production.

Reglas:

- Un batch puede existir temporalmente sin recipiente.
- En operación normal debe poder conocerse su ubicación cuando corresponda.
- Un traslado total entre recipientes mantiene el mismo batch.
- Un traslado parcial crea batches hijos.
- La capacidad es obligatoria para recipientes productivos.
- No se puede exceder la capacidad.
- Un recipiente no puede contener dos batches independientes.
- Introducir otro batch en un recipiente ocupado constituye una
  mezcla/transformación y genera un nuevo batch.

Estados y transiciones:

```text
DISPONIBLE -> OCUPADO
```

Ocurre cuando el recipiente recibe un batch.

```text
OCUPADO -> DISPONIBLE
```

Ocurre cuando el recipiente queda vacío.

`FUERA_DE_SERVICIO` bloquea nuevas ocupaciones.

## 5. Transformation

`Transformation` es una operación de dominio.

Reglas:

- Puede tener uno o varios batches de entrada.
- Puede consumir cantidades parciales.
- Puede generar uno o varios batches de salida.
- Si cambia el `Articulo`, siempre nace un nuevo batch.
- Si el producto no cambia, puede continuar el mismo batch.
- Todo output reutilizable se representa mediante `ProductionBatch`.
- No existe una entidad `Subproducto`.
- Una transformación puede generar múltiples outputs.
- La pérdida se registra explícitamente.
- Nunca se asume automáticamente que `input - output` es pérdida.
- Se aceptan diferencias entre inputs, outputs y pérdidas cuando los datos
  registrados representan cantidades reales y trazables.
- La transformación completa es atómica.
- `productionOrderId` es obligatorio y `transformationOrderId` es opcional. Si
  se proporciona este último, debe existir, pertenecer a la orden de producción
  indicada y estar `OPEN`; el backend valida la relación.

## 6. ProductionLoss

`ProductionLoss` registra una pérdida productiva explícita y auditable.

Reglas:

- Puede ser parcial o total.
- Reduce la cantidad disponible cuando afecta a un batch conocido.
- Pertenece a una `Transformation` o a un `ProductionWork`.
- Puede vincularse opcionalmente a un `ProductionBatch` conocido.
- Si no puede determinarse el batch exacto, puede permanecer asociada únicamente
  al contexto productivo correspondiente.
- Una pérdida de producto en proceso no genera `InventoryMovement`.
- Si un insumo ya salió de Inventory hacia Production, una pérdida posterior
  del insumo no genera una segunda salida de Inventory.
- Toda pérdida es explícita y auditada.

## 7. ProductionOrder

`ProductionOrder` representa el ciclo productivo principal.

Estados únicos:

```text
OPEN
CLOSED
```

Reglas:

- Todo `ProductionWork` pertenece obligatoriamente a una `ProductionOrder`.
- Puede cerrarse aunque existan `ProductionBatch` con saldo disponible.
- No puede cerrarse si tiene `TransformationOrder` abiertas, trabajos pendientes
  o transformaciones incompletas.
- `CLOSED` es irreversible.
- No existe reapertura.
- Los batches generados pueden utilizarse en `ProductionOrder` posteriores.

## 8. TransformationOrder

`TransformationOrder` representa un periodo administrativo/productivo dentro de
una `ProductionOrder`.

Estados únicos:

```text
OPEN
CLOSED
```

Reglas:

- Pertenece obligatoriamente a una `ProductionOrder`.
- Un `ProductionWork` puede relacionarse opcionalmente con una
  `TransformationOrder`.
- No puede cerrarse si tiene trabajos, transformaciones u operaciones
  productivas incompletas.
- `CLOSED` es irreversible.
- No existe reapertura.

## 9. ProductionWork

`ProductionWork` representa trabajo realmente ejecutado.

Núcleo mínimo:

- `productionOrderId`, obligatorio;
- `transformationOrderId`, opcional;
- `workTypeId`;
- `performedAt`;
- `createdAt`;
- batches relacionados, `0..N`;
- containers relacionados, `0..N`;
- participantes, `0..N`;
- observaciones opcionales;
- actor del sistema obtenido del contexto autenticado.

Reglas:

- No sustituye consumos.
- No sustituye outputs.
- No sustituye pérdidas.
- No sustituye mediciones.
- No sustituye `InventoryMovement`.
- No todo trabajo genera una `Transformation`.
- Debe distinguirse la fecha real del trabajo de la fecha de registro.
- No existe eliminación física.
- Las correcciones son explícitas y auditables.
- Los tipos de trabajo son configurables.
- El `ProductionWork` de prueba creado accidentalmente en desarrollo el
  18 de septiembre de 2026 se conserva como evidencia histórica. No se
  elimina, no se corrige y no se aísla mediante una regla administrativa.
  Su procedencia queda demostrada por su versión `0`, la ausencia de
  correcciones y sus identificadores técnicos de orden y tipo de trabajo.

## 10. ProductionParticipant

`ProductionParticipant` es una entidad operativa independiente de `User`.

Núcleo mínimo:

- `id`;
- `codigo`;
- `nombre`;
- `activo`;
- `createdAt`;
- `updatedAt`.

Reglas:

- Puede relacionarse opcionalmente con un `User`.
- No requiere un `User`.
- Un `ProductionWork` puede tener múltiples participantes.
- Cada participante puede tener un rol descriptivo configurable.
- El actor del sistema siempre es independiente del participante operativo.

## 11. Producer

Núcleo mínimo:

- `id`;
- `codigo`;
- `nombre`;
- `activo`;
- `createdAt`;
- `updatedAt`.

Reglas:

- `codigo` es único e inmutable.
- `nombre` es editable.
- Utiliza baja lógica.
- No existe borrado físico cuando hay referencias.
- Los datos adicionales se gestionan mediante campos configurables.

## 12. GrapeVariety

Núcleo mínimo:

- `id`;
- `codigo`;
- `nombre`;
- `activo`;
- `createdAt`;
- `updatedAt`.

Reglas:

- `codigo` es único e inmutable.
- `nombre` es editable.
- Utiliza baja lógica.
- No existe borrado físico cuando hay referencias.
- Los datos adicionales se gestionan mediante campos configurables.

## 13. GrapeReception

Reglas:

- Toda recepción pertenece a una `ProductionOrder`.
- Puede contener una o varias variedades.
- Cada variedad y cantidad recibida genera su propio batch inicial.
- Una recepción rechazada no ingresa a Production.
- Brix, Babo, estado sanitario y controles similares se registran mediante
  mediciones/configuración, evitando columnas rígidas cuando corresponda.
- Una recepción confirmada no se elimina.
- Las correcciones son explícitas y auditables.

Estados permitidos:

```text
ACCEPTED
ACCEPTED_WITH_OBSERVATIONS
```

El listado público de recepciones utiliza únicamente `page` y `pageSize`.
`search` y `active` no son filtros soportados; `GrapeReception` no tiene un
atributo `active`.

## 14. Measurement

Reglas:

- Puede asociarse a `ProductionBatch`, `Container`, `ProductionWork` o a una
  combinación válida.
- Tiene un `MeasurementType` configurable.
- Los tipos posibles incluyen Brix, Babo, temperatura, pH, densidad y grado
  alcohólico, entre otros.
- Las unidades son configurables.
- Conserva `measuredAt` y `createdAt`.
- El actor se obtiene del usuario autenticado.
- La persona que tomó físicamente la medición puede ser un
  `ProductionParticipant`.
- No se elimina físicamente.
- Las correcciones conservan valor original y trazabilidad.
- Puede incluir observaciones.
- No modifica automáticamente cantidades, estados ni Artículos.

## 15. Custom Fields

Winter permite campos adicionales configurables por administración sin requerir
una migración por cada campo nuevo.

Se distinguen:

- `CORE_FIELDS`;
- `CUSTOM_FIELDS`.

Los `CORE_FIELDS` son contractuales y no pueden alterarse administrativamente.

Los `CUSTOM_FIELDS` soportan inicialmente:

- `TEXT`;
- `INTEGER`;
- `DECIMAL`;
- `BOOLEAN`;
- `DATE`;
- `SELECT`.

Núcleo conceptual de `CustomFieldDefinition`:

- `entityType`;
- `code`;
- `label`;
- `dataType`;
- `required`;
- `active`;
- `options`;
- `displayOrder`;
- `createdBy`;
- `createdAt`.

Reglas:

- Solo un usuario autorizado puede administrarlos.
- No se eliminan físicamente definiciones que tengan valores históricos.
- Desactivar una definición conserva sus valores previos.
- `code` es estable.
- No puede cambiarse libremente `dataType` si existen valores.
- Hacer obligatorio un campo no invalida registros históricos.
- Todo cambio se audita.
- Un custom field no se convierte automáticamente en una regla estructural del
  dominio.

Entidades soportadas inicialmente:

- `Producer`;
- `GrapeVariety`;
- `GrapeReception`.

## 16. Frontera Production → Inventory

Mientras el producto se encuentra en proceso, `ProductionBatch` es la fuente de
verdad.

El líquido o producto en proceso ubicado en tanques o barricas no se representa
simultáneamente como `InventoryStock`.

Al salir del proceso productivo:

```text
ProductionBatch
  -> InventoryLot
  -> InventoryMovement
  -> InventoryStock
```

Reglas:

- El cruce es atómico.
- La clasificación inicial de todo `InventoryLot` liberado desde Production es
  exclusivamente `PRODUCTO_ENVASADO`. Inventory controla después sus
  transiciones a `PRODUCTO_TERMINADO` o `PRODUCTO_TERMINADO_EXPORTACION`.
- `InventoryLot` conserva `originProductionBatchId`.
- Un batch puede transferirse parcialmente a Inventory.
- Un batch puede originar varios `InventoryLot`.
- Nunca se duplica cantidad entre Production e Inventory.

La misma transacción lógica incluye, cuando corresponda:

- reducción de `ProductionBatch`;
- creación o registro del output;
- creación o reutilización de `InventoryLot`;
- persistencia de `originProductionBatchId`;
- creación de `InventoryMovement`;
- actualización de `InventoryStock`;
- auditoría de Production;
- auditoría de Inventory.

Cualquier fallo provoca rollback completo.

## 17. Integración con Artículos

Production utiliza exclusivamente `ArticulosApi`.

Production no modifica:

- `clasificacion`;
- `unidadMedida`;
- `activo`.

Las etapas productivas se representan mediante Artículos.

Debe definirse durante el diseño técnico una matriz explícita:

```text
clasificación de Articulo -> operación Production permitida
```

## 18. Actor y participantes

El actor de cualquier comando se obtiene exclusivamente del contexto
autenticado.

Nunca se aceptan desde el body como actor:

- `performedByUserId`;
- `responsibleUserId`;
- `userId`.

Si representan personas que participaron físicamente, se modelan como
`ProductionParticipant`.

## 19. Correcciones

- No existe edición destructiva de registros operativos históricos.
- No existe `DELETE` físico.
- Toda corrección exige `reason`.
- Toda corrección conserva:
  - registro original;
  - actor;
  - fecha;
  - motivo;
  - valor anterior;
  - valor corregido.

## 20. Idempotencia

Requieren idempotencia al menos:

- recepción;
- transformación;
- consumos;
- outputs;
- movimientos de batch entre recipientes;
- salida Production → Inventory.

Las claves son estables por operación lógica. Nunca se genera un UUID aleatorio
nuevo por retry.

Para `Transformation`, la unidad pública de replay es la transformación
completa: su `operationKey`/`requestHash` identifica el comando completo,
incluidas sus pérdidas. No existe retry por API independiente para una pérdida;
las claves de pérdida, si se conservan, son identificadores internos o
persistidos.

Ejemplos conceptuales:

```text
production-reception:{receptionId}
production-transformation:{transformationId}
```

## 21. Atomicidad

Production utiliza `SharedUnitOfWork`.

Toda operación crítica incluye en la misma transacción lógica:

- entidades Production;
- cantidades;
- operaciones Inventory cuando correspondan;
- auditoría.

Si la auditoría falla, la operación completa falla.

## 22. Auditoría

Se auditan al menos:

- creación y cierre de `ProductionOrder`;
- creación y cierre de `TransformationOrder`;
- `GrapeReception`;
- `ProductionWork`;
- `Transformation`;
- consumos;
- outputs;
- `ProductionLoss`;
- `Measurement` y sus correcciones;
- movimientos de recipientes;
- administración de catálogos;
- administración de custom fields.

El actor se obtiene siempre del contexto autenticado.

## 23. Permisos

Convención obligatoria:

```text
<module>:<action>
```

Base aprobada:

- `production:read`;
- `production:order_create`;
- `production:order_close`;
- `production:transformation_order_create`;
- `production:transformation_order_close`;
- `production:work_create`;
- `production:work_correct`;
- `production:reception_create`;
- `production:reception_correct`;
- `production:transformation_create`;
- `production:loss_create`;
- `production:measurement_create`;
- `production:measurement_correct`;
- `production:container_manage`;
- `production:producer_manage`;
- `production:grape_variety_manage`;
- `production:participant_manage`;
- `production:work_type_manage`;
- `production:measurement_type_manage`;
- `production:custom_fields_manage`.

No se utiliza un permiso genérico único.

`WorkType` y `MeasurementType` son catálogos administrativos con CRUD
controlado: lectura con `production:read` y altas, edición de nombre y
activación/desactivación con su permiso `*_manage` específico. No son comandos
históricos ni generan datos seed.

## 24. API HTTP

Base:

```text
/api/v1/production
```

Commands y queries se mantienen separados. No se utiliza CRUD genérico para
modificar operaciones históricas.

Commands conceptuales:

```text
POST /api/v1/production/orders
POST /api/v1/production/orders/:id/close
POST /api/v1/production/transformation-orders
POST /api/v1/production/transformation-orders/:id/close
POST /api/v1/production/works
POST /api/v1/production/works/:id/corrections
POST /api/v1/production/receptions
POST /api/v1/production/receptions/:id/corrections
POST /api/v1/production/transformations
POST /api/v1/production/measurements
POST /api/v1/production/measurements/:id/corrections
```

La definición exacta final de endpoints se deriva de este contrato durante el
diseño técnico.

Los listados utilizan paginación y filtros consistentes.

Debe existir una consulta explícita de trazabilidad equivalente a:

```text
GET /api/v1/production/batches/:id/trace
```

La consulta reconstruye:

- origen;
- batches padres;
- batches hijos;
- transformaciones;
- trabajos;
- pérdidas;
- `InventoryLot` resultante.

## 25. ProductionApi intermodular

Otros módulos no llaman controllers HTTP.

Production expone únicamente las APIs internas para las que exista una necesidad
intermodular concreta.

Base conceptual:

- `getProductionBatch`;
- `getAvailableBatchQuantity`;
- `validateProductionBatch`;
- `traceProductionBatch`.

## 26. DTOs y tipado

- No se utiliza `Promise<unknown>` como contrato público o intermodular.
- Los resultados intercambiados entre Production e Inventory son explícitamente
  tipados.
- Los DTOs no exponen modelos Prisma.
- El actor no forma parte del body.

## 27. Errores

Production utiliza errores de dominio explícitos, entre ellos:

- `PRODUCTION_ORDER_NOT_FOUND`;
- `PRODUCTION_ORDER_CLOSED`;
- `TRANSFORMATION_ORDER_CLOSED`;
- `BATCH_NOT_FOUND`;
- `INSUFFICIENT_BATCH_QUANTITY`;
- `CONTAINER_NOT_AVAILABLE`;
- `CONTAINER_CAPACITY_EXCEEDED`;
- `CONTAINER_ALREADY_OCCUPIED`;
- `INVALID_BATCH_TRANSFORMATION`;
- `INVALID_ARTICULO_CLASSIFICATION`;
- `MEASUREMENT_TYPE_INVALID`;
- `IDEMPOTENCY_CONFLICT`.

Nunca se exponen directamente errores de Prisma, PostgreSQL o Firebase.

## 28. Validación

El backend valida siempre:

- cantidades;
- unidades;
- estado de órdenes;
- disponibilidad del batch;
- capacidad del recipiente;
- ocupación;
- Artículo activo;
- clasificación;
- permisos;
- idempotencia;
- relaciones y cardinalidades.

El frontend nunca es autoridad de reglas de negocio.

## 29. Borrado y lifecycle

No se eliminan físicamente:

- `ProductionOrder`;
- `TransformationOrder`;
- `ProductionWork`;
- `ProductionBatch`;
- `GrapeReception`;
- `Transformation`;
- `ProductionLoss`;
- `Measurement`;
- correcciones;
- relaciones históricas de trazabilidad.

Los catálogos administrativos utilizan baja lógica cuando corresponda.

## 30. Objetivo funcional

Winter debe poder responder históricamente:

- qué cantidad existía de cada producto en proceso;
- en qué recipiente se encontraba;
- de qué batch provenía;
- qué transformación ocurrió;
- en qué periodo ocurrió;
- qué cantidades fueron consumidas;
- qué outputs fueron generados;
- qué pérdidas se registraron;
- qué producto terminó ingresando a Inventory;
- cuál es la trazabilidad completa desde la recepción hasta el producto final.

## 31. Contradicciones y tensiones con los contratos existentes

Esta sección registra contradicciones o tensiones detectadas. No las resuelve ni
modifica automáticamente los ocho contratos existentes.

### 31.1 Cardinalidad de variedades en GrapeReception

La decisión aprobada establece que una recepción puede contener una o varias
variedades y que cada variedad/cantidad genera su propio batch inicial.

El contrato existente presenta `grapeVarietyId` como una referencia singular y
opcional en la recepción. Debe actualizarse posteriormente el contrato de API y
el agregado para representar explícitamente la colección de variedades y sus
cantidades.

Fuentes afectadas:

- `API_CONTRACTS.md`, contrato de `GrapeReception`;
- `AGGREGATES_AND_ENTITIES.md`, agregado de recepción.

### 31.2 Actor enviado en DTOs

La decisión aprobada prohíbe aceptar el actor desde el body. Algunos contratos
existentes incluyen campos como `performedByUserId`, `responsibleUserId` o
`userId` en inputs de recepción, mediciones, movimientos u otras operaciones.

Esos campos deben eliminarse como actor o redefinirse explícitamente como
referencias a `ProductionParticipant`.

Fuentes afectadas:

- `API_CONTRACTS.md`, reglas generales de actor y varios DTOs de Production;
- `AI_IMPLEMENTATION_RULES.md`, actor derivado del contexto autenticado.

### 31.3 ProductionParticipant frente a participantes no modelados

Los contratos existentes reconocen participantes operativos, pero no consolidan
el núcleo, lifecycle y relación opcional con `User` definidos aquí.

La decisión aprobada establece una entidad propia `ProductionParticipant`.
Los contratos de agregados y APIs deben alinearse posteriormente sin convertir
participantes en actores del sistema.

Fuentes afectadas:

- `DOMAIN_MODEL.md`;
- `AGGREGATES_AND_ENTITIES.md`;
- `API_CONTRACTS.md`.

### 31.4 ProductionConsumption y ProductionOutput

Los contratos existentes utilizan conceptos como `ProductionWorkInput`,
`TrabajoInsumo`, `TransformationOutput` y la operación Inventory
`registerProductionOutput`, sin consolidar necesariamente entidades canónicas
independientes llamadas `ProductionConsumption` y `ProductionOutput`.

Este documento aprueba las reglas operativas de consumos y outputs, pero no
declara que ambos deban convertirse en entidades persistidas independientes.
El diseño técnico debe mantener esa distinción.

Fuentes afectadas:

- `AGGREGATES_AND_ENTITIES.md`;
- `MODULE_MAP.md`;
- `API_CONTRACTS.md`.

### 31.5 Inputs de Transformation

La decisión aprobada define los inputs de una transformación como uno o varios
`ProductionBatch`. El contrato de API existente permite inputs opcionales por
`productionBatchId` o directamente por `articuloId`, sin una regla completa de
exclusión y coherencia.

El diseño técnico debe alinear el DTO con batches trazables y no introducir
inputs de Artículo sin identidad productiva.

Fuente afectada:

- `API_CONTRACTS.md`, contrato de transformación.

### 31.6 Salida Production → Inventory

Este documento exige que `InventoryLot.originProductionBatchId` se conserve y
que la reducción del batch, output, lote, movimiento, stock y ambas auditorías
formen una única transacción lógica.

Los contratos existentes describen la frontera y la API de Inventory, pero no
definen de forma completa el resultado tipado ni el contexto transaccional
compartido para toda esta operación.

Fuentes afectadas:

- `ARCHITECTURE.md`;
- `MODULE_CONTRACT.md`;
- `API_CONTRACTS.md`.

### 31.7 Matriz clasificación de Artículo → operación Production

Los contratos existentes definen el ownership y las clasificaciones de
Artículo, pero no contienen todavía la matriz explícita requerida por esta
decisión.

No es una contradicción de regla; es una definición contractual pendiente que
debe resolverse durante el diseño técnico antes de implementar validaciones
productivas.

Fuentes afectadas:

- `AI_IMPLEMENTATION_RULES.md`;
- `DOMAIN_MODEL.md`;
- `API_CONTRACTS.md`.

### 31.8 Estados y cierres de órdenes

Los contratos existentes describen órdenes y operaciones de cierre, pero no
consolidan todas las precondiciones e irreversibilidad aprobadas aquí.

Este documento fija `OPEN` y `CLOSED` como únicos estados, prohíbe reapertura y
define bloqueos mínimos para el cierre. Los demás contratos deben alinearse
posteriormente.

Fuentes afectadas:

- `AGGREGATES_AND_ENTITIES.md`;
- `MODULE_CONTRACT.md`;
- `API_CONTRACTS.md`.

### 31.9 Custom Fields

Los contratos existentes permiten información configurable, pero no consolidan
un contrato uniforme de `CustomFieldDefinition`, tipos iniciales, estabilidad
de código y preservación histórica como el definido aquí.

Esto amplía y concreta el contrato; no autoriza que un custom field sustituya
invariantes, relaciones o reglas estructurales del dominio.

Fuentes afectadas:

- `DOMAIN_MODEL.md`;
- `MODULE_CONTRACT.md`;
- `API_CONTRACTS.md`.

## 32. Precedencia y trabajo posterior

Este documento consolida decisiones aprobadas y debe utilizarse como fuente
contractual para el diseño técnico de Production.

Las contradicciones enumeradas deben resolverse mediante una actualización
explícita y revisada de los contratos afectados. No deben resolverse
silenciosamente durante la implementación.

Hasta completar el diseño técnico:

- no se infieren campos adicionales;
- no se agregan estados;
- no se inventan permisos;
- no se crean endpoints adicionales;
- no se modifican contratos de otros módulos;
- no se implementa Production.
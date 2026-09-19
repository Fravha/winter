# Winter / Logger — AGGREGATES_AND_ENTITIES.md

## 1. Propósito

Este documento define la distribución de entidades y agregados del dominio de Winter para Bodega Cruce del Zorro.

Su objetivo es convertir el `DOMAIN_MODEL.md` en una estructura implementable respetando la arquitectura modular de Logger.

Este documento define:

- módulo propietario de cada entidad;
- responsabilidad de cada módulo;
- Aggregate Roots;
- entidades internas de los agregados;
- referencias entre módulos;
- límites de ownership;
- reglas para evitar duplicación de dominio;
- dependencias entre módulos.

No es todavía un esquema Prisma definitivo. Los nombres y relaciones aquí definidos constituyen el contrato de dominio que deberá utilizarse para diseñar persistencia, servicios, APIs públicas y casos de uso.

---

# 2. Principio fundamental: ownership

Cada entidad tiene un único módulo propietario.

El módulo propietario es el único responsable de:

- crear la entidad;
- modificarla;
- aplicar sus reglas;
- controlar sus estados;
- persistirla;
- exponer operaciones públicas sobre ella.

Otro módulo puede **referenciar** una entidad, pero no puede acceder directamente a su repository, service, modelo Prisma o tablas.

Regla arquitectónica:

```text
Módulo A
   |
   | Public API
   v
Módulo B
```

Nunca:

```text
Módulo A
   |
   X
Repository / Prisma de Módulo B
```

---

# 3. Módulos involucrados

El dominio MVP utilizará principalmente estos módulos:

```text
core / access-management
articulos
compras
production
inventory
```

Products y Purchases pertenecieron al proyecto Logger y fueron retirados del
runtime de Winter una vez implementados Articulos y Compras. No son módulos
disponibles ni ownership del dominio final.

No se crea un módulo `Assets` para el MVP.

Los tanques y barricas se consideran recursos operativos de Production porque su función actual es controlar dónde se encuentra el producto en proceso y durante cuánto tiempo.

Un módulo de activos completo podrá agregarse posteriormente para mantenimiento, depreciación, vida útil financiera y otros aspectos patrimoniales.

---

# 4. Mapa general de ownership

```text
CORE / ACCESS MANAGEMENT
├── User
├── Role
├── Permission
└── Audit

ARTICULOS
└── Articulo

COMPRAS
├── Compra
├── CompraItem
└── demás entidades existentes de compras

PRODUCTION
├── Vendimia
├── RecepcionUva
├── LoteUva
├── ProcesoProduccion
├── LineaProduccion
├── TipoTrabajoProduccion
├── TipoTransformacion
├── TipoMedicion
├── TipoMerma
├── Producer
├── GrapeVariety
├── OrdenProduccion
├── OrdenTransformacion
├── LoteProduccion
├── TrabajoProduccion
├── TrabajoInsumo
├── MedicionProduccion
├── DecisionProduccion
├── OcupacionRecipiente
├── MovimientoProceso
├── Transformacion
├── EntradaTransformacion
├── SalidaTransformacion
├── MermaProduccion
└── Recipiente

INVENTORY
├── Almacen
├── LoteInventario
├── Stock
└── MovimientoInventario
```

Los nombres conceptuales están expresados en español para mantener la semántica del negocio. La implementación TypeScript puede utilizar los nombres equivalentes definidos por la convención de código del proyecto.

---

# 5. Articulos

## 5.1. Responsabilidad

Articulos es responsable del maestro único de artículos de Winter.

### Regla de negocio clave

**`Articulo` es el catálogo único de todo lo que la bodega identifica como artículo.**

No se crean entidades independientes para:

- insumos;
- materias primas catalogadas;
- productos intermedios;
- productos envasados;
- productos terminados;
- artículos de empaque;
- otros artículos.

Todo se registra mediante `Articulo` y su clasificación correspondiente.

---

## 5.2. Aggregate Root: `Articulo`

### Propósito

Representar un artículo definido en el maestro de artículos.

Ejemplos:

```text
Uva Syrah
Metabisulfito
PP TINTA 1
PP TINTA 2
PP TINTA 3
PP TINTA 4
PP TINTA CRIANZA 5.4
Vino La Curiosa Tannat
Botella 750 ml
Etiqueta La Curiosa
Caja
...
```

### Datos conceptuales

```text
id
codigo
nombre
clasificacion
unidad
estado
metadatos propios del catálogo
createdAt
updatedAt
```

El módulo oficial `Articulos` de Winter tiene su propio ownership, contratos y
persistencia.

### Ownership

`Articulos` es el único dueño de `Articulo`.

### Production

Production referencia artículos mediante `articuloId`.

No crea una entidad de insumo duplicada.

---

# 6. Compras

Compras es el módulo final de Winter responsable de adquisiciones y sus
documentos. El módulo legacy `purchases` fue retirado y no ofrece una API de
compatibilidad.

Production no administra compras.

Cuando un insumo adquirido debe ser consumido durante producción, el flujo conceptual es:

```text
Compras
   ↓
Inventory
   ↓
Production
```

Production utiliza `Articulo` para identificar el insumo y solicita/declara el consumo mediante la API pública de Inventory.

Production no modifica directamente compras ni sus tablas.

---

# 7. Production

Production es el módulo propietario del proceso productivo.

Su responsabilidad es representar:

- vendimia;
- recepción y origen de la materia prima;
- proceso productivo;
- órdenes de producción;
- órdenes de transformación;
- lotes físicos en proceso;
- trabajos realizados;
- transformaciones;
- movimientos entre recipientes;
- ocupaciones de tanques y barricas;
- controles y mediciones;
- decisiones del personal enológico;
- mermas;
- insumos utilizados durante los trabajos;
- producción de vinos y singanis.

Production controla el producto mientras está **en proceso físico**.

No controla stock de almacén.

---

# 8. Aggregate Root: `Vendimia`

## Propósito

Representar una única campaña anual de cosecha y su contexto de planificación.

Solo existe una vendimia por año en el modelo actual.

La vendimia puede planificarse con anticipación para conocer productores y cantidades esperadas antes del inicio de la recepción física.

### Datos conceptuales

```text
id
codigo
nombre
anio
estado
fechaInicio
fechaFin
observaciones
createdAt
updatedAt
```

### Estados iniciales

```text
PLANIFICADA
EN_CURSO
CERRADA
```

El diseño debe permitir ampliar el catálogo de estados en el futuro.

### Relaciones

```text
Vendimia 1 ─── N RecepcionUva
```

### Invariante

No debe existir más de una vendimia para el mismo año.

---

# 9. Aggregate Root: `RecepcionUva`

## Propósito

Representar un ingreso físico real de uva a la bodega.

Una recepción pertenece a un solo productor y puede contener una o varias
variedades; cada variedad/cantidad genera un batch inicial independiente.

### Datos conceptuales

```text
id
codigo
vendimiaId
producerId
varieties: variedad + cantidad recibida (1..N)
fechaHora
pesoSolicitado
pesoRecibido
gradoAlcoholico
brix
calidad
estado
observaciones
actor autenticado (fuera del body)
createdAt
updatedAt
```

### Estados iniciales

```text
ACEPTADA
ACEPTADA_CON_OBSERVACIONES
```

No existe una recepción `RECHAZADA` en el MVP porque la uva completamente rechazada no se pesa ni se incorpora al registro de recepción.

### Relaciones

```text
Vendimia 1 ─── N RecepcionUva
RecepcionUva 1 ─── N LoteUva
```

### Invariante

Una recepción representa un único ingreso físico de un único productor.

Una entrega posterior del mismo productor debe registrarse como otra recepción aunque ocurra dentro de la misma vendimia.

---

# 10. `LoteUva`

## Tipo

Entidad de producción asociada a una recepción.

## Propósito

Representar una porción identificable de materia prima de la recepción y conservar su referencia de origen.

### Datos conceptuales

```text
id
recepcionId
codigo
variedad
calidad
cantidadKg
observaciones
```

### Nota de dominio

La uva se controla en kilogramos durante recepción.

Después del prensado, el seguimiento operativo pasa a volumen líquido y a `LoteProduccion`.

La trazabilidad requerida no busca mantener una genealogía matemática de cada litro hasta cada kilogramo original.

`LoteUva` responde principalmente:

> ¿De qué recepción y materia prima provino este proceso?

---

# 11. Aggregate Root: `ProcesoProduccion`

## Propósito

Representar el proceso maestro de elaboración definido para una línea/producto.

Un proceso contiene una ruta posible, pero no impone una secuencia rígida al equipo enológico.

### Ejemplos

```text
ELABORACION VINO TINTO
ELABORACION SINGANI
```

### Datos conceptuales

```text
id
codigo
nombre
lineaProduccionId
estado
observaciones
```

El proceso maestro sirve de referencia para las órdenes y rutas que se ejecutan realmente.

---

# 12. `LineaProduccion`

## Tipo

Maestro perteneciente a Production.

## Ejemplos

```text
VINO JOVEN
VINO CRIANZA
SINGANI
...
```

Su finalidad es clasificar y organizar la producción sin determinar por sí sola el producto final concreto.

---

# 13. Maestros operativos de Production

Los siguientes son catálogos propiedad de Production:

```text
Producer
GrapeVariety
TipoTrabajoProduccion
TipoTransformacion
TipoMedicion
TipoMerma
```

`RecepcionUva` referencia `Producer` y `GrapeVariety` por ID. No deben
representarse como texto libre, como `Articulo` ni como entidades de Core.

Todos los catálogos deben poder ampliarse sin modificar las reglas centrales
del proceso. Los campos de negocio exactos de `Producer` y `GrapeVariety`
deben definirse en el diseño de Production antes de crear su esquema Prisma;
la IA no puede inventarlos.

---

# 14. Aggregate Root: `OrdenProduccion`

## Propósito

Representar la OP maestra que responde:

> **¿De dónde nació este producto?**

Es el contexto general de una producción derivada de la materia prima de la vendimia.

### Datos conceptuales

```text
id
codigo
vendimiaId
procesoProduccionId
lineaProduccionId
articuloObjetivoId
estado
fechaInicio
fechaFin
observaciones
```

### Relaciones principales

```text
Vendimia 1 ─── N OrdenProduccion
ProcesoProduccion 1 ─── N OrdenProduccion
OrdenProduccion 1 ─── N OrdenTransformacion
OrdenProduccion 1 ─── N LoteProduccion
```

### Importante

Una OP puede producir múltiples productos intermedios a lo largo de su evolución:

```text
PP TINTA 1
   ↓
PP TINTA 2
   ↓
PP TINTA 3
   ↓
PP TINTA 4
   ↓
PP TINTA 5.4 / PP TINTA CRIANZA 5.4
   ↓
Producto terminado
```

El `articuloObjetivoId` representa el producto que actualmente se pretende fabricar/reportar como objetivo principal, pero las transformaciones intermedias son parte del proceso real.

---

# 15. Aggregate Root / entidad principal: `OrdenTransformacion`

## Propósito

Representar la orden hija de la OP maestra que responde:

> **¿Qué hicimos con determinada cantidad de producto durante este periodo?**

Es el registro periódico de una transformación reportable y de las ejecuciones relacionadas.

### Relación

```text
OrdenProduccion 1 ─── N OrdenTransformacion
```

### Datos conceptuales

```text
id
ordenProduccionId
codigo
periodo
estado
fechaInicio
fechaFin
observaciones
```

### Papel dentro del dominio

Una orden de transformación puede agrupar:

- trabajos;
- transformaciones;
- mediciones;
- decisiones;
- mermas;
- consumos de insumos;
- resultados físicos.

No debe convertirse en una receta rígida.

---

# 16. Aggregate Root: `LoteProduccion`

## Propósito

Representar una cantidad física concreta de un `Articulo` que está siendo producida/procesada.

Este concepto es fundamental para diferenciar:

```text
Articulo
    = qué es

LoteProduccion
    = qué cantidad concreta de ese artículo existe dentro de una producción
```

### Ejemplo

```text
Articulo: PP TINTA 1

LoteProduccion:
PB-2026-001
900 L
OP-2026-001
```

### Datos conceptuales

```text
id
codigo
ordenProduccionId
articuloId
cantidadGenerada (disponibilidad derivada del historial)
unidad
fechaCreacion
observaciones
```

### Relaciones

```text
OrdenProduccion 1 ─── N LoteProduccion
Articulo 1 ─── N LoteProduccion
LoteProduccion 1 ─── N OcupacionRecipiente
```

### Reglas

- Puede distribuirse entre varios recipientes.
- Puede sufrir entradas, retiros, movimientos y mermas.
- Puede convertirse en otro lote mediante una transformación.
- Puede combinarse con otros lotes durante un corte/ensamble.
- No tiene estado persistido ni cantidad disponible negativa. Una división crea
  batches hijos irreversibles y una mezcla crea un batch nuevo trazable a todos
  sus orígenes.
- No implica genealogía completa hasta cada lote de uva.

---

# 17. `TrabajoProduccion`

## Tipo

Entidad de ejecución asociada a una orden de transformación.

## Propósito

Registrar una actividad que realmente se realizó.

Ejemplos:

```text
Trasiego
Clarificación
Filtración
Embotellado
Etiquetado
Control final
Destilación
Rebaje
...
```

### Datos conceptuales

```text
id
ordenTransformacionId
tipoTrabajoId
fechaHora
actorUserId
observaciones
```

### Contexto físico

Un trabajo puede relacionarse directamente con:

```text
1..N ProductionBatch
1..N Container
```

Las dos relaciones son opcionales según la naturaleza del trabajo. Un trabajo
puede tener contexto de lote, de recipiente, de ambos o no requerir contexto
físico directo.

La forma física de persistir estas relaciones N:N se definirá en Prisma; no
cambia el ownership del dominio.

Las cantidades, movimientos, mediciones y mermas continúan perteneciendo a
sus entidades específicas y no deben duplicarse dentro de `TrabajoProduccion`.

### Participantes

`actorUserId` identifica al usuario autenticado que registra o modifica la
operación.

Adicionalmente, un trabajo puede relacionarse con múltiples
`ProductionParticipant`, entidad operativa independiente de `User`, con relación
opcional a `User` y rol descriptivo configurable. No concede permisos.

No se modelan todavía supervisor y autorizador.

### Regla

Un trabajo no se cancela ni se anula.

Si no se realizó, no se registra.

---

# 18. `TrabajoInsumo`

## Tipo

Entidad asociada a `TrabajoProduccion`.

## Propósito

Registrar los artículos/insumos consumidos durante los trabajos que realmente utilizan insumos.

### Datos conceptuales

```text
id
trabajoProduccionId
articuloId
inventoryLotId
cantidad
unidad
```

`articuloId` referencia el maestro de `Articulo`.

`inventoryLotId` referencia la existencia física que será consumida cuando aplique.

### Regla de ownership

Production registra el requerimiento/consumo productivo, pero Inventory es dueño de la existencia y del movimiento de stock.

Production nunca modifica directamente `Stock` ni `MovimientoInventario`.

---

# 19. `MedicionProduccion`

## Tipo

Entidad de control asociada a la operación productiva.

## Propósito

Registrar controles repetidos sobre un lote, recipiente o ejecución.

### Tipos iniciales

```text
TEMPERATURA
BRIX
GRADO_ALCOHOLICO
PH
ACIDEZ
DENSIDAD
SO2
VOLUMEN
GRADO_BAUME
OTRO
```

### Datos conceptuales

```text
id
loteProduccionId
recipienteId
trabajoProduccionId
tipoMedicionId
valor
unidad
fechaHora
userId
observaciones
```

No todos los campos de asociación son obligatorios simultáneamente; la medición debe poder vincularse al contexto exacto donde fue tomada.

---

# 20. `DecisionProduccion`

## Tipo

Entidad de decisión productiva/enológica.

## Propósito

Registrar decisiones que afectan la dirección de la producción sin convertir el sistema en un flujo rígido.

### Ejemplos

```text
CAMBIO_RUTA
CAMBIO_PRODUCTO_OBJETIVO
ENVIAR_A_CRIANZA
ENVIAR_A_JOVEN
REALIZAR_CORTE
AGREGAR_INSUMO
QUITAR
AGREGAR
CAMBIAR_RECIPIENTE
DETENER_PROCESO
CONTINUAR_PROCESO
```

### Datos conceptuales

```text
id
ordenProduccionId
loteProduccionId
tipoDecision
fechaHora
userId
observaciones
```

### Autoría

La decisión puede ser registrada por:

- enólogo;
- ayudante;
- administración.

Esto describe quién la registra.

La política de permisos podrá exigir que la decisión de negocio solo sea considerada válida cuando corresponda al personal autorizado, según la regla definida por Production.

---

# 21. Aggregate Root: `Recipiente`

## Propósito

Representar tanques y barricas como recursos físicos de producción.

### Datos conceptuales

```text
id
codigo
nombre
tipo
capacidad
material
ubicacion
propietario
estado
tipoTostado
numeroUsos
fechaAdquisicion
observaciones
```

### Tipos

```text
TANQUE
BARRICA
```

El catálogo puede ampliarse posteriormente si aparecen otros recipientes relevantes.

### Estados iniciales

```text
DISPONIBLE
OCUPADO
FUERA_DE_SERVICIO
```

### Reglas

- La capacidad no debe superarse.
- El sistema debe permitir retirar producto antes de volver a agregarlo.
- Una barrica incrementa su contador de uso cuando un producto entra en ella para una nueva utilización.
- El sistema registra los usos pero no decide automáticamente si una barrica todavía es utilizable.
- La decisión de continuar utilizando una barrica corresponde al enólogo.

---

# 22. `OcupacionRecipiente`

## Tipo

Entidad de relación histórica entre un `LoteProduccion` y un `Recipiente`.

## Propósito

Registrar el tiempo y volumen que un lote permaneció en un recipiente.

### Datos conceptuales

```text
id
recipienteId
loteProduccionId
fechaEntrada
fechaSalida
volumenInicial
volumenFinal
observaciones
```

### Reglas

- Un lote puede ocupar varios recipientes.
- Un producto puede estar simultáneamente distribuido entre varios recipientes.
- Un recipiente no puede contener dos batches independientes simultáneamente;
  introducir otro batch es una mezcla/transformación y genera uno nuevo.
- La salida parcial de volumen no necesariamente termina la ocupación.

No existe la obligación de construir una consulta histórica especializada del tipo “qué había exactamente en el tanque X entre dos fechas”; basta con conservar correctamente las ocupaciones y movimientos para poder derivarla en consultas futuras.

---

# 23. `MovimientoProceso`

## Tipo

Entidad de movimiento físico de producto en proceso.

## Propósito

Registrar traslados y movimientos asociados a los trabajos de producción.

### Ejemplos

```text
Tanque A → Tanque B
Tanque A → Barrica
Barrica → Tanque
Tanque A → Embotellado
```

### Datos conceptuales

```text
id
loteProduccionId
trabajoProduccionId
fechaHora
recipienteOrigenId
recipienteDestinoId
cantidad
unidad
motivo
userId
observaciones
```

Los movimientos pueden coexistir con mermas derivadas de la misma actividad.

---

# 24. Aggregate Root: `Transformacion`

## Propósito

Representar una transformación estructurada registrada para una orden de transformación.

No se trata de una transformación completamente libre o arbitraria: utiliza un `TipoTransformacion` del maestro de Production.

### Ejemplos

```text
PRENSADO
DESCUBE
TRASIEGO
FILTRACION
CLARIFICACION
CORTE
FRACCIONAMIENTO
EMBOTELLADO
DESTILACION
REBAJE
...
```

### Datos conceptuales

```text
id
ordenTransformacionId
tipoTransformacionId
fechaHora
userId
observaciones
```

### Entradas y salidas

```text
Transformacion 1 ─── N EntradaTransformacion
Transformacion 1 ─── N SalidaTransformacion
```

---

# 25. `EntradaTransformacion`

## Propósito

Indicar qué cantidades de lotes de producción participaron en una transformación.

### Datos conceptuales

```text
id
transformacionId
loteProduccionId
cantidad
unidad
```

Una transformación puede tener múltiples entradas.

Esto permite representar cortes/ensambles sin exigir una fórmula rígida.

---

# 26. `SalidaTransformacion`

## Propósito

Indicar qué lotes de producción/resultados se generan desde una transformación.

### Datos conceptuales

```text
id
transformacionId
loteProduccionId
cantidad
unidad
```

Una transformación puede tener múltiples salidas.

---

# 27. `MermaProduccion`

## Tipo

Entidad de resultado productivo asociado a una ejecución/proceso.

## Propósito

Registrar pérdidas sin obligar al operario a registrar pequeñas pérdidas gota a gota en cada trabajo.

### Datos conceptuales

```text
id
ordenProduccionId
ordenTransformacionId
loteProduccionId
trabajoProduccionId
cantidad
unidad
tipoMermaId
fechaHora
userId
observaciones
```

### Tipos iniciales

```text
OPERATIVA
VENCIMIENTO
EVAPORACION
TRASIEGO
FILTRACION
DERRAME
ANALISIS
DESCARTE
BORRA
COLAS
OTRO
```

El catálogo debe ser configurable.

### Regla

La merma se registra con contexto suficiente para saber:

- en qué producción ocurrió;
- en qué orden/trabajo ocurrió;
- qué tipo de merma fue;
- qué cantidad se perdió.

No se exige un registro individual de cada pequeña pérdida operativa.

---

# 28. Singani dentro de Production

Singani no necesita un módulo separado.

Utiliza las mismas entidades de Production, con operaciones específicas de destilación.

La transformación de destilación puede generar fracciones:

```text
CABEZA
CORAZON
COLA
```

### Reglas

```text
CABEZA
→ puede almacenarse y reutilizarse en una segunda destilación

CORAZON
→ resultado principal de la destilación

COLA
→ se desecha
```

Se deben conservar al menos:

```text
volumen
grado alcohólico
fecha
responsable
resultado/destino
```

Cuando las cabezas vuelven a producción, se convierten en una entrada de una transformación posterior.

---

# 29. Crianza dentro de Production

No se crea una entidad independiente llamada `Crianza`.

La crianza se representa mediante la combinación de:

```text
LoteProduccion
OcupacionRecipiente
MedicionProduccion
TrabajoProduccion
DecisionProduccion
MovimientoProceso
MermaProduccion
```

Esto permite registrar:

- entrada a barrica;
- volumen inicial;
- controles periódicos;
- ajustes/adiciones/retiros;
- permanencia;
- salida;
- volumen final;
- decisión de finalizar crianza.

El cambio de ruta hacia joven/crianza queda registrado como decisión del proceso.

---

# 30. Embotellado, etiquetado y control final

No se crean agregados independientes para estas operaciones en el MVP.

Se representan como `TrabajoProduccion` con tipos específicos:

```text
EMBOTELLADO
ETIQUETADO
CONTROL_FINAL
```

Pueden registrar:

- fecha;
- volumen de entrada;
- cantidad producida;
- formato;
- pérdidas;
- personas involucradas;
- observaciones.

El resultado del embotellado genera un lote que pasa al ámbito de Inventory.

---

# 31. Articulos / Production / Inventory: frontera de estados físicos

La frontera funcional es:

```text
                    ARTICULOS
                         │
                     Articulo
                         │
                         ▼
                    PRODUCTION
                         │
              producto en proceso
                         │
              tanques / barricas
                         │
                         ▼
                    EMBOTELLADO
                         │
                         ▼
                    INVENTORY
                         │
                         ▼
             InventoryLot PRODUCTO_ENVASADO
                         │
                         ▼
              Etiquetado + Control final
                         │
                         ▼
       transitionInventoryLotClassification
                         │
                         ▼
             InventoryLot PRODUCTO_TERMINADO
```

El líquido dentro de tanques y barricas **no es stock de Inventory**.

---

# 32. Inventory

## 32.1. Responsabilidad

Inventory administra existencias físicas en almacenes.

Esto incluye:

- insumos adquiridos;
- materiales;
- productos envasados;
- productos terminados;
- productos clasificados para exportación;
- movimientos físicos de almacén.

---

# 33. Aggregate Root: `Almacen`

## Propósito

Representar un espacio físico de almacenamiento.

### Datos conceptuales

```text
id
codigo
nombre
tipo
ubicacion
propietario
estado
encargadoUserId
observaciones
```

Un almacén externo, como `Almacen Lopez`, puede modelarse igual que uno propio y utilizar la propiedad correspondiente.

No se requiere una entidad adicional de propietarios.

---

# 34. Aggregate Root: `LoteInventario`

## Propósito

Representar una existencia identificable de un `Articulo` almacenada en Inventory.

Desde el envasado se genera un lote de inventario.

### Ejemplo

```text
Articulo:
PT Vino La Curiosa Tannat

LoteInventario:
INV-2026-0045
2.400 botellas
```

### Datos conceptuales

```text
id
codigo
articuloId
origenProductionBatchId
almacenId
cantidad
unidad
clasificacion
estado
fechaIngreso
observaciones
```

### Estados/clasificaciones conceptuales

```text
PRODUCTO_ENVASADO
PRODUCTO_TERMINADO
PRODUCTO_TERMINADO_EXPORTACION
```

El diseño debe distinguir claramente estado/clasificación física de una eventual futura operación comercial.

### Reglas

- Se crea/ingresa al dominio de Inventory desde el envasado con clasificación `PRODUCTO_ENVASADO`.
- Puede ubicarse lógicamente en un almacén de producto envasado distinto del almacén de producto terminado aunque ambos correspondan al mismo lugar físico.
- Puede dividirse entre almacenes/destinos mediante movimientos.
- La transición `PRODUCTO_ENVASADO -> PRODUCTO_TERMINADO` se realiza mediante `transitionInventoryLotClassification`; no se edita directamente el lote.
- Las clasificaciones de exportación reutilizan el mismo command y conservan la trazabilidad del lote de origen.
- Las operaciones de laboratorio/análisis sobre producto almacenado pueden generar movimientos de inventario.

---

# 35. `Stock`

## Tipo

Entidad/modelo de saldo de Inventory.

## Responsabilidad

Representar el saldo disponible de un artículo/lote en un almacén.

El saldo debe derivarse o mantenerse de forma consistente con los movimientos de inventario según la implementación definitiva del módulo Inventory.

Production no escribe este saldo directamente.

---

# 36. Aggregate Root: `MovimientoInventario`

## Propósito

Representar cambios de existencia en almacenes.

### Casos

```text
INGRESO
SALIDA
TRANSFERENCIA
AJUSTE
MERMA
VENCIMIENTO
ANALISIS
OTRO
```

### Regla importante

No todos los movimientos de inventario están relacionados con Production.

Ejemplos:

```text
Compra de insumo
Pérdida por vencimiento
Ajuste de stock
Análisis de laboratorio
Transferencia de almacén
Consumo para producción
```

Cuando el movimiento sí está relacionado con producción, puede llevar referencias opcionales a:

```text
ordenProduccionId
ordenTransformacionId
trabajoProduccionId
loteProduccionId
```

Inventory continúa siendo el dueño del movimiento.

---

# 37. Relación Production ↔ Inventory

La relación entre ambos módulos debe seguir esta regla:

```text
Production
    |
    | solicita / registra consumo o resultado
    v
Inventory API
    |
    v
Inventory Movement
```

Production no accede directamente a:

```text
InventoryStock
InventoryLotRepository
Prisma Inventory
Inventory tables
```

### Ejemplo: consumo de clarificante

```text
Trabajo Producción
      ↓
TrabajoInsumo
      ↓
Inventory API
      ↓
MovimientoInventario (SALIDA)
      ↓
Stock actualizado
```

---

# 38. Relación Production ↔ Articulos

Production referencia el maestro mediante `Articulo`.

Ejemplo:

```text
LoteProduccion
    |
    └── articuloId
            ↓
        Articulos.Articulo
```

No se duplica:

```text
Product
Supply
FinishedProduct
IntermediateProduct
```

El sistema tiene un único maestro:

```text
Articulo
```

La clasificación del artículo determina cómo se utiliza/catalogaloga, mientras que Production/Inventory representan su existencia dentro de un proceso o almacén.

---

# 39. Relación Production ↔ Access Management

Production no crea entidades de usuario, roles, permisos ni un agregado
`Person` propio.

El actor autenticado se identifica mediante `User.id`. Las operaciones que
requieren registrar responsabilidad utilizan esa referencia.

Ejemplos:

```text
TrabajoProduccion.actorUserId
MedicionProduccion.userId
DecisionProduccion.userId
MermaProduccion.userId
MovimientoProceso.userId
```

Los participantes físicos adicionales de un trabajo se conservan como lista
operativa dentro del contexto del trabajo y no como usuarios del sistema.

La autorización se resuelve mediante el sistema de acceso de Logger.

La auditoría se realiza mediante la infraestructura de Logger.

---

# 40. Relaciones principales del dominio

```text
Vendimia
   │
   └── RecepcionUva
          │
          └── LoteUva

Vendimia
   │
   └── OrdenProduccion
          │
          ├── OrdenTransformacion
          │      ├── TrabajoProduccion
          │      │      └── TrabajoInsumo
          │      ├── Transformacion
          │      │      ├── EntradaTransformacion
          │      │      └── SalidaTransformacion
          │      ├── MedicionProduccion
          │      ├── DecisionProduccion
          │      └── MermaProduccion
          │
          └── LoteProduccion
                 │
                 ├── OcupacionRecipiente
                 ├── MovimientoProceso
                 └── Transformaciones

LoteProduccion
      │
      └── articuloId → Articulos.Articulo

LoteProduccion
      │
      └── EMBOTELLADO
              │
              ▼
        Inventory.LoteInventario
              │
              ├── Almacen
              ├── Stock
              └── MovimientoInventario
```

---

# 41. Aggregate boundaries

Los siguientes Aggregate Roots iniciales quedan definidos para Winter:

## Production

```text
Vendimia
RecepcionUva
ProcesoProduccion
OrdenProduccion
OrdenTransformacion
LoteProduccion
Recipiente
Transformacion
```

Los catálogos operativos (`LineaProduccion`, `TipoTrabajoProduccion`, `TipoTransformacion`, `TipoMedicion`, `TipoMerma`) se comportan como entidades de referencia/maestros del módulo.

Las entidades de detalle (`LoteUva`, `TrabajoProduccion`, `TrabajoInsumo`, `MedicionProduccion`, `DecisionProduccion`, `OcupacionRecipiente`, `MovimientoProceso`, `EntradaTransformacion`, `SalidaTransformacion`, `MermaProduccion`) pertenecen al contexto productivo y no deben convertirse en módulos independientes.

## Inventory

```text
Almacen
LoteInventario
MovimientoInventario
```

`Stock` representa el saldo/existencia y su forma exacta de persistencia podrá ser determinada por Inventory.

## Articulos

```text
Articulo
```

## Access Management

```text
User
Role
Permission
Audit
```

---

# 42. Regla sobre aggregates y transacciones

Una operación que afecte a más de un Aggregate Root debe utilizar el mecanismo transaccional/UoW apropiado.

Ejemplo:

```text
Trasiego

LoteProduccion
      ↓
OcupacionRecipiente
      ↓
MovimientoProceso
      ↓
MermaProduccion
      ↓
Auditoría
```

Otra operación:

```text
Embotellado

Production
      ↓
resultado del trabajo
      ↓
Inventory API
      ↓
LoteInventario
      ↓
MovimientoInventario
      ↓
Auditoría
```

El objetivo es evitar estados parcialmente registrados.

Para operaciones que crucen Production, Inventory y Audit se utilizará el
`UnitOfWork` compartido de infraestructura definido por `ARCHITECTURE.md`. El
componente solamente administra el contexto transaccional y no conoce reglas
de negocio ni reemplaza las APIs públicas de los módulos.

---

# 43. Lo que NO forma parte del modelo MVP

No crear todavía entidades para:

```text
Recipe / Receta rígida
ProductionCost
LaborCost
Depreciation
Maintenance
Employee / HR completo
SupplierContract completo
Genealogía detallada litro-a-litro
Inventory de líquido dentro de tanques
Workflow rígido obligatorio
Schedule de producción
Asignación futura de tareas a trabajadores
```

La planificación anticipada de productores/cantidades para una vendimia puede evolucionar posteriormente a un agregado específico, pero no se introduce en este documento hasta que exista una regla de negocio concreta que lo requiera.

---

# 44. Alineación con decisiones contractuales de Production

Esta sección corrige y concreta las descripciones históricas anteriores:

- `GrapeReception` usa una colección de líneas variedad/cantidad (una o varias)
  y cada línea crea su `ProductionBatch` inicial. El actor no es un campo del
  body.
- `ProductionParticipant` es una entidad operativa propia, con `id`, `codigo`,
  `nombre`, `activo`, timestamps y relación opcional con `User`; un trabajo
  puede tener múltiples participantes y roles descriptivos.
- `ProductionBatch` es la cantidad trazable de un `Articulo`; no tiene estado
  persistido. La cantidad disponible deriva del historial y no puede ser
  negativa. División, mezcla y trazabilidad siguen las reglas contractuales;
  los batches hijos nunca se recombinan con el original.
- `TransformationInput` solo acepta uno o varios `ProductionBatch` con cantidad.
  `TransformationOutput` representa uno o varios outputs reutilizables como
  `ProductionBatch`; no existe `Subproducto`. Consumos y outputs son conceptos
  canónicos (`ProductionConsumption` y `ProductionOutput`) aunque no se exige
  una tabla independiente.
- `ProductionOrder` y `TransformationOrder` solo tienen `OPEN`/`CLOSED`;
  `CLOSED` es irreversible y el cierre aplica sus precondiciones contractuales.
- `CustomFieldDefinition` y sus valores son configurables, auditables y se
  conservan históricamente; soportan `TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`,
  `DATE` y `SELECT`, sin sustituir campos CORE ni invariantes.
- La salida a Inventory es una operación atómica compartida: reducción de
  ProductionBatch, output, InventoryLot con `originProductionBatchId`,
  InventoryMovement, InventoryStock y ambas auditorías usan `SharedUnitOfWork`.
  Production no posee ni duplica stock de producto en proceso.

---

# 44. Reglas de invariantes principales

## Vendimia

- máximo una vendimia por año;
- una vendimia cerrada no debe aceptar nuevas recepciones sin una operación explícita de reapertura, si algún día se permite.

## Recepción

- una recepción corresponde a un solo productor;
- una entrega posterior debe crear otra recepción;
- una recepción rechazada no forma parte del registro operativo MVP.

## Producción

- el producto en proceso se mide en unidades físicas de proceso, normalmente litros;
- la uva se controla en kg hasta su conversión mediante prensa;
- un lote de producción puede estar distribuido entre varios recipientes;
- un recipiente puede contener múltiples lotes;
- la capacidad del recipiente no puede superarse;
- los trabajos representan acciones realmente ejecutadas;
- si un trabajo no ocurrió, no se registra;
- las mermas se registran por contexto de trabajo/proceso, no gota a gota;
- las decisiones productivas deben conservar quién las registró y cuándo;
- los cambios de ruta/producto no se realizan solamente modificando un campo de estado sin registrar el hecho de negocio.

## Inventory

- stock de almacén es responsabilidad exclusiva de Inventory;
- todo movimiento de stock debe pasar por Inventory;
- productos líquidos en proceso dentro de recipientes no constituyen stock de almacén;
- el producto entra al ámbito de Inventory a partir del envasado;
- los lotes de inventario mantienen trazabilidad hacia su origen productivo.

---

# 45. Ejemplo completo de trazabilidad

```text
VENDIMIA 2025
   │
   ├── Recepción 001 - Productor A
   │      ├── Lote Uva Syrah
   │      └── Lote Uva Malbec
   │
   └── Recepción 002 - Productor B
          └── Lote Uva Tannat

                ↓ PRENSADO

OP-2025-001
"De dónde nació este producto"
   │
   └── PB-001
       Articulo = PP TINTA 1
       2.000 L
       │
       ├── TK-01 800 L
       ├── TK-02 700 L
       └── TK-03 500 L

                ↓

OT-2025-001
"Qué hicimos este periodo"
   │
   ├── Trabajo: fermentación
   ├── Medición: Brix
   ├── Medición: temperatura
   ├── Decisión: continuar
   └── Merma: evaporación

                ↓ DESCUBE

PB-002
Articulo = PP TINTA 2
1.850 L

                ↓

OT-2025-002
   ├── Trabajo: trasiego
   ├── Trabajo: clarificación
   ├── Insumo: clarificante
   └── Merma: borra

                ↓

PB-003
Articulo = PP TINTA 3

                ↓ CORTE

PB-004
Articulo = PP TINTA 4

                ↓ DECISIÓN ENÓLOGO

        ┌───────────────┐
        │               │
        ▼               ▼
      JOVEN           CRIANZA
        │               │
        ▼               ▼
 PP TINTA 5.4     PP TINTA CRIANZA 5.4
        │               │
        └───────┬───────┘
                ▼
           EMBOTELLADO
                │
                ▼
       INVENTORY LOT
                │
                ▼
       PRODUCTO_ENVASADO
                │
                ▼
       Etiquetado + Control final
                │
                ▼
 transitionInventoryLotClassification
                │
                ▼
       PRODUCTO_TERMINADO
                │
                ▼
 transitionInventoryLotClassification
                │
                ▼
  Clasificación de exportación
```

---

# 46. Regla para futuros desarrollos

Antes de crear una nueva entidad, el implementador debe preguntar:

1. ¿Este concepto ya está representado por una entidad existente?
2. ¿Pertenece a un módulo ya existente?
3. ¿Debe ser un nuevo Aggregate Root o una entidad interna?
4. ¿Quién es el único dueño de sus reglas y persistencia?
5. ¿Puede resolverse mediante una clasificación/estado/configuración en lugar de crear otra entidad?
6. ¿La nueva entidad representa una regla de negocio real o solamente una comodidad técnica?

No crear entidades únicamente para reflejar tablas o endpoints.

---

# 47. Decisiones arquitectónicas cerradas

Quedan establecidas las siguientes decisiones:

### D1. Artículo como catálogo único

`Articulo` contiene insumos, materia prima catalogada, productos intermedios, productos envasados, productos terminados, materiales y otros artículos.

### D2. Production controla producto en proceso

Mientras el producto esté en tanques/barricas y todavía forme parte de la transformación, su cantidad pertenece al dominio de Production.

### D3. Inventory controla almacenes

El producto entra al dominio de Inventory a partir del envasado y la generación de la existencia física almacenada.

### D4. OP Maestra y OP de Transformación son conceptos diferentes

```text
OrdenProduccion
    = ¿De dónde nació este producto?

OrdenTransformacion
    = ¿Qué hicimos con determinada cantidad durante este periodo?
```

### D5. LoteProduccion es la unidad física del proceso

Permite controlar cantidades concretas de un artículo producido sin convertir `Articulo` en una entidad de ejecución.

### D6. Los trabajos no son órdenes pendientes

`TrabajoProduccion` registra actividades realmente ejecutadas.

### D7. Las decisiones del enólogo son parte del dominio

El sistema registra decisiones y sigue la ruta efectivamente tomada, no obliga al enólogo a seguir una secuencia rígida.

### D8. Las mermas se registran por contexto

El sistema no exige registrar cada pequeña pérdida individualmente.

### D9. Tanques y barricas pertenecen a Production en el MVP

No se crea todavía un módulo financiero/patrimonial de activos.

### D10. Singani utiliza Production

No se crea un módulo separado para Singani.

### D11. Crianza utiliza estructuras existentes

No se crea una entidad `Crianza` independiente.

### D12. No existe receta rígida como centro del dominio

Los insumos utilizados se registran cuando realmente se aplican durante un trabajo.

### D13. Winter construye módulos propios sobre Logger

Products y Purchases pertenecieron al proyecto Logger y fueron retirados del
runtime de Winter. Los módulos finales del dominio son `Articulos` y
`Compras`.

### D14. Usuario autenticado como actor

El actor operativo se referencia mediante `User.id`. No se crea agregado
`Person`; los participantes adicionales se registran como lista operativa.

### D15. ProductionWork admite múltiples batches y recipientes

Un trabajo puede relacionarse opcionalmente con uno o varios
`ProductionBatch` y/o `Container`.

### D16. Clasificación de InventoryLot mediante command

La transición de producto envasado a producto terminado, y las posteriores
clasificaciones de exportación, utiliza
`transitionInventoryLotClassification` con validación y auditoría.

### D17. Producer y GrapeVariety pertenecen a Production

Son catálogos de Production referenciados por ID desde `RecepcionUva`. No se
modelan como texto libre, Articulo ni entidades de Core.

### D18. UnitOfWork compartido para atomicidad intermodular

Los workflows que requieran atomicidad entre Production, Inventory y Audit
utilizan un componente compartido de infraestructura sin reglas de negocio.

---

# 48. Regla para AI / Codex

Antes de implementar una entidad del dominio Winter, la IA debe leer como mínimo:

```text
ARCHITECTURE.md
AI_IMPLEMENTATION_RULES.md
MODULE_CONTRACT.md
DOMAIN_MODEL.md
AGGREGATES_AND_ENTITIES.md
```

Después debe revisar las APIs públicas de los módulos dependientes y la
implementación vigente de los módulos Winter correspondientes.

La IA **no debe inventar nuevas entidades, estados o relaciones de negocio** si este documento no las contempla.

Si una nueva necesidad no puede representarse correctamente con el modelo actual, debe detener la implementación y señalar la decisión de dominio pendiente en lugar de introducir silenciosamente una solución propia.

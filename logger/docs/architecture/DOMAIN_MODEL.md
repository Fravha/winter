# Winter / Logger — DOMAIN_MODEL.md

## 1. Propósito

Este documento define el modelo de dominio funcional del Proyecto Winter para Bodega Cruce del Zorro.

Winter es el sistema de negocio construido sobre la base técnica Logger. Las
reglas funcionales de este documento pertenecen a Winter y no deben deducirse
a partir de los módulos prototipo de Logger cuando exista una diferencia.

Su objetivo es establecer, antes de la implementación, qué conceptos existen en el negocio, quién es responsable de cada uno, cómo se relacionan y cómo debe representarse el proceso productivo de vinos y singanis.

Este documento complementa:

- `ARCHITECTURE.md`
- `AI_IMPLEMENTATION_RULES.md`
- `MODULE_CONTRACT.md`

No es un modelo Prisma definitivo. Es el contrato funcional que debe guiar el diseño de entidades, relaciones, servicios, comandos, consultas y módulos.

---

## 2. Naturaleza del dominio

Winter no es un sistema de producción basado únicamente en:

```text
Receta -> Orden -> Consumo -> Producto terminado
```

El proceso real es dinámico y depende de decisiones del equipo enológico.

La operación debe permitir:

- registrar materia prima recibida durante la vendimia;
- transformar uva en productos intermedios;
- registrar trabajos realizados en paralelo sobre diferentes recipientes;
- registrar movimientos físicos entre tanques y barricas;
- registrar consumos y pérdidas de insumos;
- registrar controles y análisis repetidos;
- registrar decisiones del enólogo;
- registrar mermas y subproductos;
- saber dónde se encuentra físicamente un producto en proceso;
- saber en qué etapa/proceso se encuentra;
- registrar el resultado de las transformaciones;
- convertir producto en proceso en producto envasado;
- mantener producto envasado en stock;
- convertir/clasificar producto envasado o terminado hacia exportación;
- generar información para los reportes periódicos de producción y contabilidad.

El sistema no debe imponer una secuencia rígida que impida al equipo enológico tomar decisiones.

---

# 3. Conceptos principales

## 3.1. Vendimia

La vendimia representa el periodo/campaña durante el cual se recibe la uva que será procesada.

Es el contexto de origen de la materia prima.

Una vendimia puede contener múltiples recepciones y múltiples lotes de uva.

Conceptualmente:

```text
Vendimia
  |
  +-- Recepción
  |     +-- Lote de uva
  |     +-- Lote de uva
  |
  +-- Recepción
        +-- Lote de uva
        +-- Lote de uva
```

---

## 3.2. Recepción de uva

Una recepción representa un ingreso físico de uva.

La recepción puede generar uno o varios lotes.

Una recepción debe poder registrar, según corresponda:

- fecha;
- proveedor/productor;
- finca/origen;
- una o varias variedades, cada una con su cantidad;
- calidad/estado;
- quintales solicitados;
- quintales recibidos;
- peso;
- destino productivo;
- parámetros de control;
- observaciones.

Roles involucrados:

- Enólogo: responsable de la decisión y control técnico.
- Enólogo residente: realiza normalmente el registro detallado de cada lote.
- Producción: participa en pesaje, traslado y operación física.

La recepción de uva de calidad insuficiente puede registrarse con observaciones.

Una uva completamente rechazada no se incorpora como recepción de materia prima procesable.

---

## 3.3. Lote de uva

El lote de uva es una referencia de origen de la materia prima recibida bajo condiciones comunes.

Puede distinguirse por:

- variedad;
- productor/proveedor;
- finca/origen;
- fecha;
- calidad;
- destino;
- cantidad;
- otros parámetros de recepción.

Una recepción puede crear varios lotes.

Un lote puede posteriormente ser utilizado total o parcialmente en diferentes órdenes o procesos.

La trazabilidad requerida en Winter no pretende construir una genealogía matemática de cada litro hasta cada kilogramo de uva.

El lote de uva funciona principalmente como referencia de origen para indicar:

```text
"Esta materia prima recibida fue utilizada en este proceso."
```

Después de entrar a producción, un producto puede combinar material procedente de múltiples lotes y productores.

---

# 4. Proceso maestro de producción

Durante la vendimia existe un proceso productivo amplio que agrupa la transformación de la uva recibida.

Para evitar confundir este contexto con la orden periódica que se reporta a contabilidad, se utilizará conceptualmente el término:

**Proceso Maestro de Producción**

Representa la elaboración completa derivada de la materia prima recibida durante la campaña.

Su propósito es dar contexto global al proceso.

Ejemplo:

```text
Vendimia 2025
   |
   +-- Proceso Maestro de Producción
          |
          +-- Uva tinta
          +-- Uva blanca
          +-- Uva moscatel
```

El Proceso Maestro no obliga a que toda la transformación ocurra en una sola secuencia ni en una sola orden.

---

# 5. Orden de producción del periodo

La orden que se presenta a contabilidad tiene un propósito diferente.

Representa:

> Qué se convirtió, qué trabajos se realizaron y qué insumos se utilizaron durante un periodo.

La orden de producción del periodo agrupa las ejecuciones y resultados reportables de una determinada etapa de transformación.

Ejemplo conceptual:

```text
Marzo 2026

Orden de Producción
    |
    +-- Trabajo: molienda
    +-- Trabajo: fermentación
    +-- Trabajo: descube
    +-- Trabajo: prensado
    |
    +-- Resultado:
          2.000 L vino base
          1.900 L vino joven
          merma
          subproducto
          insumos utilizados
```

La orden puede utilizar diferentes lotes de materia prima/proceso.

En etapas posteriores, la entrada ya no tiene por qué expresarse en kilogramos de uva. Puede expresarse en litros existentes en recipientes.

La orden debe poder relacionarse con:

- Proceso Maestro de Producción;
- trabajos ejecutados;
- productos intermedios generados;
- movimientos de recipientes;
- insumos utilizados cuando corresponda;
- mermas;
- subproductos;
- controles;
- decisiones;
- personas involucradas.

---

# 6. Trabajo de producción

Un Trabajo de Producción es un registro de una actividad realmente ejecutada.

No es una orden rígida y no debe asumir que todos los trabajos ocurren siguiendo exactamente el calendario esperado.

Ejemplo:

```text
Trabajo:
    1er Trasiego

Inicio:
    fecha/hora real

Fin:
    fecha/hora real

Responsable:
    usuario autenticado

Recipiente origen:
    Tanque T-01

Recipiente destino:
    Tanque T-08

Cantidad:
    1.500 L

Observaciones:
    ...
```

El sistema debe registrar qué se hizo realmente.

Debe permitir que varios recipientes se encuentren simultáneamente en diferentes trabajos:

```text
Tanque 01 -> Trasiego
Tanque 02 -> Clarificación
Tanque 03 -> Desborre
Tanque 04 -> Fermentación
```

Todos pueden pertenecer al mismo producto objetivo.

El estado general de producción debe derivarse de los trabajos y de la situación actual del proceso, no de una secuencia artificial que obligue a todos los recipientes a avanzar juntos.

---

# 7. Tipo de trabajo y ejecución de trabajo

Debe distinguirse conceptualmente entre:

### Tipo de trabajo

Catálogo/maestro que define qué actividad existe.

Ejemplos:

```text
Molienda
Maceración en frío
Fermentación alcohólica
Descube
Prensado
Trasiego
Clarificación
Desborre
Crianza / reposo
Corte / ensamble
Filtración
Destilación
Rebaje
Remontado
Embotellado / fraccionado
Etiquetado
Control final
```

### Ejecución de trabajo

Registro concreto de cuándo se realizó el trabajo sobre un producto/proceso real.

El tipo de trabajo define la naturaleza de la actividad.

La ejecución registra lo que realmente ocurrió.

---

# 8. Producto en proceso

Los productos como:

```text
PP TINTA 1
PP TINTA 2
PP TINTA 3
```

representan productos intermedios que aparecen durante la transformación.

No deben interpretarse como simples estados técnicos de una orden.

Representan estados/productos funcionales del proceso.

Ejemplo:

```text
TINTA 1
Uva molida + insumos iniciales
    |
    v
TINTA 2
Vino gota / producto corregido
    |
    v
TINTA 3
Vino clarificado
    |
    v
TINTA 4
Vino listo para embotellar
```

El uso real de estos productos intermedios puede variar según las decisiones y transformaciones.

No todos los productos en proceso tienen que utilizar los mismos trabajos.

---

# 9. Producto objetivo

Durante el proceso puede existir una intención de qué producto se desea obtener.

Ejemplos:

```text
La Curiosa Malbec
La Curiosa Cabernet Sauvignon
Cruce del Zorro Petit Verdot
Porfiados Blend
La Viuda Descalza
La Viuda Reposada
La Viuda Húngara
```

El producto objetivo no significa que el sistema pueda obligar al enólogo a seguir una ruta fija.

El producto objetivo sirve para:

- orientar el proceso;
- identificar para qué producto se están realizando trabajos;
- agrupar actividades;
- generar reportes;
- registrar decisiones.

La decisión final sobre el estilo, corte y destino pertenece al equipo enológico y gerencial.

---

# 10. Ruta de producción

Una línea de producción puede tener una ruta general de trabajos esperados.

Ejemplo:

```text
Vino joven:
Recepción
-> Molienda
-> Fermentación
-> Descube
-> Prensado
-> Trasiegos
-> Clarificación
-> Filtrado
-> Preparación final
-> Embotellado
-> Etiquetado
```

Vino con crianza:

```text
...
-> Decisión de crianza
-> Barrica / duela
-> Crianza
-> Preparación final
-> Filtrado
-> Embotellado
-> Etiquetado
```

Singani:

```text
Recepción
-> Molienda
-> Fermentación / vino base
-> Prensado
-> Clarificación
-> Desborre
-> Destilación
-> Rebaje/remontado cuando corresponda
-> Decisión de reposo
-> Filtrado
-> Embotellado
-> Etiquetado
```

La ruta es una referencia o parametrización.

No representa una ejecución rígida.

El usuario de producción registra los trabajos reales y el sistema utiliza esos registros para determinar la situación actual.

---

# 11. Etapa de producción

Las etapas son agrupaciones funcionales de trabajos.

Ejemplos:

```text
Recepción y control
Preparación del mosto
Maceración y fermentación
Separación y estabilización
Preparación final
Crianza
Destilación
Envasado
Control final
```

Las etapas permiten mostrar el estado actual de forma comprensible.

---

# 12. Estado actual del proceso

El sistema debe poder responder en cualquier momento:

```text
¿En qué proceso está?
¿En qué etapa está?
¿Dónde está?
¿Cuánto hay?
¿Qué producto se está preparando?
¿Qué trabajos ya se realizaron?
¿Qué decidió el equipo enológico?
```

Ejemplo:

```text
Producto objetivo:
    Cruce del Zorro Petit Verdot

Etapa:
    Crianza

Trabajo actual:
    Crianza / reposo

Recipiente:
    Barrica B-034

Ubicación:
    Bodega Cruce del Zorro

Cantidad:
    225 L
```

Este estado no debe depender únicamente de un campo `status`.

Debe poder reconstruirse a partir de:

- trabajos ejecutados;
- movimientos de recipientes;
- producto en proceso;
- decisiones;
- cantidades actuales;
- situación del recipiente.

---

# 13. Recipiente

Los tanques y barricas son simultáneamente:

1. activos físicos;
2. ubicaciones operativas de producto en proceso.

Ejemplos:

```text
Tanque T-01
Capacidad: 2.500 L

Barrica B-034
Capacidad: 225 L
```

Cada recipiente debe tener identidad física.

Debe poder conocerse:

- capacidad;
- tipo;
- propiedad;
- ubicación;
- estado;
- disponibilidad;
- características relevantes.

---

# 14. Ocupación de recipiente

La ocupación del recipiente NO es inventario de almacén.

Es un registro operativo de qué cantidad de producto en proceso se encuentra físicamente dentro del recipiente.

Ejemplo:

```text
Tanque T-01
Capacidad: 2.500 L

Contenido actual:
1.800 L
```

Puede quedar:

- parcialmente lleno;
- lleno;
- vacío.

Un recipiente no contiene simultáneamente dos batches independientes. Introducir
otro batch constituye una mezcla/transformación y genera un nuevo batch.

Ejemplo:

La disponibilidad física del recipiente debe reflejar siempre los movimientos realizados.

---

# 15. Movimiento de producto en proceso

Un movimiento de proceso registra una transferencia física entre recipientes o una modificación física del contenido.

Debe poder registrar:

- recipiente origen;
- recipiente destino;
- cantidad;
- unidad;
- fecha;
- usuario autenticado;
- orden de producción cuando corresponda;
- trabajo relacionado cuando corresponda;
- motivo;
- observaciones;
- insumos relacionados cuando corresponda;
- merma cuando corresponda.

Ejemplo:

```text
Tanque T-01
   |
   | 100 L
   | Motivo: corrección
   v
Tanque T-05
```

Los datos de fecha y persona deben obtenerse del contexto autenticado cuando sea posible, no depender de que el usuario escriba manualmente quién realizó la operación.

El movimiento debe actualizar la ocupación física de origen y destino.

---

# 16. Pérdida de volumen en proceso

Las pérdidas de proceso deben poder registrarse.

Ejemplo:

```text
Tanque T-01

Hace una semana:
2.500 L

Situación actual:
2.400 L

Pérdida:
100 L
```

El usuario puede registrar posteriormente un ingreso desde otro recipiente para completar el nivel requerido.

La pérdida no debe tratarse como una simple edición de cantidad.

Debe quedar como hecho operativo:

```text
Cantidad perdida
Causa
Trabajo relacionado
Observación
Usuario
Fecha
```

Esto permite conservar historial.

---

# 17. Controles y mediciones

Los controles son configurables según el tipo de trabajo.

Un trabajo puede definir qué mediciones admite.

Ejemplo:

### Recepción

```text
Brix
Baumé
pH
Acidez
Calidad
```

### Fermentación

```text
Temperatura
Densidad
Baumé
Azúcares reductores
```

### Destilación

```text
Grado alcohólico
Volumen
```

El mismo proceso puede tener múltiples mediciones a lo largo del tiempo.

Ejemplo:

```text
Fermentación - Tanque T01

12/03 08:00 -> 18 °C
12/03 14:00 -> 17 °C
12/03 20:00 -> 16 °C
```

El sistema debe permitir consultar la evolución de las mediciones por:

- recipiente;
- producto en proceso;
- trabajo;
- orden de producción;
- periodo.

---

# 18. Decisiones enológicas

Una decisión enológica es una decisión humana que modifica el rumbo del proceso.

Ejemplos:

```text
Vino joven
Vino con crianza
Barrica seleccionada
Corte seleccionado
Agregar vino prensa
Mantener vino prensa separado
```

El sistema debe registrar la decisión, no reemplazar al enólogo.

Puede existir una ruta general propuesta por la línea de producción, pero la decisión real pertenece al equipo enológico/gerencial.

---

# 19. Decisión de estilo

Una decisión de estilo determina si el vino continúa hacia:

```text
Vino joven
```

o:

```text
Vino con crianza / premium
```

Ejemplo:

```text
Producto en proceso
       |
       +----> Vino joven
       |
       +----> Crianza
```

La decisión puede ocurrir después de varios trabajos ya realizados.

Por tanto, no debe estar fijada obligatoriamente cuando se crea la primera recepción.

---

# 20. Corte / ensamble

Un corte puede combinar diferentes cantidades de producto en proceso.

Ejemplo:

```text
Lote/Proceso A -> Cabernet -> 40%
Lote/Proceso B -> Tannat   -> 30%
Lote/Proceso C -> Merlot   -> 30%
                  |
                  v
               CORTE
                  |
                  v
             Nuevo proceso
```

El sistema debe registrar:

- entradas;
- cantidades reales;
- porcentajes cuando correspondan;
- resultado;
- producto objetivo;
- trabajo;
- observaciones.

No es necesario construir una genealogía detallada hasta los lotes originales de uva.

Debe conservarse un registro suficiente de que los productos/procesos de entrada fueron transformados en el nuevo resultado.

---

# 21. Transformaciones

Una transformación no presupone igualdad entre entrada y salida.

Ejemplo:

```text
OP 001
Entrada:
5.000 kg de uva

Resultado:
2.000 L vino base
1.900 L vino joven
Merma:
...
Subproducto:
...
```

Otra orden puede obtener:

```text
5.000 kg
    ->
2.200 L vino base
2.000 L vino joven
```

El sistema registra los resultados reales.

Los porcentajes de rendimiento o pérdida utilizados por el área financiera no forman parte de la lógica operativa de Winter en el MVP.

Winter debe registrar los valores reales para que otros reportes puedan analizarlos.

---

# 22. Merma

Una merma es una pérdida cuantificable.

Debe poder registrar:

- cantidad;
- unidad;
- motivo/causa;
- trabajo;
- producto/proceso relacionado;
- observación;
- usuario;
- fecha.

Puede ocurrir en:

- selección;
- fermentación;
- trasiego;
- desborre;
- crianza;
- filtrado;
- embotellado;
- etiquetado;
- almacenamiento;
- otros procesos.

---

# 23. Resultados secundarios / subproductos

Un trabajo o transformación puede generar uno o varios resultados secundarios.

Ejemplos del proceso de vino:

```text
Prensado
    |
    +--> vino gota
    +--> vino prensa
    +--> orujo / sólido
```

`Subproducto` no será una entidad, Aggregate Root ni módulo independiente en el MVP.

La representación depende de la naturaleza real del resultado:

```text
Resultado reutilizable o trazable
    -> SalidaTransformacion
    -> ProductionBatch cuando corresponda

Merma / descarte / residuo
    -> ProductionLoss cuando corresponda
```

La clasificación contable específica queda fuera de este documento si no está definida por el negocio.

---

# 24. Insumos y materiales

Los artículos pueden clasificarse funcionalmente como:

```text
Materia prima
Insumo enológico
Material auxiliar
Materiales de envase y etiquetado
Repuestos / suministros
Producto en proceso
Producto terminado
Otro inventariable
```

El maestro de artículos actualmente contempla estas categorías funcionales y permite controlar unidad base, estado y clasificación. 

Los insumos no son obligatorios en todos los trabajos.

Ejemplos:

```text
Clarificación
    -> clara de huevo / bentonita

Trasiego
    -> puede requerir metabisulfito

Filtración
    -> placas filtrantes

Embotellado
    -> botellas, corchos/tapones, cápsulas, cajas, cinta

Etiquetado
    -> etiquetas, contraetiquetas, collarines, cápsulas
```

---

# 25. Movimiento de inventario

El inventario de Winter controla existencias físicas.

Debe existir una noción general de movimiento de inventario para:

- entrada;
- salida;
- transferencia;
- ajuste;
- pérdida;
- daño;
- vencimiento;
- consumo;
- otros movimientos definidos.

No toda salida debe estar vinculada a una orden de producción.

La regla anterior de que toda salida debe estar obligatoriamente asociada a producción queda expresamente descartada.

Cuando un movimiento sí está relacionado con producción, puede referenciar:

- orden de producción;
- ejecución de trabajo;
- producto/proceso relacionado.

---

# 26. Límite del inventario respecto a producto en proceso

El inventario de almacenes NO controla el producto líquido que permanece dentro de tanques y barricas.

Por tanto:

```text
Tanque / Barrica
    -> estado físico del proceso
```

no equivale a:

```text
Warehouse Stock
```

Winter separa dos conceptos:

### Existencia física en inventario

Controlada por Inventory.

Ejemplos:

```text
Botellas
Corchos
Etiquetas
Insumos enológicos
Producto envasado
Producto terminado
```

### Cantidad de producto dentro de recipientes

Controlada por el proceso productivo.

Ejemplos:

```text
Tanque T01 -> 2.400 L vino
Barrica B34 -> 225 L vino crianza
```

---

# 27. Producto envasado

El producto envasado aparece cuando el líquido es embotellado/fraccionado.

En este momento:

```text
Producto en proceso líquido
        |
        v
Embotellado / fraccionado
        |
        v
Producto envasado
```

El producto envasado entra inmediatamente al ámbito de Inventory como
`PRODUCTO_ENVASADO`.

Inventory puede diferenciar operativamente un almacén de producto envasado y
un almacén de producto terminado aunque ambos representen zonas lógicas dentro
del mismo lugar físico. La separación lógica no implica duplicar la existencia.

Esto permite:

- mantener stock;
- trasladarlo;
- perder unidades;
- utilizar unidades para laboratorio;
- ajustar cantidades;
- mantenerlo en reposo;
- posteriormente etiquetarlo.

---

# 28. Producto terminado

El producto se considera producto terminado después del proceso de:

```text
Etiquetado
+
Control final
```

La secuencia funcional del MVP es:

```text
Producto en proceso líquido
        |
        v
Embotellado
        |
        v
Producto envasado
        |
        v
Etiquetado
        |
        v
Producto terminado
        |
        v
Almacén de producto terminado
```

El producto terminado se controla por:

- producto;
- presentación;
- lote;
- cantidad;
- ubicación.

La transición desde `PRODUCTO_ENVASADO` hacia `PRODUCTO_TERMINADO` no se
realiza editando directamente el lote. Inventory debe ejecutar el command de
dominio `transitionInventoryLotClassification`, validar que la transición sea
válida y registrar su auditoría. El lote físico y su trazabilidad se conservan.

---

# 29. Producto de exportación

El producto de exportación representa una clasificación de stock, no necesariamente una nueva transformación física.

Puede ocurrir:

```text
Producto envasado
      |
      +----> Producto terminado
      |
      +----> Producto de exportación
```

o:

```text
Producto envasado
      |
      v
Producto terminado
      |
      v
Producto de exportación
```

La diferencia está en la clasificación/identificación y materiales de presentación de exportación.

Las clasificaciones de exportación reutilizan el mismo mecanismo de transición
de `InventoryLot`; no se modifica el lote directamente ni se duplica
innecesariamente el producto físico.

---

# 30. Singani

Singani es una rama productiva con camino propio.

La materia prima es uva Moscatel de Alejandría.

Ruta conceptual:

```text
Uva Moscatel
    |
    v
Molienda
    |
    v
Fermentación / vino base
    |
    v
Prensado
    |
    v
Clarificación
    |
    v
Desborre
    |
    v
Primera destilación
    |
    v
Segunda destilación
    |
    v
Singani base
```

Posteriormente puede existir:

```text
Sin reposo
    |
    v
Filtrado
    |
    v
Envasado
    |
    v
Etiquetado
```

o:

```text
Con crianza / reposo
    |
    v
Barrica / roble
    |
    v
Rebaje / remontado
    |
    v
Filtrado
    |
    v
Envasado
    |
    v
Etiquetado
```

---

# 31. Destilación y cortes

La destilación debe registrar:

- etapa de destilación;
- cantidad;
- volumen;
- grado alcohólico;
- cortes;
- destino;
- merma;
- observaciones.

Los cortes deben poder representar:

```text
Cabeza
Corazón
Cola
```

cuando correspondan.

El sistema debe conservar sus cantidades y grados alcohólicos.

---

# 32. Crianza / reposo

La crianza/repose puede ocurrir en:

- tanques;
- barricas;
- otros recipientes definidos por el negocio.

Debe registrar:

- proceso/lote;
- recipiente;
- fecha de entrada;
- volumen inicial;
- fecha de salida;
- volumen final;
- controles periódicos;
- análisis;
- persona/responsable;
- observaciones;
- mermas.

La crianza puede durar meses o años.

El estado del recipiente debe mostrar la ocupación y disponibilidad física.

---

# 33. Barricas como activos

Las barricas son activos físicos.

Además de contener producto, tienen ciclo de uso.

El sistema MVP debe al menos poder distinguir:

```text
Barrica
    -> disponible
    -> ocupada
```

y conservar su identificación física.

El número de usos de una barrica es relevante para su gestión futura, especialmente porque el negocio considera una vida útil limitada por cantidad de usos.

La lógica contable completa de depreciación queda fuera del MVP productivo, pero la identidad y uso físico del activo deben quedar disponibles.

---

# 34. Almacenes

El maestro actual contempla ubicaciones internas y externas, incluyendo:

```text
Bodega CDZ - Materia Prima
Bodega CDZ - Producto en proceso
Bodega CDZ - Producto Terminado
Bodega Lopez - Materia Prima
Bodega Lopez - Producto en proceso
Bodega Lopez - Producto Terminado
Santa Cruz CDZ - Producto Terminado
La Paz CDZ - Producto Terminado
Green Tower MB CDZ - Producto Terminado
```

Para el MVP productivo, el almacenamiento de líquido dentro de tanques/barricas se controla por recipiente/proceso y no como stock de inventario.

Los almacenes continúan siendo relevantes para las existencias físicas que sí forman parte de Inventory.

---

# 35. Usuarios y participantes

Para el MVP no se crea un agregado `Person` dentro de Production.

El actor que inicia o modifica una operación autenticada se identifica mediante
el `User.id` resuelto por Logger/Core. Ese identificador es la referencia de
autoría y responsabilidad del cambio.

Además, determinados trabajos pueden conservar una lista operativa de personas
o equipos participantes, especialmente en:

- envasado;
- etiquetado;
- controles;
- trabajos productivos relevantes.

La lista de participantes describe quiénes participaron físicamente y no crea
usuarios, roles, permisos ni entidades de RRHH. Para el MVP no se calcula costo
de mano de obra.

---

# 36. Ownership de dominio

La propiedad conceptual del MVP es:

```text
Articulos
    -> Articulo master

Compras
    -> Purchase / adquisición

Inventory
    -> Physical inventory
    -> Inventory lots
    -> Inventory movements
    -> Inventory lot classification transitions

Production
    -> Producer catalog
    -> GrapeVariety catalog
    -> Production process
    -> Production orders
    -> Production work executions
    -> Process transformations
    -> Process decisions
    -> Containers / tanks / barrels
    -> Process-container occupancy
    -> Process movements
    -> Controls / measurements
    -> Production losses

Access Management / Core
    -> Users
    -> Roles
    -> Permissions
    -> Audit
```

`products` y `purchases` del proyecto Logger se utilizan solamente como módulos
de referencia técnica y no son propietarios del dominio final de Winter.

---

# 37. Relaciones principales

```text
Vendimia
   |
   +--> Recepción
           |
           +--> Lote de uva
                     |
                     v
             Proceso Maestro
                     |
                     v
              Orden de Producción
                     |
          +----------+----------+
          |          |          |
          v          v          v
       Trabajos   Controles  Decisiones
          |
          v
   Transformaciones
          |
      +---+---+----------------+
      |       |                |
      v       v                v
 Producto   Merma          Resultado secundario
 en proceso
      |
      +--> Movimiento entre recipientes
      |
      +--> Crianza / reposo
      |
      +--> Corte / ensamble
      |
      v
Embotellado / fraccionado
      |
      v
Producto envasado
      |
      v
InventoryLot = PRODUCTO_ENVASADO
      |
      v
Etiquetado
      |
      v
Control final
      |
      v
transitionInventoryLotClassification
      |
      v
InventoryLot = PRODUCTO_TERMINADO
      |
      v
Clasificación exportación / despacho mediante transición de Inventory
```

---

# 38. Flujo completo de vino con crianza

Ejemplo basado en la operación real:

```text
Vendimia 2025
    |
    v
Recepción de uvas tintas
    |
    +--> Syrah
    +--> Malbec
    +--> Cabernet
    +--> otros
    |
    v
Lotes de uva
    |
    v
Molienda / estabilización
    |
    v
Tanques
    |
    v
Maceración / fermentación
    |
    +--> controles periódicos
    +--> correcciones
    +--> consumos
    +--> mermas
    |
    v
Descube
    |
    v
Prensado
    |
    +--> vino gota
    +--> vino prensa
    |
    v
Maloláctica
    |
    v
Trasiegos
    |
    v
Clarificación
    |
    v
Filtrado
    |
    v
Decisión enológica
    |
    v
Crianza
    |
    +--> barrica / duela
    +--> controles
    +--> análisis
    +--> movimientos
    +--> mermas
    |
    v
Definición de corte
    |
    v
Preparación final
    |
    v
Filtración
    |
    v
Embotellado
    |
    v
Producto envasado
    |
    v
Inventory = PRODUCTO_ENVASADO
    |
    v
Etiquetado
    |
    v
Control final
    |
    v
transitionInventoryLotClassification
    |
    v
Inventory = PRODUCTO_TERMINADO
    |
    v
Almacén de producto terminado
```

---

# 39. Flujo completo de Singani

```text
Vendimia
    |
    v
Uva Moscatel
    |
    v
Molienda
    |
    v
Fermentación / vino base
    |
    v
Prensado
    |
    v
Clarificación
    |
    v
Desborre
    |
    v
Primera destilación
    |
    +--> cabeza
    +--> corazón
    +--> cola
    |
    v
Segunda destilación
    |
    +--> cortes
    |
    v
Singani base
    |
    +------------------------+
    |                        |
    v                        v
Sin reposo               Con reposo
    |                        |
    v                        v
Filtrado                 Barrica / roble
    |                        |
    v                        v
Envasado                  Crianza
    |                        |
    v                        v
Inventory                Rebaje / remontado
PRODUCTO_ENVASADO           |
    |                        v
    v                     Filtrado
Etiquetado                  |
    |                        v
    v                    Envasado
Control final               |
    |                        v
    v                    Inventory
Transición Inventory     PRODUCTO_ENVASADO
    |                        |
    v                        v
Producto terminado       Etiquetado
                             |
                             v
                         Control final
                             |
                             v
                     Transición Inventory
                             |
                             v
                     Producto terminado
```

---

# 40. Principios de estado

No debe existir un único estado global utilizado para todo.

Winter necesita distinguir al menos:

```text
Estado del proceso
Estado del trabajo
Estado del recipiente
Estado del inventario
Estado del producto
```

Ejemplo:

```text
Proceso:
    CRIANZA

Trabajo:
    CRIANZA_EN_EJECUCION

Recipiente:
    OCUPADO

Inventario:
    no aplica al líquido del recipiente

Producto:
    PRODUCTO_EN_PROCESO
```

Posteriormente:

```text
Proceso:
    ENVASADO_COMPLETADO

Recipiente:
    LIBERADO

Inventario:
    PRODUCTO_ENVASADO = 1.200 botellas

Producto:
    PRODUCTO_ENVASADO
```

---

# 41. Reglas de negocio fundamentales

## BR-001 — Una recepción puede generar varios lotes

La recepción no representa obligatoriamente un único lote.

## BR-002 — Un lote puede utilizarse parcialmente

La misma materia prima puede alimentar diferentes procesos.

## BR-003 — Una orden de producción puede utilizar varios lotes/procesos

No existe una relación uno-a-uno entre orden y lote.

## BR-004 — La producción no es una receta rígida

El uso de insumos depende de la condición real del producto y de la decisión enológica.

## BR-005 — No todos los trabajos consumen insumos

Un trabajo puede existir sin consumo.

## BR-006 — Una orden puede contener múltiples trabajos simultáneos

Diferentes recipientes pueden estar en diferentes trabajos dentro del mismo periodo/proceso.

## BR-007 — La ruta es orientativa, no una máquina de estados rígida

Las decisiones humanas pueden cambiar la ruta.

## BR-008 — Un recipiente puede estar parcialmente lleno

La capacidad debe compararse con su ocupación física.

## BR-009 — Un recipiente puede quedar vacío

El movimiento físico debe permitir liberar completamente un recipiente.

## BR-010 — Los movimientos afectan la ocupación física

Toda transferencia debe actualizar origen y destino.

## BR-011 — La pérdida de volumen es un hecho registrable

No debe resolverse ocultando la diferencia mediante una edición silenciosa.

## BR-012 — El producto en proceso dentro de recipientes no es inventario de almacén

El líquido se controla desde Producción/Proceso.

## BR-013 — El producto envasado entra en Inventory al embotellarse

Una vez embotellado, la existencia física se registra en Inventory con la
clasificación `PRODUCTO_ENVASADO`.

## BR-014 — El producto terminado aparece después de etiquetado y control final

Después de etiquetado y control final, Inventory realiza la transición de la
clasificación del mismo lote mediante `transitionInventoryLotClassification`.
No se crea un segundo ingreso físico ni se edita la clasificación directamente.

## BR-015 — Exportación es una clasificación de stock

No implica necesariamente una nueva transformación física del producto.

## BR-016 — Las salidas de inventario no siempre pertenecen a producción

Pueden ser pérdidas, daños, vencimientos, ajustes, laboratorio u otras causas.

## BR-017 — Las decisiones de estilo pertenecen al equipo enológico

El sistema registra la decisión; no la reemplaza.

## BR-018 — Los controles pueden repetirse

Una etapa puede registrar múltiples mediciones durante su ejecución.

## BR-019 — Las transformaciones pueden producir múltiples resultados

Una entrada puede generar producto principal, resultados secundarios y merma.
Un resultado secundario trazable/reutilizable se representa como salida de
transformación/ProductionBatch; una pérdida o descarte se representa como
ProductionLoss. No existe agregado `Subproducto` en el MVP.

## BR-020 — La trazabilidad se conserva como referencia de origen y transformación

No es obligatorio construir una genealogía exacta de cada volumen hasta cada lote de uva.

## BR-021 — El actor autenticado se identifica con User.id

Production no crea una entidad `Person`. Las personas o equipos participantes
en un trabajo se conservan como lista operativa separada del actor autenticado.

## BR-022 — Producer y GrapeVariety pertenecen a Production

Ambos son catálogos propios de Production. `GrapeReception` los referencia por
ID y no deben almacenarse como texto libre ni como Articulo.

## BR-023 — Un trabajo puede tener contexto físico múltiple

`ProductionWork` puede relacionarse con uno o varios `ProductionBatch` y/o
`Container`. Estas asociaciones son opcionales de acuerdo con el tipo de
trabajo.

## BR-024 — Las clasificaciones de Inventory cambian mediante command

Las transiciones de `InventoryLot`, incluyendo producto envasado, producto
terminado y las clasificaciones de exportación definidas por el dominio, se
realizan mediante `transitionInventoryLotClassification` y quedan auditadas.

---

# 42. Lo que Winter NO debe modelar en el MVP

No forma parte del MVP:

- costo completo de producción;
- costo de mano de obra;
- depreciación contable automática;
- genealogía matemática completa de cada litro;
- inventario de líquido en cada tanque como stock de almacén;
- participación de todos los equipos de producción;
- una receta obligatoria para cada proceso;
- una secuencia rígida que bloquee decisiones del enólogo.

Estos aspectos pueden extenderse posteriormente sin romper el modelo siempre que respeten el ownership definido.

---

# 43. Casos que el sistema debe poder responder

El dominio está bien modelado cuando puede responder preguntas como:

### Producción

```text
¿Qué se hizo durante marzo?
```

### Producto

```text
¿Qué producto se estaba preparando?
```

### Estado

```text
¿En qué etapa está este vino?
```

### Ubicación

```text
¿En qué tanque/barrica está?
```

### Cantidad

```text
¿Cuántos litros hay actualmente?
```

### Movimiento

```text
¿De qué tanque vino?
¿A qué tanque fue?
¿Por qué?
```

### Insumos

```text
¿Qué insumos se utilizaron en este trabajo?
```

### Calidad

```text
¿Cómo han evolucionado las mediciones del tanque?
```

### Decisión

```text
¿Cuándo se decidió que este vino sería crianza?
```

### Resultado

```text
¿Qué se obtuvo de esta orden?
```

### Inventario

```text
¿Cuántas botellas están disponibles?
```

### Exportación

```text
¿Cuánto stock está clasificado como exportación?
```

---

# 44. Implicación para la implementación

La futura implementación no debe intentar resolver este dominio con una única entidad `Production`.

El modelo debe separar conceptualmente al menos:

```text
Producer
GrapeVariety
Vendimia
Recepción
Lote de uva
Proceso maestro
Orden de producción
Tipo de trabajo
Ejecución de trabajo
Producto en proceso
Movimiento de proceso
Ocupación de recipiente
Control / medición
Decisión enológica
Transformación
Merma
Resultado secundario representado por transformación/ProductionBatch o ProductionLoss
Inventario
Movimiento de inventario
Producto envasado
Producto terminado
Recipiente / activo
```

La implementación puede agrupar algunas entidades físicamente cuando exista una razón técnica, pero no debe eliminar distinciones funcionales necesarias para representar el negocio.

---

# 45. Regla para la IA

Cuando una nueva implementación parezca requerir una entidad, relación o estado que no esté definido aquí, la IA no debe inventarlo automáticamente si afecta al significado del negocio.

---

# 41. Alineación contractual de Production

Las siguientes reglas prevalecen sobre cualquier descripción conceptual anterior
de este documento:

- `GrapeReception` pertenece a una `ProductionOrder`, puede contener una o
  varias variedades y cada par variedad/cantidad genera su `ProductionBatch`
  inicial.
- El actor de cada cambio se obtiene exclusivamente del contexto autenticado.
  Las personas que participaron físicamente se modelan como
  `ProductionParticipant`, entidad operativa independiente de `User`, con
  relación opcional a un usuario y rol descriptivo configurable.
- Los consumos y outputs se representan mediante conceptos canónicos
  `ProductionConsumption` y `ProductionOutput` (sin duplicar consumos en
  `ProductionWork`); su forma de persistencia queda para el diseño técnico.
  Los consumos de transformación siempre referencian uno o más
  `ProductionBatch`, nunca solamente un `Articulo`.
- `ProductionBatch` no tiene estado persistido: su disponibilidad se deriva del
  historial (`generada - consumida - separada - pérdidas - transferida`) y nunca
  puede ser negativa. Una división crea batches hijos irreversibles; una mezcla
  crea un batch nuevo con trazabilidad a todos sus orígenes.
- `ProductionOrder` y `TransformationOrder` solo admiten `OPEN` y `CLOSED`.
  `CLOSED` es irreversible y no existe reapertura. Se aplican las
  precondiciones de cierre aprobadas en `DECISION_PRODUCTION.md`.
- Los campos adicionales son `Custom Fields` administrables, con definiciones
  estables, tipos `TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE` y `SELECT`,
  preservación histórica y auditoría. No sustituyen invariantes estructurales.
- El cruce `Production → Inventory` es atómico: reducción del batch, output,
  `InventoryLot` con `originProductionBatchId`, movimiento, stock y auditorías
  se confirman o revierten juntos mediante `SharedUnitOfWork`. El producto en
  proceso no es `InventoryStock`.

Debe:

1. identificar la necesidad;
2. indicar qué parte del dominio no está definida;
3. proponer alternativas;
4. detener el cambio de dominio hasta que exista una decisión.

La IA puede decidir detalles técnicos de implementación dentro del contrato, pero no debe decidir por cuenta propia reglas de negocio nuevas.

---

# 46. Fuente funcional

Este modelo se basa en:

- Manifiesto del Proyecto Winter v3.0;
- maestro funcional de artículos, procesos, activos, almacenes, líneas y trabajos;
- resumen del proceso productivo;
- entrevista con el área enológica;
- decisiones explícitas tomadas durante el análisis de dominio.

La documentación del proceso confirma las dos ramas principales —elaboración de vinos y elaboración de singanis— y describe trabajos como molienda, maceración, fermentación, descube, prensado, trasiegos, clarificación, crianza, destilación, rebaje, filtrado, embotellado y etiquetado. La entrevista también confirma que el proceso real depende de controles periódicos y decisiones del equipo enológico.

---

# 47. Estado del documento

Este documento representa el modelo funcional definido para el MVP.

Cuando exista una modificación de negocio, debe registrarse como cambio del dominio antes de modificar la implementación.

La implementación no debe utilizar el código existente como fuente de verdad sobre reglas de negocio cuando contradiga este documento.

# Winter / Logger --- AI_IMPLEMENTATION_RULES.md

## 1. Propósito

Este documento establece las reglas que deben seguir Codex, Claude Code
u otras herramientas de IA al modificar o extender la base técnica Logger
para implementar el sistema Winter.

Winter es el sistema de negocio. Logger es su foundation técnica existente.
La IA debe conservar las capacidades transversales de Logger y construir los
módulos de Winter sobre esa arquitectura.

Su finalidad es evitar que una implementación aparentemente funcional
rompa:

-   la arquitectura;
-   los contratos existentes;
-   la seguridad;
-   la auditoría;
-   las dependencias entre módulos;
-   la integridad de los datos;
-   las reglas de negocio.

Estas reglas tienen prioridad sobre cualquier inferencia arquitectónica
que la IA pueda realizar por su cuenta.

------------------------------------------------------------------------

## 2. Regla fundamental

> **No inventar arquitectura. Extender la arquitectura existente.**

Antes de implementar:

1.  leer este documento;
2.  leer `ARCHITECTURE.md`;
3.  leer `MODULE_CONTRACT.md`;
4.  leer `DOMAIN_MODEL.md`;
5.  leer `AGGREGATES_AND_ENTITIES.md`;
6.  leer `MODULE_MAP.md`;
7.  leer `WORKFLOWS.md`;
8.  leer `API_CONTRACTS.md`;
9.  leer la especificación concreta del módulo solicitado;
10. inspeccionar los módulos Winter vigentes (por ejemplo
    `src/modules/articulos` y `src/modules/compras`);
11. inspeccionar las APIs públicas de sus dependencias;
12. revisar tests existentes relacionados.

No comenzar escribiendo código sin entender primero el contrato del
módulo.

## 2.1. Regla de persistencia y autoridad documental

> **El contexto del chat no constituye documentación persistente del proyecto.**

Los archivos adjuntos, mensajes, conversaciones previas, instrucciones
temporales del chat o memoria de la herramienta de IA pueden utilizarse
como material de análisis, pero no sustituyen los documentos versionados
dentro del repositorio.

Antes de implementar o modificar un módulo, la IA debe verificar que los
documentos contractuales que utilizará existen físicamente dentro del
workspace y pertenecen al repositorio actual.

### RULE-DOC-001 — Verificar existencia física

Antes de comenzar una revisión contractual o implementación, verificar la
existencia física de los documentos requeridos.

Si un documento solamente fue proporcionado mediante chat y no existe en
el repositorio, debe reportarse como documentación no persistida.

La IA no debe reconstruirlo desde memoria ni asumir que conserva su
contenido completo.

### RULE-DOC-002 — No usar el chat como contrato

Una decisión discutida únicamente en chat no se considera contrato
persistente hasta que:

1. sea aprobada por el responsable del proyecto;
2. sea incorporada al documento correspondiente;
3. el documento exista dentro del repositorio.

El chat puede originar una decisión, pero no reemplaza su documentación.

### RULE-DOC-003 — No reconstruir documentos faltantes

Si falta un documento contractual requerido:

- no recrearlo automáticamente;
- no completarlo desde memoria;
- no inferir su contenido;
- no continuar una implementación que dependa de él.

Debe reportarse el documento faltante y detener únicamente el trabajo
afectado.

### RULE-DOC-004 — Jerarquía documental

Cuando exista contradicción entre fuentes, utilizar la siguiente prioridad:

1. decisiones de negocio explícitamente aprobadas y persistidas;
2. documentos `DECISION_*.md` aprobados para el módulo;
3. `AI_IMPLEMENTATION_RULES.md`;
4. contratos de arquitectura;
5. contratos públicos del módulo;
6. documentación de API de la implementación vigente;
7. código implementado;
8. tests;
9. material histórico o de referencia;
10. contexto del chat.

Una contradicción entre una fuente superior y una inferior no debe
resolverse silenciosamente.

Debe reportarse antes de modificar comportamiento.

### RULE-DOC-005 — Código distinto del contrato

Si durante la revisión se descubre que el código vigente contradice un
contrato aprobado:

- no asumir automáticamente que el código es correcto;
- no modificar automáticamente el contrato para describir el código;
- no modificar automáticamente el código para coincidir con el contrato.

Reportar:

Problem:
Contract says:
Implementation does:
Affected module:
Operational impact:
Proposed resolution:

La resolución requiere aprobación antes de cambiar comportamiento.

### RULE-DOC-006 — Documentación de implementación

Los documentos de API de implementación deben describir el comportamiento
real del código, pero no tienen autoridad para introducir nuevas reglas de
negocio.

Si para documentar un endpoint se descubre una inconsistencia contractual,
debe reportarse por separado.

### RULE-DOC-007 — Material obsoleto

Los archivos almacenados en directorios identificados como `obsoleto`,
`archive`, `legacy` o equivalentes son únicamente material histórico.

No pueden utilizarse como contrato vigente salvo autorización explícita.

### RULE-DOC-008 — No iniciar implementación con decisiones abiertas

Antes de implementar un nuevo módulo, realizar primero una revisión
contractual.

La revisión debe clasificar cada punto como:

- DEFINED
- MISSING
- AMBIGUOUS
- CONTRADICTORY
- OUT_OF_SCOPE

Los puntos `MISSING`, `AMBIGUOUS` o `CONTRADICTORY` que afecten reglas de
negocio, persistencia, estados, ownership, transacciones o APIs bloquean
únicamente la parte afectada de la implementación.

La IA debe solicitar decisión; no completarla por inferencia.

------------------------------------------------------------------------

## 3. Reglas inviolables

### RULE-001 --- No modificar el core sin autorización

No modificar `src/core` para implementar reglas específicas de negocio.

### RULE-002 --- No contaminar Access Management

No agregar entidades de negocio a:

``` text
src/modules/access-management
```

### RULE-003 --- No acceso directo entre módulos

Está prohibido importar desde otro módulo:

-   repositories;
-   services;
-   controllers;
-   Prisma repositories;
-   modelos Prisma internos.

Usar exclusivamente `<module>.api.ts`.

### RULE-004 --- No duplicar infraestructura

No crear nuevas instancias de:

-   Firebase;
-   Prisma;
-   PostgreSQL;
-   auditoría;
-   autenticación;
-   coordinadores transaccionales paralelos.

Utilizar las dependencias existentes. Para Winter queda autorizado un único
`UnitOfWork` compartido de infraestructura para propagar el mismo contexto
transaccional entre Production, Inventory y Audit cuando el workflow exija
atomicidad. Esta autorización no permite crear un UnitOfWork diferente por
cada integración intermodular ni introducir reglas de negocio dentro de él.

### RULE-005 --- No romper contratos existentes

No cambiar sin autorización:

-   endpoints;
-   permisos;
-   códigos de error;
-   formato de respuesta;
-   comportamiento existente;
-   contratos públicos.

Si un cambio es necesario, declararlo antes de implementarlo.

### RULE-006 --- No convertir reglas de negocio en CRUD

Si una operación implica transición de estado, validaciones complejas,
efectos secundarios, inventario, costos, trazabilidad o auditoría,
implementarla como command de dominio.

### RULE-007 --- No cambiar estados arbitrariamente

Una transición debe validar:

-   estado actual;
-   precondiciones;
-   permisos;
-   dependencias;
-   efectos secundarios.

No permitir que un `PATCH` salte reglas de negocio.

### RULE-008 --- Auditoría atómica

Cuando una escritura requiera auditoría, ambas deben formar parte de la
misma transacción.

### RULE-009 --- No acceder a Prisma desde controllers

Controllers traducen HTTP hacia casos de uso. No contienen reglas de
negocio ni consultas Prisma.

### RULE-010 --- No confiar en el frontend

Toda regla importante debe validarse en backend.

### RULE-011 --- No ocultar errores de dominio

Utilizar códigos de error de aplicación explícitos.

No devolver errores internos de Prisma, PostgreSQL o Firebase
directamente al cliente.

### RULE-012 --- No introducir dependencias innecesarias

Antes de agregar una librería, verificar si la funcionalidad ya existe
en el proyecto.

### RULE-013 --- No refactorizar sin necesidad

No realizar refactors generales mientras se implementa un módulo, salvo
que sean indispensables para cumplir el contrato.

### RULE-014 --- No modificar módulos no relacionados

Una tarea de Inventory no debe producir cambios arbitrarios en Articulos,
Compras, Production o Access Management.

### RULE-015 --- Mantener inyección de dependencias

Repositories, services y Unit of Work deben recibir sus dependencias
explícitamente.

### RULE-016 --- Mantener separación de dominio

No exponer tipos Prisma como contratos públicos de módulo.

### RULE-017 --- Mantener precisión monetaria

Los importes monetarios deben manejarse con precisión decimal y
exponerse como strings decimales en la API.

### RULE-018 --- No eliminar historial operativo

No implementar borrado físico cuando el dominio exige conservar
trazabilidad. Si una entidad debe descontinuarse, utilizar estado/active
o un command de dominio.

### RULE-019 --- No crear lógica paralela

Si otro módulo ya es propietario de una regla o dato, consumirlo
mediante su API.

### RULE-020 --- Fallar de forma explícita

Si falta una dependencia de DocType, existe una ruta duplicada, permiso
duplicado o dependencia circular, el sistema debe fallar durante la
composición/arranque.

### RULE-021 --- Winter es el sistema; Logger es la base técnica

No crear un segundo sistema ni tratar Logger y Winter como productos
independientes. Winter extiende el monolito modular existente de Logger.

### RULE-022 --- Articulos y Compras son el ownership final

Products y Purchases pertenecieron al proyecto Logger y fueron retirados del
runtime de Winter una vez implementados Articulos y Compras. Winter utiliza
únicamente los módulos oficiales `Articulos` y `Compras`; no trasladar reglas,
tablas ni contratos de los módulos retirados al dominio final.

### RULE-023 --- Identidad de actor y participantes

El actor autenticado de una operación se identifica mediante `User.id` del
sistema de acceso existente y se obtiene exclusivamente del contexto
autenticado; nunca se acepta como actor desde el body. No crear un agregado
`Person` en el MVP. Los participantes de trabajos productivos pertenecen a una
entidad operativa propia `ProductionParticipant`, que puede relacionarse
opcionalmente con un `User`, pero no requiere uno. Un trabajo puede tener
múltiples participantes y roles descriptivos configurables. Un participante no
es el actor del sistema ni adquiere por ello permisos.

### RULE-024 --- Clasificación de lotes de Inventory por command

No editar directamente la clasificación de un `InventoryLot`. La transición
`PRODUCTO_ENVASADO -> PRODUCTO_TERMINADO` debe realizarse mediante el command
`transitionInventoryLotClassification`, validando la transición y generando
auditoría. El mismo mecanismo se reutiliza para las clasificaciones de
exportación definidas por el dominio.

### RULE-025 --- Contexto físico de ProductionWork

`ProductionWork` puede relacionarse directamente con uno o varios
`ProductionBatch` y/o `Container`. Estas relaciones son opcionales según el
tipo de trabajo. No trasladar a `ProductionWork` las cantidades, movimientos,
mediciones o mermas que pertenecen a sus entidades específicas.

### RULE-026 --- Producer y GrapeVariety pertenecen a Production

`Producer` y `GrapeVariety` son catálogos del módulo Production.
`GrapeReception` los referencia por identificador. No modelarlos como texto
libre, Articulo ni entidades de Core. Si sus campos exactos todavía no están
documentados, detener únicamente la parte que dependa de esos campos y
reportar la definición faltante.

### RULE-027 --- Subproducto no es agregado del MVP

No crear entidad, agregado o módulo `Subproducto`. Un resultado secundario
reutilizable o trazable se representa como salida de transformación /
`ProductionBatch`; una merma, descarte o residuo se representa mediante
`ProductionLoss` cuando corresponda.

### RULE-028 --- Convención de permisos

Todos los permisos de Winter utilizan la sintaxis estable:

``` text
<module>:<action>
```

No crear permisos con notación por punto (`production.read`).

------------------------------------------------------------------------

## 4. Regla de lectura antes de escritura

Antes de modificar un archivo:

1.  leer el archivo completo;
2.  identificar dependencias;
3.  revisar tests;
4.  verificar si forma parte de un contrato;
5.  realizar el cambio mínimo necesario.

No sobrescribir archivos completos simplemente para cambiar una sección.

------------------------------------------------------------------------

## 5. Regla para nuevos módulos

Antes de crear un módulo, producir internamente este análisis:

``` text
Module:
Purpose:
Owned entities:
Dependencies:
Public API:
Permissions:
Queries:
Commands:
State transitions:
Business invariants:
Transactions:
Audit events:
Error codes:
Tests:
```

Si alguno de estos puntos no está definido por la especificación, no
inventar una regla de negocio. Señalar la ausencia.

## 5.1. Regla especial para Production

Production es un módulo de alta criticidad debido a que coordina
transformaciones físicas, trazabilidad e Inventory.

Antes de implementar Production debe existir una revisión contractual
aprobada que defina, como mínimo:

- ProductionOrder;
- TransformationOrder;
- ProductionWork;
- ProductionBatch;
- Container;
- consumos;
- outputs;
- transformaciones;
- pérdidas/mermas;
- mediciones;
- relaciones entre batches y recipientes;
- estados y transiciones;
- ownership de cada entidad;
- integración con Articulos;
- integración con Inventory;
- atomicidad de operaciones;
- idempotencia;
- auditoría;
- permisos;
- errores de dominio.

### RULE-PROD-001 — Production no modifica Inventory directamente

Production no puede escribir directamente:

- InventoryMovement;
- InventoryStock;
- InventoryLot.

Todo efecto físico debe realizarse mediante la API pública de Inventory y,
cuando el workflow exija atomicidad, utilizando el UnitOfWork compartido
autorizado.

### RULE-PROD-002 — No inventar trazabilidad

Si no está definido cómo una operación relaciona:

ProductionOrder
ProductionWork
ProductionBatch
Container
InventoryLot
InventoryMovement

la implementación afectada debe detenerse.

No crear relaciones solamente porque resulten técnicamente convenientes.

### RULE-PROD-003 — Transformaciones atómicas

Una transformación que consume uno o más batches y genera nuevos batches,
outputs o pérdidas debe ejecutarse como una única operación de dominio.

No puede quedar persistido un consumo sin su resultado correspondiente
cuando ambos pertenecen a la misma transformación.

### RULE-PROD-004 — No confundir trabajo con movimiento físico

`ProductionWork` registra el trabajo realizado.

No debe utilizarse como sustituto de:

- consumo;
- output;
- transformación;
- pérdida;
- medición;
- movimiento de Inventory.

Cada concepto conserva su ownership y reglas propias.

### RULE-PROD-006 — Batches, transformaciones y cantidades

`ProductionBatch` es la fuente de verdad del producto en proceso y representa
una cantidad identificable y trazable de un `Articulo`. Cada transformación que
cambia el producto crea un nuevo batch; una operación que no lo cambia puede
mantener el mismo batch. Un consumo parcial conserva el remanente del batch
original y la cantidad disponible nunca puede ser negativa.

Una división física crea batches hijos irreversibles. La mezcla de dos o más
batches crea un nuevo batch con trazabilidad hacia todos sus orígenes. Un
`Container` productivo no contiene dos batches independientes; introducir otro
batch constituye una mezcla/transformación.

Los consumos y outputs son conceptos de la operación de transformación y no
implican necesariamente entidades persistidas independientes. Todo output
reutilizable se representa como `ProductionBatch`; no crear `Subproducto`.
La transformación completa, incluidos consumos, outputs y pérdidas explícitas,
es atómica.

### RULE-PROD-007 — Cierres y correcciones irreversibles

`ProductionOrder` y `TransformationOrder` solo utilizan los estados `OPEN` y
`CLOSED`. El cierre valida sus precondiciones, es irreversible y no existe
reapertura. Los registros operativos históricos no se eliminan físicamente;
toda corrección es explícita, auditable y requiere motivo.

### RULE-PROD-008 — Custom Fields

Los campos contractuales (`CORE_FIELDS`) no se sustituyen por campos
configurables. Los `CUSTOM_FIELDS` deben utilizar las definiciones y tipos
aprobados por Production, conservar valores históricos al desactivarse y
mantener código estable. No pueden convertirse automáticamente en invariantes,
relaciones ni reglas estructurales del dominio.

Los tipos iniciales son `TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE` y
`SELECT`. Las entidades soportadas inicialmente son `Producer`,
`GrapeVariety` y `GrapeReception`. Las definiciones con valores históricos no
se eliminan físicamente; todo cambio administrativo se audita.

### RULE-PROD-009 — Frontera Production → Inventory

Mientras el producto está en proceso, `ProductionBatch` es la fuente de verdad
y no se representa simultáneamente como `InventoryStock`. Production no escribe
directamente lotes, movimientos ni stock de Inventory: solicita la operación
mediante la API pública de Inventory.

La salida es una única operación atómica y explícitamente tipada que coordina la
reducción del batch, el `InventoryLot` con `originProductionBatchId`, el
`InventoryMovement`, el `InventoryStock` y las auditorías correspondientes.
Puede ser parcial y originar varios lotes, sin duplicar cantidades; cualquier
fallo provoca rollback completo.

### RULE-PROD-005 — Detenerse ante ambigüedad física

Cuando una regla no permita determinar inequívocamente:

- qué se consume;
- qué se produce;
- qué batch cambia;
- qué recipiente participa;
- qué cantidad se mueve;
- qué unidad corresponde;
- qué lote de Inventory resulta afectado;

la IA debe detener esa operación y solicitar definición funcional.

------------------------------------------------------------------------

## 6. Regla de ownership

Antes de crear una entidad preguntar:

> ¿Qué módulo es el propietario de esta información?

Si ya existe un propietario, no crear una copia local de la misma
entidad para evitar consumir su API.

------------------------------------------------------------------------

## 7. Regla de dependencias

Una dependencia debe ser explícita en el DocType.

Ejemplo:

``` text
production
    depends on:
        recipes
        inventory
        articulos
```

El código debe consumir:

``` ts
resolve<RecipeApi>("recipes")
resolve<InventoryApi>("inventory")
resolve<ArticulosApi>("articulos")
```

No acceder directamente a sus repositories.

------------------------------------------------------------------------

## 8. Regla de comandos

Un command debe:

1.  validar que el recurso exista;
2.  validar su estado actual;
3.  validar precondiciones;
4.  consultar dependencias;
5.  ejecutar el cambio;
6.  ejecutar efectos secundarios;
7.  registrar auditoría;
8.  completar todo de forma atómica cuando corresponda.

------------------------------------------------------------------------

## 9. Regla de transacciones

Si una operación produce múltiples cambios que deben ocurrir juntos:

``` text
BEGIN
  change A
  change B
  change C
  audit
COMMIT
```

Nunca implementar:

``` text
change A -> commit
change B -> commit
audit -> fail
```

cuando el dominio exige atomicidad.

------------------------------------------------------------------------

## 10. Regla de pruebas

Un módulo no está terminado solamente porque compile.

Debe probar:

### Dominio

-   happy path;
-   reglas;
-   invariantes;
-   transiciones;
-   casos límite.

### Integración

-   repositories;
-   transacciones;
-   dependencias;
-   auditoría.

### HTTP

-   400;
-   401;
-   403;
-   404;
-   409;
-   respuestas exitosas.

### Seguridad

-   token ausente;
-   token inválido;
-   usuario inexistente;
-   usuario inactivo;
-   permiso faltante.

------------------------------------------------------------------------

## 11. Verificación obligatoria

Antes de declarar una tarea terminada:

``` bash
npm run db:validate
npm run db:generate
npm run typecheck
npm test
npm run build
```

Si alguno falla, la tarea no está terminada.

La IA debe reportar qué falló en lugar de ocultarlo.

------------------------------------------------------------------------

## 12. Regla de cambios de esquema

Antes de modificar Prisma:

1.  revisar entidades existentes;
2.  revisar ownership;
3.  revisar relaciones;
4.  revisar política de borrado;
5.  revisar índices y restricciones únicas;
6.  crear migración;
7.  validar migración;
8.  actualizar tests.

No modificar la base de datos directamente fuera del flujo de
migraciones del proyecto.

------------------------------------------------------------------------

## 13. Regla para errores

Los errores de dominio deben utilizar códigos estables.

Ejemplo:

``` text
PRODUCT_NOT_FOUND
PURCHASE_REFERENCE_ALREADY_EXISTS
SALE_INVALID_STATE
INSUFFICIENT_STOCK
PRODUCTION_NOT_COMPLETABLE
```

No utilizar mensajes como mecanismo de control de flujo.

------------------------------------------------------------------------

## 14. Regla para auditoría

Cada evento debe responder:

``` text
Who?
What?
Which resource?
When?
Relevant metadata?
```

Ejemplo:

``` text
PRODUCTION_COMPLETED
resourceType: production
resourceId: ...
metadata:
  batchNumber: ...
  changedFields: [...]
```

Nunca registrar secretos o tokens.

------------------------------------------------------------------------

## 15. Regla para cambios arquitectónicos

Si la IA considera necesario cambiar la arquitectura:

**NO implementarlo silenciosamente.**

Debe identificar:

``` text
Problem:
Current limitation:
Proposed change:
Affected modules:
Affected contracts:
Migration required:
Risk:
```

La implementación queda bloqueada hasta que la decisión arquitectónica
sea aprobada.

------------------------------------------------------------------------

## 16. Definition of Done

Una implementación se considera terminada solamente cuando:

-   [ ] respeta ownership;
-   [ ] respeta dependencias;
-   [ ] usa la API pública de otros módulos;
-   [ ] tiene validaciones;
-   [ ] tiene reglas de dominio;
-   [ ] tiene auditoría cuando corresponde;
-   [ ] tiene transacciones cuando corresponde;
-   [ ] tiene tests;
-   [ ] mantiene los contratos existentes;
-   [ ] `typecheck` pasa;
-   [ ] tests pasan;
-   [ ] build pasa;
-   [ ] no existen cambios no relacionados.

------------------------------------------------------------------------

## 17. Prioridad de decisión

Cuando existan dudas, seguir este orden:

``` text
1. Approved and persisted business decisions
2. Approved module DECISION_*.md
3. AI_IMPLEMENTATION_RULES.md
4. ARCHITECTURE.md
5. MODULE_CONTRACT.md
6. DOMAIN_MODEL.md / AGGREGATES_AND_ENTITIES.md
7. WORKFLOWS.md / API_CONTRACTS.md
8. Existing public module APIs
9. Current implementation
10. Existing tests
11. Historical/reference documents
12. Chat context
13. General programming conventions
```

Nunca utilizar una convención genérica de programación para contradecir
una regla explícita de Logger.

------------------------------------------------------------------------

## 18. Principio final

> **La IA implementa decisiones. No inventa decisiones de negocio ni
> arquitectura.**

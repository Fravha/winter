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
10. inspeccionar `src/modules/products` y, cuando corresponda,
    `src/modules/purchases` únicamente como referencias estructurales;
11. inspeccionar las APIs públicas de sus dependencias;
12. revisar tests existentes relacionados.

No comenzar escribiendo código sin entender primero el contrato del
módulo.

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
Compras, Production, los módulos de referencia `products`/`purchases` o Access Management.

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

### RULE-022 --- Products y Purchases son referencias, no ownership final

Los módulos `products` y `purchases` existentes en Logger son prototipos y
referencias estructurales. Winter define sus propios módulos `Articulos` y
`Compras`. No trasladar automáticamente reglas, tablas o contratos de los
prototipos al dominio final.

### RULE-023 --- Identidad de actor y participantes

El actor autenticado de una operación se identifica mediante `User.id` del
sistema de acceso existente. No crear un agregado `Person` en el MVP. Los
equipos o personas participantes en trabajos productivos se conservan en una
lista operativa del trabajo y no adquieren por ello identidad de usuario, rol
o permiso.

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
        products
```

El código debe consumir:

``` ts
resolve<RecipeApi>("recipes")
resolve<InventoryApi>("inventory")
resolve<ProductApi>("products")
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
1. Explicit business specification
2. AI_IMPLEMENTATION_RULES.md
3. ARCHITECTURE.md
4. MODULE_CONTRACT.md
5. Existing public module APIs
6. Existing reference implementation
7. Existing tests
8. General programming conventions
```

Nunca utilizar una convención genérica de programación para contradecir
una regla explícita de Logger.

------------------------------------------------------------------------

## 18. Principio final

> **La IA implementa decisiones. No inventa decisiones de negocio ni
> arquitectura.**

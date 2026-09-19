# Winter / Logger --- ARCHITECTURE.md

## 1. Propósito

Winter es el sistema de negocio de gestión de producción, trazabilidad e
inventario de Bodega Cruce del Zorro.

Logger es la base técnica previa sobre la cual se construye Winter. Aporta
la estructura de monolito modular, autenticación, autorización RBAC,
auditoría, infraestructura compartida, DocTypes y contratos técnicos de
integración. Logger no constituye el producto final de negocio.

Por tanto, Winter extiende la arquitectura existente de Logger sin crear un
sistema paralelo ni reemplazar sus capacidades transversales ya validadas.

El objetivo de esta arquitectura es permitir que los módulos de negocio
evolucionen sin acoplarse al núcleo de seguridad ni entre sí mediante
acceso directo a infraestructura interna.

## 2. Principios arquitectónicos

1.  **El core es infraestructura compartida, no dominio de negocio.**
2.  **Cada módulo es dueño de sus entidades y reglas de negocio.**
3.  **La comunicación entre módulos se realiza mediante APIs públicas de
    módulo.**
4.  **Un módulo nunca accede directamente al repository, service o
    modelo Prisma de otro módulo.**
5.  **Las reglas de negocio viven en services/use cases, no en
    controllers ni routes.**
6.  **Las operaciones de escritura relevantes deben ser atómicas con su
    auditoría.**
7.  **La autenticación y autorización son responsabilidades del core.**
8.  **Los módulos de negocio no crean instancias propias de Firebase,
    Prisma o PostgreSQL.**
9.  **Los contratos públicos deben ser estables y explícitos.**
10. **La arquitectura existente debe extenderse, no reemplazarse, salvo
    decisión arquitectónica explícita.**

## 3. Capas del sistema

``` text
Frontend / Consumers
        |
        v
     HTTP API
        |
        v
+-----------------------+
| Routes / Controllers  |
+-----------------------+
        |
        v
+-----------------------+
| Domain Services       |
| Commands / Queries    |
+-----------------------+
        |
        +------------------+
        |                  |
        v                  v
+---------------+   +----------------+
| Public Module |   | Unit of Work   |
| APIs          |   | / Transactions |
+---------------+   +----------------+
        |                  |
        +--------+---------+
                 v
        +------------------+
        | Repositories     |
        +------------------+
                 |
                 v
        +------------------+
        | PostgreSQL/Prisma|
        +------------------+
```

El core transversal acompaña este flujo:

``` text
Authentication
     |
Current Local User
     |
RBAC Permission
     |
Audit Context
```

## 4. Core / Platform

### `src/core`

Contiene funcionalidades transversales y no específicas del dominio:

-   autenticación Firebase;
-   resolución del usuario local;
-   autorización RBAC;
-   auditoría;
-   errores de aplicación;
-   infraestructura compartida;
-   contratos transversales.

Los módulos de negocio no deben introducir reglas propias dentro de
`src/core`.

### `src/modules/access-management`

Contiene la administración de:

-   usuarios;
-   roles;
-   permisos;
-   asignaciones.

Este módulo es parte de la plataforma de acceso y no debe convertirse en
un contenedor de entidades de negocio.

## 5. Business Modules

Los módulos de negocio viven bajo:

``` text
src/modules/
```

Los módulos finales del MVP de Winter son conceptualmente:

``` text
articulos
compras
production
inventory
```

Products y Purchases pertenecieron al proyecto Logger y fueron retirados del
runtime de Winter una vez implementados Articulos y Compras. No representan
módulos disponibles ni ownership de negocio de Winter.

Cada módulo:

-   posee sus entidades;
-   contiene sus reglas;
-   expone una API pública;
-   declara sus permisos;
-   declara sus dependencias;
-   registra un `DocType`;
-   expone rutas HTTP cuando corresponde.

## 6. Ownership de datos

Cada entidad debe tener un único módulo propietario.

Ownership conceptual del MVP de Winter:

``` text
Articulos
  └── Articulo

Compras
  └── Compra / Purchase

Production
  ├── Producer
  ├── GrapeVariety
  ├── Vendimia / Harvest
  ├── RecepcionUva / GrapeReception
  ├── ProductionOrder
  ├── TransformationOrder
  ├── ProductionBatch
  ├── ProductionWork
  ├── ProductionParticipant
  ├── Container
  ├── Transformation
  ├── ProductionLoss
  ├── Measurement
  └── CustomFieldDefinition / values

Inventory
  ├── Warehouse
  ├── InventoryLot
  ├── Stock
  └── InventoryMovement
```

El ownership significa que solamente el módulo propietario decide cómo
se crea, modifica, elimina o cambia de estado una entidad.

Otros módulos pueden solicitar operaciones mediante la API pública del
propietario.

## 7. Comunicación entre módulos

La comunicación debe seguir:

``` text
Production
    |
    v
InventoryApi
```

y no:

``` text
Production
    |
    X
PrismaInventoryRepository
```

Los contratos públicos viven en:

``` text
<module>.api.ts
```

El API público debe exponer solamente operaciones necesarias para otros
módulos.

No debe exponer:

-   Prisma;
-   Express;
-   repositories concretos;
-   controllers;
-   detalles internos de persistencia.

## 8. DocType Registry

Un `DocType` es el descriptor de integración de un módulo.

Declara:

-   nombre;
-   ruta;
-   permisos;
-   dependencias;
-   construcción del router;
-   API pública.

`DocTypeRegistry`:

1.  valida nombres y rutas;
2.  valida permisos;
3.  resuelve dependencias;
4.  detecta dependencias circulares;
5.  construye APIs;
6.  monta routers;
7.  expone los módulos bajo `/api/v1`.

Los módulos de negocio se registran en:

``` text
src/modules/doc-types/index.ts
```

No se debe modificar manualmente el router global para montar un módulo
de negocio.

## 9. Estructura de un módulo

Estructura recomendada:

``` text
src/modules/<module>/
├── <entity>.model.ts
├── <entity>.dto.ts
├── <entity>.schema.ts
├── <entity>.repository.ts
├── prisma-<entity>.repository.ts
├── <entity>.unit-of-work.ts
├── prisma-<entity>.unit-of-work.ts
├── <entity>.api.ts
├── <entity>.service.ts
├── <entity>.controller.ts
├── <entity>.routes.ts
└── <entity>.doc-type.ts
```

No todos los módulos deben tener exactamente la misma cantidad de
archivos. La estructura se adapta al dominio, pero las responsabilidades
deben mantenerse separadas.

## 10. CRUD vs operaciones de dominio

Logger no considera que toda entidad deba exponerse como CRUD.

### Queries

Consultas que no modifican el estado:

``` text
list
getById
getAvailableStock
getProductionHistory
```

### CRUD

Adecuado para maestros simples:

``` text
create
read
update
delete
```

### Commands

Operaciones que representan una decisión o transición de negocio:

``` text
confirm
approve
start
complete
cancel
consume
adjust
close
```

Si una acción implica reglas, cambios de estado, movimientos de
inventario, cálculos, efectos sobre otros módulos o auditoría
específica, debe modelarse como un command de dominio y no como un
simple `PATCH`.

## 11. Transacciones

Una escritura de negocio y su auditoría deben ejecutarse atómicamente
cuando forman parte de la misma operación. En la salida de Production hacia
Inventory, la misma operación lógica incluye la reducción del
`ProductionBatch`, el `InventoryLot` con `originProductionBatchId`, el
`InventoryMovement`, el `InventoryStock` y ambas auditorías. El intercambio
entre módulos utiliza resultados explícitamente tipados; cualquier fallo
provoca rollback completo.

``` text
BEGIN
  business change
  related changes
  inventory movements
  audit log
COMMIT
```

Si cualquier parte falla:

``` text
ROLLBACK
```

La unidad de trabajo permite que repositories y auditoría utilicen el
mismo cliente transaccional.

Para Winter queda autorizada una única infraestructura compartida de
`UnitOfWork`, independiente de los módulos de negocio. Su responsabilidad es
administrar y propagar el contexto transaccional para workflows que deban
coordinar operaciones de Production, Inventory y Audit dentro de una misma
transacción.

Este `UnitOfWork` compartido:

- no contiene reglas de negocio;
- no convierte un módulo en propietario de entidades de otro módulo;
- no permite acceso directo a repositories internos entre módulos;
- no funciona como service locator;
- debe reutilizar el mismo cliente Prisma/transaccional existente;
- debe ser utilizado únicamente cuando el workflow exija atomicidad entre
  módulos.

La ubicación física exacta del componente dentro de la infraestructura del
proyecto es una decisión técnica de implementación, no una nueva frontera de
dominio.

## 12. Seguridad

Toda ruta de negocio debe respetar:

``` text
Firebase authentication
        ↓
Local user resolution
        ↓
ACTIVE user validation
        ↓
RBAC permission
        ↓
Request validation
        ↓
Controller
```

Un Firebase ID Token válido no implica autorización para operar en
Logger.

## 13. Auditoría

Las operaciones relevantes de escritura deben generar eventos de
auditoría.

Ejemplo:

``` text
PRODUCT_CREATED
PURCHASE_CREATED
SALE_CREATED
PRODUCTION_COMPLETED
INVENTORY_ADJUSTED
```

La auditoría debe registrar contexto suficiente para reconstruir quién
realizó la acción y sobre qué recurso.

No se deben almacenar:

-   tokens;
-   secretos;
-   contraseñas;
-   cuerpos completos de requests sin necesidad de negocio.

## 14. Contrato HTTP

La API utiliza:

``` text
/api/v1
```

Las respuestas exitosas con contenido utilizan:

``` json
{
  "data": {}
}
```

Los errores utilizan:

``` json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "requestId": "REQUEST_UUID"
  }
}
```

Los códigos de error forman parte del contrato público.

## 15. Contrato de datos

Los valores monetarios deben representarse como strings decimales en la
API.

Ejemplo:

``` json
{
  "price": "100.50"
}
```

No se deben transportar importes monetarios como números JSON cuando
exista riesgo de pérdida de precisión.

## 16. Extensibilidad

La arquitectura debe permitir integrar posteriormente sistemas externos
como:

-   SAP;
-   IZI;
-   otros ERP;
-   sistemas contables.

Las futuras integraciones deben consumir contratos públicos y no
acoplarse a tablas internas de módulos de negocio.

## 17. Referencia arquitectónica

Los módulos actuales de Winter son la referencia estructural vigente. Products
y Purchases fueron retirados del runtime y no deben utilizarse como módulos de
referencia activa.

Debe utilizarse para comprender:

-   organización;
-   inyección de dependencias;
-   repositories;
-   services;
-   controllers;
-   routes;
-   DocTypes;
-   contratos HTTP.

No debe asumirse que esos módulos legacy exponen APIs disponibles. Los módulos
`Articulos` y `Compras` de Winter deben respetar los
contratos aquí definidos.

## 18. Estado arquitectónico

Actualmente Logger ya valida como funcionales:

-   autenticación;
-   usuario local;
-   RBAC;
-   administración de usuarios;
-   validación de módulos;
-   estructura de DocTypes;
-   Articulos y Compras como módulos oficiales de Winter.

A partir de este punto, Winter debe construir sus módulos de negocio propios
sobre esta base, respetando el contrato arquitectónico y evitando degradar
las capacidades existentes de Logger.

La convención estable de permisos para Winter será:

``` text
<module>:<action>
```

Ejemplos:

``` text
production:read
production:work_create
inventory:adjust
```

# Logger --- MODULE_CONTRACT.md

## 1. Propósito

Este documento define el contrato que todo módulo de negocio de Logger
debe cumplir.

El objetivo es que módulos como Products, Purchases, Inventory, Recipes,
Production y Sales puedan evolucionar independientemente manteniendo una
arquitectura coherente.

Un módulo no se considera simplemente un conjunto de endpoints CRUD. Es
una unidad de dominio con:

-   ownership;
-   reglas;
-   casos de uso;
-   contratos;
-   dependencias;
-   permisos;
-   auditoría;
-   persistencia;
-   pruebas.

------------------------------------------------------------------------

## 2. Definición mínima de un módulo

Todo módulo debe definir:

``` text
Identity
Purpose
Owned entities
Public API
Permissions
Dependencies
Queries
Commands
Business rules
State transitions
Persistence
Audit events
HTTP routes
Error contract
Tests
DocType
```

------------------------------------------------------------------------

## 3. Identidad

Cada módulo debe tener:

``` text
name:
route:
```

Ejemplo:

``` text
name: products
route: /products
```

El nombre debe ser único.

La ruta debe ser única dentro de la API.

------------------------------------------------------------------------

## 4. Ownership

El módulo debe declarar explícitamente las entidades de las que es
propietario.

Ejemplo:

``` text
Inventory owns:
- Stock
- Lot
- InventoryMovement
```

El propietario es responsable de:

-   creación;
-   actualización;
-   eliminación o desactivación;
-   invariantes;
-   estados;
-   reglas;
-   persistencia.

Otro módulo nunca debe modificar directamente una entidad que no le
pertenece.

------------------------------------------------------------------------

## 5. Modelo de dominio

El modelo de dominio no debe depender de Prisma.

Ejemplo:

``` ts
export interface Product {
  id: string;
  code: string;
  name: string;
  price: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

El modelo representa el contrato interno del dominio, no el esquema de
persistencia.

------------------------------------------------------------------------

## 6. DTOs

Los DTOs representan datos de entrada para casos de uso.

Separar:

``` text
CreateXDto
UpdateXDto
CommandDto
QueryDto
```

No utilizar directamente modelos Prisma como DTOs HTTP.

------------------------------------------------------------------------

## 7. Validación

La validación HTTP se realiza antes de llegar al controller/service.

Validar:

-   params;
-   query;
-   body;
-   UUID;
-   fechas;
-   decimales;
-   strings;
-   enumeraciones;
-   campos obligatorios;
-   combinaciones inválidas.

Un `PATCH` debe rechazar cuerpos vacíos cuando la operación requiere al
menos un cambio.

------------------------------------------------------------------------

## 8. Repository Contract

El repository define persistencia sin conocer HTTP.

Ejemplo:

``` ts
export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  findByCode(code: string): Promise<Product | null>;
  create(data: CreateProductDto): Promise<Product>;
  update(id: string, data: UpdateProductDto): Promise<Product>;
  delete(id: string): Promise<void>;
}
```

La implementación Prisma:

``` text
PrismaXRepository
```

debe:

-   recibir el cliente por inyección;
-   mapear Prisma -\> dominio;
-   traducir errores conocidos;
-   no exponer errores internos de Prisma.

------------------------------------------------------------------------

## 9. Unit of Work

Utilizar Unit of Work cuando una operación requiere múltiples escrituras
que deben ser atómicas.

Ejemplo:

``` ts
interface ProductionUnitOfWork {
  execute<T>(
    work: (transaction: ProductionTransaction) => Promise<T>
  ): Promise<T>;
}
```

La transacción puede incluir:

``` text
domain write
related domain write
inventory movement
audit
```

------------------------------------------------------------------------

## 10. Service

El service contiene los casos de uso y reglas de negocio.

Debe poder responder:

``` text
¿Esta operación está permitida?
¿El estado actual lo permite?
¿Existen las dependencias necesarias?
¿Se cumple el stock?
¿Qué cambios deben ocurrir?
¿Qué debe auditarse?
```

El service no debe depender de Express.

------------------------------------------------------------------------

## 11. Queries

Las queries consultan información sin producir efectos de negocio.

Ejemplos:

``` text
listProducts
getProduct
getAvailableLots
getInventoryBalance
getProductionHistory
```

Las queries pueden usar repositories de lectura y APIs públicas de
dependencias cuando sea necesario.

------------------------------------------------------------------------

## 12. Commands

Los commands representan operaciones con intención de negocio.

Ejemplos:

``` text
confirmPurchase
receivePurchase
startProduction
completeProduction
cancelProduction
adjustInventory
```

Un command debe ser explícito y validar sus precondiciones.

No sustituir un command complejo por:

``` http
PATCH /resource/:id
{
  "status": "COMPLETED"
}
```

si cambiar el estado requiere efectos secundarios.

------------------------------------------------------------------------

## 13. Estados

Cuando una entidad tenga ciclo de vida, documentar:

``` text
States
Allowed transitions
Forbidden transitions
Transition commands
Side effects
```

Ejemplo:

``` text
DRAFT
  |
  +--> CONFIRMED
  |
  +--> CANCELLED

CONFIRMED
  |
  +--> IN_PROGRESS

IN_PROGRESS
  |
  +--> COMPLETED
  |
  +--> CANCELLED
```

No asumir que todos los estados pueden modificarse libremente.

------------------------------------------------------------------------

## 14. Invariantes

Cada módulo debe documentar reglas que siempre deben ser verdaderas.

Ejemplos:

``` text
A completed production must have a valid recipe.
An inventory balance cannot become negative unless explicitly allowed.
A product code is unique.
A purchase reference is unique.
A cancelled operation cannot be completed.
```

Las invariantes deben protegerse en backend y, cuando corresponda,
también mediante restricciones de base de datos.

------------------------------------------------------------------------

## 15. Public API

El archivo:

``` text
<module>.api.ts
```

es el contrato oficial entre módulos.

Ejemplo:

``` ts
export interface ProductApi {
  list(): Promise<Product[]>;
  getById(id: string): Promise<Product>;
}
```

Otro módulo puede importar:

``` ts
import type { ProductApi } from "../products/product.api";
```

No puede importar:

``` text
PrismaProductRepository
ProductService
ProductController
ProductRoutes
```

------------------------------------------------------------------------

## 16. API mínima

No exponer más operaciones de las necesarias.

Si Production solamente necesita:

``` text
ProductApi.getById()
```

no exponer operaciones administrativas innecesarias dentro del contrato
consumido por Production.

La API pública debe representar capacidades del módulo, no sus detalles
internos.

------------------------------------------------------------------------

## 17. Dependencias

Las dependencias deben declararse en el DocType.

Ejemplo:

``` ts
dependencies: [
  "products",
  "recipes",
  "inventory"
]
```

La dependencia debe utilizarse mediante:

``` ts
resolve<ProductApi>("products")
```

Las dependencias circulares están prohibidas.

Ejemplo inválido:

``` text
Production -> Inventory
Inventory  -> Production
```

Si el dominio requiere coordinación circular, debe revisarse la
arquitectura antes de implementar.

------------------------------------------------------------------------

## 18. Permisos

Los permisos deben seguir:

``` text
<module>:read
<module>:create
<module>:update
<module>:delete
```

Cuando existan commands de negocio importantes, pueden existir permisos
específicos:

``` text
production:complete
inventory:adjust
purchase:receive
```

Los códigos de permisos son contratos estables.

No cambiar códigos existentes sin migración y actualización de
consumidores.

------------------------------------------------------------------------

## 19. HTTP Routes

Las rutas deben encargarse de:

-   autenticación;
-   usuario local;
-   permiso;
-   validación;
-   delegación al controller.

Ejemplo:

``` ts
router.post(
  "/:id/complete",
  authenticate(tokenVerifier),
  resolveCurrentUser(userRepository),
  requirePermission("production:complete"),
  validateRequest({ params: idSchema }),
  controller.complete,
);
```

------------------------------------------------------------------------

## 20. Controller

El controller:

1.  recibe HTTP;
2.  obtiene datos validados;
3.  construye contexto;
4.  llama al service;
5.  transforma el resultado en respuesta HTTP.

No debe:

-   consultar Prisma;
-   contener reglas de dominio;
-   ejecutar lógica de inventario;
-   decidir transiciones de estado.

------------------------------------------------------------------------

## 21. Auditoría

Definir eventos por operación relevante.

Ejemplo:

``` text
PRODUCTION_CREATED
PRODUCTION_STARTED
PRODUCTION_COMPLETED
PRODUCTION_CANCELLED
```

La auditoría debe utilizar el contexto autenticado.

Las operaciones auditadas deben registrar:

``` text
actor
action
resourceType
resourceId
metadata
```

Cuando la operación es transaccional, la auditoría debe participar en la
misma transacción.

------------------------------------------------------------------------

## 22. Errores

Cada módulo debe definir sus errores relevantes.

Formato:

``` json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "requestId": "REQUEST_UUID"
  }
}
```

Categorías habituales:

``` text
400 VALIDATION_ERROR
401 authentication errors
403 authorization errors
404 resource not found
409 domain conflict
```

Ejemplos:

``` text
PRODUCT_NOT_FOUND
PURCHASE_NOT_FOUND
PRODUCT_CODE_ALREADY_EXISTS
PURCHASE_REFERENCE_ALREADY_EXISTS
INSUFFICIENT_STOCK
INVALID_PRODUCTION_STATE
PRODUCTION_NOT_COMPLETABLE
```

------------------------------------------------------------------------

## 23. Persistencia

Las restricciones importantes deben estar protegidas en dos niveles
cuando corresponda:

``` text
Business validation
        +
Database constraint
```

Ejemplo:

``` text
Product.code
    business validation
    +
    UNIQUE database constraint
```

No confiar exclusivamente en validación previa para garantizar unicidad.

------------------------------------------------------------------------

## 24. Eliminación

Cada módulo debe declarar la política de borrado por entidad:

``` text
physical delete
soft delete
deactivation
domain cancellation
immutable history
```

Una entidad que forma parte de trazabilidad no debe eliminarse si
hacerlo destruye el historial requerido por el negocio.

------------------------------------------------------------------------

## 25. Trazabilidad

Para Winter, la trazabilidad es una capacidad transversal del dominio.

La arquitectura debe permitir reconstruir:

``` text
Finished Product
      ↓
Production Lot
      ↓
Production Processes
      ↓
Inputs / Materials
      ↓
Raw Material Reception
      ↓
Grape Origin
```

El diseño debe evitar relaciones que rompan esta cadena histórica.

------------------------------------------------------------------------

## 26. Producción e inventario

Production e Inventory no deben duplicar responsabilidades.

Conceptualmente:

``` text
Production
    owns production process
          |
          v
Inventory
    owns stock and movements
```

Production solicita al módulo de Inventory las operaciones necesarias
para consumir o ingresar existencias.

Inventory es propietario de:

-   stock;
-   lots;
-   inventory movements;
-   reglas de inventario.

Production es propietario de:

-   production orders/lots;
-   production states;
-   process activities;
-   product transformation records.

------------------------------------------------------------------------

## 27. Productos y compras

Products representa el maestro de productos.

Purchases representa operaciones de compra.

Una compra no debe convertirse automáticamente en inventario simplemente
porque exista una entidad `Purchase`.

Si el dominio requiere recepción de mercadería o ingreso a stock, debe
existir un command/proceso explícito que coordine Purchases e Inventory.

------------------------------------------------------------------------

## 28. Registro DocType

Cada módulo debe exponer su descriptor:

``` ts
export const exampleDocType: DocType<ExampleApi> = {
  name: "example",
  route: "/examples",
  permissions: [],
  dependencies: [],
  register(dependencies, resolve) {
    // composition
  },
};
```

Debe registrarse en:

``` ts
businessDocTypes
```

No modificar el router global para introducir rutas de negocio.

------------------------------------------------------------------------

## 29. Estructura recomendada

``` text
src/modules/<module>/
├── <module>.model.ts
├── <module>.dto.ts
├── <module>.schema.ts
├── <module>.repository.ts
├── prisma-<module>.repository.ts
├── <module>.unit-of-work.ts
├── prisma-<module>.unit-of-work.ts
├── <module>.api.ts
├── <module>.service.ts
├── <module>.controller.ts
├── <module>.routes.ts
└── <module>.doc-type.ts
```

Cuando un módulo tenga múltiples agregados, se puede dividir
internamente, pero debe conservar las mismas responsabilidades
arquitectónicas.

------------------------------------------------------------------------

## 30. Definition of Done del módulo

Antes de considerar terminado un módulo:

-   [ ] propósito documentado;
-   [ ] ownership definido;
-   [ ] entidades definidas;
-   [ ] DTOs definidos;
-   [ ] validaciones definidas;
-   [ ] repository implementado;
-   [ ] service implementado;
-   [ ] commands documentados;
-   [ ] queries documentadas;
-   [ ] estados y transiciones definidos;
-   [ ] invariantes protegidas;
-   [ ] Unit of Work cuando corresponde;
-   [ ] auditoría implementada;
-   [ ] API pública definida;
-   [ ] dependencias declaradas;
-   [ ] permisos definidos;
-   [ ] routes protegidas;
-   [ ] errores definidos;
-   [ ] tests unitarios;
-   [ ] tests de integración;
-   [ ] tests HTTP;
-   [ ] migración validada;
-   [ ] typecheck aprobado;
-   [ ] tests aprobados;
-   [ ] build aprobado.

------------------------------------------------------------------------

## 31. Regla de evolución

Un módulo puede crecer internamente sin romper a sus consumidores
mientras mantenga estable su API pública.

Los cambios internos son libres siempre que no violen:

``` text
ownership
business invariants
security
audit
public API
data integrity
architecture
```

Los cambios de contrato requieren revisión explícita.

------------------------------------------------------------------------

## 32. Principio final

> **Un módulo de Logger es una unidad de dominio, no una carpeta de
> CRUD.**

Su responsabilidad es proteger la integridad del negocio que representa
y ofrecer capacidades claras al resto del sistema mediante contratos
públicos.

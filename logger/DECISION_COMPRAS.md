# DECISION_COMPRAS

## 1. Propósito y alcance

El módulo `compras` administra el ciclo administrativo de adquisición y
recepción de artículos en Winter.

Sus responsabilidades son:

- registrar compras y sus ítems;
- conservar información comercial y documental de referencia;
- permitir modificaciones mientras la compra esté abierta para edición;
- coordinar la recepción física total mediante la API pública de Inventory;
- conservar referencias a los movimientos creados para trazabilidad;
- cancelar compras cuando las reglas de estado lo permitan;
- auditar creación, modificación, recepción y cancelación.

Inventory continúa siendo el único propietario del stock físico, sus saldos,
movimientos y lotes. Compras no puede acceder directamente a tablas, modelos
Prisma, repositories ni servicios internos de Inventory.

Los módulos legacy `products` y `purchases` pertenecieron al proyecto Logger y
fueron retirados del runtime de Winter. Winter implementa el módulo `compras`
sin obligación de migrar ni mantener compatibilidad con ellos. Las entidades
`Purchase` y `PurchaseItem` que aparecen en este documento son nombres
conceptuales del dominio oficial de Compras, no referencias a esos módulos
legacy.

## 2. Entidades

### 2.1 Purchase

Campos aprobados:

- `id`: UUID técnico.
- `supplierName`: proveedor como dato referencial.
- `supplierTaxId`: NIT o identificador opcional del proveedor.
- `documentNumber`: número o referencia opcional del documento de compra.
- `documentDate`: fecha opcional del documento.
- `currency`: código textual opcional de moneda.
- `observations`: observaciones opcionales.
- `status`: estado cerrado de la compra.
- `createdByUserId`: usuario autenticado que creó la compra.
- `createdAt`: fecha técnica de creación.
- `updatedAt`: fecha técnica de actualización.

### 2.2 PurchaseItem

Campos aprobados:

- `id`: UUID técnico.
- `purchaseId`: compra propietaria del ítem.
- `articuloId`: artículo adquirido.
- `brand`: marca opcional como dato referencial.
- `requestedQuantity`: cantidad solicitada.
- `unit`: unidad base del artículo.
- `unitPrice`: precio unitario referencial opcional.
- `createdAt`: fecha técnica de creación.
- `updatedAt`: fecha técnica de actualización.

Debe existir unicidad lógica por:

```text
purchaseId + articuloId
```

Un artículo no puede repetirse dentro de una misma compra.

### 2.3 Entidades que no se crearán en el MVP

No se crearán maestros independientes de:

- Supplier;
- Brand;
- Currency.

Proveedor se conserva en Purchase y marca en PurchaseItem.

## 3. Estados y transiciones

Estados permitidos:

- `REGISTERED`
- `RECEIVED`
- `CANCELLED`

Toda nueva compra se crea en `REGISTERED`.

Transiciones permitidas:

```text
REGISTERED → RECEIVED
REGISTERED → CANCELLED
```

`RECEIVED` y `CANCELLED` son estados finales.

No se permite:

- recibir una compra cancelada;
- cancelar una compra recibida;
- volver de `RECEIVED` o `CANCELLED` a `REGISTERED`;
- modificar funcionalmente una compra recibida o cancelada;
- revertir una recepción;
- agregar estados adicionales.

## 4. Edición y eliminación

Una compra y sus ítems solo pueden modificarse mientras Purchase permanezca en
`REGISTERED`.

No existe DELETE físico para Purchase ni PurchaseItem.

Los registros recibidos o cancelados conservan su información histórica.

## 5. Artículos y unidades

Todos los PurchaseItem deben utilizar artículos existentes y activos.

Compras debe validar artículos exclusivamente mediante `ArticulosApi`. No puede
acceder directamente a tablas, repositories ni servicios internos de
Artículos.

Antes de modificar stock deben validarse:

- existencia del artículo;
- estado activo;
- unidad base;
- reglas aplicables a la cantidad.

La unidad de PurchaseItem debe coincidir exactamente con la unidad base
registrada en Artículos.

Unidades permitidas:

- `KG`
- `G`
- `L`
- `M`
- `UNIDAD`

No existen conversiones automáticas.

No se modificará Artículos para introducir mecanismos adicionales de
concurrencia, salvo que durante la implementación se identifique una necesidad
concreta que no pueda resolver el Unit of Work compartido.

## 6. Cantidades

`requestedQuantity` debe ser mayor que cero.

Las cantidades deben representarse con precisión decimal compatible con
`DECIMAL(18,3)`. No se utilizará floating point.

Cuando la unidad sea `UNIDAD`, la cantidad debe ser entera.

No se almacenará `receivedQuantity` en el MVP porque solo existe recepción
total.

## 7. Datos comerciales y documentales

Se permite registrar:

- proveedor;
- NIT o identificador del proveedor;
- marca;
- precio unitario;
- moneda;
- número o referencia del documento;
- fecha del documento;
- observaciones.

Estos datos tienen propósito administrativo, histórico, analítico y de
trazabilidad.

No modifican:

- stock;
- cantidades disponibles;
- clasificación del artículo;
- unidad base;
- costos contables;
- reglas de Production.

### 7.1 Precio

`unitPrice` es opcional y debe almacenarse como decimal, nunca como floating
point.

Es un valor referencial y no representa un costo contable oficial.

No se implementarán cálculos contables, impuestos, valorización de inventario
ni costos adicionales.

### 7.2 Moneda

`currency` es un código textual simple, por ejemplo `BOB` o `USD`.

No se creará un maestro de monedas ni se realizarán conversiones.

## 8. Recepción total

En el MVP solo se permite recepción total.

No se implementarán:

- recepciones parciales;
- cantidades recibidas por separado;
- recepción de algunos ítems dejando otros pendientes;
- movimientos compensatorios por fallos intermedios.

Purchase cambia de `REGISTERED` a `RECEIVED` únicamente cuando todos sus ítems
han ingresado correctamente a Inventory.

Si falla cualquier ítem:

- Purchase permanece en `REGISTERED`;
- no queda ningún InventoryMovement de esa recepción;
- no cambia ningún InventoryStock;
- no quedan registros parciales de idempotencia;
- no queda auditoría que afirme una recepción exitosa.

## 9. Almacén

El almacén no forma parte del registro administrativo de Purchase.

Se selecciona al ejecutar la recepción.

En el MVP:

- toda la compra se recibe en un único almacén;
- no puede dividirse entre varios almacenes;
- el almacén debe existir y estar activo;
- Inventory continúa siendo propietario de la validación operativa del
  almacén.

## 10. Lotes

Compras no administra, crea ni modifica InventoryLot.

En el MVP:

- puede proporcionarse un `inventoryLotId` existente cuando sea necesario;
- puede omitirse cuando Inventory permita una entrada sin lote;
- no se crea automáticamente un lote de proveedor;
- no se envían `lotCode` ni otros datos para crear lotes.

Inventory es responsable de validar:

- existencia del lote;
- relación entre lote y artículo;
- cualquier otra regla de ownership de lotes.

Si posteriormente se necesita crear o reutilizar lotes a partir de información
del proveedor, primero deberá extenderse la API pública de Inventory.

## 11. Integración con Inventory

Compras utiliza exclusivamente la API pública intermodular `InventoryApi`.

No puede modificar directamente:

- `InventoryStock`;
- `InventoryMovement`;
- `InventoryLot`;
- idempotencia interna de Inventory;
- repositories internos;
- tablas Prisma de Inventory.

Inventory debe extender su API pública con una operación batch atómica,
conceptualmente:

```text
InventoryApi.registerInbounds(...)
```

El nombre y DTO técnico pueden ajustarse a las convenciones del proyecto.

Esta operación debe:

- recibir todos los ingresos de la compra;
- ejecutarlos dentro de una única transacción compartida;
- conservar las validaciones funcionales existentes de Inventory;
- crear todos los movimientos o ninguno;
- actualizar todos los saldos o ninguno;
- registrar idempotencia y auditoría de Inventory en la misma transacción;
- devolver resultados tipados.

No se utilizarán llamadas independientes a `registerInbound()` para recibir una
compra con múltiples ítems.

## 12. Resultado tipado de Inventory

La operación batch no debe devolver `Promise<unknown>`.

El resultado de cada ingreso debe incluir como mínimo:

- `movementId`;
- `articuloId`;
- `inventoryLotId`, cuando exista;
- `quantity`;
- `unit`;
- `resultingStock`;
- `createdAt`.

Compras puede conservar los identificadores de movimientos necesarios para
trazabilidad mediante registros normalizados explícitos que relacionen
Purchase, PurchaseItem e InventoryMovement. Estos registros solo contienen
identificadores y datos técnicos de relación; no copian datos operativos del
movimiento (cantidad, unidad, saldos, almacén, lote ni actor). Esto no
transfiere ownership: InventoryMovement continúa perteneciendo exclusivamente
a Inventory.

No debe duplicarse en Purchase información operativa que ya pertenece a
Inventory, salvo identificadores de referencia necesarios.

## 13. Unit of Work compartido

Debe incorporarse un mecanismo de Unit of Work compartido y reutilizable en
Core o infraestructura. No es una abstracción específica de Compras ni debe
contener reglas, nombres o dependencias del dominio de compras.

El workflow completo de recepción debe participar en una única transacción
Prisma con aislamiento `Serializable`.

La misma transacción coordina:

- Purchase;
- PurchaseItem;
- InventoryMovement;
- InventoryStock;
- idempotencia de Inventory;
- auditoría de Inventory;
- auditoría de Compras;
- transición `REGISTERED → RECEIVED`.

El contexto transaccional:

- es exclusivamente interno;
- no se expone por HTTP;
- no puede ser creado, proporcionado ni controlado por el cliente;
- se transmite únicamente entre APIs intermodulares confiables.

## 14. Workflow definitivo de recepción

1. Recibir la solicitud de recepción de Purchase.
2. Verificar el permiso `compras:receive`.
3. Abrir el Unit of Work `Serializable`.
4. Obtener nuevamente Purchase dentro de la transacción.
5. Confirmar que continúa en `REGISTERED`.
6. Validar que el almacén existe y está activo.
7. Validar artículos, unidades, cantidades y lotes aplicables.
8. Construir todos los ingresos.
9. Generar las claves idempotentes en backend.
10. Ejecutar el ingreso batch mediante InventoryApi dentro del mismo Unit of
    Work.
11. Registrar idempotencia, movimientos, saldos y auditoría de Inventory.
12. Conservar las referencias necesarias a los movimientos.
13. Cambiar Purchase a `RECEIVED`.
14. Auditar la recepción de Compras.
15. Confirmar la transacción.

Ante cualquier error se revierte el workflow completo.

## 15. Reintentos y concurrencia

Los conflictos serializables, incluido Prisma `P2034`, deben reintentar el
workflow completo.

Cada reintento debe:

- abrir una nueva transacción;
- volver a cargar Purchase;
- comprobar nuevamente que sigue en `REGISTERED`;
- reconstruir y ejecutar todos los ingresos;
- reutilizar las mismas claves idempotentes.

No se reintentará un PurchaseItem de forma independiente.

Debe existir un límite controlado de reintentos. Si se agota, la operación falla
sin persistir una recepción parcial.

## 16. Idempotencia

Cada ingreso utiliza la clave:

```text
purchase-receive:{purchaseId}:{purchaseItemId}
```

Las claves:

- son generadas exclusivamente por backend;
- son deterministas;
- permanecen iguales durante todos los reintentos;
- no son proporcionadas libremente por frontend;
- son administradas y verificadas por Inventory.

La misma operación lógica reutiliza exactamente la misma clave.

Una clave reutilizada con otra operación o payload debe ser rechazada conforme
al contrato de idempotencia de Inventory.

## 17. Cancelación

Solo una Purchase en `REGISTERED` puede cancelarse.

La cancelación:

- cambia el estado a `CANCELLED`;
- no genera movimientos compensatorios;
- no modifica Inventory;
- debe quedar auditada.

El motivo de cancelación es opcional en el MVP. Si se proporciona, se conserva
únicamente en la metadata de auditoría de la cancelación. No se copia en
`observations` ni existe un campo de motivo de cancelación en Purchase.

Una Purchase `RECEIVED` no puede cancelarse.

## 18. Permisos

Permisos del módulo:

- `compras:read`
- `compras:create`
- `compras:update`
- `compras:receive`
- `compras:cancel`

No existe `compras:delete`.

`compras:receive` autoriza al usuario a ejecutar el workflow completo de
recepción.

La llamada Compras → Inventory es intermodular y confiable. El usuario no
necesita poseer además `inventory:inbound`.

`inventory:inbound` continúa siendo obligatorio para ingresos manuales
realizados directamente mediante el módulo Inventory.

Esta diferencia debe resolverse mediante contexto interno confiable. No se
otorgan permisos implícitos al usuario ni se falsifica su lista de permisos.

## 19. Auditoría

Deben auditarse:

- creación;
- modificación;
- recepción;
- cancelación.

El actor se obtiene exclusivamente del contexto autenticado.

No se aceptan desde el cliente:

- `performedByUserId`;
- `createdByUserId`;
- identificadores de autorizador;
- contextos transaccionales;
- marcadores de llamada intermodular confiable.

La auditoría de recepción debe formar parte del mismo Unit of Work que la
transición de estado y los ingresos de Inventory.

## 20. Invariantes consolidados

1. Toda nueva Purchase nace en `REGISTERED`.
2. Solo `REGISTERED` puede modificarse, recibirse o cancelarse.
3. `RECEIVED` y `CANCELLED` son finales.
4. No existe DELETE físico.
5. Cada compra contiene al menos un PurchaseItem antes de recibirse.
6. Un artículo no puede repetirse dentro de una compra.
7. Todo artículo debe existir y estar activo.
8. La unidad debe coincidir con la unidad base del artículo.
9. `requestedQuantity` debe ser positiva.
10. `UNIDAD` exige cantidad entera.
11. No existen conversiones de unidad ni moneda.
12. Toda la compra se recibe en un único almacén.
13. La recepción es total y atómica.
14. Inventory es el único propietario del stock, movimientos y lotes.
15. Compras solo conserva referencias necesarias a movimientos.
16. Las claves idempotentes son deterministas y generadas por backend.
17. El actor y los permisos provienen del contexto autenticado.
18. Toda operación mutante requerida queda auditada atómicamente.
19. El precio es decimal, referencial y no contable.
20. No se implementan reversiones ni compensaciones en el MVP.

## 21. Cambios autorizados en Inventory

Puede modificarse Inventory únicamente para:

- soportar una operación batch atómica;
- participar en el Unit of Work compartido;
- devolver resultados tipados;
- reconocer un contexto de llamada intermodular confiable.

No se modificarán sus reglas funcionales existentes.

Deben mantenerse:

- InventoryMovement como fuente histórica;
- InventoryStock como saldo materializado;
- validaciones actuales;
- `DECIMAL(18,3)`;
- reglas de `UNIDAD`;
- idempotencia;
- auditoría;
- ownership de lotes;
- política de stock negativo.

Las entradas de compra incrementan stock y no requieren autorización de stock
negativo.

## 22. Fuera de alcance del MVP

Quedan fuera:

- recepciones parciales;
- múltiples almacenes por recepción;
- división de un ítem entre almacenes;
- creación automática de lotes de proveedor;
- maestros de proveedores, marcas o monedas;
- conversiones de unidad o moneda;
- costos contables oficiales;
- impuestos, descuentos y valorización;
- reversión de recepciones;
- cancelación de compras recibidas;
- movimientos compensatorios;
- DELETE físico;
- estados adicionales.

## 23. Condición para iniciar implementación

Este documento consolida las decisiones funcionales y técnicas aprobadas para
el módulo `compras`.

La implementación solo debe comenzar después de revisar y aprobar expresamente
este contenido.
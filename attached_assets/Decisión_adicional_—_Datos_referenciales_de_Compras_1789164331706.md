## Datos referenciales de Compras

El módulo Compras deberá conservar información comercial y documental de la adquisición aunque estos datos no participen directamente en la lógica de Inventory.

Se permite registrar como información referencial:

- proveedor;
- NIT o identificador del proveedor cuando exista;
- marca del producto o material comprado;
- precio unitario;
- moneda;
- número o referencia del documento de compra;
- fecha del documento;
- observaciones.

Estos campos tienen propósito histórico, analítico y de trazabilidad administrativa.

No modifican:

- el stock;
- la unidad base del Artículo;
- la clasificación del Artículo;
- las reglas de Production;
- el cálculo de cantidades disponibles en Inventory.

La entrada física a Inventory seguirá basándose únicamente en los datos operativos necesarios para el movimiento de stock.

En esta etapa no crear obligatoriamente maestros independientes de `Supplier` o `Brand` salvo que ya estén definidos expresamente en los documentos del proyecto.

Proveedor y marca pueden almacenarse inicialmente como datos referenciales de Purchase o PurchaseItem.

`precioUnitario` deberá almacenarse utilizando tipo decimal, nunca floating point.

El precio registrado en Compras será considerado referencial y no debe interpretarse como costo contable oficial hasta que se defina un módulo o regla específica de costos.
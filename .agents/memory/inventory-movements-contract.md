---
name: Contrato desplegado de movimientos de inventario
description: Aclara la diferencia entre la documentación histórica y el endpoint desplegado para consultar movimientos.
---

El backend desplegado de Winter expone una consulta paginada de movimientos de inventario, obligatoriamente filtrada por artículo, con filtros opcionales de almacén, lote y tipo.

**Why:** La documentación histórica de Inventory afirma que no existe un endpoint HTTP para listar movimientos, pero el cierre oficial del Bloque 4 confirmó que el contrato ya está implementado y desplegado. Tratar la documentación antigua como vigente eliminaría una capacidad real del producto.

**How to apply:** Para cambios posteriores del frontend, conservar la consulta por artículo y su paginación real. No convertirla en un listado global ni inventar consultas globales de stock o lotes. Si se modifica el contrato, confirmar primero el estado del backend desplegado.
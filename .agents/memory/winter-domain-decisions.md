---
name: Decisiones de dominio de Winter
description: Reglas autoritativas para trabajos, transformaciones, inventario, atomicidad y módulos finales de Winter.
---

Winter debe aplicar estas decisiones sin asumir comportamientos adicionales:

- Todo `ProductionWork` pertenece obligatoriamente a una `ProductionOrder`; puede pertenecer además a una `TransformationOrder` y vincularse con uno o varios batches y recipientes.
- No inventar estados ni transiciones. Si una operación requiere uno no documentado, detener esa lógica y reportar la decisión pendiente.
- `ProductionOrder` y `TransformationOrder` se crean `OPEN` y solo transicionan a `CLOSED`; cerradas bloquean nuevos registros operativos y conservan el historial.
- `Purchase` se crea `REGISTERED` y solo transiciona a `RECEIVED` o `CANCELLED`. La recepción exige éxito atómico de Inventory; no existe reversión inicial desde `RECEIVED`.
- `ProductionBatch`, `Transformation` e `InventoryLot` no tienen estado de ciclo de vida persistido. Su situación se deriva de cantidades, movimientos y relaciones.
- La clasificación de `InventoryLot` solo avanza `PRODUCTO_ENVASADO` → `PRODUCTO_TERMINADO` → `PRODUCTO_TERMINADO_EXPORTACION` mediante `transitionInventoryLotClassification`.
- No crear una entidad `Status` ni un catálogo dinámico; todo estado futuro requiere una decisión explícita con reglas, permisos, efectos y auditoría.
- Una transformación consume batches existentes y crea uno o varios batches nuevos; conserva inputs, outputs, cantidades e historial completo.
- `InventoryMovement` es la fuente de verdad del stock. Cualquier vista, caché o proyección futura debe ser reconstruible desde movimientos.
- Los workflows críticos coordinan módulos y auditoría mediante un Unit of Work compartido; cualquier fallo crítico revierte toda la operación.
- `products` y `purchases` son solo referencias técnicas. Winter usa módulos nuevos: `articulos`, `compras`, `production` e `inventory`, sin migración ni compatibilidad obligatoria.

**Why:** Estas reglas resuelven ambigüedades entre los documentos iniciales y evitan duplicación de ownership, trazabilidad incompleta y confirmaciones parciales.

**How to apply:** Usarlas al diseñar contratos, modelos Prisma, servicios, APIs públicas, transacciones y pruebas de los módulos Winter. Verificar que Logger Core no dependa de los módulos de referencia antes de retirarlos físicamente.
# Siguiente módulo: Purchases / Compras

Los módulos Artículos e Inventory se consideran implementados a nivel backend.

Antes de escribir código de Compras, realiza una revisión contractual completa del módulo.

## Fuentes obligatorias

Utiliza:

- `ARCHITECTURE.md`
- `AI_IMPLEMENTATION_RULES.md`
- `MODULE_CONTRACT.md`
- `MODULE_MAP.md`
- `DOMAIN_MODEL.md`
- `AGGREGATES_AND_ENTITIES.md`
- `WORKFLOWS.md`
- `API_CONTRACTS.md`
- `docs/articulos-api.md`
- `docs/inventory-api.md`
- `listaMaestros_v1.1.xlsx`

No implementar todavía.

No importar datos del Excel.

---

# Objetivo del módulo

Compras debe administrar el ciclo administrativo de adquisición y recepción de artículos.

Inventory continúa siendo el único propietario del stock físico.

Compras no puede modificar directamente:

- `InventoryStock`
- `InventoryMovement`
- `InventoryLot`
- repositories internos de Inventory
- tablas Prisma de Inventory

Cuando una compra sea recibida físicamente, debe utilizar exclusivamente la API pública de Inventory.

---

# Estados aprobados previamente

La entidad Purchase utiliza:

- `REGISTERED`
- `RECEIVED`
- `CANCELLED`

Reglas conocidas:

- Una compra se crea como `REGISTERED`.
- Solo puede pasar a `RECEIVED` cuando el ingreso correspondiente a Inventory haya finalizado correctamente.
- Una compra cancelada no puede recibirse.
- Una compra recibida no puede volver a `REGISTERED`.
- No inventar estados adicionales.

Revisar si los documentos definen reglas adicionales para cancelación.

---

# Dependencia con Artículos

Los items de compra deben utilizar artículos existentes.

Compras debe validar los artículos utilizando exclusivamente la API pública de Artículos.

No acceder directamente a repositories o tablas del módulo Artículos.

---

# Dependencia con Inventory

La recepción de una compra debe utilizar:

`Inventory.registerInbound()`

Analizar cómo debe manejarse:

- una compra con múltiples artículos;
- recepción total;
- recepción parcial si los documentos la contemplan;
- lotes proporcionados por proveedor;
- unidades;
- idempotencia;
- errores de Inventory;
- transacción entre Purchase e Inventory;
- auditoría.

No asumir recepción parcial si no está definida documentalmente.

---

# Revisar entidad Purchase

Determinar exclusivamente desde los documentos:

- campos de Purchase;
- campos de PurchaseItem;
- proveedor;
- documento de compra;
- fechas;
- cantidades;
- precios, si corresponden;
- moneda, si corresponde;
- observaciones;
- estado;
- usuario responsable;
- timestamps.

No agregar información contable o financiera que no esté dentro del alcance aprobado.

---

# Reglas de cantidades

Revisar relación entre:

- cantidad solicitada;
- cantidad recibida;
- unidad base del artículo.

No implementar conversiones de unidades.

Respetar el contrato definido por Artículos e Inventory.

---

# Recepción

Revisar exactamente qué significa `RECEIVED`.

Confirmar si:

- toda la compra debe haber ingresado a Inventory;
- pueden existir recepciones parciales;
- una compra puede contener artículos enviados a diferentes almacenes;
- el almacén se define en Purchase o durante la recepción.

No inventar estas reglas.

---

# Cancelación

Revisar:

- cuándo puede cancelarse una compra;
- si una compra parcialmente o totalmente recibida puede cancelarse;
- efecto sobre Inventory;
- si cancelar genera movimientos compensatorios o está prohibido después de una recepción.

---

# Idempotencia

Inventory ya soporta idempotencia.

Revisar cómo Purchase debe generar y conservar las claves utilizadas para `registerInbound()` para evitar ingresos duplicados ante reintentos.

No generar claves aleatorias nuevas en cada reintento de la misma operación lógica.

---

# Atomicidad

La transición:

`REGISTERED → RECEIVED`

debe ser consistente con el ingreso físico.

No puede ocurrir:

`Purchase = RECEIVED`

si `Inventory.registerInbound()` falla.

Revisar el Unit of Work existente y determinar cómo se garantiza esta regla según la arquitectura del proyecto.

---

# Stock negativo

La política de stock negativo pertenece a Inventory.

Compras no debe implementar una política propia.

Las entradas de compra incrementan stock y no requieren autorización de stock negativo.

---

# Auditoría

Revisar auditoría para:

- creación de compra;
- modificación permitida;
- recepción;
- cancelación.

El actor debe provenir del contexto autenticado.

No aceptar `performedByUserId` proporcionado por el cliente.

---

# API

Revisar en `API_CONTRACTS.md` y demás documentos:

- Commands existentes.
- Queries existentes.
- Endpoints administrativos.
- Respuestas.
- Paginación.
- Filtros.
- Permisos.

No inventar endpoints todavía.

---

# Resultado esperado

Entregar un informe previo a implementación indicando:

1. Responsabilidad final de Compras.
2. Entidades involucradas.
3. Campos documentados.
4. Estados y transiciones.
5. Invariantes.
6. Commands.
7. Queries.
8. Dependencias con Artículos.
9. Dependencias con Inventory.
10. Flujo completo de recepción.
11. Política de cancelación.
12. Recepción total o parcial.
13. Manejo de múltiples artículos.
14. Manejo de almacenes.
15. Manejo de lotes.
16. Idempotencia.
17. Atomicidad.
18. Auditoría.
19. Permisos.
20. Conflictos entre documentos.
21. Decisiones faltantes.
22. Qué partes pueden implementarse sin nuevas decisiones.

No escribir código todavía.

Si una regla necesaria no está definida, reportarla claramente en lugar de asumirla.
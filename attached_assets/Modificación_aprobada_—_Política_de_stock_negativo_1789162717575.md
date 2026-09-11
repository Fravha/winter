## 2. Política de Stock Negativo

Winter permitirá excepcionalmente que una operación deje stock negativo.

El comportamiento normal continúa siendo impedir una operación cuando la cantidad disponible sea insuficiente.

### Flujo normal

Si:

`cantidadSolicitada <= stockDisponible`

la operación continúa normalmente.

Si:

`cantidadSolicitada > stockDisponible`

Inventory debe detectar que la operación producirá stock negativo y **no confirmarla automáticamente**.

Debe responder indicando:

- stock disponible;
- cantidad solicitada;
- saldo resultante;
- artículo;
- almacén;
- lote, cuando corresponda;
- indicador `requiresNegativeStockAuthorization: true`.

---

### Autorización excepcional

La operación solamente podrá continuar si existe una autorización explícita de un usuario con permiso:

`inventory:negative_stock_authorize`

La autorización permitirá ejecutar la operación aunque el saldo resultante sea negativo.

No basta con que el usuario que registra la operación tenga permisos de salida, transferencia, ajuste o consumo.

La autorización de stock negativo debe ser una acción explícita.

---

### Auditoría obligatoria

Toda operación autorizada que produzca stock negativo debe registrar:

- usuario que realizó la operación;
- usuario que autorizó el negativo;
- fecha y hora;
- stock existente antes de la operación;
- cantidad solicitada;
- saldo negativo resultante;
- motivo obligatorio;
- artículo;
- almacén;
- lote, cuando corresponda;
- movimiento generado;
- origen de la operación.

La autorización debe quedar vinculada al movimiento correspondiente.

---

### Motivo obligatorio

Cuando se autorice stock negativo, debe existir un campo obligatorio:

`negativeStockReason`

No permitir una autorización sin justificación.

Ejemplos de motivo pueden ser:

- movimiento físico realizado antes del registro;
- inventario pendiente de regularización;
- ingreso pendiente de registrar;
- diferencia de conteo físico;
- operación administrativa pendiente;
- otro.

No es necesario convertir estos valores en enum inicialmente; puede utilizarse texto controlado mientras se analiza el uso real.

---

### Estado del saldo negativo

InventoryStock puede contener temporalmente una cantidad menor que cero.

Cuando:

`quantity < 0`

la API debe identificar explícitamente la posición como negativa.

Por ejemplo:

```ts
{
  quantity: "-12.000",
  hasNegativeStock: true
}
```

Esto permitirá que el frontend muestre posteriormente una alerta visual.

---

### Regularización

El saldo negativo no debe corregirse automáticamente.

Debe regularizarse mediante movimientos reales posteriores, por ejemplo:

- ingreso;
- ajuste;
- devolución;
- corrección mediante movimiento compensatorio.

Los movimientos originales permanecen inmutables.

---

### Alertas en el MVP

No implementar todavía:

- correos;
- WhatsApp;
- push notifications;
- tareas programadas;
- sistema general de notificaciones.

Sí implementar desde ahora la información necesaria para que frontend pueda mostrar:

- advertencia antes de autorizar el negativo;
- indicador de stock negativo;
- saldo negativo;
- necesidad de autorización;
- movimientos que fueron autorizados excepcionalmente.

De esta manera el MVP queda preparado para incorporar posteriormente un módulo de Alertas/Notificaciones sin modificar la lógica fundamental de Inventory.

---

### Permiso adicional

Agregar:

`inventory:negative_stock_authorize`

Este permiso debe estar separado de:

- `inventory:outbound`
- `inventory:transfer`
- `inventory:adjust`

Tener permiso para registrar movimientos no implica tener permiso para autorizar stock negativo.

Inicialmente puede asignarse al rol administrativo correspondiente definido mediante RBAC.

---

### Transferencias

Una transferencia que produciría stock negativo en el almacén de origen también requiere autorización explícita.

El almacén destino recibe la cantidad completa autorizada.

Toda la transferencia continúa siendo atómica.

---

### Production

Si `registerProductionConsumption` solicita una cantidad superior al stock disponible, Inventory debe aplicar exactamente la misma política.

Production no puede ignorar esta validación.

La operación deberá requerir autorización de stock negativo antes de confirmar la transacción completa.

La autorización debe conservarse dentro de la trazabilidad de la operación.
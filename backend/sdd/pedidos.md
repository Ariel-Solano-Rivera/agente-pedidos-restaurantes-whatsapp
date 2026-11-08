# Módulo de pedidos

## Propósito y alcance

Proyecta pedidos sintéticos existentes y sus unidades históricas; ADMIN/CAJA pueden ejecutar transiciones autorizadas con trazabilidad e idempotencia. La creación y reserva siguen fuera de este incremento.

## Fuente y dependencias

- Código: `pedidos/OrderController.java`, `pedidos/OrderReportingService.java`.
- Tablas: `customer_order`, `order_unit`, `order_unit_option`.
- Consumidores: panel de pedidos y futura vista de cocina.

## Contratos y permisos

- `GET /orders` devuelve cliente, teléfono y resumen de unidades para identificar cada tarjeta. `GET /orders/{id}` incluye cliente, teléfono, modalidad, datos de entrega o retiro, zona, estado de pago, importes, confirmación y unidades históricas.
- `POST /orders/{id}/transitions` exige `Idempotency-Key`, `targetStatus` y rol ADMIN/CAJA. COCINA solo puede leer estados operativos.
- Si el rol es COCINA, solo devuelve `ACCEPTED`, `PREPARING`, `READY` o `COMPLETED`.

## Validaciones y efectos de estado

- Filtra cada pedido, unidad y opción por restaurante.
- Cada fila `order_unit` se devuelve como unidad individual con precio y opciones históricas.
- El código público se deriva actualmente del UUID para datos de demostración.
- Las únicas transiciones permitidas son `PENDING_DECISION → ACCEPTED|REJECTED`, `ACCEPTED → PREPARING|CANCELLED`, `PREPARING → READY` y `READY → COMPLETED`.
- La operación bloquea la fila del pedido durante la validación, inserta historial y auditoría con usuario y `correlation_id`, y usa la clave de idempotencia para no repetir su efecto.
- `OrderReportingService` es el contrato interno de solo lectura para consumidores fuera del módulo; actualmente expone el plato con más unidades históricas, sin revelar tablas de pedidos.

## Pruebas

- `scripts/smoke.ps1` verifica la lista de pedidos para COCINA. Añadir cobertura de transición, idempotencia, aislamiento y roles al ampliar las pruebas automatizadas.

## TBD / exclusiones

- Carrito, confirmación de cliente, reserva efectiva, vencimiento, notificaciones y el flujo conversacional. Los pedidos sintéticos no contienen reservas que liberar todavía.

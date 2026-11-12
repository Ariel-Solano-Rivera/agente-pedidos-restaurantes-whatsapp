# Módulo de pagos

## Propósito y alcance

Expone pagos sintéticos existentes para ADMIN y CAJA y permite confirmarlos manualmente (segunda ronda, bloque B; estados de pago de ADR-001 validados el 2026-11-11). Rechazar un pago, comprobantes y la política de pago por transición siguen pendientes.

## Fuente y dependencias

- Código: `pagos/PaymentController.java`.
- Tablas: `payment`, `customer_order` (`payment_status` se sincroniza al confirmar), `idempotency_operation`, `audit_log` y `app_user` (correo del verificador).
- Consumidores: `frontend/src/features/pedidos/OrderDetailView.tsx` (`?orderId=` y «Confirmar pago»), `OrdersPage.tsx` («Cobrado» en la tarjeta con el `paymentId` de `GET /orders`).

## Contratos y permisos

- `GET /payments?orderId`: ADMIN o CAJA; devuelve `id`, `orderId`, `orderCode`, medio, importe, estado, referencia, `verifiedBy` (correo de quien verificó) y `verifiedAt`. `orderId` (opcional) limita la lista a ese pedido; un pedido de otro restaurante devuelve una lista vacía.

- `POST /payments/{id}/confirm`: ADMIN o CAJA; cabecera `Idempotency-Key` obligatoria (hasta 120 caracteres); sin cuerpo. Devuelve el pago actualizado con `status = CONFIRMED`, `verifiedBy` y `verifiedAt`.

## Validaciones y efectos de estado

- Filtra por restaurante autenticado; un pago de otro restaurante responde 404 `PAYMENT_NOT_FOUND`.
- Confirmar, en una transacción reactiva: registra la clave (`PAYMENT_CONFIRM:{id}`), bloquea el pago con `FOR UPDATE`, exige estado `PENDING` o `PENDING_VERIFICATION` (si no, 409 `PAYMENT_NOT_CONFIRMABLE`: «ya está confirmado/rechazado/…»), fija `status = CONFIRMED`, `verified_by` y `verified_at = now()`, pone `customer_order.payment_status = CONFIRMED` y escribe `audit_log` (`PAYMENT_CONFIRMED`, entidad `PAYMENT`, `correlation_id`). No cambia el estado del pedido ni toca reservas.
- Repetir la misma `Idempotency-Key` no repite el efecto y devuelve el pago tal como está. Sin clave: 400 `IDEMPOTENCY_KEY_REQUIRED`.
- Solo esta operación confirma: recibir un comprobante o una declaración del cliente no cambia nada automáticamente.

## Pruebas

- `scripts/smoke.ps1` comprueba que COCINA recibe 403.
- `PaymentsIntegrationTest` (Testcontainers): filtro por pedido, verificador y fecha en un pago confirmado, lista vacía para otro restaurante y 403 para COCINA; `cashierConfirmsAPendingPaymentOnceAndItIsAuditedAndIsolated`: otro restaurante 404, COCINA 403, sin clave 400, confirmación con verificador y fecha, `paymentStatus` del pedido sincronizado sin cambiar su estado, misma clave sin efecto, clave nueva sobre un pago confirmado 409, una sola fila de auditoría.

## TBD / exclusiones

- Rechazar un pago, comprobantes, política por medio de pago y condición de pago para transiciones de pedido. Ver `docs/adr-001-reservas-pagos.md`.

# Módulo de pagos

## Propósito y alcance

Expone pagos sintéticos existentes para ADMIN y CAJA. La confirmación manual está retenida hasta aprobar el modelo de estados.

## Fuente y dependencias

- Código: `pagos/PaymentController.java`.
- Tablas: `payment`, `customer_order` y `app_user` (solo el correo del verificador).
- Consumidores: `frontend/src/features/pedidos/OrderDetailView.tsx` (`?orderId=`).

## Contratos y permisos

- `GET /payments?orderId`: ADMIN o CAJA; devuelve `id`, `orderId`, `orderCode`, medio, importe, estado, referencia, `verifiedBy` (correo de quien verificó) y `verifiedAt`. `orderId` (opcional) limita la lista a ese pedido; un pedido de otro restaurante devuelve una lista vacía.

## Validaciones y efectos de estado

- Filtra por restaurante autenticado.
- No existe endpoint mutante: recibir un comprobante no confirma nada automáticamente.

## Pruebas

- `scripts/smoke.ps1` comprueba que COCINA recibe 403.
- `PaymentsIntegrationTest` (Testcontainers): filtro por pedido, verificador y fecha en un pago confirmado, lista vacía para otro restaurante y 403 para COCINA.

## TBD / exclusiones

- Estados persistidos, confirmación/rechazo, política por medio de pago, comprobantes y condición de pago para transiciones de pedido. Ver `docs/adr-001-reservas-pagos.md`.

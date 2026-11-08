# Módulo de pagos

## Propósito y alcance

Expone pagos sintéticos existentes para ADMIN y CAJA. La confirmación manual está retenida hasta aprobar el modelo de estados.

## Fuente y dependencias

- Código: `pagos/PaymentController.java`.
- Tablas: `payment`, `customer_order`.

## Contratos y permisos

- `GET /payments`: ADMIN o CAJA; devuelve pedido, medio, importe, estado, referencia y fecha de verificación.

## Validaciones y efectos de estado

- Filtra por restaurante autenticado.
- No existe endpoint mutante: recibir un comprobante no confirma nada automáticamente.

## Pruebas

- `scripts/smoke.ps1` comprueba que COCINA recibe 403.

## TBD / exclusiones

- Estados persistidos, confirmación/rechazo, política por medio de pago, comprobantes y condición de pago para transiciones de pedido. Ver `docs/adr-001-reservas-pagos.md`.

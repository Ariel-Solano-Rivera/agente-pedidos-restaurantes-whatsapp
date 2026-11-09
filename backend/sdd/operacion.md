# Operación, disponibilidad, zonas y horarios

## Propósito y alcance

Gestiona estado operativo, disponibilidad vendible, zonas de entrega y horarios. No crea pedidos ni reservas.

## Fuente y dependencias

- Código: `operacion/OperationController.java`.
- Tablas: `operation_settings`, `availability`, `availability_movement`, `idempotency_operation`, `delivery_zone`, `opening_hours`.
- Consumidor: panel operativo.

## Contratos y permisos

- Consultas: `GET /operation/settings`, `/availability`, `/operation/zones`, `/operation/schedules`.
- ADMIN: `PUT /admin/operation/settings`, `POST /admin/zones`, `POST /admin/schedules`.
- ADMIN o CAJA: `POST /availability/adjustments` con `Idempotency-Key` UUID.

## Validaciones y efectos de estado

- Ajuste requiere variante, motivo y clave de idempotencia; inserta la clave, actualiza solo si `on_hand + delta >= reserved`, quita la marca `sold_out`, activa el control de cantidad (`tracked=true`) y registra movimiento `PANEL` con actor y correlación. Una variante inexistente o de otro restaurante devuelve 400 (no 404).
- Repetir la misma clave devuelve la disponibilidad actual sin aplicar otro movimiento.
- Horario acepta día 0 a 6; zonas convierten tarifa a decimal en backend.
- Pausa de recepción registra usuario y fecha.

## Pruebas

- Prueba manual de ajuste repetido y reversión sobre datos sintéticos; el saldo quedó restaurado.

## TBD / exclusiones

- Marcar agotado explícitamente, cierre excepcional, editar/desactivar zonas u horarios, reservas y su liberación atómica.

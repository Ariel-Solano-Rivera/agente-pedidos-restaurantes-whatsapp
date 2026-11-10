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
- ADMIN o CAJA: `PUT /availability/dishes/{dishId}/sold-out` con cuerpo `{ soldOut }` y `Idempotency-Key` UUID. Marca o quita «agotado» en todas las variantes de un plato propio (crea la fila de disponibilidad sin control de cantidad si faltaba). En una transacción registra la operación idempotente y una fila en `audit_log` (`DISH_SOLD_OUT` o `DISH_SOLD_OUT_CLEARED`, entidad `dish`, usuario y `correlation_id`). No cambia cantidades, reservas ni movimientos. Repetir la clave devuelve el estado sin repetir efectos. Errores: 400 `IDEMPOTENCY_KEY_REQUIRED`, 403 (COCINA) y 404 `DISH_NOT_FOUND` (también para platos de otro restaurante). Responde `{dishId, soldOut, variants}`.

## Validaciones y efectos de estado

- Ajuste requiere variante, motivo y clave de idempotencia; inserta la clave, actualiza solo si `on_hand + delta >= reserved`, quita la marca `sold_out`, activa el control de cantidad (`tracked=true`) y registra movimiento `PANEL` con actor y correlación. Una variante inexistente o de otro restaurante devuelve 400 (no 404).
- Repetir la misma clave devuelve la disponibilidad actual sin aplicar otro movimiento.
- Horario acepta día 0 a 6; zonas convierten tarifa a decimal en backend.
- Pausa de recepción registra usuario y fecha.

## Pruebas

- `DishSoldOutIntegrationTest` (Testcontainers): CAJA marca y quita «agotado» y `available` cambia; repetir la clave no duplica la auditoría; COCINA recibe 403, otro restaurante 404 y una clave inválida 400.

- Prueba manual de ajuste repetido y reversión sobre datos sintéticos; el saldo quedó restaurado.

## TBD / exclusiones

- Motivo al marcar agotado (requiere migración), cierre excepcional, editar/desactivar zonas u horarios, reservas y su liberación atómica.

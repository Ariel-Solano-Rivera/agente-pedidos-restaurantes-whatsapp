# Módulo de pedidos

## Propósito y alcance

Proyecta pedidos sintéticos existentes con sus unidades históricas, los lista con filtros y paginación en el backend y ejecuta los cambios de estado permitidos por rol: avanzar, retroceder (ADMIN/CAJA) y deshacer (COCINA). La creación de pedidos, la reserva y el vencimiento siguen fuera de este incremento (ADR-001).

## Fuente y dependencias

- Código: `pedidos/OrderController.java` (API), `pedidos/OrderTransitionPolicy.java` (matriz de transiciones, única autoridad), `pedidos/OrderFilter.java` (filtros validados), `pedidos/OrderReportingService.java` (contrato interno de lectura), `common/ApiException.java`.
- Tablas: `customer_order`, `order_unit`, `order_unit_option`, `order_status_history`, `idempotency_operation`, `audit_log`, `delivery_zone`, `app_user`, `restaurant.timezone`. Migraciones V1, V8 y V10.
- Configuración: `app.orders.kitchen-undo-window` (ISO-8601, por defecto `PT2M`; variable `KITCHEN_UNDO_WINDOW`).
- Consumidores: `frontend/src/features/pedidos/OrdersPage.tsx`; `administracion/DashboardController` vía `OrderReportingService`.

## Contratos y permisos

- `GET /orders?status&fulfillment&paymentStatus&range&from&to&q&page&size` (todos los roles) devuelve `{items, page, size, total}`. Cada ítem: `id`, `publicCode`, `status`, `paymentStatus`, `fulfillmentType`, `customerName`, `phone`, `items`, `total`, `createdAt` y `allowedTransitions`. Orden: más recientes primero.
- `GET /orders/{id}` (todos los roles) añade contacto, retiro/entrega, zona, importes, `customerConfirmedAt`, `restaurantDecisionBy` (correo de quien aceptó o rechazó), unidades históricas, `allowedTransitions`, `undo` (solo COCINA) e `history` (más reciente primero: estados, `changeType`, `reasonCode`, `reason`, `actorEmail`, `actorRole`, `createdAt`).
- `allowedTransitions` es una lista de `{targetStatus, direction: FORWARD|BACKWARD, requiresReason, destructive}` calculada por `OrderTransitionPolicy` según el estado y el rol autenticado. El panel no decide transiciones.
- `POST /orders/{id}/transitions` (todos los roles; la política restringe por rol): cabecera `Idempotency-Key` (obligatoria, hasta 120 caracteres) y cuerpo `{targetStatus, reasonCode?, reason?}`. Devuelve `{orderId, status, changeType}`; `changeType` vale `AVANCE`, `RETROCESO` o `REPETIDO` si la clave ya se usó.
- `POST /orders/{id}/undo` (solo COCINA, `Idempotency-Key` obligatoria): revierte el último avance de esa misma persona. Devuelve `changeType = DESHACER` o `REPETIDO`.
- **COCINA no recibe montos**: en lista y detalle `total`, `subtotal`, `deliveryFee`, `paymentStatus`, precios de unidad y recargos de opciones son `null`. Solo ve `ACCEPTED`, `PREPARING`, `READY` y `COMPLETED`; otro estado responde 404. No puede filtrar por pago (403).

### Matriz de transiciones (`OrderTransitionPolicy`)

| Desde | Avanzar (ADMIN, CAJA) | Avanzar (COCINA) | Retroceder (ADMIN, CAJA; motivo obligatorio) |
|---|---|---|---|
| `PENDING_DECISION` | `ACCEPTED`, `REJECTED` | — | — |
| `ACCEPTED` | `PREPARING`, `CANCELLED` | `PREPARING` | — (`PENDING_DECISION` es TBD según ADR-001) |
| `PREPARING` | `READY` | `READY` | `ACCEPTED` |
| `READY` | `COMPLETED` | — | `PREPARING` |
| `COMPLETED`, `REJECTED`, `CANCELLED`, `EXPIRED` | — | — | — |

`REJECTED` y `CANCELLED` se marcan `destructive`. Motivos de retroceso: `ERROR_AL_AVANZAR`, `CLIENTE_CAMBIO_PEDIDO`, `FALTA_PRODUCTO`, `OTRO`; el texto libre (hasta 300 caracteres) es obligatorio solo con `OTRO`.

## Validaciones y efectos de estado

- Filtros (`OrderFilter`): `status` debe ser un estado conocido; `fulfillment` `PICKUP|DELIVERY`; `paymentStatus` `[A-Z_]{1,40}`; `range` `TODAY|LAST_7_DAYS|CUSTOM` (CUSTOM exige `from` y `to`, `from ≤ to`, hasta 366 días); `q` hasta 80 caracteres; `page ≥ 0`; `1 ≤ size ≤ 100` (por defecto 20). Error: 400 `FILTER_INVALID`.
- Los rangos se calculan en SQL con `restaurant.timezone`: `TODAY` desde las 00:00 locales; `LAST_7_DAYS` desde las 00:00 de hace 6 días; `CUSTOM` de `from` 00:00 a `to` 23:59:59 locales.
- La búsqueda `q` compara sin distinguir mayúsculas contra el nombre, el teléfono, los dígitos del teléfono (sin espacios ni signos) y el código `PED-XXXXXXXX`. Los comodines `%` y `_` se escapan.
- Transición: dentro de una transacción reactiva inserta la clave de idempotencia (`ORDER_TRANSITION:{id}`), bloquea el pedido con `FOR UPDATE`, valida con la política, actualiza el estado, inserta `order_status_history` (con `actor_role`, `change_type`, `reason_code`, `reason` y `correlation_id`) y `audit_log` (`ORDER_{changeType}_{target}`). Aceptar o rechazar guarda `restaurant_decision_by`. Cualquier error revierte todo, incluida la clave.
- Deshacer: misma transacción y bloqueo (`ORDER_UNDO:{id}`). Solo procede si la última fila del historial es un `AVANCE` del mismo usuario, el pedido sigue en el estado que dejó y no venció la ventana (comparada con `now()` de la base). Registra `DESHACER` sin motivo.
- Retroceder y deshacer no crean ni liberan reservas y no cambian el pago.
- Errores: 400 `IDEMPOTENCY_KEY_REQUIRED`, `STATUS_INVALID`, `REASON_REQUIRED`, `REASON_INVALID`, `REASON_TEXT_REQUIRED`, `REASON_TOO_LONG`; 403 `FORBIDDEN`; 404 `ORDER_NOT_FOUND`; 409 `TRANSITION_NOT_ALLOWED`, `UNDO_NOT_AVAILABLE`, `UNDO_WINDOW_EXPIRED` («Pasó el tiempo para deshacer. Avisa a caja…»).
- El código público `PED-XXXXXXXX` se deriva de los primeros 8 caracteres del UUID.
- `OrderReportingService` es el contrato interno de solo lectura para otros módulos; expone el plato con más unidades históricas sin revelar tablas.

## Aislamiento, trazabilidad e idempotencia

- Toda consulta filtra `restaurante_id` del usuario autenticado; un pedido de otro restaurante responde 404 al leer o al cambiar.
- Cada cambio de estado deja historial y auditoría con usuario, rol, fecha y `correlation_id`. Repetir la misma `Idempotency-Key` no repite el efecto y devuelve el estado actual (aunque el cuerpo sea distinto).
- La lista hace una consulta de conteo y otra de página con los mismos filtros enlazados como parámetros.

## Pruebas

- `OrderTransitionPolicyTest` (unitaria): matriz por rol, estados terminales, ausencia de `ACCEPTED → PENDING_DECISION`, límites de COCINA y motivos.
- `OrdersIntegrationTest` (Testcontainers, PostgreSQL real con V1–V10): COCINA sin montos ni estados no operativos; avance y deshacer de COCINA, segundo deshacer rechazado, CAJA no puede deshacer; ventana vencida; retroceso de CAJA con y sin motivo y su historial; idempotencia; aislamiento con Sierra Verde; filtros, búsqueda por código y teléfono, paginación y errores de filtro.
- `scripts/smoke.ps1`: COCINA lista pedidos sin montos y Sierra Verde recibe 404 en un pedido de Mar Azul.

## TBD / exclusiones

- **TBD (ADR-001):** ¿se permite volver de `ACCEPTED` a `PENDING_DECISION`? Afecta la reserva.
- **TBD:** ¿número correlativo por restaurante (#0001) en lugar de `PED-XXXXXXXX`? Requiere columna nueva.
- **TBD:** ¿cómo identificar a la persona si cocina comparte una cuenta (PIN por persona)? Deshacer depende de identificar al autor.
- Carrito, confirmación de cliente, creación de pedidos, reserva efectiva, vencimiento automático, notificaciones y política de pago por transición.
- El panel pide el detalle de cada pedido de la página (hasta 12 solicitudes adicionales); un detalle embebido en la lista queda como mejora futura.

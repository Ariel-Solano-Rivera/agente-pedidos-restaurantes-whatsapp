# Módulo de pedidos

## Propósito y alcance

Proyecta pedidos sintéticos existentes con sus unidades históricas, los lista con filtros y paginación en el backend y ejecuta los cambios de estado permitidos por rol: avanzar y retroceder un paso con motivo (los tres roles; segunda ronda, bloque C). El «deshacer» de cocina se retiró. La creación de pedidos, la reserva y el vencimiento siguen fuera de este incremento (ADR-001).

## Fuente y dependencias

- Código: `pedidos/OrderController.java` (API), `pedidos/OrderTransitionPolicy.java` (matriz de transiciones, única autoridad), `pedidos/OrderFilter.java` (filtros validados), `pedidos/OrderReportingService.java` (contrato interno de lectura), `common/ApiException.java`.
- Tablas: `customer_order`, `order_unit`, `order_unit_option`, `order_status_history`, `idempotency_operation`, `audit_log`, `delivery_zone`, `app_user`, `restaurant.timezone`. Migraciones V1, V8 y V10.
- Consumidores: `frontend/src/features/pedidos/OrdersPage.tsx`; `administracion/DashboardController` vía `OrderReportingService`.

## Contratos y permisos

- `GET /orders?status&fulfillment&paymentStatus&range&from&to&q&sort&page&size` (todos los roles) devuelve `{items, page, size, total}`. Cada ítem: `id`, `publicCode`, `status`, `paymentStatus`, `paymentId` (pago `PENDING` o `PENDING_VERIFICATION` del pedido que el personal puede confirmar; `null` si no hay o para COCINA), `fulfillmentType`, `customerName`, `phone`, `items`, `total`, `createdAt` y `allowedTransitions`. `sort` (segunda ronda, bloque B): `CREATED_DESC` (por defecto, más recientes primero) o `CREATED_ASC`; el orden es estable porque desempata por `id`, así que la paginación no repite ni salta pedidos.
- `GET /orders/facets` (todos los roles, mismos filtros que la lista sin `page` ni `size`) devuelve `{status, fulfillment, paymentStatus, range}` con la cantidad de pedidos por opción. Cada grupo se calcula con `OrderFilter` aplicando los demás filtros activos y no el propio (así el panel muestra cuántos pedidos daría cada botón); `range` incluye `ALL`, `TODAY`, `LAST_7_DAYS` y `CUSTOM` cuando llegan `from` y `to`. COCINA recibe solo estados operativos y `paymentStatus` vacío, y sigue sin poder filtrar por pago (403). Las columnas agrupadas son constantes del código.
- `GET /orders/board` (todos los roles) devuelve los pedidos activos de cocina (`ACCEPTED`, `PREPARING`, `READY`, ordenados por `statusSince`, máximo 200) con unidades y modificaciones sin importes para ningún rol, `allowedTransitions` del rol y `statusSince` (último cambio del historial o la recepción). Es una sola llamada para el tablero; reutiliza las consultas de unidades e historial.
- `GET /orders/{id}` (todos los roles) añade contacto, retiro/entrega, zona, importes, `customerConfirmedAt`, `restaurantDecisionBy` (correo de quien aceptó o rechazó), unidades históricas, `allowedTransitions` e `history` (más reciente primero: estados, `changeType`, `reasonCode`, `reason`, `actorEmail`, `actorRole`, `createdAt`).
- `allowedTransitions` es una lista de `{targetStatus, direction: FORWARD|BACKWARD, requiresReason, destructive}` calculada por `OrderTransitionPolicy` según el estado y el rol autenticado. El panel no decide transiciones.
- `POST /orders/{id}/transitions` (todos los roles; la política restringe por rol): cabecera `Idempotency-Key` (obligatoria, hasta 120 caracteres) y cuerpo `{targetStatus, reasonCode?, reason?}`. Devuelve `{orderId, status, changeType}`; `changeType` vale `AVANCE`, `RETROCESO` o `REPETIDO` si la clave ya se usó.
- **COCINA no recibe montos**: en lista y detalle `total`, `subtotal`, `deliveryFee`, `paymentStatus`, precios de unidad y recargos de opciones son `null`. Solo ve `ACCEPTED`, `PREPARING`, `READY` y `COMPLETED`; otro estado responde 404. No puede filtrar por pago (403).

### Matriz de transiciones (`OrderTransitionPolicy`)

| Desde | Avanzar (ADMIN, CAJA) | Avanzar (COCINA) | Retroceder (los tres roles; motivo obligatorio) |
|---|---|---|---|
| `PENDING_DECISION` | `ACCEPTED`, `REJECTED` | — | — |
| `ACCEPTED` | `PREPARING`, `CANCELLED` | `PREPARING` | — (`PENDING_DECISION` es TBD según ADR-001) |
| `PREPARING` | `READY` | `READY` | `ACCEPTED` |
| `READY` | `COMPLETED` | — | `PREPARING` |
| `COMPLETED`, `REJECTED`, `CANCELLED`, `EXPIRED` | — | — | — |

`REJECTED` y `CANCELLED` se marcan `destructive`. Motivos de retroceso: `ERROR_AL_AVANZAR`, `CLIENTE_CAMBIO_PEDIDO`, `FALTA_PRODUCTO`, `OTRO`; el texto libre (hasta 300 caracteres) es obligatorio con `OTRO` solo para ADMIN y CAJA: COCINA elige `OTRO` con un toque, sin texto (regla a de la segunda ronda). COCINA no completa desde `READY` ni vuelve de `ACCEPTED` a `PENDING_DECISION`.

## Validaciones y efectos de estado

- Filtros (`OrderFilter`): `sort` debe ser `CREATED_DESC` o `CREATED_ASC` (sin distinguir mayúsculas); `status` debe ser un estado conocido; `fulfillment` `PICKUP|DELIVERY`; `paymentStatus` `[A-Z_]{1,40}`; `range` `TODAY|LAST_7_DAYS|CUSTOM` (CUSTOM exige `from` y `to`, `from ≤ to`, hasta 366 días); `q` hasta 80 caracteres; `page ≥ 0`; `1 ≤ size ≤ 100` (por defecto 20). Error: 400 `FILTER_INVALID`.
- Los rangos se calculan en SQL con `restaurant.timezone`: `TODAY` desde las 00:00 locales; `LAST_7_DAYS` desde las 00:00 de hace 6 días; `CUSTOM` de `from` 00:00 a `to` 23:59:59 locales.
- La búsqueda `q` compara sin distinguir mayúsculas contra el nombre, el teléfono, los dígitos del teléfono (sin espacios ni signos) y el código `PED-XXXXXXXX`. Los comodines `%` y `_` se escapan.
- Transición: dentro de una transacción reactiva inserta la clave de idempotencia (`ORDER_TRANSITION:{id}`), bloquea el pedido con `FOR UPDATE`, valida con la política, actualiza el estado, inserta `order_status_history` (con `actor_role`, `change_type`, `reason_code`, `reason` y `correlation_id`) y `audit_log` (`ORDER_{changeType}_{target}`). Aceptar o rechazar guarda `restaurant_decision_by`. Cualquier error revierte todo, incluida la clave.
- Retroceder no crea ni libera reservas y no cambia el pago. Cada retroceso queda como `RETROCESO` con usuario, rol, motivo, estado anterior y nuevo y fecha; el dashboard los muestra para que ADMIN los revise.
- Las filas históricas con `change_type = DESHACER` (anteriores al bloque C) se conservan; la restricción CHECK de V10 sigue admitiendo el valor, pero el código ya no lo genera y `POST /orders/{id}/undo` responde 404.
- Errores: 400 `IDEMPOTENCY_KEY_REQUIRED`, `STATUS_INVALID`, `REASON_REQUIRED`, `REASON_INVALID`, `REASON_TEXT_REQUIRED`, `REASON_TOO_LONG`; 403 `FORBIDDEN`; 404 `ORDER_NOT_FOUND`; 409 `TRANSITION_NOT_ALLOWED`.
- El código público `PED-XXXXXXXX` se deriva de los primeros 8 caracteres del UUID.
- `OrderReportingService` es el contrato interno de solo lectura para otros módulos; expone el plato con más unidades históricas sin revelar tablas.

## Aislamiento, trazabilidad e idempotencia

- Toda consulta filtra `restaurante_id` del usuario autenticado; un pedido de otro restaurante responde 404 al leer o al cambiar.
- Cada cambio de estado deja historial y auditoría con usuario, rol, fecha y `correlation_id`. Repetir la misma `Idempotency-Key` no repite el efecto y devuelve el estado actual (aunque el cuerpo sea distinto).
- La lista hace una consulta de conteo y otra de página con los mismos filtros enlazados como parámetros.

## Pruebas

- `OrderTransitionPolicyTest` (unitaria): matriz por rol, estados terminales, ausencia de `ACCEPTED → PENDING_DECISION`, COCINA un paso adelante o atrás entre sus tres columnas con motivo (`OTRO` sin texto), sin completar, y motivos.
- `OrdersIntegrationTest` (Testcontainers, PostgreSQL real con V1–V13): COCINA sin montos ni estados no operativos; COCINA avanza y retrocede con motivo (`REASON_REQUIRED` sin motivo, `OTRO` con un toque, historial con rol y motivo, `undo` responde 404); COCINA no completa desde `READY`; retroceso de CAJA con y sin motivo y su historial; idempotencia; aislamiento con Sierra Verde; filtros, orden, búsqueda por código y teléfono, paginación y errores de filtro; el mismo extra dos veces llega como dos filas y suma dos veces (`sameExtraChosenTwiceArrivesAsTwoRowsAndSumsTwice`).
- `OrdersIntegrationTest.sortsByCreationDateInBothDirectionsWithAStableOrder`: el orden por defecto coincide con `CREATED_DESC`, `CREATED_ASC` es su inverso y no decrece, tres páginas consecutivas no repiten ni saltan pedidos, un `sort` desconocido responde 400 `FILTER_INVALID`, y `paymentId` solo llega con pago pendiente de confirmar y nunca para COCINA.
- `OrdersIntegrationTest.facetsCountEachGroupWithTheOtherFiltersAndStayIsolated`: la suma de cada grupo coincide con el total de la lista; cada opción coincide con el total filtrado; elegir un estado no cambia su propio grupo y sí los demás; COCINA sin grupo de pago y con 403 al filtrar por pago; otro restaurante solo cuenta sus pedidos; estado inválido → 400.
- `OrdersIntegrationTest.boardListsActiveOrdersWithUnitsWithoutAmountsAndRoleTransitions`: solo estados activos, unidades sin importes, `READY` solo con retroceso para COCINA, transiciones por rol tras avanzar y aislamiento del otro restaurante.
- `scripts/smoke.ps1`: COCINA lista pedidos sin montos y Sierra Verde recibe 404 en un pedido de Mar Azul.

## TBD / exclusiones

- **TBD (ADR-001):** ¿se permite volver de `ACCEPTED` a `PENDING_DECISION`? Afecta la reserva.
- **TBD:** ¿número correlativo por restaurante (#0001) en lugar de `PED-XXXXXXXX`? Requiere columna nueva.
- **TBD:** ¿cómo identificar a la persona si cocina comparte una cuenta (PIN por persona)? El historial de retrocesos guarda al autor de la cuenta.
- Carrito, confirmación de cliente, creación de pedidos, reserva efectiva, vencimiento automático, notificaciones y política de pago por transición.
- `order_unit_option` no tiene columna de cantidad: el mismo extra elegido dos veces son dos filas con el mismo nombre (el panel las agrupa como «x2»); cambiarlo requeriría migración (TBD).

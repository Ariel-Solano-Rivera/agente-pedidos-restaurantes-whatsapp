# Resumen de negocio y dashboard de ADMIN

## Propósito y alcance

Expone dos proyecciones de solo lectura para Inicio:

- `GET /dashboard` para todos los roles: nombre del restaurante, pausa de recepción, plato con más unidades históricas, tareas programadas y, solo para ADMIN y CAJA, cobrado y por cobrar de hoy.
- `GET /dashboard/admin` para ADMIN: indicadores del período con comparación frente al período anterior de igual duración.

No modifica pedidos, pagos, disponibilidad ni tareas. No calcula ganancia: el sistema no guarda costos, recetas ni compras.

## Fuente y dependencias

- Código: `administracion/DashboardController.java`, `administracion/DashboardPeriod.java`.
- Contratos internos de lectura (cada módulo consulta solo sus tablas):
  - `pedidos/OrderMetricsService` (`customer_order`, `order_unit`, `order_unit_option`, `order_status_history`; consulta `payment` solo para «por cobrar», ver TBD),
  - `pedidos/OrderReportingService.mostSoldDish`,
  - `pagos/PaymentReportingService.collected` (`payment`),
  - `menu/MenuReportingService.soldOutDishes` (`dish`, `sellable_variant`, `availability`),
  - `intervencion/HandoffReportingService.openCount` (`human_handoff`).
- Tablas propias: `restaurant` (incluida `timezone`), `operation_settings`, `dashboard_task`.
- Consumidores: `frontend/src/features/inicio/HomePage.tsx` y `AdminDashboard.tsx`.

## Contratos y permisos

- `GET /api/v1/dashboard` (ADMIN, CAJA, COCINA): `restaurantName`, `receptionPaused`, `pauseReason`, `generatedAt`, `topDish`, hasta tres `tasks` `SCHEDULED` desde el inicio del día y `cash: {collected, receivable}` del día. **COCINA recibe `cash = null`.**
- `GET /api/v1/dashboard/admin?range=TODAY|LAST_7_DAYS|LAST_30_DAYS` (solo ADMIN; por defecto `TODAY`). CAJA y COCINA reciben 403 `FORBIDDEN`; un rango desconocido devuelve 400 `RANGE_INVALID`.
  - Respuesta: `range`, `timezone`, `from`, `to`, `previousFrom`, `previousTo`, `generatedAt`.
  - Indicadores con `{current, previous}`: `collected`, `receivable`, `completedSales`, `completedOrders`, `averageTicket`, `acceptanceRate`, `decisionMinutes`, `preparationMinutes`, `newCustomers`, `returningCustomers`.
  - `lostSales`: `[{cause, count, amount, previousCount, previousAmount}]`.
  - Solo del período actual: `ordersByHour` (24 filas), `topDishes` y `topExtras` (hasta 5), `fulfillment` y `backwards` (`[{day, role, changeType, count}]`).
  - Del momento (no del período): `openHandoffs` y `soldOutDishes`.

## Definiciones de los indicadores

**Período.** Se usa la zona horaria `restaurant.timezone`.
- `TODAY` va de las 00:00 locales de hoy hasta el instante actual; `LAST_7_DAYS` y `LAST_30_DAYS` empiezan a las 00:00 locales de hace 6 y 29 días, respectivamente.
- El período anterior es el mismo intervalo desplazado 1, 7 o 30 días hacia atrás. Por ejemplo, con `TODAY` se compara con ayer desde las 00:00 hasta la misma hora.
- Los intervalos son semiabiertos `[from, to)`.

**Cálculo.** Todos los importes son `NUMERIC` sumados en PostgreSQL. Los cocientes se calculan con `BigDecimal` y redondeo `HALF_UP`. Se usan los precios copiados en el pedido (`total`, `subtotal`, `surcharge_snapshot`) y nunca los precios actuales del menú.

| Indicador | Definición exacta |
|---|---|
| Cobrado | `SUM(payment.amount)` con `status='CONFIRMED'` y `verified_at` en el período. |
| Por cobrar | `SUM(customer_order.total)` de pedidos **creados** en el período, en `ACCEPTED`, `PREPARING`, `READY` o `COMPLETED`, sin ningún pago `CONFIRMED`. |
| Ventas completadas | `SUM(total)` y conteo de pedidos en `COMPLETED` cuyo historial tiene la entrada `new_status='COMPLETED'` dentro del período (**fecha de completado**). |
| Ventas no concretadas | Por causa (`REJECTED`, `CANCELLED`, `EXPIRED`): conteo y `SUM(total)` de pedidos **creados** en el período con ese estado final. |
| Ticket promedio | Ventas completadas ÷ pedidos completados (2 decimales); `null` si no hay completados. |
| Tasa de aceptación | Pedidos creados en el período que fueron aceptados (estado `ACCEPTED`, `PREPARING`, `READY`, `COMPLETED` o `CANCELLED`) ÷ esos mismos más los `REJECTED` (4 decimales; 0,85 = 85 %). Los `PENDING_DECISION` y `EXPIRED` no cuentan. `null` sin decisiones. |
| Tiempo de decisión | Promedio en minutos (1 decimal) entre `confirmed_by_customer_at` y la primera entrada `AVANCE` `PENDING_DECISION → ACCEPTED/REJECTED`, para las decisiones ocurridas en el período. |
| Tiempo de preparación | Promedio en minutos entre la primera entrada `AVANCE` `PENDING_DECISION → ACCEPTED` y la última entrada `AVANCE` a `READY`, para pedidos que llegaron a `READY` en el período. |
| Pedidos por hora | Conteo de pedidos **creados** en el período por hora local (0–23). |
| Platos más vendidos | Unidades (`order_unit`) e importe (`SUM(order_unit.subtotal)`) por `dish_name_snapshot` en pedidos completados en el período; top 5 por unidades. |
| Extras más pedidos | Conteo y `SUM(surcharge_snapshot)` de opciones `EXTRA` en pedidos completados en el período; top 5. |
| Retiro frente a entrega | Conteo y `SUM(total)` de pedidos completados en el período por `fulfillment_mode`. |
| Clientes nuevos y recurrentes | El cliente se identifica por `customer_phone`. Entre los teléfonos con pedidos creados en el período, es nuevo si su primer pedido en el restaurante cae dentro del período; recurrente en otro caso. |
| Derivaciones sin contestar | Conteo actual de `human_handoff.status='OPEN'`. |
| Platos agotados | Platos activos sin variante vendible (activa, no `sold_out` y, si `tracked`, con `on_hand - reserved > 0`); misma regla que `available`. |
| Retrocesos por rol por día | Conteo de entradas `RETROCESO` y `DESHACER` del historial en el período, por día local, `actor_role` y `change_type`. |
| Cobrado y por cobrar de hoy (CAJA) | Las mismas definiciones con el período `TODAY`. |

## Validaciones y efectos de estado

- `Tenant.restaurantId()` fija el restaurante; ningún endpoint recibe ese valor del cliente.
- Si no hay unidades vendidas, `topDish` vale `Sin ventas registradas` con cero unidades.
- No hay efectos de estado ni idempotencia requerida (solo lectura).

## Aislamiento, trazabilidad e idempotencia

- Cada consulta de cada servicio filtra `restaurante_id`. Sierra Verde no ve las cifras de Mar Azul.

## Pruebas

- `DashboardPeriodTest`: períodos en la zona del restaurante (incluido un instante en que la fecha UTC ya cambió), desplazamiento del período anterior, rango inválido y división exacta.
- `DashboardIntegrationTest` (Testcontainers):
  - permisos: CAJA y COCINA reciben 403 en `/admin`; COCINA no recibe `cash`; CAJA recibe solo cobrado y por cobrar;
  - coherencia: la suma de pedidos por hora coincide con `GET /orders?range=…`, la suma de retiro y entrega coincide con las ventas completadas, y el ticket promedio coincide con ventas ÷ pedidos;
  - aislamiento con Sierra Verde.

## TBD / exclusiones

- **TBD:** ¿«Por cobrar» debe vivir detrás de un contrato del módulo de pagos? Hoy `OrderMetricsService` consulta `payment` para excluir pedidos con pago confirmado.
- **TBD:** al integrar el CRM, ¿una derivación sin contestar debe ser la que tiene el último mensaje del cliente, en lugar de `OPEN`?
- **TBD:** costo opcional por plato para estimar margen; no implementado.
- CRUD de tareas, alertas, exportación y estados de pago definitivos (ADR-001).

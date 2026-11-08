# Resumen de negocio compartido

## Propósito y alcance

Expone una proyección de lectura para Inicio: nombre del restaurante, pausa de recepción, plato con más unidades históricas y tareas programadas. No modifica pedidos, disponibilidad ni tareas.

## Fuente y dependencias

- Código: `administracion/DashboardController.java`, `pedidos/OrderReportingService.java`.
- Tablas propias: `restaurant`, `operation_settings`, `dashboard_task`.
- Contrato interno: `OrderReportingService.mostSoldDish(restauranteId)` encapsula el acceso a `order_unit`.
- Consumidor: `frontend/src/features/inicio/HomePage.tsx`.

## Contratos y permisos

- `GET /api/v1/dashboard`, autenticado para ADMIN, CAJA y COCINA.
- Devuelve `restaurantName`, estado operativo, `generatedAt`, `topDish` y máximo tres tareas `SCHEDULED` desde el inicio del día.

## Validaciones y efectos de estado

- `Tenant.restaurantId()` fija el restaurante; el endpoint no recibe ese valor.
- Si no existen unidades vendidas, devuelve `Sin ventas registradas` con cero unidades.
- Solo consulta tareas del restaurante y no tiene efectos de estado ni idempotencia requerida.

## Pruebas

- Arranque de Flyway con `V6__dashboard_tasks.sql`.
- 200 para ADMIN, CAJA y COCINA de Mar Azul; confirmar aislamiento para Sierra Verde y ausencia de `restaurante_id` controlable.

## TBD / exclusiones

- CRUD, asignación y ciclo de vida de tareas; métricas financieras, notificaciones y logo por restaurante.

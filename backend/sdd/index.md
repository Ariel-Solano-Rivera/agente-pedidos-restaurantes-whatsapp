# Índice SDD - backend

| Módulo | Fuente principal | Documento | Estado |
|---|---|---|---|
| Arranque y errores | `RestaurantAdminApplication`, `common/`, `compose.yaml` | [plataforma.md](plataforma.md) | Implementado; errores `{code,message}` con código estable; Actuator health; Maven Wrapper y Testcontainers |
| Autenticación y tenancy | `security/`, `administracion/MeController` | [seguridad-tenancy.md](seguridad-tenancy.md) | Implementado para demo local; 401 JSON sin diálogo nativo |
| Resumen y dashboard | `administracion/DashboardController`, `DashboardPeriod`, `pedidos/OrderMetricsService`, `OrderReportingService`, `pagos/PaymentReportingService`, `menu/MenuReportingService`, `intervencion/HandoffReportingService` | [resumen-negocio.md](resumen-negocio.md) | Resumen para tres roles con caja de hoy (ADMIN/CAJA); dashboard de ADMIN con indicadores definidos y comparación; pruebas unitarias y de integración |
| Menú | `menu/MenuController` | [menu.md](menu.md) | CRUD de platos por catálogo; `available` por plato y `tracked` por variante (V11); prueba de integración |
| Catálogo de menú | `menu/CatalogController` | [catalogo.md](catalogo.md) | CRUD de presentaciones e ingredientes; borrado seguro de categorías |
| Operación y disponibilidad | `operacion/OperationController` | [operacion.md](operacion.md) | Implementado parcialmente |
| Pedidos | `pedidos/OrderController`, `OrderTransitionPolicy`, `OrderFilter`, `OrderReportingService` | [pedidos.md](pedidos.md) | Filtros, conteos por opción (`GET /orders/facets`), tablero de cocina (`GET /orders/board`) y paginación en backend; avanzar, retroceder con motivo y deshacer de cocina por rol, con historial e idempotencia; COCINA sin montos; pruebas unitarias y de integración |
| Pagos | `pagos/PaymentController` | [pagos.md](pagos.md) | Solo lectura con filtro por pedido y verificador (`?orderId`); prueba de integración; confirmación manual pendiente de ADR-001 |
| Intervención humana | `intervencion/HandoffController`, `HandoffReportingService` | [intervencion-humana.md](intervencion-humana.md) | Tomar/liberar con regla de dueño, transacción y auditoría |
| CRM | `intervencion/CrmController`, `pedidos/OrderReportingService.customerHistory` | [crm.md](crm.md) | Conversaciones con pestañas y búsqueda, hilo, respuesta STAFF idempotente, ficha del cliente (V12); sin WhatsApp |
| Marca del restaurante | `administracion/BrandingController`, `BrandingPolicy` | [marca.md](marca.md) | Colores y logo (V13), contraste WCAG AA contra blanco, tipo real del archivo, auditoría y aislamiento |
| Esquema y datos ficticios | `resources/db/migration/` | [persistencia.md](persistencia.md) | V1–V13; modelo sensible por revisar |

# Índice SDD - backend

| Módulo | Fuente principal | Documento | Estado |
|---|---|---|---|
| Arranque y errores | `RestaurantAdminApplication`, `common/`, `compose.yaml` | [plataforma.md](plataforma.md) | Implementado; errores `{code,message}` con código estable; Actuator health; Maven Wrapper y Testcontainers |
| Autenticación y tenancy | `security/`, `administracion/MeController` | [seguridad-tenancy.md](seguridad-tenancy.md) | Implementado para demo local; 401 JSON sin diálogo nativo |
| Resumen compartido | `administracion/DashboardController`, `pedidos/OrderReportingService` | [resumen-negocio.md](resumen-negocio.md) | Implementado; lectura para tres roles |
| Menú | `menu/MenuController` | [menu.md](menu.md) | CRUD de platos por catálogo; `available` por plato y `tracked` por variante (V11); prueba de integración |
| Catálogo de menú | `menu/CatalogController` | [catalogo.md](catalogo.md) | CRUD de presentaciones e ingredientes; borrado seguro de categorías |
| Operación y disponibilidad | `operacion/OperationController` | [operacion.md](operacion.md) | Implementado parcialmente |
| Pedidos | `pedidos/OrderController`, `OrderTransitionPolicy`, `OrderFilter`, `OrderReportingService` | [pedidos.md](pedidos.md) | Filtros y paginación en backend; avanzar, retroceder con motivo y deshacer de cocina por rol, con historial e idempotencia; COCINA sin montos; pruebas unitarias y de integración |
| Pagos | `pagos/PaymentController` | [pagos.md](pagos.md) | Solo lectura; ADR pendiente |
| Intervención humana | `intervencion/HandoffController` | [intervencion-humana.md](intervencion-humana.md) | Implementado parcialmente |
| Esquema y datos ficticios | `resources/db/migration/` | [persistencia.md](persistencia.md) | V1–V11; modelo sensible por revisar |

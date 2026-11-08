# Índice SDD - backend

| Módulo | Fuente principal | Documento | Estado |
|---|---|---|---|
| Arranque y errores | `RestaurantAdminApplication`, `common/`, `compose.yaml` | [plataforma.md](plataforma.md) | Implementado; PostgreSQL local en 55478 por defecto |
| Autenticación y tenancy | `security/`, `administracion/MeController` | [seguridad-tenancy.md](seguridad-tenancy.md) | Implementado para demo local; 401 JSON sin diálogo nativo |
| Resumen compartido | `administracion/DashboardController`, `pedidos/OrderReportingService` | [resumen-negocio.md](resumen-negocio.md) | Implementado; lectura para tres roles |
| Menú | `menu/MenuController` | [menu.md](menu.md) | Consulta y alta por catálogo implementadas |
| Catálogo de menú | `menu/CatalogController` | [catalogo.md](catalogo.md) | CRUD de presentaciones e ingredientes; borrado seguro de categorías |
| Operación y disponibilidad | `operacion/OperationController` | [operacion.md](operacion.md) | Implementado parcialmente |
| Pedidos | `pedidos/OrderController`, `pedidos/OrderReportingService` | [pedidos.md](pedidos.md) | Lectura detallada y transiciones manuales trazables implementadas |
| Pagos | `pagos/PaymentController` | [pagos.md](pagos.md) | Solo lectura; ADR pendiente |
| Intervención humana | `intervencion/HandoffController` | [intervencion-humana.md](intervencion-humana.md) | Implementado parcialmente |
| Esquema y datos ficticios | `resources/db/migration/` | [persistencia.md](persistencia.md) | Implementado; modelo sensible por revisar |

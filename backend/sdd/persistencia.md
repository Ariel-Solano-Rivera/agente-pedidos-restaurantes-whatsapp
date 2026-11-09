# Persistencia, migraciones y datos ficticios

## Propósito y alcance

Describe las migraciones PostgreSQL que sostienen el incremento administrativo. Especifica la implementación existente; el modelo conceptual aprobado sigue siendo `Planificacion/modelo-base-datos.md`.

## Fuente y dependencias

- Migraciones: `src/main/resources/db/migration/V1__administrative_schema.sql` a `V10__order_transitions_filters.sql`.
- Arranque: Flyway se ejecuta por JDBC solo durante inicio; las rutas usan R2DBC.

## Reglas implementadas

- Entidades dependientes incluyen `restaurante_id`; datos semilla contienen dos restaurantes ficticios.
- El esquema incluye menú, disponibilidad, movimientos, configuración, pedidos históricos, pagos, conversaciones, derivaciones, tareas compartidas e idempotencia.
- `dashboard_task` se filtra por `restaurante_id`, conserva fecha programada y admite únicamente los estados `SCHEDULED`, `COMPLETED` o `CANCELLED`; la pantalla Inicio solo lee las tareas programadas.
- `dish_image` usa la clave compuesta `(restaurante_id,dish_id)`, admite solo JPEG/PNG/WebP y limita el binario a 2 MB; la semilla no contiene imágenes reales.
- `order_status_history` conserva estado anterior/nuevo, motivo libre, `reason_code`, actor, `actor_role` (`ADMIN|CAJA|COCINA`), `change_type` (`AVANCE|RETROCESO|DESHACER`) y correlación; un `RETROCESO` exige `reason_code` (CHECK). `idempotency_operation` deduplica la acción por pedido.
- V10 añade `restaurant.timezone` (por defecto `America/Guayaquil`), un CHECK con los ocho estados de pedido, `UNIQUE(restaurante_id,id)` en `customer_order` y un índice por restaurante y fecha. También siembra 28 pedidos ficticios con IDs `md5('t1-order-N')::uuid` (24 de Mar Azul, 4 de Sierra Verde) repartidos en 60 días, todos los estados, modalidades y estados de pago, con historial coherente, pagos y un retroceso de ejemplo; los teléfonos usan el prefijo ficticio `+593 000 000`.
- `menu_presentation` y `catalog_ingredient` son catálogos aislados por restaurante y únicos por nombre. No son FKs de las opciones de plato, para que una edición o baja posterior no modifique configuraciones o ventas históricas.
- Restricciones evitan saldo o precio negativo en las tablas definidas y FKs relacionan recursos del mismo restaurante cuando están modeladas.
- Credenciales de demostración se regeneran como BCrypt en la migración V5 y son solo para entorno local.

## Pruebas

- Arranque Docker y `OrdersIntegrationTest` (Testcontainers) aplican Flyway V1 a V10 correctamente.
- La prueba de humo valida aislamiento entre los dos restaurantes ficticios.

## TBD / exclusiones

- No modificar migraciones ya aplicadas; agregar una nueva versión para cambios.
- Completar el modelo tras aprobar reserva, pagos, cancelaciones, privacidad y las restricciones de concurrencia asociadas.
- Pendiente: claves foráneas compuestas `(restaurante_id, …)` de `order_unit`, `order_unit_option`, `payment` y `order_status_history` hacia `customer_order` (V10 ya creó la clave única necesaria) y CHECK de estados de pago cuando ADR-001 los apruebe.

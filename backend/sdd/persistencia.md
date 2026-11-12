# Persistencia, migraciones y datos ficticios

## Propósito y alcance

Describe las migraciones PostgreSQL que sostienen el incremento administrativo. Especifica la implementación existente; el modelo conceptual aprobado sigue siendo `Planificacion/modelo-base-datos.md`.

## Fuente y dependencias

- Migraciones: `src/main/resources/db/migration/V1__administrative_schema.sql` a `V14__unify_extra_names.sql`.
- Arranque: Flyway se ejecuta por JDBC solo durante inicio; las rutas usan R2DBC.

## Reglas implementadas

- Entidades dependientes incluyen `restaurante_id`; datos semilla contienen dos restaurantes ficticios.
- El esquema incluye menú, disponibilidad, movimientos, configuración, pedidos históricos, pagos, conversaciones, derivaciones, tareas compartidas e idempotencia.
- `dashboard_task` se filtra por `restaurante_id`, conserva fecha programada y admite únicamente los estados `SCHEDULED`, `COMPLETED` o `CANCELLED`; la pantalla Inicio solo lee las tareas programadas.
- `dish_image` usa la clave compuesta `(restaurante_id,dish_id)`, admite solo JPEG/PNG/WebP y limita el binario a 2 MB; desde el bloque D el backend guarda siempre `image/webp`; la semilla no contiene imágenes reales.
- `order_status_history` conserva estado anterior/nuevo, motivo libre, `reason_code`, actor, `actor_role` (`ADMIN|CAJA|COCINA`), `change_type` (`AVANCE|RETROCESO|DESHACER`) y correlación; un `RETROCESO` exige `reason_code` (CHECK). `idempotency_operation` deduplica la acción por pedido.
- V10 añade `restaurant.timezone` (por defecto `America/Guayaquil`), un CHECK con los ocho estados de pedido, `UNIQUE(restaurante_id,id)` en `customer_order` y un índice por restaurante y fecha. También siembra 28 pedidos ficticios con IDs `md5('t1-order-N')::uuid` (24 de Mar Azul, 4 de Sierra Verde) repartidos en 60 días, todos los estados, modalidades y estados de pago, con historial coherente, pagos y un retroceso de ejemplo; los teléfonos usan el prefijo ficticio `+593 000 000`.
- `menu_presentation` y `catalog_ingredient` son catálogos aislados por restaurante y únicos por nombre. No son FKs de las opciones de plato, para que una edición o baja posterior no modifique configuraciones o ventas históricas.
- Restricciones evitan saldo o precio negativo en las tablas definidas y FKs relacionan recursos del mismo restaurante cuando están modeladas.
- V11 añade `availability.tracked` (por defecto `TRUE` para las variantes existentes): indica si la variante controla cantidad. Los platos creados desde el panel nacen con `tracked=false` y el primer ajuste de disponibilidad lo activa.
- V12 crea `customer` (único por `(restaurante_id, phone)`), añade `customer_id` con FK compuesta a `conversation` y `customer_order` (rellenado por teléfono), crea `conversation_message` (autor `CUSTOMER|AGENT|STAFF`, cuerpo de 1 a 2000 caracteres, `external_message_id` único por restaurante, FK compuesta a la conversación, `STAFF` exige `author_user_id`) y CHECK de `conversation.control_mode` y `human_handoff.status`. Siembra 7 conversaciones ficticias (6 de Mar Azul, 1 de Sierra Verde) con mensajes y derivaciones abiertas, en atención y resueltas.
- V13 crea `restaurant_branding` (PK `restaurante_id`, colores `#RRGGBB` en mayúsculas con CHECK, logo `BYTEA` de hasta 2 MB con tipo `image/png|jpeg|webp`, ambos nulos o ambos presentes, `updated_by`/`updated_at`). Siembra el tema por defecto para Mar Azul y una marca verde ficticia para Sierra Verde.
- V14 (segunda ronda, bloque D) renombra «X extra» a «X» en `catalog_ingredient` y `extra_option` cuando no choca con un nombre existente, sin tocar `order_unit_option.name_snapshot` ni borrar filas (en la semilla: «Camarón extra» pasa a «Camarón»).
- Credenciales de demostración se regeneran como BCrypt en la migración V5 y son solo para entorno local.

## Pruebas

- Arranque Docker y `OrdersIntegrationTest` (Testcontainers) aplican Flyway V1 a V14 correctamente.
- La prueba de humo valida aislamiento entre los dos restaurantes ficticios.

## TBD / exclusiones

- No modificar migraciones ya aplicadas; agregar una nueva versión para cambios.
- Completar el modelo tras aprobar reserva, pagos, cancelaciones, privacidad y las restricciones de concurrencia asociadas.
- Pendiente: claves foráneas compuestas `(restaurante_id, …)` de `order_unit`, `order_unit_option`, `payment` y `order_status_history` hacia `customer_order` (V10 ya creó la clave única necesaria) y CHECK de estados de pago cuando ADR-001 los apruebe.

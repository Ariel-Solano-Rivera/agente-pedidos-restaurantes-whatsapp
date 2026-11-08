# Contratos HTTP v1

Base: `/api/v1`. Autenticación HTTP Basic de demostración; no usar fuera del entorno local. El usuario autenticado determina restaurante y rol. Todas las respuestas de error usan `{ "code", "message" }`. Un 401 devuelve `UNAUTHORIZED` y el mensaje `Usuario o contraseña incorrectos.` sin encabezado `WWW-Authenticate`, para que el panel muestre el error en su formulario y no active un diálogo nativo del navegador.

| Operación | Actor | Entrada / salida | Errores |
|---|---|---|---|
| `GET /me` | cualquier rol | usuario, restaurante y permisos | 401 |
| `GET /dashboard` | ADMIN, CAJA, COCINA | resumen aislado: restaurante, estado de recepción, fecha, plato más vendido y máximo tres tareas programadas | 401 |
| `GET /menu/categories`, `GET /menu/catalog/presentations`, `GET /menu/catalog/ingredients`, `GET /menu/dishes` | cualquier rol | menú y catálogos del restaurante actual | 401 |
| `GET /menu/dishes/{id}/image` | cualquier rol | imagen binaria del plato propio, si existe | 401, 404 |
| `POST/PUT/DELETE /admin/categories/{id?}` | ADMIN | categoría validada; el borrado solo procede sin platos asociados | 400, 403, 404, 409 |
| `POST/PUT/DELETE /admin/catalog/presentations/{id?}`, `POST/PUT/DELETE /admin/catalog/ingredients/{id?}` | ADMIN | elemento reutilizable de catálogo; borrar no altera copias existentes en platos o pedidos | 400, 403, 404, 409 |
| `POST /admin/dishes` | ADMIN | plato, variantes, extras y retirables con IDs activos y propios de categoría, presentación e ingrediente | 400, 403, 409 |
| `PUT /admin/dishes/{id}` | ADMIN | cuerpo `{categoryId,name,description,presentationId,price,extras:[{ingredientId,surcharge,active}],ingredients:[{ingredientId,removable}]}`; cambia datos y reemplaza extras/retirables de un plato propio en una transacción; listas vacías eliminan esas opciones | 400, 403, 404, 409 |
| `PATCH /admin/dishes/{id}/active` | ADMIN | cuerpo `{ active }`; activa o desactiva un plato propio | 403, 404 |
| `DELETE /admin/dishes/{id}` | ADMIN | elimina plato propio, imagen, opciones, disponibilidad y variantes; se rechaza si hay movimientos de disponibilidad | 403, 404, 409 |
| `POST /admin/dishes/{id}/image` | ADMIN | `multipart/form-data` con `file` JPEG/PNG/WebP hasta 2 MB; reemplaza la imagen previa | 400, 403, 404, 413 |
| `GET /operation/settings`, `PUT /admin/operation/settings` | cualquier rol / ADMIN | consulta o actualiza pausa de recepción | 400, 403 |
| `GET /operation/zones`, `POST /admin/zones`; `GET /operation/schedules`, `POST /admin/schedules` | cualquier rol / ADMIN | zonas, tarifas y horarios | 400, 403 |
| `GET /availability`, `POST /availability/adjustments` | ADMIN, CAJA | disponibilidad o ajuste con clave idempotente | 400, 403, 404, 409 |
| `GET /orders`, `GET /orders/{id}` | ADMIN, CAJA, COCINA | la lista incluye cliente, estado, modalidad, total y hora; el detalle incluye contacto, retiro/entrega, zona, importes, pago, confirmación y unidades históricas | 401, 403, 404 |
| `POST /orders/{id}/transitions` | ADMIN, CAJA | cuerpo `{ targetStatus, reason? }` y cabecera `Idempotency-Key`; cambia únicamente una transición permitida y registra historial | 400, 403, 404, 409 |
| `GET /payments` | ADMIN, CAJA | pagos sintéticos | 401, 403 |
| `GET /handoffs`, `POST /handoffs/{id}/claim`, `POST /handoffs/{id}/release` | ADMIN, CAJA | derivación y control humano | 403, 404 |

El panel nunca calcula precios, totales, permisos ni transiciones. Operaciones mutantes incluyen `Idempotency-Key` cuando el reintento pueda producir efectos. La transición de pedidos ya está implementada para solicitudes sintéticas; creación, reserva, vencimiento y pago manual continúan separados y pendientes de sus contratos.

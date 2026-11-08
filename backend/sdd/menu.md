# Módulo de menú

## Propósito y alcance

Consulta categorías y platos del restaurante, y permite a ADMIN crear un plato con sus opciones permitidas provenientes del catálogo. Es la fuente futura del contenido RAG, pero no implementa RAG.

## Fuente y dependencias

- Código: `menu/MenuController.java`.
- Tablas: `category`, `menu_presentation`, `catalog_ingredient`, `dish`, `sellable_variant`, `extra_option`, `removable_ingredient`, `preparation_instruction`, `availability`, `dish_image`.
- Consumidores: panel de menú y futuro módulo `menu-rag`.

## Contratos y permisos

- `GET /menu/categories`, `GET /menu/dishes`, `GET /menu/dishes/{id}` y `GET /menu/dishes/{id}/image`: usuario autenticado del restaurante.
- `POST /admin/categories`, `PUT /admin/categories/{id}`, `POST /admin/dishes`, `PUT /admin/dishes/{id}`, `PATCH /admin/dishes/{id}/active`, `DELETE /admin/dishes/{id}` y `POST /admin/dishes/{id}/image`: ADMIN.
- Alta de plato exige categoría, presentación activa propia, una o más variantes y precio mayor que cero; extras y retirables enviados deben referenciar ingredientes activos propios.

## Validaciones y efectos de estado

- Todas las lecturas y escrituras filtran el restaurante autenticado.
- Crear plato verifica que la categoría y cada referencia del Catálogo sean del restaurante y estén activas; copia sus nombres a opciones del plato y crea disponibilidad inicial en cero para cada variante dentro de una transacción reactiva.
- Editar cambia categoría, nombre, descripción, primera presentación/precio y reemplaza extras y retirables en una transacción. Cada opción se valida contra el catálogo activo del restaurante y copia su nombre; listas vacías los quitan. Una imagen opcional usa la carga existente. Activar/desactivar solo cambia `dish.active`.
- Eliminar borra imagen, opciones, disponibilidad y variantes dentro de una transacción; se rechaza con 409 cuando alguna variante registra movimientos de disponibilidad, preservando la trazabilidad.
- Las opciones opcionales vacías se interpretan como listas vacías.
- La imagen se valida como JPEG, PNG o WebP de hasta 2 MB; se guarda con la clave del restaurante y plato, y un nuevo envío reemplaza la previa.

## Pruebas

- Construcción de backend y consulta autenticada de platos desde `scripts/smoke.ps1`.

## TBD / exclusiones

- Edición de instrucciones y múltiples presentaciones, auditoría de cambios de menú y sincronización/invalidez del índice RAG.

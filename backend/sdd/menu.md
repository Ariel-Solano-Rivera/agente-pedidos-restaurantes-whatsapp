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
- Cada plato devuelve `available`: verdadero si alguna variante está activa, no tiene `sold_out` y, cuando `availability.tracked` es verdadero, le queda al menos una unidad libre (`on_hand - reserved > 0`). Las variantes sin cantidad controlada (`tracked=false`) cuentan como disponibles mientras no estén agotadas. Cada variante expone `tracked`. `available` es independiente de `active` (visibilidad).
- Crear plato verifica que la categoría exista en el restaurante (no comprueba que esté activa) y que cada referencia del Catálogo sea del restaurante y esté activa; copia sus nombres a opciones del plato y crea disponibilidad inicial en cero y **sin control de cantidad** (`tracked=false`) para cada variante dentro de una transacción reactiva. El nombre del plato no se recorta al crearlo (sí al editarlo).
- Editar cambia categoría, nombre, descripción, la presentación y precio de la primera variante por orden alfabético de nombre (al renombrarla puede cambiar cuál es la primera), y reemplaza extras y retirables en una transacción. Cada opción se valida contra el catálogo activo del restaurante y copia su nombre; listas vacías los quitan. Una imagen opcional usa la carga existente. Activar/desactivar solo cambia `dish.active`.
- Eliminar borra imagen, opciones, disponibilidad y variantes dentro de una transacción; se rechaza con 409 cuando alguna variante registra movimientos de disponibilidad, preservando la trazabilidad.
- Las opciones opcionales vacías se interpretan como listas vacías.
- La imagen se valida como JPEG, PNG o WebP de hasta 2 MB; se guarda con la clave del restaurante y plato, y un nuevo envío reemplaza la previa.

## Pruebas

- `MenuAvailabilityIntegrationTest` (Testcontainers): plato con stock disponible y agotado al llegar a cero tras un ajuste; plato nuevo sin cantidad controlada disponible hasta marcarse agotado; Sierra Verde no ve el menú de Mar Azul.
- Consulta autenticada de platos desde `scripts/smoke.ps1`.

## TBD / exclusiones

- **TBD:** ¿cómo marca ADMIN/CAJA un plato como agotado o pasa una variante a «sin control de cantidad» desde el panel? Hoy `sold_out` solo se cambia por base de datos y el primer ajuste activa el control. ¿Una reserva futura debe validar stock en variantes sin control?
- **TBD:** ¿la categoría debe estar activa para crear o editar un plato?
- Edición de instrucciones y múltiples presentaciones, auditoría de cambios de menú y sincronización/invalidez del índice RAG.

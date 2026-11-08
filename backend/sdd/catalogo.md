# Catálogo reutilizable de menú

## Propósito y alcance

Administra los nombres reutilizables de presentaciones e ingredientes del menú, además de completar el borrado seguro de categorías. Las opciones concretas de un plato conservan el nombre aplicado como copia.

## Fuente y dependencias

- Código: `menu/CatalogController.java`, `menu/MenuController.java`.
- Tablas: `category`, `menu_presentation`, `catalog_ingredient`, `dish`, `sellable_variant`, `extra_option` y `removable_ingredient`.
- Consumidores: Catálogo y alta de plato del panel.

## Contratos y permisos

- Lecturas de catálogo: usuario autenticado, filtrado por `restaurante_id`.
- Altas, cambios y borrados de presentaciones/ingredientes: ADMIN mediante `/admin/catalog/*`.
- Categorías conservan `POST/PUT /admin/categories`; `DELETE /admin/categories/{id}` es ADMIN.
- La alta de plato exige IDs de presentación e ingrediente activos y propios del restaurante; el backend obtiene los nombres, no confía en valores del cliente.

## Validaciones y efectos de estado

- Cada tabla mantiene unicidad de nombre por restaurante. Un ID inexistente o de otro restaurante produce error.
- Borrar una categoría con platos devuelve 409. Borrar presentación o ingrediente es seguro porque los platos y pedidos conservan nombres históricos; el valor solo deja de estar disponible para nuevas configuraciones.
- Las inserciones de plato siguen siendo transaccionales: si falla una referencia del catálogo, no se crean plato, variantes ni opciones parciales.

## Aislamiento, trazabilidad e idempotencia

- Todas las consultas filtran `restaurante_id`. No se admite que un cuerpo manipulado conecte un plato con opciones de otro restaurante.
- El CRUD del catálogo no se declara idempotente; los nombres únicos impiden duplicados y las eliminaciones inexistentes devuelven 404.

## Pruebas

- Construcción backend y arranque Flyway V9.
- Probar CRUD ADMIN, 403 para otro rol, 409 al borrar categoría en uso, duplicado y referencia de catálogo de otro restaurante.

## TBD / exclusiones

- Auditoría específica de cambios de catálogo, estados inactivos editables y actualización/eliminación completa de platos.

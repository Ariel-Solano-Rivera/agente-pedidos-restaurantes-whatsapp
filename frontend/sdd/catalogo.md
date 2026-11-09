# Catálogo de opciones de menú

## Propósito y alcance

Centraliza categorías, presentaciones e ingredientes reutilizables del restaurante. Evita definir estos valores libres dentro del formulario de plato.

## Fuente y dependencias

- Código: `src/features/catalogo/CatalogPage.tsx`, `src/components/AppShell.tsx`, `src/App.tsx` y `src/styles.css`.
- API: `GET /menu/categories`, `GET /menu/catalog/presentations`, `GET /menu/catalog/ingredients`; operaciones `POST`, `PUT` y `DELETE` administrativas correspondientes.
- Roles: todos consultan; solo ADMIN crea, edita o elimina.

## Comportamiento visible

- Un selector cambia entre Categorías, Presentaciones e Ingredientes; se muestra una sección a la vez con búsqueda por nombre, contador de resultados y filas de nombre y acciones. La búsqueda filtra en el cliente el catálogo seleccionado.
- ADMIN abre ventanas de alta y edición, con nombre precargado al editar; las filas muestran iconos accesibles para editar y eliminar. El borrado solicita confirmación y el control de eliminar tiene color rojo.
- Menú ya no crea categorías. Al crear un plato, la presentación se selecciona desde el Catálogo; los ingredientes se seleccionan para retirables o extras, y cada extra recibe su recargo propio.
- CAJA y COCINA ven el catálogo en modo lectura.

## Validaciones y errores

- Nombres vacíos o duplicados son rechazados por el backend dentro del restaurante autenticado.
- No se puede borrar una categoría si conserva platos asociados. Presentaciones e ingredientes se eliminan del catálogo sin alterar opciones ya copiadas en platos o pedidos.
- El frontend muestra errores de alta y edición dentro del diálogo, y los de eliminación en la sección seleccionada. El selector conserva el modo de solo lectura de CAJA y COCINA.

## Pruebas

- Construcción de frontend; comprobar selector, búsqueda, diálogo de edición y CRUD autenticado de cada tipo con datos ficticios.
- Confirmar aislamiento entre restaurantes y que un plato solo acepta IDs activos del catálogo del restaurante.

## TBD / exclusiones

- Activar/desactivar elementos desde la interfaz.

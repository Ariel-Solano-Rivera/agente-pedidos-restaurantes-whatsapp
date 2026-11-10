# Catálogo de opciones de menú

## Propósito y alcance

Centraliza categorías, presentaciones e ingredientes reutilizables del restaurante. Evita definir estos valores libres dentro del formulario de plato.

## Fuente y dependencias

- Código: `src/features/catalogo/CatalogPage.tsx` y `catalog.css` (rediseño, etapa 8); kit `src/design/forms.css` (`ds-form-dialog`) y botones `ds-icon-btn` del sistema de diseño.
- API: `GET /menu/categories`, `GET /menu/catalog/presentations`, `GET /menu/catalog/ingredients`; operaciones `POST`, `PUT` y `DELETE` administrativas correspondientes.
- Roles: todos consultan; solo ADMIN crea, edita o elimina.

## Comportamiento visible

- Pestañas Categorías, Presentaciones e Ingredientes con su contador (antes era un menú desplegable). Cada pestaña muestra título, explicación, búsqueda por nombre, tabla con nombre, descripción (categorías), estado «Activo» o «Inactivo» con icono, y el conteo «N de M registros».
- ADMIN ve «Agregar ‹tipo›» y, por fila, editar y eliminar como botones de icono de 44 px con nombre accesible. Alta y edición usan un diálogo `ds-modal ds-form-dialog` con el nombre precargado; eliminar pide confirmación en un `<dialog>` que explica la regla (las categorías solo se borran sin platos; presentaciones e ingredientes no alteran copias). Los resultados se informan con un aviso con icono.
- Menú ya no crea categorías. Al crear un plato, la presentación se selecciona desde el Catálogo; los ingredientes se seleccionan para retirables o extras, y cada extra recibe su recargo propio.
- CAJA y COCINA ven el catálogo en modo lectura.

## Validaciones y errores

- Nombres vacíos o duplicados son rechazados por el backend dentro del restaurante autenticado.
- No se puede borrar una categoría si conserva platos asociados. Presentaciones e ingredientes se eliminan del catálogo sin alterar opciones ya copiadas en platos o pedidos.
- El frontend muestra errores de alta y edición dentro del diálogo, y los de eliminación en la sección seleccionada. El selector conserva el modo de solo lectura de CAJA y COCINA.

## Pruebas

- `npm run build` y `npm run lint`; revisión con Chrome sin interfaz como ADMIN a 1280 px (pestaña Ingredientes). Pendiente: CRUD automatizado de cada tipo en el frontend.
- Confirmar aislamiento entre restaurantes y que un plato solo acepta IDs activos del catálogo del restaurante.

## TBD / exclusiones

- Activar/desactivar elementos desde la interfaz.

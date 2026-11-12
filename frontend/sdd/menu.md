# Menú: tabla de platos

## Propósito y alcance

Tabla de los platos del restaurante con búsqueda, filtros como menús desplegables (segunda ronda, bloque D), interruptor de disponibilidad y acciones por fila. ADMIN crea, edita, oculta o muestra y elimina platos; ADMIN y CAJA marcan un plato como agotado o disponible; COCINA consulta. El backend decide si cada plato está disponible (`available`). Rediseñado en la etapa 7 con el sistema de diseño.

## Fuente y dependencias

- Código: `src/features/menu/MenuPage.tsx` (tabla, filtros, interruptor y confirmación de borrado), `DishForms.tsx` (formularios de crear y editar con la lógica de T1/T2, imagen y selectores) y `menu.css`; kit de formularios `src/design/forms.css` (`ds-form-dialog`); componentes `Dropdown`, `Icon`, `PageHeader`, `EmptyState` y `Skeleton`.
- API:
  - lectura: `GET /menu/dishes`, `GET /menu/categories`, `GET /menu/catalog/presentations`, `GET /menu/catalog/ingredients` y `GET /menu/dishes/{id}/image`;
  - ADMIN: `POST /admin/dishes`, `PUT /admin/dishes/{id}`, `PATCH /admin/dishes/{id}/active`, `DELETE /admin/dishes/{id}` y `POST /admin/dishes/{id}/image`;
  - ADMIN y CAJA: `PUT /availability/dishes/{id}/sold-out` con `Idempotency-Key`.
- Roles: los botones solo se muestran a quien el backend autoriza; el backend vuelve a validar.

## Comportamiento visible

- Encabezado con «Agregar plato» (ADMIN). Búsqueda por nombre, descripción o ingrediente (incluye extras y retirables), sin distinguir tildes.
- Filtros como menús desplegables accesibles (`Dropdown`, bloque D) con contador por opción, calculados sobre el menú cargado aplicando los demás filtros: **Categoría** (Todas y cada categoría), **Disponibilidad** (Todas, Disponible, Agotado) y **Visibilidad** (Todos, Visibles, Ocultos). Debajo, «N de M platos» y «Limpiar filtros».
- Tabla:
  - **Plato:** miniatura (foto o patrón si no tiene), nombre y descripción en una línea.
  - **Categoría.**
  - **Precio:** el precio, o «desde» y el número de presentaciones si hay varias.
  - **Opciones:** número de extras y de retirables.
  - **Disponible:** interruptor con texto «Disponible» o «Agotado» (ADMIN y CAJA); COCINA ve solo el texto con icono.
  - **Visible:** «Visible» u «Oculto» con icono.
  - **Acciones (ADMIN):** editar, ocultar o mostrar, y eliminar, como botones de icono de 44 px con nombre accesible.
- Interruptor: apagarlo marca el plato como agotado (todas sus variantes); encenderlo quita la marca. Si el plato sigue sin unidades libres, el aviso dice que ajuste la cantidad en Operación. El cambio queda auditado.
- Eliminar pide confirmación en un `<dialog>` que explica qué se borra y que los pedidos anteriores conservan su copia.
- Formularios de crear y editar: diálogo `ds-modal ds-form-dialog` con categoría, nombre, descripción, presentación, precio, ingredientes retirables, extras con recargo y foto (PNG, JPEG o WebP hasta 2 MB, con vista previa; el pie indica «se guarda como WebP»: el servidor convierte y guarda solo WebP, bloque D).
- Avisos de éxito o error con icono (6 s).
- Responsivo:
  - por debajo de 1100 px se oculta la columna Opciones, y por debajo de 900 px también Categoría;
  - por debajo de 680 px cada fila es una tarjeta con etiquetas y las acciones abajo.

## Validaciones y errores

- El panel no calcula precios ni disponibilidad: muestra `available` y los precios del backend. Los formularios validan campos obligatorios y formato de imagen como ayuda; el backend repite la validación por contenido (`IMAGE_INVALID_TYPE`, `IMAGE_TOO_LARGE`, `IMAGE_EMPTY`).
- Extras: en el catálogo hay un solo elemento (por ejemplo «Camarón»); la palabra «extra» no forma parte del nombre y solo la añade la vista de preparación y el detalle según el uso en el pedido (V14 unificó los nombres «X extra»).
- Errores de carga: `EmptyState` con «Reintentar». Error de una acción: aviso rojo con el mensaje del backend.

## Estados de interfaz

Esqueletos de filas al cargar, `aria-busy` en la fila en curso, vacíos «Aún no hay platos» (con «Agregar plato» para ADMIN) y «Ningún plato coincide» (con «Limpiar filtros»).

## Pruebas

- `npm run build` y `npm run lint`; `MenuAvailabilityIntegrationTest` y `DishSoldOutIntegrationTest`.
- Desde la interfaz, como CAJA: se apagó y encendió el interruptor de un plato. La API lo mostró agotado y luego disponible, y `audit_log` registró `DISH_SOLD_OUT` y `DISH_SOLD_OUT_CLEARED` con el usuario de caja. COCINA recibe 403.
- Capturas: ADMIN a 1440 px, formulario de edición en oscuro a 1280 px y CAJA a 390 px.

## TBD / exclusiones

- Motivo obligatorio al marcar agotado: hoy solo se audita usuario, fecha y `correlation_id`. Guardar el motivo requiere una migración y aprobar el modelo.
- Edición de varias presentaciones por plato y orden manual de platos.

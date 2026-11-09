# Menú y opciones configurables

## Propósito y alcance

Muestra el menú aislado por restaurante con búsqueda y filtros, y permite a ADMIN crear, editar, activar/desactivar y eliminar platos con presentación, precio, extras e ingredientes retirables del Catálogo. Las categorías se gestionan en Catálogo; las instrucciones de preparación no se crean desde esta pantalla (se envía `instructions: []`).

## Fuente y dependencias

- Código: `src/features/menu/MenuPage.tsx`, `src/shared/api.ts` y `src/styles.css`.
- API: `GET /menu/categories`, `GET /menu/catalog/presentations`, `GET /menu/catalog/ingredients`, `GET /menu/dishes`, `GET /menu/dishes/{id}/image`, `POST /admin/dishes`, `PUT /admin/dishes/{id}`, `PATCH /admin/dishes/{id}/active`, `DELETE /admin/dishes/{id}` y `POST /admin/dishes/{id}/image`.
- Roles: ADMIN escribe; CAJA y COCINA consultan.

## Comportamiento visible

- Barra de filtros: búsqueda por nombre, descripción o ingrediente (ingredientes informativos, extras y retirables; sin distinguir mayúsculas ni tildes; todas las palabras deben aparecer), categoría, disponibilidad (disponible/agotado según `available` del backend) y visibilidad (activos/desactivados). Muestra «X de Y platos» y «Limpiar filtros».
- **Decisión:** el filtrado se hace en el cliente porque `GET /menu/dishes` ya devuelve el menú completo del restaurante; el cliente no calcula la disponibilidad, solo usa `available`. Si el menú creciera mucho, pasar los filtros al backend.
- Un plato no disponible muestra la etiqueta roja «Agotado» junto a su estado.
- Presenta cada plato en una tarjeta de 460 px de altura fija: categoría y estado en las esquinas superiores de la foto, nombre, descripción y presentación, retirables y extras desplazables sin título general, y precio con acciones a su lado. Si no existe foto, muestra un estado visual pendiente.
- ADMIN ve iconos accesibles de Editar, Desactivar/Activar y Eliminar junto al precio; Eliminar tiene tratamiento rojo. No hay botón de ojo. La foto se cambia dentro de Editar.
- ADMIN abre el diálogo de plato. En alta y edición, categoría, presentación, retirables y extras usan selectores buscables: filtran nombres mientras se escribe y solo permiten elegir opciones del catálogo. Los ingredientes se agregan de uno en uno y se quitan mediante un icono de papelera con nombre accesible.
- El formulario mantiene presentación y precio porque una variante vendible con precio es obligatoria; permite elegir y previsualizar una foto antes de crear el plato.

## Validaciones y errores

- El backend exige categoría, presentación e ingredientes propios y activos del restaurante, nombre no vacío, una variante y precio mayor que cero.
- Editar exige categoría, presentación e ingredientes activos del restaurante, precio válido y recargos no negativos. Permite añadir o quitar individualmente extras y retirables; el envío reemplaza esas listas. Eliminar se bloquea si alguna variante posee movimientos de disponibilidad.
- La interfaz no permite crear un plato sin categoría disponible y muestra errores devueltos por la API.
- Las opciones no configuradas no se habilitan por la interfaz; escribir una búsqueda sin elegir un resultado no fija un ID válido.
- La foto se restringe a PNG, JPEG o WebP y 2 MB; el cliente solo envía el binario después de crear el plato y muestra el error dentro del diálogo.

## Pruebas

- `npm run build` y `npm run lint`; `available` cubierto por `MenuAvailabilityIntegrationTest`.
- Pendiente manual: búsqueda y combinación de filtros; construcción, búsqueda y selección por teclado y puntero en los cuatro campos, alta/edición de extras y retirables, activación/desactivación y eliminación segura; inspección visual de iconos y listas.
- Comprobar estado de foto pendiente, vista previa y que CAJA/COCINA no ven acciones de alta.

## TBD / exclusiones

- Edición de instrucciones y múltiples presentaciones de un plato existente; sincronización con RAG futura.

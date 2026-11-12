# Pedidos: lista con filtros y acciones por rol

## Propósito y alcance

Lista de pedidos sintéticos con filtros, búsqueda y paginación resueltos en el backend. Permite ejecutar solo los cambios de estado que el backend devuelve en `allowedTransitions`. No permite capturar pedidos manualmente. Rediseñada en la etapa 2 con el sistema de diseño y ajustada en la segunda ronda (bloque B): menús desplegables para modalidad, fecha y pago, orden de la lista, acciones compactas en la tarjeta y confirmación corta del cobro. El detalle se documenta en `detalle-pedido.md` (etapa 3), y el tablero de cocina llega en la etapa 4.

## Fuente y dependencias

- Código: `src/features/pedidos/OrdersPage.tsx` (página, tarjetas y rango personalizado), `TransitionDialog.tsx` (confirmación y motivo), `PaymentConfirmDialog.tsx` (confirmación del cobro), `orderTypes.ts` (contrato, textos de acción y formatos), `OrderDetailView.tsx` (detalle; ver `detalle-pedido.md`), `orders.css`; componentes `FilterGroup`, `Dropdown`, `ActionMenu`, `StatusBadge`, `PaymentBadge`, `Icon`, `PageHeader`, `EmptyState` y `Skeleton` de `src/design/`.
- API: `GET /orders` (paginada, con `sort`), `GET /orders/facets` (conteos por opción), `GET /orders/{id}`, `POST /orders/{id}/transitions` y `POST /payments/{id}/confirm`.
- Roles: ADMIN y CAJA avanzan, rechazan, cancelan y retroceden con confirmación; COCINA avanza con un toque y retrocede un paso con motivo (sin texto con «Otro motivo»); «Deshacer» se retiró en la segunda ronda (bloque C). El rol solo elige textos y si hay confirmación: las acciones visibles salen de `allowedTransitions` y `undo`.
- Entrada desde Inicio: `App.tsx` pasa un `preset` de filtros (p. ej., estado «Por aceptar»). Elegir Pedidos en el menú abre la lista sin filtros.

## Comportamiento visible

- Encabezado: título, explicación según el rol y fecha de hoy.
- Búsqueda: un solo campo para número `PED-…`, nombre o teléfono. Consulta 300 ms después de dejar de escribir.
- Filtros. El estado sigue como botones (`FilterGroup`: relleno, check y `aria-pressed`); modalidad, fecha y pago son menús desplegables accesibles (`Dropdown`, bloque B): botón «Modalidad: Todas 25» con `aria-haspopup="listbox"` y `aria-expanded`, lista `role="listbox"` con `aria-selected`, flechas, Inicio/Fin, Enter, Esc, cierre al hacer clic fuera y foco de vuelta al botón. Cada grupo tiene «Todos» o «Todas» y cada opción muestra su contador (`GET /orders/facets`).
  - Estado: los ocho estados (COCINA: Aceptado, En preparación, Listo y Completado).
  - Modalidad: Todas, Retiro y Entrega.
  - Fecha: Todas, Hoy, Últimos 7 días y Personalizado. Personalizado abre un diálogo con «Desde» y «Hasta» (zona horaria del restaurante, ambos días incluidos); el botón muestra el rango elegido.
  - Pago (oculto para COCINA): Pendiente, Por verificar, Confirmado, Rechazado y No requerido.
- Orden (bloque B): menú desplegable «Orden» junto al resumen con «Más recientes primero» (por defecto) y «Más antiguos primero»; envía `sort=CREATED_DESC|CREATED_ASC`, vuelve a la página 1 y «Limpiar filtros» lo restablece.
- Bajo los filtros: «N pedidos con los filtros elegidos» y «Limpiar filtros» cuando hay algún filtro o búsqueda. Cambiar un filtro vuelve a la página 1. En móvil los filtros se pliegan tras el botón «Filtros», que muestra cuántos hay activos.
- Tarjetas en cuadrícula (mínimo 320 px). Cada una muestra el número `PED-XXXXXXXX` destacado en Geist Mono, el tiempo desde la recepción y la hora, la insignia de estado, el cliente, el teléfono, la modalidad con icono, el resumen de unidades y, salvo para COCINA, la insignia de pago y el total. Un filete superior repite el color de los estados activos.
- Acciones compactas (bloque B), siempre a partir de `allowedTransitions`: un botón principal con la siguiente acción en una palabra («Aceptar», «Preparar», «Listo», «Completar»; `shortLabel`), «Cobrado» como acción corta cuando el pedido trae `paymentId` y su pago está Pendiente o Por verificar (ADMIN y CAJA), y un menú «⋯» (`ActionMenu`, `aria-haspopup="menu"`, teclado) con «Ver detalle», el retroceso («Volver a Aceptado», «Volver a En preparación») y «Rechazar» o «Cancelar pedido» en rojo. El número `PED-…` también abre el detalle; al volver se conservan los filtros, la página y la posición. Sin flechas ni textos largos; el diálogo de confirmación conserva el texto completo (`actionLabel`).
- ADMIN y CAJA confirman cada acción en un diálogo con origen → destino (insignias) y el cliente:
  - Retroceder exige un motivo de la lista (Se avanzó por error, El cliente cambió el pedido, Falta un producto, Otro motivo), presentado como opciones de 44 px. El detalle es obligatorio solo con «Otro motivo», y el diálogo recuerda que retroceder no libera la reserva ni cambia el pago.
  - Las acciones destructivas muestran un aviso rojo.
  - «Cobrado» abre un diálogo corto «Confirmar cobro» con el número, el cliente, el importe y la nota de que no cambia el estado del pedido; al confirmar llama a `POST /payments/{id}/confirm` con `Idempotency-Key`, muestra «Pago de PED-… confirmado.» y recarga lista y contadores. El error del backend (por ejemplo, pago ya confirmado) se muestra en el diálogo.
- COCINA: avanza con un toque, sin diálogo ni motivo, con botones de 56 px; su menú «⋯» contiene «Ver detalle» y el retroceso, que abre el mismo diálogo de motivo (el detalle es opcional con «Otro motivo» porque el backend no lo exige a cocina).
- Después de una acción: aviso «PED-… pasó a «‹estado›»», «volvió a…» o «Cambio deshecho: …» (6 s) y recarga de la lista y de los contadores.
- Paginación de 12 pedidos: «Mostrando 1–12 de N», «Anterior», «Página X de Y» y «Siguiente».
- Animación: las tarjetas entran con opacidad y 4 px (280 ms) y la cuadrícula se atenúa al recargar; sin movimiento con `prefers-reduced-motion`.

## Validaciones y errores

- El panel no recalcula precios ni decide transiciones, permisos o contadores: solo muestra lo que envía el backend. Cada acción envía una `Idempotency-Key` nueva.
- El motivo y el rango se validan en el diálogo solo como ayuda; el backend repite la validación y su mensaje se muestra dentro del diálogo. Los errores de COCINA aparecen en el aviso de la página.
- Si fallan los contadores, los botones muestran «–» y los filtros siguen funcionando.

## Estados de interfaz

- Carga: seis tarjetas esqueleto; recarga con `aria-busy` y cuadrícula atenuada.
- Vacío: «No hay pedidos con estos filtros» con «Limpiar filtros», o «Aún no hay pedidos» sin filtros.
- Error: `EmptyState` de error con «Reintentar».
- Éxito: aviso verde con icono; error de acción: aviso rojo con icono.

## Pruebas

- `npm run build` y `npm run lint`.
- Contrato y conteos verificados por `OrdersIntegrationTest` (incluida la prueba de `facets`); `scripts/smoke.ps1` comprueba que COCINA no recibe montos.
- Revisión con Chrome sin interfaz y sesión real: ADMIN a 1440 y 390 px (filtros plegados en móvil), CAJA a 1280 px en oscuro con el diálogo de retroceso, COCINA a 1180 px en oscuro. Bloque B: CAJA a 1440 px con el desplegable de fecha, el menú «⋯» y el diálogo de cobro abiertos; CAJA a 390 px con los filtros desplegados; COCINA a 1180 px en oscuro. Además se ejecutó un retroceso completo desde la interfaz (validación del motivo, confirmación, aviso y contadores actualizados) y luego se restauró el pedido.
- Pendiente: pruebas de componentes con Vitest.

## TBD / exclusiones

- El tablero de cocina con arrastrar y soltar vive en `cocina.md`.
- Actualización automática de la lista; número correlativo por restaurante (TBD en el backend).
- Creación de pedidos, reserva efectiva y vencimiento.

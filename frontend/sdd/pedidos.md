# Pedidos: lista con filtros y acciones por rol

## Propósito y alcance

Lista de pedidos sintéticos con filtros, búsqueda y paginación resueltos en el backend. Permite ejecutar solo los cambios de estado que el backend devuelve en `allowedTransitions`. No permite capturar pedidos manualmente. Rediseñada en la etapa 2 con el sistema de diseño. El detalle conserva el diseño de T1 hasta la etapa 3, y el tablero de cocina llega en la etapa 4.

## Fuente y dependencias

- Código: `src/features/pedidos/OrdersPage.tsx` (página, tarjetas y rango personalizado), `TransitionDialog.tsx` (confirmación y motivo), `orderTypes.ts` (contrato, textos de acción y formatos), `LegacyOrderDetail.tsx` (detalle de T1 en zona clara), `orders.css`; componentes `FilterGroup`, `StatusBadge`, `PaymentBadge`, `Icon`, `PageHeader`, `EmptyState` y `Skeleton` de `src/design/`.
- API: `GET /orders` (paginada), `GET /orders/facets` (conteos por opción), `GET /orders/{id}`, `POST /orders/{id}/transitions` y `POST /orders/{id}/undo`.
- Roles: ADMIN y CAJA avanzan, rechazan, cancelan y retroceden con confirmación; COCINA avanza con un toque y puede deshacer su último cambio. El rol solo elige textos y si hay confirmación: las acciones visibles salen de `allowedTransitions` y `undo`.
- Entrada desde Inicio: `App.tsx` pasa un `preset` de filtros (p. ej., estado «Por aceptar»). Elegir Pedidos en el menú abre la lista sin filtros.

## Comportamiento visible

- Encabezado: título, explicación según el rol y fecha de hoy.
- Búsqueda: un solo campo para número `PED-…`, nombre o teléfono. Consulta 300 ms después de dejar de escribir.
- Filtros solo con botones, sin menús desplegables ni listas. Cada grupo tiene una opción «Todos» o «Todas»; la elegida se marca con relleno, check y `aria-pressed`, y cada opción muestra su contador (`GET /orders/facets`).
  - Estado: los ocho estados (COCINA: Aceptado, En preparación, Listo y Completado).
  - Modalidad: Retiro y Entrega.
  - Fecha: Todas, Hoy, 7 días y Personalizado. Personalizado abre un diálogo con «Desde» y «Hasta» (zona horaria del restaurante, ambos días incluidos); el botón muestra el rango elegido.
  - Pago (oculto para COCINA): Pendiente, Por verificar, Confirmado, Rechazado y No requerido.
- Bajo los filtros: «N pedidos con los filtros elegidos» y «Limpiar filtros» cuando hay algún filtro o búsqueda. Cambiar un filtro vuelve a la página 1. En móvil los filtros se pliegan tras el botón «Filtros», que muestra cuántos hay activos.
- Tarjetas en cuadrícula (mínimo 320 px). Cada una muestra el número `PED-XXXXXXXX` destacado en Geist Mono, el tiempo desde la recepción y la hora, la insignia de estado, el cliente, el teléfono, la modalidad con icono, el resumen de unidades y, salvo para COCINA, la insignia de pago y el total. Un filete superior repite el color de los estados activos.
- Acciones de `allowedTransitions`: las de avance son botones principales («Aceptar», «Pasar a En preparación», «Pasar a Listo», «Marcar completado»); los retrocesos son secundarios con flecha («Volver a Aceptado»); «Rechazar» y «Cancelar pedido» llevan borde y texto rojos. «Ver detalle» abre el detalle.
- ADMIN y CAJA confirman cada acción en un diálogo con origen → destino (insignias) y el cliente:
  - Retroceder exige un motivo de la lista (Se avanzó por error, El cliente cambió el pedido, Falta un producto, Otro motivo), presentado como opciones de 44 px. El detalle es obligatorio solo con «Otro motivo», y el diálogo recuerda que retroceder no libera la reserva ni cambia el pago.
  - Las acciones destructivas muestran un aviso rojo.
- COCINA: avanza con un toque, sin diálogo ni motivo, con botones de 56 px. Si el detalle trae `undo`, aparece «Deshacer (volver a ‹estado›)»; si la ventana venció, se muestra el mensaje del backend.
- Después de una acción: aviso «PED-… quedó en «‹estado›»» (6 s) y recarga de la lista y de los contadores.
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
- Revisión con Chrome sin interfaz y sesión real: ADMIN a 1440 y 390 px (filtros plegados en móvil), CAJA a 1280 px en oscuro con el diálogo de retroceso, COCINA a 1180 px en oscuro. Además se ejecutó un retroceso completo desde la interfaz (validación del motivo, confirmación, aviso y contadores actualizados) y luego se restauró el pedido.
- Pendiente: pruebas de componentes con Vitest.

## TBD / exclusiones

- Detalle del pedido rediseñado (etapa 3) y tablero de cocina con arrastrar y soltar (etapa 4).
- Actualización automática de la lista; número correlativo por restaurante (TBD en el backend).
- Creación de pedidos, reserva efectiva y vencimiento.

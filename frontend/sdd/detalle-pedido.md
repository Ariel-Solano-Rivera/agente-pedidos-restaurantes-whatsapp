# Detalle del pedido

## Propósito y alcance

Vista completa de un pedido dentro de Pedidos: unidades separadas con sus modificaciones, totales, cliente y entrega, pago, confirmación y decisión, línea de tiempo del historial y acciones según el rol (avanzar, retroceder con motivo y deshacer). Es de solo lectura salvo las transiciones que autoriza el backend. Rediseñada en la etapa 3 y reemplaza el diálogo de T1.

## Fuente y dependencias

- Código: `src/features/pedidos/OrderDetailView.tsx` y `order-detail.css`. `OrdersPage.tsx` decide si muestra la lista o el detalle (`detailId`), ejecuta las acciones y aloja `TransitionDialog.tsx`. Tipos y textos en `orderTypes.ts`.
- API:
  - `GET /orders/{id}`: unidades históricas, importes (`null` para COCINA), pago, confirmación, `restaurantDecisionBy`, `allowedTransitions`, `undo` e `history`.
  - `GET /payments?orderId={id}` (ADMIN y CAJA): medio, importe, estado, referencia, `verifiedBy` y `verifiedAt`.
  - `POST /orders/{id}/transitions` y `POST /orders/{id}/undo`.
- Roles: ADMIN, CAJA y COCINA. COCINA no ve importes ni la sección de pago; el rol solo decide los textos y si hay confirmación.

## Comportamiento visible

- «Volver a pedidos» regresa a la lista con los mismos filtros, la misma página y la posición de desplazamiento.
- Encabezado: número `PED-XXXXXXXX` en Geist Mono, insignia de estado y fecha de recepción (con «hace…» si fue hoy). A la derecha, las acciones de `allowedTransitions`: retroceder y cancelar o rechazar como secundarias, avanzar como principal. COCINA usa botones de 56 px.
- Deshacer (COCINA): si el backend devuelve `undo`, aparece «Deshacer (volver a ‹estado›) · m:ss» con cuenta regresiva hasta `expiresAt`. Al llegar a cero se recarga el pedido y el botón desaparece; el backend sigue siendo quien decide.
- Pedido: una fila por unidad, numerada, con plato, variante y modificaciones como etiquetas (extra en verde con su recargo, «Sin …» en rojo e instrucciones). Sin modificaciones muestra «Sin modificaciones». Para ADMIN y CAJA: importe por unidad, desglose «Base + extras», subtotal, tarifa de entrega con zona y total.
- Cliente y entrega: nombre, teléfono y modalidad. En entrega: dirección, referencia y zona. En retiro: hora acordada.
- Pago (ADMIN y CAJA): insignia del estado y, por cada pago, medio, importe, comprobante o referencia y «Verificado por ‹correo› · fecha» o «Sin verificar». Recuerda que un comprobante o una declaración del cliente no confirma el pago. No hay acciones de pago (ADR-001).
- Confirmación y decisión: cuándo confirmó el cliente y si el restaurante aceptó o rechazó, quién y cuándo (o «Pendiente de decisión»).
- Línea de tiempo vertical en orden cronológico:
  - pasos hechos con punto de color e icono del estado;
  - el estado actual resaltado con el color de acción y la etiqueta «Estado actual»;
  - los próximos pasos del flujo principal (Aceptado → En preparación → Listo → Completado) en gris, con borde punteado y la etiqueta «Próximo».
  - Cada paso muestra fecha y hora, quién lo hizo y su rol.
  - Los retrocesos y los deshacer van marcados con icono y la etiqueta «Retroceso desde ‹estado›» o «Deshacer desde ‹estado›», y su motivo aparece en un recuadro.
  - Los próximos pasos son solo informativos; las acciones posibles las da `allowedTransitions`.
- Después de una acción: aviso «PED-… pasó a / volvió a «‹estado›»» o «Cambio deshecho: …», y recarga del detalle, de la lista y de los contadores.
- Responsivo: dos columnas desde 1024 px (pedido y línea de tiempo; cliente, pago y decisión). Más angosto: una columna con el orden pedido → cliente → pago → decisión → línea de tiempo, y en móvil las acciones ocupan el ancho.
- Animación: las secciones entran con opacidad y 4 px (280 ms); sin movimiento con `prefers-reduced-motion`.

## Validaciones y errores

- El panel no recalcula importes ni decide transiciones: muestra las cifras y acciones del backend. Cada acción envía una `Idempotency-Key` nueva.
- Retroceder abre el mismo diálogo de la lista: motivo obligatorio de la lista y texto obligatorio solo con «Otro motivo».
- Si falla `GET /payments`, la sección de pago dice «No se pudo cargar el detalle del pago» sin bloquear el resto.

## Estados de interfaz

Carga con esqueletos, error con `EmptyState` y «Reintentar», avisos de éxito o error con icono y `aria-busy` durante una acción.

## Pruebas

- `npm run build` y `npm run lint`; `PaymentsIntegrationTest` (filtro por pedido, verificador, aislamiento y 403 para COCINA) y `OrdersIntegrationTest`.
- Revisión con Chrome sin interfaz y sesión real: ADMIN a 1440 px (pedido con retrocesos), COCINA a 1180 px en oscuro (cuenta regresiva de deshacer) y CAJA a 390 px.
- Flujo ejecutado desde la interfaz: COCINA avanzó un pedido, abrió el detalle con «Deshacer · 1:55» y deshizo el cambio, que quedó en el historial; el pedido volvió a su estado original.

## TBD / exclusiones

- Confirmar o rechazar pagos y subir comprobantes (ADR-001).
- Editar el pedido, reasignar la zona o reimprimir la comanda.
- Identificar a la persona si cocina comparte una cuenta (PIN por persona, TBD en AGENTS.md).

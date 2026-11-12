# Detalle del pedido

## Propósito y alcance

Vista completa de un pedido dentro de Pedidos: unidades separadas con sus modificaciones, totales, cliente y entrega, pago, confirmación y decisión, línea de tiempo del historial y acciones según el rol (avanzar y retroceder con motivo; «Deshacer» se retiró en la segunda ronda, bloque C). Es de solo lectura salvo las transiciones que autoriza el backend. Rediseñada en la etapa 3 y reemplaza el diálogo de T1.

## Fuente y dependencias

- Código: `src/features/pedidos/OrderDetailView.tsx` y `order-detail.css`. `OrdersPage.tsx` decide si muestra la lista o el detalle (`detailId`), ejecuta las acciones y aloja `TransitionDialog.tsx`. Tipos y textos en `orderTypes.ts`.
- API:
  - `GET /orders/{id}`: unidades históricas, importes (`null` para COCINA), pago, confirmación, `restaurantDecisionBy`, `allowedTransitions` e `history`.
  - `GET /payments?orderId={id}` (ADMIN y CAJA): medio, importe, estado, referencia, `verifiedBy` y `verifiedAt`.
  - `POST /orders/{id}/transitions`.
- Roles: ADMIN, CAJA y COCINA. COCINA no ve importes ni la sección de pago; el rol solo decide los textos y si hay confirmación.

## Comportamiento visible

- «Volver a pedidos» regresa a la lista con los mismos filtros, la misma página y la posición de desplazamiento.
- Encabezado: número `PED-XXXXXXXX` en Geist Mono, insignia de estado y fecha de recepción (con «hace…» si fue hoy). A la derecha, las acciones de `allowedTransitions`: retroceder y cancelar o rechazar como secundarias, avanzar como principal. COCINA usa botones de 56 px.
- Extras (bloque C): cada extra se muestra con la palabra «extra» e icono «+» («Camarón (extra)»); si el cliente eligió el mismo extra dos veces, el backend envía dos filas y el detalle muestra una con «x2» y el recargo multiplicado («+$3,50»); el total ya suma cada fila.
- Pedido: una fila por unidad, numerada, con plato, variante y modificaciones como etiquetas (extra en verde con su recargo, «Sin …» en rojo e instrucciones). Sin modificaciones muestra «Sin modificaciones». Para ADMIN y CAJA: importe por unidad, desglose «Base + extras», subtotal, tarifa de entrega con zona y total.
- Cliente y entrega: nombre, teléfono y modalidad. En entrega: dirección, referencia y zona. En retiro: hora acordada.
- Pago (ADMIN y CAJA): insignia del estado y, por cada pago, medio, importe, comprobante o referencia y «Verificado por ‹correo› · fecha» o «Sin verificar». Recuerda que un comprobante o una declaración del cliente no confirma el pago. Si el pago está Pendiente o Por verificar, ADMIN y CAJA ven «Confirmar pago» (bloque B), que abre el mismo diálogo «Confirmar cobro» de la lista y llama a `POST /payments/{id}/confirm`.
- Confirmación y decisión: cuándo confirmó el cliente y si el restaurante aceptó o rechazó, quién y cuándo (o «Pendiente de decisión»).
- Línea de tiempo vertical en orden cronológico:
  - pasos hechos con punto de color e icono del estado;
  - el estado actual resaltado con el color de acción y la etiqueta «Estado actual»;
  - los próximos pasos del flujo principal (Aceptado → En preparación → Listo → Completado) en gris, con borde punteado y la etiqueta «Próximo».
  - Cada paso muestra fecha y hora, quién lo hizo y su rol.
  - Los retrocesos van marcados con icono y la etiqueta «Retroceso desde ‹estado›» y su motivo aparece en un recuadro; las filas históricas `DESHACER` conservan su etiqueta.
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
- Revisión con Chrome sin interfaz y sesión real: ADMIN a 1440 px (pedido con retrocesos), COCINA a 1180 px en oscuro y CAJA a 390 px; bloque C: CAJA a 1440 px con un extra repetido («x2», «+$3,50», total correcto).

## TBD / exclusiones

- Rechazar pagos y subir comprobantes (ADR-001).
- Editar el pedido, reasignar la zona o reimprimir la comanda.
- Identificar a la persona si cocina comparte una cuenta (PIN por persona, TBD en AGENTS.md).

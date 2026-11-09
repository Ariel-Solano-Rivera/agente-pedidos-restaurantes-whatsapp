# Pedidos y vista de cocina por rol

## Propósito y alcance

Muestra pedidos sintéticos como comandas, con filtros y búsqueda resueltos en el backend, y permite ejecutar solo los cambios de estado que el backend devuelve en `allowedTransitions`. No permite captura manual de pedidos.

## Fuente y dependencias

- Código: `src/features/pedidos/OrdersPage.tsx`, `src/shared/api.ts` y la sección «Pedidos» de `src/styles.css`.
- API: `GET /orders` (paginada), `GET /orders/{id}`, `POST /orders/{id}/transitions`, `POST /orders/{id}/undo`.
- Roles: ADMIN y CAJA avanzan, rechazan, cancelan y retroceden con confirmación; COCINA avanza con un toque y puede deshacer su último cambio. El rol solo se usa para elegir textos y la confirmación: las acciones visibles salen de `allowedTransitions` y `undo`.

## Comportamiento visible

- Barra de filtros: búsqueda libre (número `PED-…`, nombre o teléfono; espera 300 ms tras escribir), estado, modalidad (retiro/entrega), estado de pago (oculto para COCINA) y fecha (todas, hoy, últimos 7 días o personalizado con «Desde» y «Hasta»). «Limpiar filtros» aparece cuando hay alguno activo. Cambiar un filtro vuelve a la página 1.
- Contador de resultados y paginación de 12 pedidos por página («Anterior», «Página X de Y», «Siguiente»).
- Cada tarjeta muestra el número `PED-XXXXXXXX` como dato principal, la hora de recepción, el estado, cliente, modalidad (dirección/zona/tarifa o hora acordada), unidades con extras, ingredientes retirados e instrucciones, y el total con estado de pago. Si el backend no envía montos (COCINA), no se muestran importes.
- Botones de acción derivados de `allowedTransitions`: «Avanzar a ‹estado›», «Retroceder a ‹estado›» (estilo con borde), «Rechazar» y «Cancelar pedido» (rojo).
- ADMIN/CAJA: toda acción abre un diálogo que muestra `PED-… estado actual → estado destino`. Un retroceso exige elegir un motivo (Se avanzó por error, El cliente cambió el pedido, Falta un producto, Otro motivo) y escribir el detalle si es «Otro motivo». Las acciones destructivas muestran un aviso.
- COCINA: «Avanzar» actúa con un toque, sin diálogo ni motivo. Si el backend devuelve `undo`, aparece «Deshacer (volver a ‹estado›)»; si la ventana venció, se muestra el mensaje del backend pidiendo avisar a caja.
- El ojo abre la comanda ampliada con contacto, importes (si corresponden), confirmación del cliente, quién decidió, pago, recepción e **historial de estados**: los retrocesos y deshacer se distinguen con etiqueta y color, con autor, rol, fecha y motivo.

## Validaciones y errores

- El cliente no recalcula precios ni decide transiciones o permisos: solo muestra lo que el backend envía. Cada acción envía una `Idempotency-Key` nueva.
- La validación de motivo en el diálogo es una ayuda; el backend la repite y su mensaje de error se muestra dentro del diálogo. Los errores de COCINA (incluida la ventana vencida) aparecen en el aviso de la página.

## Estados de interfaz

- Carga: contador «Cargando pedidos…» y `aria-busy` en la grilla; botón de la tarjeta en curso muestra «Actualizando…».
- Vacío: mensaje distinto con filtros activos o sin pedidos.
- Error de carga: alerta con el mensaje de la API.
- Éxito: aviso `PED-…: ‹nuevo estado›`.

## Pruebas

- `npm run build` y `npm run lint`.
- Contrato verificado por `backend/.../OrdersIntegrationTest`; `scripts/smoke.ps1` comprueba que COCINA no recibe montos.
- Pendiente: pruebas de componentes con Vitest e inspección visual en 1440, 768 y 390 px.

## TBD / exclusiones

- Vista de cocina separada (tablero por columnas), actualización automática de la cola y número correlativo por restaurante (TBD en el backend).
- Creación de pedidos, reserva efectiva y vencimiento.

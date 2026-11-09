# CRM: conversaciones y clientes

## Propósito y alcance

Sección «CRM» para ADMIN y CAJA: lista de conversaciones con pestañas y búsqueda, hilo de mensajes, toma y liberación del control humano, respuesta como personal y ficha del cliente con sus pedidos. No envía nada por WhatsApp.

## Fuente y dependencias

- Código: `src/features/crm/CrmPage.tsx`, `src/components/AppShell.tsx` (entrada «CRM»), `src/App.tsx` y la sección «CRM» de `src/styles.css`.
- API o estado compartido: `GET /crm/conversations`, `GET /crm/conversations/{id}`, `POST /crm/conversations/{id}/messages`, `POST /handoffs/{id}/claim` y `POST /handoffs/{id}/release`.
- Roles: ADMIN y CAJA. La navegación oculta «CRM» a COCINA, pero quien autoriza es el backend (403).

## Comportamiento visible

- Columna izquierda:
  - pestañas «Por contestar» (por defecto), «Con control humano» y «Todas»;
  - búsqueda por nombre o teléfono, que espera 300 ms tras escribir;
  - contador de resultados y lista con nombre, hora, vista previa del último mensaje y etiquetas («Por contestar», «Control humano», estado de la derivación).
- Al elegir una conversación:
  - **Hilo:** encabezado con teléfono y quién atiende, aviso de la derivación (motivo, contexto y responsable) y burbujas por autor (cliente, agente, personal) con fecha.
  - **Control:** «Tomar control» aparece si la derivación está abierta; «Liberar control» solo para quien lo tiene, y pide confirmación.
  - **Respuesta:** «Registrar respuesta» se habilita solo cuando el backend devuelve `canReply`. La pantalla aclara que la respuesta aún no se envía por WhatsApp.
  - **Ficha del cliente:** nombre, teléfono, fecha de alta, pedidos, completados, ventas completadas y los 10 pedidos más recientes con `PED-…`, estado e importe.
- En pantallas angostas la lista, el hilo y la ficha se apilan.

## Validaciones y errores

- No decide permisos ni estados: los botones dependen de `handoff.status`, `handoff.mine` y `canReply`, que envía el backend. Cada respuesta usa una `Idempotency-Key` nueva.
- Los errores de API (por ejemplo «Otra persona ya tiene el control» o «Toma el control…») se muestran dentro del hilo.

## Estados de interfaz

- Carga de la conversación, error, lista vacía por pestaña, marcador cuando no hay ninguna seleccionada y avisos de éxito (control tomado o liberado, respuesta registrada).

## Pruebas

- `npm run build` y `npm run lint`; contrato cubierto por `CrmIntegrationTest` del backend.
- Pendiente: inspección visual en 1440, 768 y 390 px.

## TBD / exclusiones

- Envío por WhatsApp, actualización automática del hilo, notas internas y reasignación.

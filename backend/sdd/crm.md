# CRM: conversaciones y clientes

## Propósito y alcance

Permite a ADMIN y CAJA revisar conversaciones sintéticas, ver el hilo y la ficha del cliente con sus pedidos, y responder como personal cuando tienen el control de una derivación. Reutiliza la toma y liberación de control de `intervencion-humana.md`. **No envía mensajes por WhatsApp** ni invoca al agente.

## Fuente y dependencias

- Código: `intervencion/CrmController.java`; contrato interno `pedidos/OrderReportingService.customerHistory` para los pedidos del cliente.
- Tablas o migraciones: `customer`, `conversation` (`customer_id`, `control_mode`), `conversation_message`, `human_handoff`, `idempotency_operation` y `audit_log` (V12).
- Consumidores: `frontend/src/features/crm/CrmPage.tsx`.

## Contratos y permisos

- Todas las rutas: ADMIN o CAJA (COCINA 403).
- `GET /crm/conversations?tab=PENDING|HUMAN|ALL&q&page&size` devuelve `{items, page, size, total}`, ordenado por último mensaje (más reciente primero).
  - Cada ítem: `id`, `customerId`, `customerName`, `phone`, `controlMode`, `awaitingReply`, `lastAuthor`, `lastMessage`, `lastMessageAt` y `handoff {id, status, reason, context, assignee, mine}`.
  - `handoff` es la derivación no resuelta más reciente o, si no hay, la última resuelta.
- `GET /crm/conversations/{id}` devuelve `{conversation, canReply, messages[], customer}`.
  - `messages` va en orden cronológico, con `authorType` (`CUSTOMER|AGENT|STAFF`) y `authorEmail` del personal.
  - `customer` incluye `{id, name, phone, since, history {orders, completed, completedAmount, recent[10]}}`.
- `POST /crm/conversations/{id}/messages`: cabecera `Idempotency-Key` y cuerpo `{body}` (1 a 2000 caracteres; se recorta). Responde 201 con el mensaje `STAFF` creado; repetir la clave devuelve el mismo mensaje.
- Tomar o liberar el control usa `POST /handoffs/{id}/claim|release` (ver `intervencion-humana.md`).

## Validaciones y efectos de estado

- **Por contestar** se calcula y no se guarda: el último mensaje de la conversación es del cliente (`CUSTOMER`). Responder como `STAFF` la saca de esa pestaña.
- **Con control humano** muestra las conversaciones con `control_mode='HUMAN'`.
- La búsqueda `q` (hasta 80 caracteres) compara nombre y teléfono sin distinguir mayúsculas, además de los dígitos del teléfono; escapa `%` y `_`.
- Responder exige, dentro de la transacción y con la conversación bloqueada (`FOR UPDATE`), que `control_mode='HUMAN'` y que exista una derivación `IN_PROGRESS` asignada al usuario. Si no, devuelve 409 `CONTROL_REQUIRED`.
- Errores: 400 `FILTER_INVALID`, `IDEMPOTENCY_KEY_REQUIRED`, `VALIDATION`; 403 `FORBIDDEN`; 404 `CONVERSATION_NOT_FOUND`; 409 `CONTROL_REQUIRED`.

## Aislamiento, trazabilidad e idempotencia

- Toda consulta filtra `restaurante_id`, y las claves foráneas compuestas de V12 impiden vincular conversaciones, mensajes, clientes o pedidos de otro restaurante.
- Cada respuesta registra el mensaje con `author_user_id` y `correlation_id`, y una entrada `CRM_STAFF_REPLY` en `audit_log`.
- `idempotency_operation` (`CRM_REPLY:{id}`) guarda el id del mensaje en `result_reference`.
- `conversation_message.external_message_id` es único por restaurante; servirá para deduplicar mensajes de WhatsApp cuando se integre.

## Pruebas

- `CrmIntegrationTest` (Testcontainers):
  - pestañas calculadas, búsqueda por dígitos, COCINA 403 y pestaña inválida;
  - responder sin control (409), tomar el control dos veces sin efecto, otra persona no puede tomarlo (`HANDOFF_TAKEN`), respuesta idempotente que sale de «por contestar», liberar ajeno (`HANDOFF_NOT_HELD`) y auditoría;
  - ficha del cliente con pedidos del mismo restaurante;
  - aislamiento con Sierra Verde (404 al leer, tomar y responder).

## TBD / exclusiones

- **TBD:** envío real de respuestas por WhatsApp (adaptador `whatsapp`), plantillas y ventana de 24 horas.
- **TBD:** ¿puede el personal tomar el control de una conversación que no tiene derivación? Hoy solo se toma a través de una derivación.
- Fusión de clientes duplicados y normalización de teléfonos (hoy la unicidad es por texto exacto); notas internas; asignación o reasignación de conversaciones.

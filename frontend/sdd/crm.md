# CRM: conversaciones y clientes

## Propósito y alcance

Bandeja de conversaciones con clientes para ADMIN y CAJA en tres columnas: lista, hilo de mensajes y ficha del cliente con sus pedidos. Permite tomar y liberar el control de una derivación y registrar respuestas del personal. No envía nada por WhatsApp (TBD hasta integrar el canal). Rediseñado en la etapa 6 con el sistema de diseño.

## Fuente y dependencias

- Código: `src/features/crm/CrmPage.tsx` y `crm.css`; componentes `Icon`, `PageHeader`, `EmptyState`, `Skeleton` y `StatusBadge` de `src/design/`, y clases `ds-tabs`, `ds-search`, `ds-modal` y `ds-badge`.
- API:
  - `GET /crm/conversations?tab=PENDING|HUMAN|ALL&q&page&size`: lista de 50 y `total` de cada pestaña con `size=1`.
  - `GET /crm/conversations/{id}`: conversación, `canReply`, mensajes y ficha.
  - `POST /crm/conversations/{id}/messages` con `Idempotency-Key`.
  - `POST /handoffs/{id}/claim` y `POST /handoffs/{id}/release`.
- Roles: ADMIN y CAJA; la entrada no aparece para COCINA y el backend responde 403.
- Navegación: un pedido de la ficha abre Pedidos con la búsqueda `PED-…` aplicada (`App.tsx` pasa `{ q }` como filtro inicial).

## Comportamiento visible

- **Lista** (330 px):
  - pestañas «Por contestar», «Con control humano» y «Todas», cada una con su contador; «Por contestar» se calcula en el backend porque el último mensaje es del cliente;
  - búsqueda por nombre o teléfono, 300 ms después de dejar de escribir;
  - cada conversación muestra avatar con iniciales (y un punto ámbar si espera respuesta), nombre, tiempo desde el último mensaje, vista previa con autor e insignias con icono y texto: «Por contestar», «Control humano» y «Derivación abierta»;
  - la conversación elegida se resalta con fondo de marca y un filete.
- **Hilo:**
  - encabezado con cliente y modo de atención («Atiende el agente» o «Control humano: tú / responsable»);
  - acciones: «Tomar control» si la derivación está abierta y «Liberar control» si la tiene quien mira. Liberar pide confirmación en un `<dialog>` que explica que la derivación queda resuelta, vuelve al agente y queda auditada;
  - aviso de la derivación con motivo, contexto y responsable;
  - mensajes agrupados por día («Hoy», «Ayer» o la fecha). El cliente va a la izquierda; el agente a la derecha en tono de marca y el personal a la derecha en color de acción, cada uno con autor y hora;
  - solo se desplaza la lista de mensajes, que muestra siempre el último.
  - Caja de respuesta: activa solo si `canReply`; si no, explica por qué («Toma el control…»). Ctrl o Cmd + Enter registra la respuesta y una nota recuerda que aún no se envía por WhatsApp.
- **Ficha del cliente:** avatar, nombre, teléfono, cliente desde, pedidos, completados y ventas completadas. Los pedidos recientes muestran número, total, insignia de estado y fecha, y abren el pedido en Pedidos.
- Avisos de éxito o error con icono (6 s). Recarga automática de la lista y del hilo cada 20 s mientras la pestaña está visible.
- Responsivo:
  - desde 1280 px, tres columnas a la altura de la ventana;
  - entre 900 y 1279 px, lista e hilo, y el botón «Ficha» cambia el hilo por la ficha;
  - por debajo de 900 px, un panel a la vez («Conversaciones» para volver y «Ficha» para el cliente).

## Validaciones y errores

- Responder exige tener el control: el backend responde 409 `CONTROL_REQUIRED` y el panel muestra el mensaje. Tomar el control solo es posible si la derivación está abierta o ya es de quien la toma (409 `HANDOFF_TAKEN`).
- La respuesta admite de 1 a 2000 caracteres y envía una `Idempotency-Key` nueva.
- Errores de carga: `EmptyState` de error con «Reintentar» en el hilo y aviso en la lista.

## Estados de interfaz

Esqueletos en la lista, el hilo y la ficha; vacíos con `EmptyState` («Todo contestado», «Sin resultados», «Elige una conversación»); botones deshabilitados mientras hay una acción en curso.

## Pruebas

- `npm run build` y `npm run lint`; `CrmIntegrationTest` (pestañas, respuesta con control e idempotencia, regla de dueño y aislamiento).
- Flujo ejecutado desde la interfaz como CAJA: tomar el control de una derivación abierta, registrar una respuesta (el contador de «Por contestar» bajó de 5 a 4 y el mensaje del personal apareció en el hilo) y liberar el control con el diálogo de confirmación. La API mostró la conversación de vuelta en `AGENT` y la derivación `RESOLVED`.
- Capturas a 1440 px en claro y oscuro y a 390 px con el hilo abierto.

## TBD / exclusiones

- Envío real por WhatsApp y estados de entrega del mensaje.
- Reabrir una derivación resuelta o crear una desde el panel.

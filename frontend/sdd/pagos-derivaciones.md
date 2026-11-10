# Pagos y derivaciones

## Propósito y alcance

Dos pantallas para ADMIN y CAJA, rediseñadas en la etapa 9:

- **Pagos:** consulta de los pagos por pedido. Es **solo lectura**: confirmar o rechazar pagos depende del ADR-001, que sigue pendiente.
- **Derivaciones:** lista de conversaciones que el agente pasó a una persona. Permite tomar o liberar el control y abrir la conversación en el CRM.

Ninguna cambia contratos de API.

## Fuente y dependencias

- Código: `src/features/pagos/PaymentsPage.tsx` y `payments.css`; `src/features/derivaciones/HandoffsPage.tsx` y `handoffs.css`; componentes `FilterGroup`, `PaymentBadge`, `Icon`, `PageHeader`, `EmptyState` y `Skeleton`.
- API:
  - `GET /payments`: pedido, medio, importe, estado, referencia, `verifiedBy` y `verifiedAt`;
  - `GET /handoffs`: cliente, motivo, estado, responsable y fecha;
  - `POST /handoffs/{id}/claim` y `POST /handoffs/{id}/release`.
- Roles: ambas entradas (grupo Operación) se muestran solo a ADMIN y CAJA; el backend responde 403 a COCINA.
- Navegación: un pedido abre Pedidos con su número buscado; «Abrir conversación» y «Tomar control» abren el CRM con la conversación seleccionada (`initialConversation`).

## Comportamiento visible

- **Pagos:**
  - aviso azul «Solo lectura» con la referencia al ADR-001, y búsqueda por número de pedido o referencia;
  - filtros como botones con contador: **Estado** (Todos, Por verificar, Pendiente, Rechazado, Confirmado) y **Medio** (los medios presentes: Efectivo, Transferencia, Tarjeta);
  - tabla ordenada con «Por verificar» primero, marcados con un filete ámbar: pedido (enlace en Geist Mono), medio con icono, importe, insignia de estado, comprobante o referencia, y «Verificado por» con correo y fecha o «Sin verificar»;
  - en móvil, cada pago es una tarjeta con etiquetas.
- **Derivaciones:**
  - pestañas Abiertas, En atención y Resueltas con su contador;
  - cada derivación muestra una insignia de estado, el cliente, el motivo con icono, hace cuánto se derivó y el responsable («tú» si es quien mira);
  - acciones: «Tomar control» si está abierta (al tomarla se abre en el CRM), «Liberar control» si es tuya (con confirmación en un `<dialog>`) y «Abrir conversación»;
  - se recarga cada 20 s mientras la pestaña está visible.
- Avisos de éxito o error con icono (6 s).

## Validaciones y errores

- Un comprobante o una declaración nunca cambia por sí solo el estado del pago; no hay acciones de pago.
- Tomar solo es posible si la derivación está abierta o ya es de quien la toma; liberar, solo quien la tiene. El backend valida (409 `HANDOFF_TAKEN` / `HANDOFF_NOT_HELD`) y el mensaje se muestra en el aviso.

## Estados de interfaz

Esqueletos al cargar, `EmptyState` de error con «Reintentar» y vacíos explicados («Nada pendiente», «Ningún pago coincide»).

## Pruebas

- `npm run build` y `npm run lint`; `PaymentsIntegrationTest` y `CrmIntegrationTest` (regla de dueño de las derivaciones); `scripts/smoke.ps1` (COCINA recibe 403 en pagos).
- Revisión con Chrome sin interfaz como CAJA: Pagos a 1280 px en claro y Derivaciones en oscuro. «Abrir conversación» llevó al CRM con la conversación seleccionada en «Todas».

## TBD / exclusiones

- Confirmar o rechazar pagos, subir comprobantes y la política por medio de pago (ADR-001).
- El contexto de la derivación se ve en el CRM: `GET /handoffs` no lo incluye.

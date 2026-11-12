# ADR-001 — Propuesta de reservas y estados de pago

**Estado: transiciones manuales de pedidos validadas por el usuario el 2026-11-07; estados de pago y confirmación manual validados el 2026-11-11 (`POST /payments/{id}/confirm`, ADMIN y CAJA, desde `PENDING` o `PENDING_VERIFICATION` a `CONFIRMED`, auditado e idempotente, sin efecto sobre el estado del pedido); la reserva y el rechazo de pagos continúan pendientes.**

## Propuesta

1. Al confirmar el cliente, se crea una solicitud `PENDING_DECISION` y se reserva disponibilidad atómicamente por **15 minutos configurables**. El restaurante puede aceptarla (`ACCEPTED`) o rechazarla (`REJECTED`). Rechazo, cancelación o vencimiento liberan la reserva una sola vez.
2. Estados persistidos de pago: `NOT_REQUIRED`, `PENDING`, `PENDING_VERIFICATION`, `CONFIRMED`, `REJECTED`. Transferencia con comprobante pasa solo a `PENDING_VERIFICATION`; CAJA o ADMIN es quien puede pasarla a `CONFIRMED` o `REJECTED`. Efectivo al retiro/entrega inicia en `PENDING`.
3. Flujo de pedido propuesto: `DRAFT → CUSTOMER_CONFIRMED → PENDING_DECISION → ACCEPTED → PREPARING → READY → COMPLETED`; terminales `REJECTED`, `CANCELLED` y `EXPIRED`.
4. Cancelación del cliente se permite antes de `PREPARING`; modificaciones posteriores a aceptación requieren revisión humana y no se aplican automáticamente.
5. Para el panel, se propone una única operación idempotente `POST /orders/{id}/transitions` con `targetStatus`, motivo opcional y `Idempotency-Key`. Solo ADMIN o CAJA podrán efectuar las transiciones propuestas: `PENDING_DECISION → ACCEPTED|REJECTED`, `ACCEPTED → PREPARING|CANCELLED`, `PREPARING → READY` y `READY → COMPLETED`. COCINA permanecerá estrictamente en lectura. La implementación actual de pedidos sintéticos registra historial y auditoría; al incorporar reservas, su consumo o liberación se incluirá en la misma transacción.

## Justificación

El informe exige separar confirmación, aceptación y pago, y liberar reservas por rechazo, cancelación o vencimiento. La entrevista indica que el negocio confirma el pedido antes de cocina y limita cambios cuando ya se prepara; no establece un plazo de reserva ni una máquina de estados universal. Por ello el plazo y los estados son una propuesta, no una conclusión de la entrevista.

## Preguntas para validar

- ¿Se aprueba reserva al confirmar cliente durante 15 minutos configurables, o debe reservarse recién al aceptar el restaurante?
- Validado (2026-11-11): los cinco estados de pago y la confirmación manual por ADMIN o CAJA. Pendiente: rechazo de pago y política por medio de pago antes de bloquear o permitir una transición.
- ¿La cancelación previa a `PREPARING` debe ser automática o requiere aprobación de CAJA?
- Validado: endpoint idempotente único y las cuatro transiciones operativas para ADMIN/CAJA.
- Validado (2026-11-08, AGENTS.md): retrocesos `PREPARING→ACCEPTED` y `READY→PREPARING` solo para ADMIN/CAJA con motivo codificado; COCINA avanza `ACCEPTED→PREPARING→READY` y deshace su propio último avance en una ventana configurable. Retroceder y deshacer no tocan reservas ni pagos.
- Pendiente: ¿se permite `ACCEPTED → PENDING_DECISION`? Afecta la reserva.

# Módulo de intervención humana

## Propósito y alcance

Permite a ADMIN o CAJA consultar, tomar y liberar derivaciones, y mantiene `conversation.control_mode` sincronizado con la derivación. El CRM (`crm.md`) reutiliza estas operaciones. También expone un contrato interno de lectura para el dashboard.

## Fuente y dependencias

- Código: `intervencion/HandoffController.java`, `intervencion/HandoffReportingService.java` (contrato interno) y `intervencion/CrmController.java` (ver `crm.md`).
- Tablas: `human_handoff` (CHECK `OPEN|IN_PROGRESS|RESOLVED`, V12), `conversation` (CHECK `AGENT|HUMAN`), `app_user`, `audit_log`.

## Contratos y permisos

- `GET /handoffs`, `POST /handoffs/{id}/claim`, `POST /handoffs/{id}/release`: ADMIN o CAJA; los cambios responden 204.
- **Tomar** solo procede si la derivación está `OPEN` o ya está `IN_PROGRESS` asignada al mismo usuario (repetirlo no cambia nada). La deja `IN_PROGRESS`, asigna el usuario y pone `control_mode = HUMAN`. Si otra persona la tiene o ya está resuelta, devuelve 409 `HANDOFF_TAKEN`.
- **Liberar** solo procede para quien la tiene `IN_PROGRESS`: la deja `RESOLVED` y devuelve el control a `AGENT`. En otro caso devuelve 409 `HANDOFF_NOT_HELD`.
- Si la derivación no existe o es de otro restaurante, devuelve 404 `HANDOFF_NOT_FOUND`.

## Validaciones y efectos de estado

- Tomar y liberar actualizan la derivación y la conversación dentro de una transacción reactiva. La condición del `UPDATE … RETURNING` evita que dos personas tomen la misma derivación.
- El agente futuro debe respetar `control_mode` y no responder bajo control humano.

## Aislamiento, trazabilidad e idempotencia

- Todas las consultas y actualizaciones incluyen el restaurante autenticado.
- Cada toma o liberación efectiva registra `HANDOFF_CLAIM` o `HANDOFF_RELEASE` en `audit_log`, con usuario y `correlation_id`.

## Pruebas

- `CrmIntegrationTest`: toma repetida por el dueño, toma rechazada para otra persona, liberación ajena rechazada, auditoría y aislamiento entre restaurantes.

## TBD / exclusiones

- Creación automática por WhatsApp/agente, reasignación, prioridad y SLA.
- **TBD:** ¿liberar debe resolver la derivación o devolverla a `OPEN`? Hoy la resuelve.

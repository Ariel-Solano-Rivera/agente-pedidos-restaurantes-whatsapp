# Módulo de intervención humana

## Propósito y alcance

Permite a ADMIN o CAJA consultar, tomar y liberar derivaciones. Mantiene el modo de control de la conversación sincronizado con la derivación.

## Fuente y dependencias

- Código: `intervencion/HandoffController.java`.
- Tablas: `human_handoff`, `conversation`, `app_user`.

## Contratos y permisos

- `GET /handoffs`, `POST /handoffs/{id}/claim`, `POST /handoffs/{id}/release`: ADMIN o CAJA.
- Tomar cambia la derivación a `IN_PROGRESS`, asigna el usuario y deja `conversation.control_mode = HUMAN`.
- Liberar exige ser el usuario asignado, cambia a `RESOLVED` y devuelve control a `AGENT`.

## Validaciones y efectos de estado

- Todas las actualizaciones incluyen el restaurante autenticado.
- La toma solo acepta derivaciones `OPEN` o `IN_PROGRESS`; liberar una derivación no asignada al usuario devuelve 403.
- El agente futuro debe respetar `control_mode` y no responder bajo control humano.

## Pruebas

- Prueba manual de claim/release y restauración del dato sintético a `OPEN` después de verificar.

## TBD / exclusiones

- Creación automática por WhatsApp/agente, reasignación, prioridad, contexto de mensajes, SLA y auditoría detallada.

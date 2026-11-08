# Pagos y derivaciones humanas

## Propósito y alcance

Muestra pagos sintéticos en solo lectura y permite a ADMIN/CAJA tomar o liberar derivaciones humanas.

## Fuente y dependencias

- Código: `src/App.tsx` (`Payments`, `Handoffs`).
- API: `GET /payments`, `GET /handoffs`, `POST /handoffs/{id}/claim`, `POST /handoffs/{id}/release`.
- Roles: ADMIN y CAJA; COCINA no ve estas pestañas.

## Comportamiento visible

- Pagos: pedido, medio, importe, estado y referencia con aviso de solo lectura.
- Derivaciones: cliente, motivo, estado, responsable y acciones Tomar/Liberar según estado.

## Validaciones y errores

- Un comprobante no confirma pago; no existe acción de confirmación hasta ADR-001.
- Tomar o liberar usa autorización del backend; los errores se muestran al operador.
- Mientras está tomada, la conversación conserva control humano; al liberar, el backend la devuelve a AGENT.

## Pruebas

- Prueba manual de toma/liberación con datos sintéticos y verificación posterior del estado.
- `scripts/smoke.ps1` comprueba que COCINA recibe 403 en pagos.

## TBD / exclusiones

- Confirmación/rechazo manual de pago, comprobantes adjuntos, reasignación, detalle de mensajes y políticas de retención de datos.

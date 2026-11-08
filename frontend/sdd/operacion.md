# Operación, disponibilidad, zonas y horarios

## Propósito y alcance

Permite consultar la operación diaria; ADMIN pausa la recepción y configura zonas, mientras ADMIN y CAJA ajustan disponibilidad por ventas locales. Horarios se muestran en esta versión.

## Fuente y dependencias

- Código: `src/App.tsx` (`Operation`, `Availability`, `Settings`).
- API: `GET /operation/settings`, `PUT /admin/operation/settings`, `GET /availability`, `POST /availability/adjustments`, `GET /operation/zones`, `POST /admin/zones`, `GET /operation/schedules`.
- Roles: ADMIN configura y ajusta; CAJA ajusta disponibilidad y consulta; COCINA solo consulta las rutas que el backend autorice.

## Comportamiento visible

- Muestra recepción activa o pausada y permite a ADMIN confirmar pausar o reanudar con motivo.
- Lista disponibilidad por plato y variante; el ajuste envía `Idempotency-Key` UUID y motivo.
- Muestra zonas con tarifa y permite a ADMIN crear una zona.
- Muestra horarios existentes.

## Validaciones y errores

- Confirmar antes de pausar/reanudar o registrar un ajuste.
- La disponibilidad y el permiso se validan en backend; la interfaz muestra el error recibido.
- El cliente no calcula saldo, reserva ni tarifa.

## Pruebas

- Ajuste sintético idempotente: mismo `Idempotency-Key` no vuelve a mover el saldo.
- `scripts/smoke.ps1` verifica acceso autenticado y disponibilidad del panel.

## TBD / exclusiones

- Formularios para crear/editar horarios, cierres excepcionales, editar/desactivar zonas, marcar agotado con acción específica y tablero de alertas.

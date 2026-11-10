# Operación diaria: recepción, disponibilidad, horarios y zonas

## Propósito y alcance

Pantalla «Operación diaria» para ADMIN y CAJA con cuatro pestañas:

- **Recepción:** pausar o reanudar, solo ADMIN.
- **Disponibilidad:** porciones por variante y ajustes con motivo, ADMIN y CAJA.
- **Horarios:** consulta y alta por día, alta solo ADMIN.
- **Zonas de entrega:** consulta y alta, alta solo ADMIN.

No calcula saldos, reservas ni tarifas: muestra lo que devuelve el backend. Creada en la etapa 8; antes no existía pantalla, y este documento describía componentes de `App.tsx` que ya no estaban.

## Fuente y dependencias

- Código: `src/features/operacion/OperationPage.tsx` y `operation.css`; kit `src/design/forms.css` para los diálogos; componentes `Icon`, `PageHeader`, `EmptyState` y `Skeleton`.
- API:
  - `GET /operation/settings` y `PUT /admin/operation/settings`;
  - `GET /availability` y `POST /availability/adjustments` con `Idempotency-Key`;
  - `GET /operation/schedules` y `POST /admin/schedules`;
  - `GET /operation/zones` y `POST /admin/zones`.
- Roles: la entrada «Operación diaria» (grupo Operación) se muestra a ADMIN y CAJA. Los botones de alta y pausa solo aparecen para ADMIN; el backend vuelve a validar.

## Comportamiento visible

- **Recepción:**
  - un recuadro verde «Recibiendo pedidos» o ámbar «Recepción pausada» con su motivo y la explicación de que no se crean solicitudes nuevas;
  - ADMIN abre un diálogo para pausar (motivos rápidos como botones y texto obligatorio) o para reanudar; CAJA ve el estado y una nota.
- **Disponibilidad:**
  - tabla por plato y variante con existencia, reservadas y estado (Disponible o Agotado, con icono);
  - «Ajustar» abre un diálogo con botones −5, −1, +1 y +5, un campo entero, la explicación en texto («Se descontará 1 porción») y el motivo como botones (Venta presencial, Reposición de porciones, Corrección de conteo, Otro), más un detalle obligatorio solo con «Otro»;
  - el motivo enviado combina la opción y el detalle; cada ajuste guarda motivo, autor y fecha en `availability_movement`.
  - Para marcar agotado se remite al interruptor del Menú.
- **Horarios:** `day_of_week` usa 0 = domingo, 1 = lunes … 6 = sábado (confirmado por el equipo; igual que `EXTRACT(DOW)`).
  - los siete días (de lunes a domingo) con el rango «08:30 – 15:30», «Cerrado» o «Sin horario»;
  - ADMIN agrega el horario de un día que no lo tiene: interruptor «Cerrado todo el día» u horas de apertura y cierre, y la de cierre debe ser posterior.
- **Zonas de entrega:**
  - tabla con nombre, tarifa en USD y estado (Activa o Inactiva, con icono);
  - ADMIN crea una zona con nombre, tarifa de hasta dos decimales y estado. Antes de enviar se avisa si el nombre ya existe.
- Avisos de éxito o error con icono (6 s). En móvil, las tablas se desplazan dentro de su tarjeta y los días ocupan dos líneas.

## Validaciones y errores

- El backend valida permisos, existencia y saldo (un ajuste no puede dejar menos unidades que las reservadas) y su mensaje se muestra en el diálogo.
- Cada ajuste envía una `Idempotency-Key` nueva.
- Errores de carga: `EmptyState` de error en la pestaña.

## Estados de interfaz

Esqueletos por pestaña y vacíos explicados («Sin disponibilidad registrada», «Sin zonas de entrega»).

## Pruebas

- `npm run build` y `npm run lint`; ajuste idempotente cubierto por `MenuAvailabilityIntegrationTest`; `scripts/smoke.ps1`.
- Desde la interfaz:
  - como CAJA, un ajuste de −1 por «Venta presencial» y otro de +1 por «Corrección de conteo» en Limonada; `availability_movement` guardó ambos con motivo y autor y la existencia volvió a 30;
  - como ADMIN, se pausó la recepción con «Cocina saturada» y se reanudó (`GET /operation/settings` lo confirmó).

## TBD / exclusiones

- **Backend pendiente:**
  - editar o borrar horarios, cierres excepcionales y editar o desactivar zonas;
  - consultar el historial de movimientos de disponibilidad;
  - auditoría de la pausa de recepción;
  - error 409 claro al repetir el nombre de una zona (hoy lo impide la restricción de la base).

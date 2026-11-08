# Pedidos y vista de cocina por rol

## Propósito y alcance

Consulta pedidos sintéticos existentes como comandas y permite a ADMIN/CAJA avanzar solo las transiciones autorizadas por el backend. No permite captura manual.

## Fuente y dependencias

- Código: `src/features/pedidos/OrdersPage.tsx` y `src/shared/api.ts`.
- API: `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/transitions`.
- Roles: ADMIN y CAJA consultan y ejecutan transiciones; COCINA recibe solo estados operativos desde el backend y no ve acciones mutantes.

## Comportamiento visible

- Presenta solicitudes en tarjetas de altura fija y desplazamiento interno. El número y estado tienen mayor jerarquía visual; el bloque de cliente se conserva. La modalidad compacta dice Local o Envío; en Envío muestra la tarifa junto a la modalidad y debajo dirección, referencia y zona. Cada unidad muestra solo las opciones presentes. El total y las acciones permanecen al pie.
- El botón de ojo abre una comanda ampliada para lectura más cómoda; no es necesario para conocer toda la información operativa del pedido en la tarjeta.
- Para local muestra la hora acordada; para envío muestra dirección, referencia y zona. La sección «Importes y confirmación» ya no aparece en la tarjeta; subtotal, pago, confirmación y hora de recepción siguen disponibles en la comanda ampliada.
- Muestra unidades históricas con plato, variante, extras, ingredientes retirados, instrucciones y total de línea, omitiendo por completo los renglones de opciones vacías.
- La tarjeta ofrece solo la siguiente acción válida: aceptar/rechazar, iniciar preparación/cancelar, marcar listo o completar. Las acciones destructivas requieren confirmación local; el servidor decide si la transición procede.

## Validaciones y errores

- La consulta, detalle y transición son filtrados por restaurante; COCINA no recibe ni puede invocar transiciones.
- Precios, estados y configuración son datos del servidor; el cliente no recalcula ni autoriza cambios. Cada transición envía una clave de idempotencia nueva.

## Pruebas

- `scripts/smoke.ps1` comprueba que COCINA puede consultar pedidos; probar transición válida, repetición con la misma clave, transición inválida y rechazo por rol; inspección visual de número/estado, modalidad/tarifa, opciones condicionales y altura fija.

## TBD / exclusiones

- Filtros, vista de cocina separada, reserva efectiva, vencimiento y flujo de pedido desde conversación. La creación de pedidos con reserva sigue pendiente.

# Cocina: tablero por estados

## Propósito y alcance

Tablero para la tableta de cocina con los pedidos activos en tres columnas: **Por preparar** (`ACCEPTED`), **En preparación** (`PREPARING`) y **Listo** (`READY`). Son los estados que COCINA puede mover; la regla de la etapa 4 limita el tablero a cuatro columnas como máximo, y con más estados habría que proponer otra vista. Pasar una tarjeta a la columna siguiente equivale a avanzar el pedido con la misma transición del backend. No muestra importes a ningún rol. Rediseño, etapa 4.

## Fuente y dependencias

- Código: `src/features/cocina/KitchenBoard.tsx` y `kitchen.css`; `src/features/pedidos/Countdown.tsx` (compartido con el detalle); icono `grip` en `src/design/Icon.tsx`.
- API:
  - `GET /orders/board`: tarjetas con unidades y modificaciones, `allowedTransitions` del rol, `undo` propio y `statusSince`.
  - `POST /orders/{id}/transitions` y `POST /orders/{id}/undo`.
- Roles: entrada «Cocina» en el grupo Operación para todos los roles; las tarjetas de Inicio de COCINA llevan aquí. COCINA usa el tema oscuro por defecto (preferencia por persona). ADMIN y CAJA ven el mismo tablero, con las acciones que el backend les permite.
- Sin dependencias nuevas: arrastrar y soltar con Pointer Events propios (dedo, lápiz y mouse), sin dnd-kit.

## Comportamiento visible

- Encabezado con instrucciones y «Actualizado HH:MM» (recarga manual). Se recarga sola cada 15 s si nadie arrastra ni espera una respuesta, y el tiempo de cada tarjeta avanza en cada recarga.
- Columnas con icono, nombre y contador, en el color de su estado.
- Tarjeta:
  - número `PED-…` en Geist Mono y asa de arrastre;
  - tiempo en el estado actual con icono: normal, ámbar desde 10 min, rojo desde 20 min con texto oculto «demorado», y «Listo hace…» en verde. Se muestran minutos, luego horas y luego días;
  - modalidad con icono («Retiro · hora acordada» o «Entrega · zona») y cliente;
  - unidades numeradas en letra grande, con sus modificaciones como etiquetas (extra en verde, «Sin …» en rojo, instrucciones en azul);
  - botón para avanzar sin arrastrar (56 px, de `allowedTransitions` sin motivo) y, si el backend devuelve `undo`, «Deshacer» con la cuenta regresiva `m:ss` en una etiqueta ámbar.
- Arrastrar:
  - el movimiento empieza tras 8 px; la tarjeta original queda atenuada y una copia sigue al dedo o al puntero;
  - la columna bajo el puntero se marca en verde si `allowedTransitions` permite soltar allí sin motivo, y con borde rojo punteado si no;
  - soltar en una columna permitida avanza el pedido;
  - **deshacer arrastrando:** si la tarjeta tiene `undo` vigente, soltarla en la columna anterior (`undo.targetStatus`) ejecuta `POST /orders/{id}/undo`, igual que el botón. Esa columna se marca en ámbar y la tarjeta dice «Soltar para deshacer»;
  - en otro lugar, la tarjeta vuelve y aparece un aviso: COCINA lee que solo puede deshacer su último cambio durante 2 minutos y que, si no, avise a caja; ADMIN y CAJA, que para retroceder hace falta un motivo y se hace desde Pedidos;
  - en tableta, la tarjeta admite `touch-action: pan-y` para desplazar la columna en vertical, y el asa usa `touch-action: none` para arrastrar en cualquier dirección.
- Teclado: cada tarjeta es enfocable. Espacio o Enter la toma, las flechas izquierda y derecha eligen la columna (resaltada igual que al arrastrar, y anunciada como «deshacer tu último cambio» cuando corresponde), Enter la suelta y Escape cancela. Cada paso se anuncia en una región `aria-live`.
- Actualización optimista: la tarjeta cambia de columna al instante, se llama al backend y, si falla, vuelve a su columna con el mensaje del backend. Al terminar se recarga el tablero.
- Responsivo: tres columnas desde 900 px; por debajo se apilan y se avanza con los botones.
- Animación: transiciones de 150–220 ms; la copia arrastrada se inclina 1,5° salvo con `prefers-reduced-motion`.

## Validaciones y errores

- El panel no decide transiciones: solo deja soltar donde `allowedTransitions` lo permite y el backend vuelve a validar. Cada acción envía una `Idempotency-Key` nueva.
- Deshacer se ofrece mientras no venza `undo.expiresAt`; vencido, el backend responde «avisa a caja».
- Si falla la carga inicial: `EmptyState` de error con «Reintentar» (56 px).

## Estados de interfaz

Carga con tarjetas esqueleto por columna, columnas vacías con `EmptyState` compacto, `aria-busy` en la tarjeta en curso y avisos de éxito o error con icono.

## Pruebas

- `npm run build` y `npm run lint`; `OrdersIntegrationTest.boardListsActiveOrdersWithUnitsWithoutAmountsAndOwnUndo`.
- Pruebas desde la interfaz con Chrome sin interfaz (protocolo de DevTools), como COCINA a 1180 px en tema oscuro:
  - arrastre con mouse de Por preparar a En preparación;
  - arrastre con toque emulado;
  - retroceso prohibido (la tarjeta vuelve con aviso);
  - soltar en una columna no permitida (resaltado rojo y aviso);
  - avance con teclado (Espacio, flecha derecha y Enter);
  - deshacer arrastrando de vuelta, con mouse y con toque, tras avanzar el mismo pedido (columna ámbar, aviso «Cambio deshecho» y pedido de vuelta en «Aceptado»).
  - Después se restauraron los pedidos de prueba con retrocesos de caja.
- Pendiente: probar en una tableta física.

## TBD / exclusiones

- Identificar a la persona si cocina comparte una cuenta (PIN por persona, TBD en AGENTS.md).
- Sonido o aviso al llegar un pedido nuevo; impresión de comandas.

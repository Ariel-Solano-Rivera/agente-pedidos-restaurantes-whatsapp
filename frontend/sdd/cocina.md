# Cocina: tablero por estados

## Propósito y alcance

Tablero para la tableta de cocina con los pedidos activos en tres columnas: **Por preparar** (`ACCEPTED`), **En preparación** (`PREPARING`) y **Listo** (`READY`). Son los estados entre los que se mueve cocina; la regla de la etapa 4 limita el tablero a cuatro columnas como máximo. Mover una tarjeta a la columna de al lado equivale a avanzar o retroceder el pedido con la misma transición del backend; retroceder pide un motivo con un toque. No muestra importes a ningún rol. Rediseño de la etapa 4, ajustado en la segunda ronda (bloque C): se retiró «Deshacer» y su cuenta regresiva.

## Fuente y dependencias

- Código: `src/features/cocina/KitchenBoard.tsx` y `kitchen.css`; `src/features/cocina/groupUnits.ts` (agrupación de unidades, función pura con pruebas en `groupUnits.test.ts`); icono `grip` en `src/design/Icon.tsx`.
- API:
  - `GET /orders/board`: tarjetas con unidades y modificaciones, `allowedTransitions` del rol y `statusSince`.
  - `POST /orders/{id}/transitions` (avanzar sin motivo; retroceder con `reasonCode` y, salvo para COCINA, texto con `OTRO`).
- Roles: entrada «Cocina» en el grupo Operación para todos los roles; las tarjetas de Inicio de COCINA llevan aquí. COCINA usa el tema oscuro por defecto (preferencia por persona). ADMIN y CAJA ven el mismo tablero, con las acciones que el backend les permite.
- Sin dependencias nuevas: arrastrar y soltar con Pointer Events propios (dedo, lápiz y mouse), sin dnd-kit.

## Comportamiento visible

- Encabezado con instrucciones y «Actualizado HH:MM» (recarga manual). Se recarga sola cada 15 s si nadie arrastra, elige motivo ni espera una respuesta; el tiempo de cada tarjeta avanza en cada recarga.
- Columnas con icono, nombre y contador, en el color de su estado. Las tres tienen exactamente el mismo ancho y la misma altura (cuadrícula con filas iguales y columnas estiradas), y toda la columna es zona de soltar, también cuando está vacía.
- Tarjeta:
  - borde completo del color del estado en el que está, más la insignia de estado con icono y texto (nunca solo color), el número `PED-…` en Geist Mono y el asa de arrastre;
  - tiempo en el estado actual con icono: normal, ámbar desde 10 min, rojo desde 20 min con texto oculto «demorado», y «Listo hace…» en verde. Se muestran minutos, luego horas y luego días;
  - modalidad con icono («Retiro · hora acordada» o «Entrega · zona») y cliente;
  - unidades **agrupadas** por `groupUnits`: dos unidades son la misma línea solo si coinciden plato, variante, extras (con su cantidad) e ingredientes retirados, sin importar el orden; la línea muestra «x2», «x3»… cuando se repite. Cualquier diferencia es otra línea (un encebollado con extra de camarón y sin cebolla y uno clásico sin cambios son dos líneas). Sin numeración por plato;
  - modificaciones como etiquetas: los extras con la palabra «extra» e icono «+» en verde («Camarón (extra)», con «x2» si el cliente eligió el mismo extra dos veces: el backend envía una fila por elección), los retirados «Sin …» con icono en rojo y las instrucciones en azul;
  - dos botones de 56 px solo con flechas, con `aria-label` y tooltip: retroceder (izquierda) y avanzar (derecha). Se deshabilitan en la primera y la última columna, o cuando `allowedTransitions` no trae esa transición; avanzar desde «Listo» no existe en el tablero (completar es de caja, desde Pedidos).
- Avanzar (botón, arrastre o teclado) es inmediato. Retroceder (botón, arrastre a la columna anterior o teclado) abre primero un selector pequeño con los cuatro motivos como botones de 56 px: «Se avanzó por error», «El cliente cambió el pedido», «Falta un producto» y «Otro motivo». Un toque elige y ejecuta; «Cancelar, se queda donde está» cierra sin mover la tarjeta. Para ADMIN y CAJA, «Otro motivo» pide además el texto (obligatorio); COCINA lo elige con un toque sin escribir (regla a de la segunda ronda).
- Arrastrar:
  - el movimiento empieza tras 8 px; la tarjeta original queda atenuada y una copia sigue al dedo o al puntero;
  - la columna bajo el puntero se marca en verde si se puede avanzar, en ámbar si es la columna anterior (retroceder, pide motivo) y con borde rojo punteado si no se permite; la copia lo explica («Soltar para volver a «Aceptado» (pide motivo)»);
  - soltar dos columnas atrás o adelante no se permite: la tarjeta vuelve y un aviso explica que solo se mueve un paso;
  - en tableta, la tarjeta admite `touch-action: pan-y` para desplazar la columna en vertical, y el asa usa `touch-action: none` para arrastrar en cualquier dirección.
- Teclado: cada tarjeta es enfocable. Espacio o Enter la toma, las flechas izquierda y derecha eligen la columna (resaltada igual que al arrastrar, anunciada como «retroceder, pide motivo» cuando corresponde), Enter la suelta y Escape cancela. Cada paso se anuncia en una región `aria-live`.
- Actualización optimista: la tarjeta cambia de columna al instante, se llama al backend y, si falla, vuelve a su columna con el mensaje del backend. Al terminar se recarga el tablero. En un retroceso el movimiento ocurre al elegir el motivo; si el backend lo rechaza, el selector muestra el error y la tarjeta vuelve.
- Después de un retroceso el aviso dice «PED-… volvió a «Aceptado» · Falta un producto».
- Responsivo: tres columnas desde 900 px; por debajo se apilan y se mueve con las flechas.
- Animación: transiciones de 150–220 ms; la copia arrastrada se inclina 1,5° salvo con `prefers-reduced-motion`.

## Validaciones y errores

- El panel no decide transiciones: solo deja soltar donde `allowedTransitions` lo permite y el backend vuelve a validar (incluido el motivo). Cada acción envía una `Idempotency-Key` nueva.
- Si falla la carga inicial: `EmptyState` de error con «Reintentar» (56 px).

## Estados de interfaz

Carga con tarjetas esqueleto por columna, columnas vacías con `EmptyState` compacto centrado (siguen siendo zona de soltar), `aria-busy` en la tarjeta en curso y avisos de éxito o error con icono.

## Pruebas

- `npm run build`, `npm run lint` y `npm test` (`groupUnits.test.ts`: agrupación de idénticas, separación por extra o retirado, independencia del orden y las mayúsculas, el mismo extra dos veces frente a una vez, variantes e instrucciones, `countByName`).
- Backend: `OrderTransitionPolicyTest.kitchenMovesOneStepForwardOrBackwardBetweenItsThreeColumns`, `OrdersIntegrationTest.kitchenAdvancesAndGoesBackOneStepWithAReason`, `kitchenCannotCompleteFromReady`, `boardListsActiveOrdersWithUnitsWithoutAmountsAndRoleTransitions` y `sameExtraChosenTwiceArrivesAsTwoRowsAndSumsTwice`.
- Revisión con Chrome sin interfaz y sesión real (bloque C): COCINA a 1180 px en oscuro (bordes por estado, «x2» en unidades y en un extra repetido, flechas deshabilitadas en los extremos, selector de motivo) y ADMIN a 1440 px con «Otro motivo» pidiendo texto. Las pruebas de arrastre, toque y teclado de la etapa 4 siguen vigentes en su mecánica; cambió solo el resultado al soltar atrás (motivo en lugar de deshacer).
- Pendiente: probar en una tableta física.

## TBD / exclusiones

- Identificar a la persona si cocina comparte una cuenta (PIN por persona, TBD en AGENTS.md).
- Sonido o aviso al llegar un pedido nuevo; impresión de comandas.

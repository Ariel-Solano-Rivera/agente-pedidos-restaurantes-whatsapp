# Inicio: resumen breve por rol

## Propósito y alcance

Primera pantalla tras iniciar sesión: muestra «lo que pide atención ahora» según el rol y lleva a la página donde se resuelve. Es de solo lectura y no calcula indicadores. El dashboard completo de ADMIN vive en su propia página (ver `dashboard.md`).

## Fuente y dependencias

- Código: `src/features/inicio/HomePage.tsx`, `src/features/inicio/home.css`; componentes `Icon`, `PageHeader`, `EmptyState` y `Skeleton` de `src/design/`.
- API (sin endpoints nuevos):
  - `GET /dashboard`: nombre del restaurante, estado de recepción y motivo de pausa, fecha, plato más vendido (`topDish`, histórico), tareas programadas y `cash {collected, receivable}` de hoy (`null` para COCINA).
  - `GET /orders?status=…&size=1`: se usa solo `total` para contar pedidos por estado (sin rango de fechas).
  - `GET /crm/conversations?tab=PENDING&size=1` (ADMIN, CAJA): `total` de conversaciones por contestar (el último mensaje es del cliente; lo calcula el backend).
  - `GET /menu/dishes` (ADMIN): platos con `active = true` y `available = false`; misma regla que «Platos agotados» del dashboard.
- Roles: ADMIN, CAJA y COCINA. El rol solo elige qué tarjetas pedir; montos y permisos los decide el backend.

## Comportamiento visible

- Encabezado: saludo según la hora («Buenos días», «Buenas tardes», «Buenas noches»), nombre del restaurante y fecha; insignia «Recepción activa» o «Recepción pausada» (icono y texto) y botón «Actualizado HH:MM» que recarga. Si la recepción está pausada, un aviso muestra el motivo.
- «Ahora mismo»: tarjetas grandes con icono, cifra, explicación y enlace a la página que resuelve:
  - ADMIN: Por aceptar (`PENDING_DECISION`) → Pedidos; Por cobrar hoy → Pedidos; Por contestar → CRM; Platos agotados (con hasta dos nombres y «y N más») → Menú.
  - CAJA: Por aceptar, Cobrado hoy, Por cobrar hoy y Por contestar.
  - COCINA: Por preparar (`ACCEPTED`), En preparación (`PREPARING`) y Listos (`READY`), con cifras más grandes y sin montos.
- Las tarjetas abren la página que resuelve: Por aceptar → Pedidos con estado «Por aceptar»; Por preparar, En preparación y Listos (COCINA) → tablero de Cocina; Cobrado hoy → hoy con pago confirmado; Por cobrar hoy → hoy (la lista no filtra exactamente «sin pago confirmado»). Elegir Pedidos en el menú abre la lista sin filtros.
- ADMIN, además: dos bloques con el mismo ancho y la misma altura, alineados en una cuadrícula de dos columnas (segunda ronda, bloque A): «Indicadores del negocio» (tarjeta con botón «Abrir dashboard» que ocupa toda la altura) y «Accesos rápidos» (Pedidos, CRM, Menú y Configuración; los enlaces se reparten la altura disponible, mínimo 64 px). Por debajo de 900 px se apilan.
- Todos: «Plato más vendido» (nombre y unidades vendidas en pedidos registrados, o «Aún sin ventas») junto a «Próximas tareas del equipo» (hora y título, o «Sin tareas programadas»).
- Se actualiza sola cada 60 s mientras la pestaña está visible.
- Ya no se muestra la identidad del restaurante con logo (queda en el menú lateral).
- Animación: las tarjetas entran con un desplazamiento de 6 px y opacidad (280 ms, escalonadas 40 ms); con `prefers-reduced-motion` no hay movimiento.
- Responsivo: cuatro tarjetas por fila desde 1240 px y dos por debajo (COCINA: tres desde 768 px), sin tarjetas huérfanas; en móvil se oculta la explicación y por debajo de 380 px hay una por fila.

## Validaciones y errores

- No acepta `restaurante_id` desde la URL ni el cuerpo.
- Si falla `GET /dashboard` en la primera carga: estado de error con ilustración y «Reintentar». Si falla una recarga: aviso «No se pudo actualizar» y se conservan los últimos datos.
- Si falla un conteo concreto, su tarjeta muestra «—» y «No se pudo cargar este dato» sin ocultar las demás.

## Estados de interfaz

Carga con esqueletos por tarjeta y en tareas (`aria-busy`), error con `EmptyState`, vacío de tareas con `EmptyState` compacto. Cada tarjeta es un botón con nombre accesible completo («Por aceptar: 1. Ver pedidos por aceptar»).

## Pruebas

- `npm run lint` y `npm run build`.
- Revisión visual con Chrome sin interfaz y sesión real: ADMIN a 1440 y 390 px, CAJA a 820 px y COCINA a 1180 px en tema oscuro; sin desbordamiento horizontal.

## TBD / exclusiones

- Alta, asignación y completado de tareas.

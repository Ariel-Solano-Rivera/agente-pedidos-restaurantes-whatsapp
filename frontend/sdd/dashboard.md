# Dashboard de ADMIN

## Propósito y alcance

Página propia, visible solo para ADMIN en el menú, con los indicadores del negocio de T3 y su comparación frente al período anterior de igual duración. Es de solo lectura y no calcula indicadores: solo formatea los valores del backend. Antes vivía dentro de Inicio; desde la etapa 1 del rediseño Inicio muestra un resumen breve (ver `inicio.md`).

Estado: la página y su entrada de menú son nuevas; el contenido conserva el diseño de T3 dentro de una zona `.legacy-page` de tema claro hasta su rediseño (etapa 5).

## Fuente y dependencias

- Código: `src/features/dashboard/DashboardPage.tsx` (encabezado de página) y `src/features/dashboard/AdminDashboard.tsx` (contenido de T3, movido desde `features/inicio/`); estilos de T3 en `src/styles.css`.
- API: `GET /dashboard/admin?range=TODAY|LAST_7_DAYS|LAST_30_DAYS`; definiciones en `backend/sdd/resumen-negocio.md`.
- Roles: ADMIN. La entrada «Dashboard» (grupo «Análisis») solo se muestra a ADMIN y `App.tsx` vuelve a Inicio si otro rol la pide; el backend responde 403 a otros roles.

## Comportamiento visible

- Selector segmentado Hoy / 7 días / 30 días (por defecto Hoy), con una nota que indica contra qué período se compara y la zona horaria.
- Tarjetas: cobrado, por cobrar, ventas completadas (con número de pedidos), ticket promedio, tasa de aceptación, tiempos de decisión y preparación, y clientes nuevos (con recurrentes). Cada tarjeta muestra la variación con flecha y texto («▲ $3,50 vs. ayer a esta hora»), sin depender del color.
- Ventas no concretadas: rechazados, cancelados y vencidos, con importe, cantidad y valor del período anterior.
- Pedidos por hora: columnas SVG de un tono, tooltip por hora, foco por teclado, indicación de la hora pico y tabla alternativa en «Ver tabla».
- Platos y extras más vendidos y retiro frente a entrega: barras horizontales con etiqueta directa de unidades e importe.
- «Ahora mismo»: derivaciones sin contestar y platos agotados (con sus nombres).
- Retrocesos y deshacer por día, rol y tipo, en tabla (ya no desborda su tarjeta: `.chart-card .data-table { min-width: 0 }`).
- Animaciones sutiles: las tarjetas aparecen (220 ms) y las barras crecen (320 ms); con `prefers-reduced-motion` no hay movimiento. Al cambiar el rango, el contenido anterior se atenúa mientras carga.

## Validaciones y errores

- No acepta `restaurante_id` desde la URL ni el cuerpo.
- Si una consulta falla, muestra el error de API sin ocultar la navegación.

## Estados de interfaz

Carga inicial («Calculando indicadores…»), recarga atenuada con `aria-busy`, error en alerta y vacíos explícitos («Sin pedidos completados en el período», «Sin retrocesos en el período», «Sin datos para comparar»).

## Pruebas

- `npm run build` y `npm run lint`; definiciones y permisos cubiertos por `DashboardIntegrationTest` del backend.
- Revisión visual a 1280 px en tema oscuro (zona clara): sin desbordamiento horizontal.

## TBD / exclusiones

- Rediseño visual con el sistema de diseño (etapa 5).
- Costo por plato y ganancia: fuera del MVP (`AGENTS.md`).

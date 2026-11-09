# Inicio, resumen compartido y dashboard de ADMIN

## Propósito y alcance

Muestra a cada usuario autenticado un resumen de su restaurante. ADMIN ve además el dashboard de indicadores del negocio. CAJA ve el cobrado y por cobrar de hoy. COCINA conserva el resumen sin montos. No crea ni modifica tareas.

## Fuente y dependencias

- Código: `src/features/inicio/HomePage.tsx`, `src/features/inicio/AdminDashboard.tsx`, `src/shared/api.ts` y la sección «Inicio» de `src/styles.css`.
- API: `GET /dashboard` (todos) y `GET /dashboard/admin?range=` (ADMIN).
- Roles: ADMIN (dashboard completo), CAJA (caja de hoy), COCINA (sin montos). El rol solo elige qué bloques pedir; los montos y permisos los decide el backend (`cash` llega `null` a COCINA y `/dashboard/admin` responde 403 a otros roles).

## Comportamiento visible

- Todos: saludo, fecha, estado de recepción, identidad del restaurante y tareas programadas.
- CAJA y COCINA: plato más vendido histórico. CAJA, además, tarjetas «Cobrado hoy» y «Por cobrar hoy».
- ADMIN: selector segmentado Hoy / 7 días / 30 días (por defecto Hoy), con una nota que indica contra qué período se compara y la zona horaria.
  - Tarjetas: cobrado, por cobrar, ventas completadas (con número de pedidos), ticket promedio, tasa de aceptación, tiempos de decisión y preparación, y clientes nuevos (con recurrentes). Cada tarjeta muestra la variación con flecha y texto («▲ $3,50 vs. ayer a esta hora»), sin depender del color.
  - Ventas no concretadas: rechazados, cancelados y vencidos, con importe, cantidad y valor del período anterior.
  - Pedidos por hora: columnas SVG de un tono (`#0a5eae`, validado con el script de la skill de visualización), tooltip por hora, foco por teclado, indicación de la hora pico y tabla alternativa en «Ver tabla».
  - Platos y extras más vendidos y retiro frente a entrega: barras horizontales con etiqueta directa de unidades e importe.
  - «Ahora mismo»: derivaciones sin contestar y platos agotados (con sus nombres).
  - Retrocesos y deshacer por día, rol y tipo, en tabla.
- Animaciones sutiles: las tarjetas aparecen (220 ms) y las barras crecen (320 ms); con `prefers-reduced-motion` no hay movimiento. Al cambiar el rango, el contenido anterior se atenúa mientras carga.

## Validaciones y errores

- No acepta `restaurante_id` desde la URL ni el cuerpo; no calcula indicadores: solo formatea los valores del backend.
- Si una consulta falla, muestra el error de API sin ocultar la navegación.

## Estados de interfaz

- Carga inicial («Calculando indicadores…»), recarga atenuada con `aria-busy`, error en alerta, y vacíos explícitos («Sin pedidos completados en el período», «Sin retrocesos en el período», «Sin datos para comparar»).

## Pruebas

- `npm run build` y `npm run lint`; definiciones y permisos cubiertos por `DashboardIntegrationTest` del backend.
- Pendiente: inspección visual en 1440, 768 y 390 px y tema oscuro (el panel aún no tiene tema oscuro).

## TBD / exclusiones

- Alta, asignación y completado de tareas; exportación; logo por restaurante (T5); tema oscuro.

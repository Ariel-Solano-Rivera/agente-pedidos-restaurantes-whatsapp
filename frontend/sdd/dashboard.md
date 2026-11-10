# Dashboard de ADMIN

## Propósito y alcance

Página propia, visible solo para ADMIN en el menú (grupo «Análisis»), con los indicadores del negocio de T3 frente al período anterior de igual duración. Es de solo lectura y no calcula indicadores: presenta los valores del backend. Rediseñada en la etapa 5 con el sistema de diseño; Inicio muestra solo un resumen breve (ver `inicio.md`).

## Fuente y dependencias

- Código: `src/features/dashboard/DashboardPage.tsx` y `dashboard.css`; componentes `Icon`, `PageHeader`, `EmptyState` y `Skeleton` de `src/design/`, y clases `ds-chip` y `ds-table`.
- API: `GET /dashboard/admin?range=TODAY|LAST_7_DAYS|LAST_30_DAYS`; las definiciones están en `backend/sdd/resumen-negocio.md`.
- Roles: ADMIN. `App.tsx` vuelve a Inicio si otro rol pide la vista; el backend responde 403 a otros roles.
- Color de datos: `--data-1` (`#2f6fed` en claro, `#5b8cf5` en oscuro). Se validó con `validate_palette.js` de la skill dataviz contra `--surface` de cada tema: banda de luminosidad, croma y contraste ≥ 3:1.

## Comportamiento visible

- Encabezado con título y explicación. A la derecha, el período como botones (Hoy, 7 días, 30 días; por defecto Hoy) en una sola fila sobre los gráficos.
- Nota: contra qué período se compara, la zona horaria, que los montos usan los precios copiados en cada pedido y que no se calcula ganancia.
- **Ingresos y cobros:** cuatro tarjetas grandes (Cobrado, Por cobrar, Ventas completadas con número de pedidos y Ticket promedio). **Operación y clientes:** Tasa de aceptación, Tiempo de decisión, Tiempo de preparación y Clientes nuevos con recurrentes.
  - Cada tarjeta lleva icono, cifra con números tabulares y variación con flecha y texto («▲ $3,50 vs. ayer a esta hora», «= Igual que…»), en tinta neutra porque subir no siempre es bueno.
  - También muestra una explicación breve del indicador.
- **Pedidos por hora:**
  - columnas de una serie (16 px de ancho, extremo redondeado de 4 px, cuadrado en la base) sobre un eje recesivo con marcas 0, mitad y máximo redondeado, y la hora pico en el subtítulo;
  - cada barra es enfocable y muestra al pasar el puntero o al enfocarla un tooltip («20:00 – 20:59 · 3 pedidos»); las demás se atenúan;
  - incluye «Ver como tabla».
- **Retiro frente a entrega**, **Platos más vendidos** y **Extras más pedidos:** barras horizontales de una serie con etiqueta directa (nombre, cantidad e importe).
- **Ventas no concretadas:** rechazados, cancelados y vencidos con icono, importe, cantidad y valor del período anterior.
- **Ahora mismo** (no depende del período): derivaciones sin contestar (lleva al CRM) y platos agotados (lleva a Menú) con sus nombres.
- **Retrocesos y deshacer:** tabla por día, rol y tipo, con icono por tipo.
- Responsivo: cuatro tarjetas por fila desde 1200 px y dos por debajo, también en móvil (cifra más pequeña, sin explicación secundaria); en una columna los gráficos por hora y retiro/entrega por debajo de 1200 px; en móvil, el gráfico por hora se desplaza en horizontal dentro de su tarjeta.
- Animación: las tarjetas entran con opacidad (280 ms) y las barras crecen desde la base (300 ms); sin movimiento con `prefers-reduced-motion`. Al cambiar el período, el contenido anterior se atenúa mientras carga.

## Validaciones y errores

- No acepta `restaurante_id` desde la URL ni el cuerpo.
- Error en la primera carga: `EmptyState` con «Reintentar». Error al cambiar el período: aviso «No se pudo actualizar» y se conservan los datos anteriores.

## Estados de interfaz

Carga con tarjetas esqueleto; `aria-busy` y cuerpo atenuado al recargar; vacíos con `EmptyState` compacto («Sin datos», «Sin retrocesos»).

## Pruebas

- `npm run build` y `npm run lint`; definiciones y permisos cubiertos por `DashboardIntegrationTest` del backend.
- Revisión con Chrome sin interfaz y sesión real: 1440 px en claro (30 días), 1280 px en oscuro con el tooltip activo y 390 px en móvil, sin desbordamiento de página.

## TBD / exclusiones

- Costo por plato y ganancia: fuera del MVP (`AGENTS.md`).
- Exportar datos o elegir un rango personalizado en el dashboard.

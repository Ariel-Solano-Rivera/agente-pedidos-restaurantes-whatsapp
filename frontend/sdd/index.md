# Índice SDD - frontend

| Módulo | Fuente | Documento | Estado |
|---|---|---|---|
| Sistema de diseño | `src/design/` (`tokens.css`, `components.css`, `Icon.tsx`, `States.tsx`), `public/fonts/`, `muestra-sistema.html` | [sistema-de-diseno.md](sistema-de-diseno.md) | Aprobado (etapa 0): Geist + Geist Mono, tokens claro/oscuro, estados con icono y texto, componentes `ds-*`; en uso desde la etapa 1 |
| Shell, sesión y API | `index.html`, `src/App.tsx`, `src/components/AppShell.tsx` + `.css`, `src/shared/theme.ts`, `src/shared/branding.ts`, `src/shared/api.ts`, `src/main.tsx`, `src/styles.css`, `public/tesis-logo.png` | [app-shell-auth.md](app-shell-auth.md) | Rediseñado (etapa 1): menú lateral por grupos, barra compacta en tableta, menú de pantalla completa en móvil, preferencia de tema Claro/Oscuro/Sistema, páginas antiguas en zona clara; inicio de sesión pendiente (etapa 11) |
| Inicio | `src/features/inicio/HomePage.tsx`, `home.css` | [inicio.md](inicio.md) | Rediseñado (etapa 1): resumen breve por rol con conteos de endpoints existentes, accesos rápidos y tarjeta al Dashboard (ADMIN) |
| Dashboard de ADMIN | `src/features/dashboard/DashboardPage.tsx`, `AdminDashboard.tsx` | [dashboard.md](dashboard.md) | Página propia solo para ADMIN; contenido de T3 en zona clara hasta su rediseño (etapa 5) |
| Catálogo de menú | `src/features/catalogo/CatalogPage.tsx` | [catalogo.md](catalogo.md) | Implementado; selector, búsqueda, diálogos y CRUD de tres catálogos |
| Operación, disponibilidad, zonas y horarios | `src/App.tsx` (`Operation`, `Availability`, `Settings`) | [operacion.md](operacion.md) | Implementado parcialmente |
| Menú y opciones | `src/features/menu/MenuPage.tsx` | [menu.md](menu.md) | CRUD de platos; búsqueda y filtros por categoría, disponibilidad y visibilidad en el cliente; etiqueta «Agotado» |
| Pedidos (lista) | `src/features/pedidos/OrdersPage.tsx`, `orders.css`, `TransitionDialog.tsx`, `orderTypes.ts` | [pedidos.md](pedidos.md) | Rediseñado (etapa 2): filtros como botones con contador del backend, búsqueda, tarjetas con acciones de `allowedTransitions`, confirmación con motivo, paginación |
| Detalle del pedido | `src/features/pedidos/OrderDetailView.tsx`, `order-detail.css` | [detalle-pedido.md](detalle-pedido.md) | Rediseñado (etapa 3): unidades con modificaciones, totales, cliente, pago con verificador, decisión, línea de tiempo con retrocesos y deshacer, acciones por rol |
| Cocina (tablero) | `src/features/cocina/KitchenBoard.tsx`, `kitchen.css` | [cocina.md](cocina.md) | Rediseñado (etapa 4): tres columnas, arrastrar y soltar con Pointer Events (dedo, mouse) y teclado, actualización optimista con reversión, deshacer con cuenta regresiva, sin importes |
| Pagos y derivaciones | — | [pagos-derivaciones.md](pagos-derivaciones.md) | Pantalla de pagos no implementada; derivaciones en CRM |
| Configuración: marca | `src/features/configuracion/SettingsPage.tsx`, `src/shared/branding.ts` | [marca.md](marca.md) | Pestaña Marca (ADMIN); tema aplicado con variables CSS para todos; logo en barra lateral e Inicio |
| CRM | `src/features/crm/CrmPage.tsx` | [crm.md](crm.md) | Pestañas, búsqueda, hilo, tomar/liberar control, respuesta y ficha del cliente |

`App.tsx` compone autenticación, shell y las secciones vigentes; cada pantalla vive en `src/features/` y los elementos compartidos en `src/components/` o `src/shared/`.

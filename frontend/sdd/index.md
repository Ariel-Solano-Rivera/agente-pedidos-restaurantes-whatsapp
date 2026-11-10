# Índice SDD - frontend

| Módulo | Fuente | Documento | Estado |
|---|---|---|---|
| Sistema de diseño | `src/design/` (`tokens.css`, `components.css`, `Icon.tsx`, `States.tsx`), `public/fonts/`, `muestra-sistema.html` | [sistema-de-diseno.md](sistema-de-diseno.md) | Aprobado (etapa 0): Geist + Geist Mono, tokens claro/oscuro, estados con icono y texto, componentes `ds-*`; en uso desde la etapa 1 |
| Shell, sesión y API | `index.html`, `src/App.tsx`, `src/components/AppShell.tsx` + `.css`, `src/shared/theme.ts`, `src/shared/branding.ts`, `src/shared/api.ts`, `src/main.tsx`, `src/styles.css`, `public/tesis-logo.png` | [app-shell-auth.md](app-shell-auth.md) | Rediseñado (etapa 1): menú lateral por grupos, barra compacta en tableta, menú de pantalla completa en móvil, preferencia de tema Claro/Oscuro/Sistema, páginas antiguas en zona clara; inicio de sesión pendiente (etapa 11) |
| Inicio | `src/features/inicio/HomePage.tsx`, `home.css` | [inicio.md](inicio.md) | Rediseñado (etapa 1): resumen breve por rol con conteos de endpoints existentes, accesos rápidos y tarjeta al Dashboard (ADMIN) |
| Dashboard de ADMIN | `src/features/dashboard/DashboardPage.tsx`, `dashboard.css` | [dashboard.md](dashboard.md) | Rediseñado (etapa 5): período como botones, indicadores con variación, columnas por hora con tooltip y tabla, barras de una serie validadas con dataviz, ventas no concretadas, ahora mismo y retrocesos |
| Catálogo de menú | `src/features/catalogo/CatalogPage.tsx` | [catalogo.md](catalogo.md) | Implementado; selector, búsqueda, diálogos y CRUD de tres catálogos |
| Operación, disponibilidad, zonas y horarios | `src/App.tsx` (`Operation`, `Availability`, `Settings`) | [operacion.md](operacion.md) | Implementado parcialmente |
| Menú | `src/features/menu/MenuPage.tsx`, `DishForms.tsx`, `menu.css`, `src/design/forms.css` | [menu.md](menu.md) | Rediseñado (etapa 7): tabla con interruptor de agotado (ADMIN/CAJA), búsqueda y filtros como botones con contador, acciones por fila (editar, ocultar, eliminar con confirmación), formularios con el kit `ds-form-dialog` |
| Pedidos (lista) | `src/features/pedidos/OrdersPage.tsx`, `orders.css`, `TransitionDialog.tsx`, `orderTypes.ts` | [pedidos.md](pedidos.md) | Rediseñado (etapa 2): filtros como botones con contador del backend, búsqueda, tarjetas con acciones de `allowedTransitions`, confirmación con motivo, paginación |
| Detalle del pedido | `src/features/pedidos/OrderDetailView.tsx`, `order-detail.css` | [detalle-pedido.md](detalle-pedido.md) | Rediseñado (etapa 3): unidades con modificaciones, totales, cliente, pago con verificador, decisión, línea de tiempo con retrocesos y deshacer, acciones por rol |
| Cocina (tablero) | `src/features/cocina/KitchenBoard.tsx`, `kitchen.css` | [cocina.md](cocina.md) | Rediseñado (etapa 4): tres columnas, arrastrar y soltar con Pointer Events (dedo, mouse) y teclado, actualización optimista con reversión, deshacer con cuenta regresiva, sin importes |
| Pagos y derivaciones | — | [pagos-derivaciones.md](pagos-derivaciones.md) | Pantalla de pagos no implementada; derivaciones en CRM |
| Configuración: marca | `src/features/configuracion/SettingsPage.tsx`, `src/shared/branding.ts` | [marca.md](marca.md) | Pestaña Marca (ADMIN); tema aplicado con variables CSS para todos; logo en barra lateral e Inicio |
| CRM | `src/features/crm/CrmPage.tsx`, `crm.css` | [crm.md](crm.md) | Rediseñado (etapa 6): tres columnas (lista con pestañas y contadores, hilo agrupado por día, ficha con pedidos enlazados), tomar y liberar control con confirmación, respuesta solo con control, un panel a la vez en móvil |

`App.tsx` compone autenticación, shell y las secciones vigentes; cada pantalla vive en `src/features/` y los elementos compartidos en `src/components/` o `src/shared/`.

# Índice SDD - frontend

| Módulo | Fuente | Documento | Estado |
|---|---|---|---|
| Shell, sesión y API | `src/App.tsx`, `src/components/AppShell.tsx`, `src/shared/api.ts`, `src/main.tsx`, `src/styles.css`, `public/tesis-logo.png` | [app-shell-auth.md](app-shell-auth.md) | Implementado; Sidebar Inicio → Pedidos → CRM (ADMIN/CAJA) → Menú → Catálogo → Configuración (ADMIN); tema por variables CSS |
| Inicio y dashboard | `src/features/inicio/HomePage.tsx`, `AdminDashboard.tsx` | [inicio.md](inicio.md) | Resumen por rol; dashboard de ADMIN con rango, comparación, tarjetas y gráficos accesibles; caja de hoy para CAJA |
| Catálogo de menú | `src/features/catalogo/CatalogPage.tsx` | [catalogo.md](catalogo.md) | Implementado; selector, búsqueda, diálogos y CRUD de tres catálogos |
| Operación, disponibilidad, zonas y horarios | `src/App.tsx` (`Operation`, `Availability`, `Settings`) | [operacion.md](operacion.md) | Implementado parcialmente |
| Menú y opciones | `src/features/menu/MenuPage.tsx` | [menu.md](menu.md) | CRUD de platos; búsqueda y filtros por categoría, disponibilidad y visibilidad en el cliente; etiqueta «Agotado» |
| Pedidos y vista de cocina por rol | `src/features/pedidos/OrdersPage.tsx` | [pedidos.md](pedidos.md) | Filtros, búsqueda y paginación del backend; número destacado; avanzar/retroceder con confirmación y motivo; deshacer de cocina; historial en la comanda |
| Pagos y derivaciones | — | [pagos-derivaciones.md](pagos-derivaciones.md) | Pantalla de pagos no implementada; derivaciones en CRM |
| Configuración: marca | `src/features/configuracion/SettingsPage.tsx`, `src/shared/branding.ts` | [marca.md](marca.md) | Pestaña Marca (ADMIN); tema aplicado con variables CSS para todos; logo en barra lateral e Inicio |
| CRM | `src/features/crm/CrmPage.tsx` | [crm.md](crm.md) | Pestañas, búsqueda, hilo, tomar/liberar control, respuesta y ficha del cliente |

`App.tsx` compone autenticación, shell y las cuatro secciones vigentes; cada pantalla vive en `src/features/` y los elementos compartidos en `src/components/` o `src/shared/`.

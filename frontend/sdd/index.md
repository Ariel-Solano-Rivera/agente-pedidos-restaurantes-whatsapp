# Índice SDD - frontend

| Módulo | Fuente | Documento | Estado |
|---|---|---|---|
| Shell, sesión y API | `src/App.tsx`, `src/components/AppShell.tsx`, `src/shared/api.ts`, `src/main.tsx`, `src/styles.css`, `public/tesis-logo.png` | [app-shell-auth.md](app-shell-auth.md) | Implementado; Sidebar Inicio → Pedidos → Menú → Catálogo |
| Inicio y resumen compartido | `src/features/inicio/HomePage.tsx` | [inicio.md](inicio.md) | Implementado; solo lectura |
| Catálogo de menú | `src/features/catalogo/CatalogPage.tsx` | [catalogo.md](catalogo.md) | Implementado; selector, búsqueda, diálogos y CRUD de tres catálogos |
| Operación, disponibilidad, zonas y horarios | `src/App.tsx` (`Operation`, `Availability`, `Settings`) | [operacion.md](operacion.md) | Implementado parcialmente |
| Menú y opciones | `src/features/menu/MenuPage.tsx` | [menu.md](menu.md) | Implementado parcialmente; tarjetas fijas y formularios con selección buscable |
| Pedidos y vista de cocina por rol | `src/features/pedidos/OrdersPage.tsx` | [pedidos.md](pedidos.md) | Tarjetas compactas con detalle desplazable, tarifa visible y transiciones autorizadas |
| Pagos y derivaciones | `src/App.tsx` (`Payments`, `Handoffs`) | [pagos-derivaciones.md](pagos-derivaciones.md) | Pago solo lectura; derivaciones implementadas |

`App.tsx` compone autenticación, shell y las cuatro secciones vigentes; cada pantalla vive en `src/features/` y los elementos compartidos en `src/components/` o `src/shared/`.

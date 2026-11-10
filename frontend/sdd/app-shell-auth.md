# Shell, autenticación y cliente API

## Propósito y alcance

Inicia React, autentica al usuario de demostración mediante HTTP Basic y muestra navegación limitada por rol. No implementa registro, recuperación de contraseña ni gestión de usuarios.

## Fuente y dependencias

- Código: `index.html`, `src/main.tsx`, `src/App.tsx` (`Login`, `App`), `src/components/AppShell.tsx`, `src/components/AppShell.css`, `src/shared/theme.ts`, `src/shared/branding.ts`, `src/shared/api.ts`, `src/shared/Table.tsx`, `src/styles.css` y `public/tesis-logo.png`.
- API: `GET /api/v1/me` y los endpoints definidos por cada pantalla.
- Roles: todos los roles autenticados.

## Comportamiento visible

- Guarda el token Basic codificado en `localStorage` solo para la demostración local.
- El contrato de sesión usa `email`, `restaurantId` y `roles`; los componentes no asumen un campo `username` inexistente.
- Verifica la sesión al arrancar, muestra un formulario propio de acceso si falla y permite cerrar sesión. El formulario presenta el logo de la tesis, campos vacíos con ejemplos de usuario/correo y contraseña, estado de envío y errores en la propia página; no usa diálogos emergentes.
- Estructura general (rediseño, etapa 1), con el sistema de diseño (`sistema-de-diseno.md`):
  - Menú lateral claro u oscuro según el tema, con logo (el del restaurante si existe; ver `marca.md`) y grupos: **Operación** (Inicio, Pedidos, Cocina, Operación diaria, CRM, Derivaciones y Pagos; las cuatro últimas solo ADMIN y CAJA), **Análisis** (Dashboard solo ADMIN), **Carta** (Menú, Catálogo) y **Ajustes** (Configuración solo ADMIN). El elemento activo se resalta con el color de acción y `aria-current="page"`. `roles` solo oculta secciones que el backend negaría con 403; si se pide una vista no permitida, `App.tsx` muestra Inicio.
  - Pie del menú: preferencia de tema (Claro, Oscuro o Sistema; ver `src/shared/theme.ts`; `AppShell` la comparte con Configuración → Apariencia mediante `ThemeContext`) y tarjeta del usuario con correo, rol en español y botón «Cerrar sesión».
  - Escritorio (≥ 1100 px): menú lateral fijo de 256 px. Tableta (768–1099 px): barra compacta de 96 px con icono y etiqueta corta; las opciones de tema quedan solo con icono, con nombre accesible y tooltip. Móvil (< 768 px): barra superior con logo, título de la sección y botón «Menú», que abre un menú de pantalla completa (`<dialog>` modal con foco atrapado y Esc) con elementos de 56 px, tema, usuario y «Cerrar».
  - Enlace «Saltar al contenido»; al cambiar de sección el foco pasa al contenido principal y la vista vuelve arriba.
  - Tema: `useThemePreference` lee la preferencia por persona en `localStorage` (`restaurant.theme.<correo>`, con `try/catch`); por defecto Oscuro para COCINA y Claro para los demás. «Sistema» sigue `prefers-color-scheme` y sus cambios. Pone `data-theme` en `<html>` y lo quita al cerrar sesión. No se envía al backend.
  - Marca: `applyBranding` marca `data-brand-contrast="low"` cuando `contrast` de `GET /branding` dice que el color principal no cumple AA; el panel no calcula contraste.
  - Todas las páginas usan el sistema de diseño (etapas 1 a 10). Los estilos globales antiguos de `button`, `input`, `select` y `table` de `styles.css` quedan limitados con `:where(.legacy-page, .login)` y solo alcanzan al inicio de sesión hasta la etapa 11.
- `index.html` declara `lang="es"`, `meta viewport` (antes faltaba y el panel se veía como escritorio reducido en móviles), `color-scheme`, título «Panel del restaurante», icono y precarga de Geist.
- Orden de estilos en `main.tsx`: `styles.css` (antiguo), `design/tokens.css`, `design/components.css` y luego los de cada página.
- Centraliza solicitudes JSON, encabezado `Authorization`, carga inicial y presentación de errores de API.

## Validaciones y errores

- Un HTTP no exitoso se convierte en mensaje de error de la API o del estado HTTP; el 401 se anuncia dentro del formulario.
- No infiere permisos en el cliente: el backend sigue siendo la autoridad.
- `localStorage` no es un mecanismo de autenticación de producción; reemplazarlo cuando se defina el mecanismo definitivo.

## Pruebas

- `npm run build` (comprueba tipos de `src/` y de `vite.config.ts` sin emitir archivos) y `npm run lint` (ESLint con reglas de TypeScript y de hooks de React). Las versiones quedan fijadas por `package-lock.json`.
- Prueba de humo: `scripts/smoke.ps1` desde la raíz comprueba acceso, `GET /me` y la carga del panel en `:5173`; llama a la API directamente en `:8080`, no a través del proxy `/api`.
- Verificación visual con Chrome sin interfaz y sesión real: menú lateral a 1440 y 1180 px, barra compacta a 820 px, barra superior y menú de pantalla completa a 390 px, en tema claro y oscuro; sin desbordamiento horizontal. El inicio de sesión se rediseña en la etapa 11.

## TBD / exclusiones

- Sesiones seguras, renovación, recuperación de contraseña, gestión de usuarios y accesibilidad avanzada.

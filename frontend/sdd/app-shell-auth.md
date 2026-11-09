# Shell, autenticación y cliente API

## Propósito y alcance

Inicia React, autentica al usuario de demostración mediante HTTP Basic y muestra navegación limitada por rol. No implementa registro, recuperación de contraseña ni gestión de usuarios.

## Fuente y dependencias

- Código: `src/main.tsx`, `src/App.tsx` (`Login`, `App`), `src/components/AppShell.tsx`, `src/shared/api.ts`, `src/shared/Table.tsx`, `src/styles.css` y `public/tesis-logo.png`.
- API: `GET /api/v1/me` y los endpoints definidos por cada pantalla.
- Roles: todos los roles autenticados.

## Comportamiento visible

- Guarda el token Basic codificado en `localStorage` solo para la demostración local.
- El contrato de sesión usa `email`, `restaurantId` y `roles`; los componentes no asumen un campo `username` inexistente.
- Verifica la sesión al arrancar, muestra un formulario propio de acceso si falla y permite cerrar sesión. El formulario presenta el logo de la tesis, campos vacíos con ejemplos de usuario/correo y contraseña, estado de envío y errores en la propia página; no usa diálogos emergentes.
- Muestra el shell en este orden: Inicio, Pedidos, CRM (solo ADMIN y CAJA), Menú y Catálogo. La lista `navigation` admite `roles` solo para ocultar secciones que el backend negaría con 403. En escritorio, el Sidebar queda fijo a todo el alto del viewport y el área de trabajo reserva su ancho; incluye iconos SVG, estado activo, sección principal y perfil. En pantallas angostas se convierte en una barra superior fija y deslizable, sin mostrar una barra de desplazamiento ni desbordar el contenido. Operación y pagos siguen fuera de la navegación; las derivaciones se atienden en CRM.
- Centraliza solicitudes JSON, encabezado `Authorization`, carga inicial y presentación de errores de API.

## Validaciones y errores

- Un HTTP no exitoso se convierte en mensaje de error de la API o del estado HTTP; el 401 se anuncia dentro del formulario.
- No infiere permisos en el cliente: el backend sigue siendo la autoridad.
- `localStorage` no es un mecanismo de autenticación de producción; reemplazarlo cuando se defina el mecanismo definitivo.

## Pruebas

- `npm run build` (comprueba tipos de `src/` y de `vite.config.ts` sin emitir archivos) y `npm run lint` (ESLint con reglas de TypeScript y de hooks de React). Las versiones quedan fijadas por `package-lock.json`.
- Prueba de humo: `scripts/smoke.ps1` desde la raíz comprueba acceso, `GET /me` y la carga del panel en `:5173`; llama a la API directamente en `:8080`, no a través del proxy `/api`.
- Verificación visual responsiva: formulario, Sidebar fijo y foco visible en 1440 px, 768 px y 390 px; entrada reducida cuando `prefers-reduced-motion` está activo.

## TBD / exclusiones

- Sesiones seguras, renovación, recuperación de contraseña, gestión de usuarios y accesibilidad avanzada.

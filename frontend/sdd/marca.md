# Configuración: marca del restaurante

## Propósito y alcance

Sección «Configuración», pestaña «Marca», solo para ADMIN: editar el color principal y el secundario, subir, reemplazar o quitar el logo, y ver los avisos de contraste. El panel aplica la marca del restaurante del usuario con variables CSS para todos los roles.

## Fuente y dependencias

- Código:
  - `src/features/configuracion/SettingsPage.tsx`;
  - `src/shared/branding.ts` (`useBranding`, `applyBranding`);
  - `src/App.tsx`, `src/components/AppShell.tsx` (entrada «Configuración» y logo en la barra lateral) y `src/features/inicio/HomePage.tsx` (logo);
  - en `src/styles.css`, las variables `:root` y la sección «Configuración → Marca».
- API o estado compartido: `GET /branding`, `GET /branding/logo`, `PUT /admin/branding`, `POST /admin/branding/logo` y `DELETE /admin/branding/logo`.
- Roles: todos leen y aplican la marca; solo ADMIN ve «Configuración» (el backend responde 403 a los demás).

## Comportamiento visible

- **Tema:** `styles.css` define `--brand-primary` (`#0a3165`) y `--brand-secondary` (`#0a5eae`) como tema por defecto, y de ellos deriva `--brand-primary-strong`, `--brand-primary-soft` y `--brand-secondary-strong`.
  - Tras iniciar sesión, `useBranding` lee `GET /branding` y fija las dos variables en `document.documentElement`. Al cerrar sesión se quitan.
  - El principal colorea botones y la barra lateral; el secundario, acciones, acentos, barras y gráficos.
  - Con logo, la barra lateral e Inicio lo muestran en lugar del logo de la tesis.
- **Pestaña «Marca»:**
  - cada color tiene selector visual y campo hexadecimal, con validación de formato al escribir;
  - una vista previa muestra un botón principal, una acción secundaria y un texto;
  - el informe de contraste del backend muestra, por color, la relación contra `#FFFFFF` con «Cumple» (✓) o «Contraste insuficiente» (⚠) y su uso, más un aviso general si alguno falla;
  - botones «Descartar cambios» y «Guardar colores».
- **Logo:** vista previa del actual, selector de archivo para subir o reemplazar (PNG, JPEG o WebP, hasta 2 MB) y «Quitar logo» con confirmación.

## Validaciones y errores

- El cliente revisa formato, tipo y tamaño solo para avisar antes; la validación real (formato, tipo por contenido, 2 MB y permisos) la hace el backend, y sus mensajes se muestran en la pestaña.
- El contraste lo calcula el backend; el cliente solo lo muestra. Mientras haya cambios sin guardar, se indica que el informe corresponde a los colores guardados.

## Estados de interfaz

- Carga de la marca, guardado en curso (controles deshabilitados), error en alerta y aviso de éxito («Colores guardados y aplicados al panel», «Logo actualizado», «Logo eliminado»).

## Pruebas

- `npm run build` y `npm run lint`; contrato cubierto por `BrandingIntegrationTest`.
- Pendiente: inspección visual con la marca de Sierra Verde (`#1F5E3B` / `#2E7D4F`) en 1440, 768 y 390 px.

## TBD / exclusiones

- Otras pestañas de configuración (horarios, zonas, pausa), tema oscuro, y logo en el login (TBD en el backend).

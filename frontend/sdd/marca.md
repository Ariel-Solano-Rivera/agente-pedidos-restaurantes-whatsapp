# Configuración: marca del restaurante

## Propósito y alcance

Sección «Configuración», pestaña «Marca», solo para ADMIN: editar el color principal y el secundario, subir, reemplazar o quitar el logo, y ver los avisos de contraste. El panel aplica la marca del restaurante del usuario con variables CSS para todos los roles.

## Fuente y dependencias

- Código:
  - `src/features/configuracion/SettingsPage.tsx` y `settings.css` (rediseño, etapa 10);
  - `src/shared/branding.ts` (`useBranding`, `applyBranding`) y `src/shared/theme.ts` (`ThemeContext`, `useTheme`);
  - `src/App.tsx` y `src/components/AppShell.tsx` (entrada «Configuración», logo en el menú lateral, la barra superior móvil y el menú de pantalla completa, y proveedor del tema);
  - en `src/design/tokens.css`, las variables de marca y su variante de bajo contraste.
- API o estado compartido: `GET /branding`, `GET /branding/logo`, `PUT /admin/branding`, `POST /admin/branding/logo` y `DELETE /admin/branding/logo`.
- Roles: todos leen y aplican la marca; solo ADMIN ve «Configuración» (el backend responde 403 a los demás).

## Comportamiento visible

- **Tema:** `styles.css` define `--brand-primary` (`#0a3165`) y `--brand-secondary` (`#0a5eae`) como tema por defecto, y de ellos deriva `--brand-primary-strong`, `--brand-primary-soft` y `--brand-secondary-strong`.
  - Tras iniciar sesión, `useBranding` lee `GET /branding` y fija las dos variables en `document.documentElement`. Al cerrar sesión se quitan.
  - El principal colorea botones y la barra lateral; el secundario, acciones, acentos, barras y gráficos.
  - Con logo, el menú lateral y la barra superior móvil lo muestran en lugar del logo de la tesis (Inicio ya no muestra el logo desde la etapa 1 del rediseño).
  - Si `contrast` indica que el color principal no cumple AA contra blanco, `applyBranding` pone `data-brand-contrast="low"` y la acción usa el color por defecto (ver `sistema-de-diseno.md`).
- **Configuración** tiene las pestañas **Marca** y **Apariencia**. Cada ajuste es una fila con título y explicación a la izquierda y el control a la derecha (referencia `marca-01`).
- **Marca → Colores:**
  - cada color tiene una muestra clicable (selector nativo) y un campo hexadecimal con «#» fijo; solo admite 6 dígitos y avisa si el formato no es válido;
  - bajo cada color, el resultado de contraste que calculó el backend para el color **guardado**: «Cumple AA · 12,8:1» en verde o «Contraste insuficiente · 1,95:1» en rojo, con su uso. Mientras hay cambios sin guardar, dice «Guarda para que el sistema verifique el contraste»; el panel no calcula contraste;
  - vista previa en miniatura del panel (menú lateral con elemento activo, botón «Aceptar», enlace secundario y barras) con los colores elegidos. Si el principal guardado no cumple AA, la vista previa usa el color de acción por defecto, igual que el panel;
  - aviso ámbar si algún color guardado no llega a 4,5:1, y botones «Descartar cambios» y «Guardar colores».
- **Marca → Logo:** vista previa de 96 px (o «Sin logo»), «Subir logo» o «Reemplazar logo» (PNG, JPEG o WebP, hasta 2 MB; el servidor valida el contenido y lo guarda como WebP, bloque D) y «Quitar logo» con confirmación en un `<dialog>`. Debajo, la fecha de la última actualización y la nota de auditoría.
- **Apariencia:** tarjetas Claro y Oscuro (dos columnas; «Sistema» se retiró en la segunda ronda, bloque A) con una miniatura, una descripción y una marca de selección (`role="radio"`). Comparten estado con el selector del menú lateral a través de `ThemeContext`; la preferencia es por persona y se guarda solo en el navegador.
- Avisos de éxito o error con icono (6 s).

## Validaciones y errores

- El cliente revisa formato, tipo y tamaño solo para avisar antes; la validación real (formato, tipo por contenido, 2 MB y permisos) la hace el backend, y sus mensajes se muestran en la pestaña.
- El contraste lo calcula el backend; el cliente solo lo muestra (y, si el principal no cumple, aplica el color de acción por defecto). Mientras haya cambios sin guardar, se indica que el informe corresponde a los colores guardados.

## Estados de interfaz

- Carga de la marca, guardado en curso (controles deshabilitados), error en alerta y aviso de éxito («Colores guardados y aplicados al panel», «Logo actualizado», «Logo eliminado»).

## Pruebas

- Desde la interfaz (etapa 10): se guardó `#E0B43A` como principal; el backend devolvió 1,95:1 sin AA, el panel mostró «Contraste insuficiente», puso `data-brand-contrast="low"` y la vista previa usó el color por defecto. Después se restauraron `#0A3165` y `#0A5EAE`. Capturas de Marca en claro y Apariencia en oscuro.

- `npm run build` y `npm run lint`; contrato cubierto por `BrandingIntegrationTest`.
- Pendiente: inspección visual con la marca de Sierra Verde (`#1F5E3B` / `#2E7D4F`) en 1440, 768 y 390 px.

## TBD / exclusiones

- Otras pestañas de configuración (horarios, zonas, pausa), tema oscuro, y logo en el login (TBD en el backend).

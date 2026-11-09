# Marca del restaurante

## Propósito y alcance

Guarda y entrega la marca del restaurante del usuario autenticado: color principal, color secundario y logo o foto del local. Calcula los avisos de contraste WCAG AA. El panel aplica la marca; solo ADMIN la modifica.

## Fuente y dependencias

- Código: `administracion/BrandingController.java` (API) y `administracion/BrandingPolicy.java` (formato de color, contraste y tipo real de imagen).
- Tablas o migraciones: `restaurant_branding` (V13), `audit_log`.
- Consumidores: `frontend/src/shared/branding.ts`, `features/configuracion/SettingsPage.tsx`, `components/AppShell.tsx` y `features/inicio/HomePage.tsx`.

## Contratos y permisos

- `GET /branding` (todos los roles) devuelve `{primaryColor, secondaryColor, hasLogo, updatedAt, contrast[]}`. Si el restaurante no tiene fila, responde con el tema por defecto `#0A3165` / `#0A5EAE`.
- `GET /branding/logo` (todos los roles) devuelve el binario con su tipo detectado y `Cache-Control: no-cache`; sin logo, 404 `LOGO_NOT_FOUND`.
- `PUT /admin/branding` (ADMIN), cuerpo `{primaryColor, secondaryColor}`: guarda los colores y devuelve la marca con el contraste recalculado.
- `POST /admin/branding/logo` (ADMIN), `multipart/form-data` con `file`: guarda o reemplaza el logo.
- `DELETE /admin/branding/logo` (ADMIN): quita el logo.
- CAJA y COCINA reciben 403 `FORBIDDEN` en las rutas `/admin/branding*`.

## Validaciones y efectos de estado

- Colores: formato `#RRGGBB` (se recorta y se guarda en mayúsculas); en otro caso, 400 `COLOR_INVALID`. La base lo refuerza con un `CHECK '^#[0-9A-F]{6}$'`.
- **Contraste (WCAG 2.x, AA para texto normal, umbral 4,5:1).** Se mide cada color de marca **contra el blanco `#FFFFFF`**, porque en el panel:
  - el principal es el fondo de botones y de la barra lateral, con texto blanco;
  - el secundario es el fondo de acciones con texto blanco, y también el color de textos, barras y gráficos sobre tarjetas blancas.
  - `contrast[]` trae `{color, usage, against, ratio (2 decimales), passesAA}`. Es un **aviso**: guardar con contraste insuficiente está permitido.
- Logo:
  - se lee de forma reactiva con un límite de 2 MB (si lo supera, 413 `LOGO_TOO_LARGE`);
  - el tipo se detecta por la firma de los primeros bytes (PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `RIFF….WEBP`), ignorando la extensión y el tipo declarado; si no coincide, 400 `LOGO_INVALID_TYPE`; un archivo vacío da 400 `LOGO_EMPTY`;
  - se guarda en `BYTEA` mediante R2DBC, sin E/S bloqueante.
- Cada cambio actualiza `updated_by` y `updated_at`.

## Aislamiento, trazabilidad e idempotencia

- La clave primaria es `restaurante_id`, que sale siempre del usuario autenticado: cada restaurante solo ve y cambia su propia marca.
- Cada cambio registra `BRANDING_COLORS_UPDATE`, `BRANDING_LOGO_UPDATE` o `BRANDING_LOGO_DELETE` en `audit_log`, con usuario y `correlation_id`.
- Las operaciones son idempotentes por naturaleza (reemplazo del valor) y no usan `Idempotency-Key`.

## Pruebas

- `BrandingPolicyTest`: formato y normalización, contraste (21:1 para negro sobre blanco, límite de `#767676`) y detección de PNG, JPEG y WebP frente a SVG o GIF renombrados.
- `BrandingIntegrationTest` (Testcontainers): lectura para todos los roles, 403 para CAJA, color inválido, normalización y avisos, auditoría, SVG renombrado como `.png` rechazado, 413 por tamaño, PNG declarado como JPEG guardado como `image/png`, borrado y aislamiento con Sierra Verde.

## TBD / exclusiones

- **TBD:** ¿el logo debe mostrarse también en el login? Hoy el login aparece antes de saber el restaurante y usa el logo de la tesis.
- Tipografías, tema oscuro y colores adicionales (estado, fondo).

# Seguridad, identidad y aislamiento por restaurante

## Propósito y alcance

Autentica usuarios ficticios con HTTP Basic y propaga el `restaurante_id` del usuario autenticado para que cada consulta y mutación quede aislada.

## Fuente y dependencias

- Código: `security/AppPrincipal.java`, `AppUserDetailsService.java`, `SecurityConfig.java`, `Tenant.java` y `administracion/MeController.java`.
- Tablas: `app_user`, `restaurant`.
- Consumidor: todas las rutas `/api/v1/**`.

## Contratos y permisos

- `GET /api/v1/me` devuelve id, correo, rol y restaurante de la sesión.
- `/actuator/health` es público; `/api/**` exige autenticación; autorización específica se declara por endpoint. Un 401 devuelve JSON `{ "code":"UNAUTHORIZED", "message":"Usuario o contraseña incorrectos." }` sin `WWW-Authenticate`, para que el cliente web controle la recuperación en su formulario. Esto vale también para credenciales incorrectas: `httpBasic` usa el mismo punto de entrada, que no envía `WWW-Authenticate: Basic`, para que el navegador no abra su diálogo nativo (corregido en la etapa 11 del rediseño; antes solo se cumplía sin credenciales). Prueba: `LoginErrorIntegrationTest`.
- El rol se expone como `ROLE_ADMIN`, `ROLE_CAJA` o `ROLE_COCINA`.

## Validaciones y efectos de estado

- `Tenant.restaurantId()` obtiene el restaurante desde el principal, nunca desde cuerpo o URL del cliente.
- Las consultas documentadas de los módulos filtran `restaurante_id`; las FKs y claves del esquema refuerzan la pertenencia.
- Las contraseñas de demostración se almacenan con hash BCrypt y solo corresponden a datos sintéticos.

## Pruebas

- `scripts/smoke.ps1` valida acceso de ADMIN, acceso de COCINA a pedidos, 403 de COCINA a pagos y 404 entre restaurantes.

## TBD / exclusiones

- Reemplazar HTTP Basic/localStorage por autenticación de producción, gestión de usuarios, rotación de credenciales y auditoría de inicio de sesión.

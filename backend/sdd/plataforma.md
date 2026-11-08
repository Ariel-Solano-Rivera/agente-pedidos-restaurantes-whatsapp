# Plataforma, transacciones y errores

## Propósito y alcance

Arranca el monolito reactivo y centraliza la traducción de errores de validación o negocio para el panel.

## Fuente y dependencias

- Código: `RestaurantAdminApplication.java`, `common/ApiExceptionHandler.java`, `common/TransactionConfig.java` y `compose.yaml`.
- Dependencias: Spring WebFlux, R2DBC y `ReactiveTransactionManager`.

## Contratos y permisos

- `ApiExceptionHandler` devuelve `{code, message}` para `ResponseStatusException` y validaciones de cuerpo.
- `TransactionalOperator` envuelve actualmente creación de platos y ajustes de disponibilidad.

## Validaciones y efectos de estado

- No usar `block()`, JDBC síncrono ni I/O bloqueante en rutas WebFlux.
- Las operaciones que combinan múltiples escrituras deben declarar su límite transaccional antes de implementarse.
- Compose publica PostgreSQL en `127.0.0.1:55478` por defecto y permite cambiar el puerto mediante `POSTGRES_PORT`; el backend se conecta al puerto interno `5432`.

## Pruebas

- `docker compose build backend`, arranque de los tres servicios y prueba de humo contra el servicio levantado.

## TBD / exclusiones

- Normalizar errores de restricciones de base de datos, problema de detalle RFC y observabilidad estructurada.

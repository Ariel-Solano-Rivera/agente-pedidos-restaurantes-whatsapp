# Plataforma, transacciones y errores

## Propósito y alcance

Arranca el monolito reactivo y centraliza la traducción de errores de validación o negocio para el panel.

## Fuente y dependencias

- Código: `RestaurantAdminApplication.java`, `common/ApiExceptionHandler.java`, `common/TransactionConfig.java` y `compose.yaml`.
- Dependencias: Spring WebFlux, R2DBC, `ReactiveTransactionManager` y Spring Boot Actuator (`/actuator/health`, único endpoint expuesto y público).
- Construcción: Maven Wrapper 3.9.9 (`./mvnw`) con JDK 21; pruebas con JUnit 5, `spring-security-test` y Testcontainers (PostgreSQL real; requiere Docker).

## Contratos y permisos

- `ApiExceptionHandler` devuelve `{code, message}` con un código estable: `ApiException` (código de negocio propio), validación de cuerpo (`VALIDATION`), parámetros o cabeceras inválidos (`BAD_REQUEST`), permiso denegado por rol (`FORBIDDEN`) y `ResponseStatusException` (nombre del estado HTTP, por ejemplo `NOT_FOUND`).
- `TransactionalOperator` envuelve creación, edición y eliminación de platos, ajustes de disponibilidad, transiciones de pedidos y el deshacer de cocina.

## Validaciones y efectos de estado

- No usar `block()`, JDBC síncrono ni I/O bloqueante en rutas WebFlux.
- Las operaciones que combinan múltiples escrituras deben declarar su límite transaccional antes de implementarse.
- Compose publica PostgreSQL en `127.0.0.1:55478` por defecto y permite cambiar el puerto mediante `POSTGRES_PORT`; el backend se conecta al puerto interno `5432`. Fuera de Docker, `application.yml` usa por defecto `localhost:55478`, el mismo puerto que publica Compose.

## Pruebas

- `./mvnw package` (incluye las pruebas; `-DskipTests` las omite), `docker compose build backend`, arranque de los tres servicios y prueba de humo contra el servicio levantado.

## TBD / exclusiones

- Normalizar errores de restricciones de base de datos, problema de detalle RFC y observabilidad estructurada.

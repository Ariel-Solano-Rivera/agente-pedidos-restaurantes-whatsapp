# Ejecución local

1. Copiar `.env.example` a `.env` y reemplazar solo valores locales de demostración.
2. Ejecutar `docker compose up --build`. PostgreSQL usa el puerto local `55478` por defecto; si está ocupado, ajustar `POSTGRES_PORT` en `.env`.
3. Abrir `http://localhost:5173`.
4. Usuarios ficticios iniciales: `admin@marazul.test`, `caja@marazul.test`, `cocina@marazul.test`; contraseña: `password`. `admin@sierraverde.test` permite verificar el aislamiento entre dos restaurantes ficticios. Cambiar estas credenciales antes de cualquier uso que no sea la demostración local.

La base de datos usa un volumen Docker. Para reiniciar solamente datos ficticios: `docker compose down -v`; esto borra el volumen del proyecto.

## Compilar y probar sin Docker Compose

- Backend (JDK 21): `cd backend && ./mvnw test` ejecuta pruebas unitarias y de integración. Las de integración levantan PostgreSQL con Testcontainers, así que Docker debe estar abierto. `./mvnw -DskipTests package` solo compila.
- Frontend (Node 22): `cd frontend && npm ci && npm run lint && npm run build`.
- Frontend en modo desarrollo (recarga en caliente): con `db` y `backend` levantados, detener el contenedor `frontend` (`docker compose stop frontend`) y ejecutar `cd frontend && npm run dev`. Vite sirve en `http://localhost:5173` y reenvía `/api` a `http://localhost:8080` (cambiar con `VITE_API_PROXY`).
- Prueba de humo con el stack levantado: `pwsh -File scripts/smoke.ps1`.

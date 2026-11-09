# Plataforma administrativa — tesis

Incremento ejecutable de la primera etapa: panel administrativo, API reactiva y PostgreSQL con datos únicamente ficticios. No contiene bot, RAG ni conexión a WhatsApp.

## Arranque

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Abrir `http://localhost:5173`. La API queda en `http://localhost:8080` y PostgreSQL localmente en el puerto `55478`. Si ese puerto está ocupado, cambiar `POSTGRES_PORT` en `.env` antes de iniciar Compose.

Usuarios de demostración (todos con contraseña `password`):

- `admin@marazul.test` — ADMIN
- `caja@marazul.test` — CAJA
- `cocina@marazul.test` — COCINA
- `admin@sierraverde.test` — ADMIN del segundo restaurante ficticio, para comprobar aislamiento.

Para detener: `docker compose down`. Para reiniciar los datos ficticios del proyecto: `docker compose down -v` y luego `docker compose up --build`.

Con los servicios ya levantados, se puede repetir la comprobación básica con `powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1`.

## Operativo hoy

- Inicio de sesión HTTP Basic de demostración, roles y aislamiento por `restaurante_id` resuelto desde el usuario autenticado.
- Menú con categorías, platos, variantes, extras, ingredientes retirables, instrucciones y disponibilidad; ADMIN puede crear categorías y platos por API; ADMIN/CAJA registra ajustes de disponibilidad idempotentes.
- Pausa de recepción, zonas/tarifas y horarios en el panel; ADMIN modifica configuración.
- Pedidos sintéticos con filtros, búsqueda y paginación; ADMIN/CAJA avanzan y retroceden con motivo; COCINA avanza a preparando/listo, deshace su último cambio y no ve montos.
- Consulta de pagos y toma/liberación de derivaciones humanas; un pago no se confirma automáticamente.

Los contratos, permisos, entradas, salidas y errores están en [docs/contratos-api.md](docs/contratos-api.md). Arquitectura y organización paralela: [docs/arquitectura.md](docs/arquitectura.md).

## Desarrollo guiado por especificaciones

El proyecto mantiene especificaciones junto al código: [frontend/sdd/](frontend/sdd/) y [backend/sdd/](backend/sdd/). Antes de cambiar una funcionalidad, consultar su `index.md` y actualizar el documento de módulo, el índice y `AGENTS.md` en la misma tarea o commit. La regla completa está en `AGENTS.md`.

## Deliberadamente pendiente

No se habilitaron creación/transición de pedidos, reserva de disponibilidad ni confirmación manual de pagos: dependen de la validación de [ADR-001](docs/adr-001-reservas-pagos.md). Tampoco se implementaron RAG, agente ni adaptador WhatsApp en esta etapa.

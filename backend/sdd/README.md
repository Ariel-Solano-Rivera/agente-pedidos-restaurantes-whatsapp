# SDD del backend

Esta carpeta especifica los módulos que exponen la API administrativa y su relación con seguridad, aislamiento y persistencia. No sustituye `AGENTS.md`, `docs/contratos-api.md`, el modelo conceptual ni ADR-001.

## Regla obligatoria

Cada cambio que agregue, modifique o elimine endpoint, regla, rol, validación, tabla, migración, evento de auditoría o comportamiento de un módulo requiere actualizar el registro correspondiente y `index.md` en la misma tarea o commit. Si altera el contrato usado por el panel, actualizar el SDD de frontend y `docs/contratos-api.md` de forma sincronizada.

## Lectura inicial

1. Leer `index.md`, `AGENTS.md` y el módulo afectado.
2. Confirmar actor, entrada, salida, aislamiento por restaurante, estado afectado y prueba necesaria.
3. Marcar como `TBD` una decisión de dominio pendiente; no activar un flujo sensible sin ADR aprobada.

Usar `template.md` para módulos o funcionalidades nuevas.

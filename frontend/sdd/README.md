# SDD del frontend

Esta carpeta describe el comportamiento que implementa `frontend/src/`. No reemplaza las reglas de `AGENTS.md` ni los contratos de `docs/contratos-api.md`.

## Regla obligatoria

Si una pantalla, estado, componente compartido, permiso, consumo de API o flujo se agrega, cambia o elimina, actualizar su archivo SDD y `index.md` en la misma tarea o commit. Si el cambio altera un contrato, actualizar también la documentación de contrato y el SDD correspondiente del backend.

## Lectura inicial

1. Leer `index.md` y el documento de la pantalla afectada.
2. Confirmar actor, API, estados visibles, validaciones y límites de alcance.
3. Implementar y verificar el flujo; después sincronizar este SDD con el código final.

Usar `template.md` para una pantalla o componente nuevo.

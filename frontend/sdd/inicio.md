# Inicio y resumen compartido

## Propósito y alcance

Muestra a cualquier usuario autenticado un resumen de su restaurante: identidad visual de la tesis, fecha, estado de recepción, plato más vendido y tareas programadas compartidas. No crea ni modifica tareas en este incremento.

## Fuente y dependencias

- Código: `src/components/AppShell.tsx`, `src/features/inicio/HomePage.tsx`, `src/shared/api.ts` y `src/styles.css`.
- API: `GET /dashboard`.
- Roles: ADMIN, CAJA y COCINA.

## Comportamiento visible

- El shell cambia entre Inicio, Menú y Pedidos sin recalcular datos de negocio en el cliente.
- Inicio muestra carga, error y estado vacío de tareas; el backend decide el restaurante y entrega el plato más vendido.
- El logo es el activo común `public/tesis-logo.png` para la demostración de tesis, no un logo configurable de cada restaurante.
- Inicio usa una superficie con bordes visibles para separar encabezado, resumen y tareas. Solo al montar Inicio aplica una entrada de 220 ms por opacidad y desplazamiento vertical breve; no hay movimiento ligado al scroll.

## Validaciones y errores

- No acepta `restaurante_id` desde la URL ni el cuerpo.
- Si la consulta falla, muestra el error de API sin ocultar la navegación ni abrir diálogos nativos.

## Pruebas

- `npm run build` dentro de Docker.
- Consulta autenticada de `/api/v1/dashboard` con ADMIN, CAJA y COCINA; comprobar que Sierra Verde no recibe los datos de Mar Azul.
- Revisión visual en escritorio, tableta y móvil.
- `prefers-reduced-motion` conserva una transición de opacidad sin desplazamiento.

## TBD / exclusiones

- Alta, asignación, edición y completado de tareas; configuración de logotipo por restaurante; indicadores financieros y alertas de pedidos.

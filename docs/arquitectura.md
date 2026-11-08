# Arquitectura del incremento administrativo

El sistema es un monolito modular con React/Vite como panel y Spring WebFlux/R2DBC como API. PostgreSQL es la única fuente transaccional. La autenticación resuelve el `restaurante_id` y el rol desde el usuario; ningún endpoint recibe ese identificador desde el cliente.

## Módulos

| Módulo | Responsabilidad actual | Límite |
|---|---|---|
| `administracion` | identidad, roles, configuración del restaurante, horarios, zonas, pausa y resumen compartido | obtiene el plato más vendido mediante el contrato interno de `pedidos-disponibilidad`, no consulta `order_unit` directamente |
| `menu-rag` | categorías, platos, variantes y opciones configurables | RAG queda como contrato futuro, sin índice ni modelo |
| `pedidos-disponibilidad` | disponibilidad y movimientos; lectura y transición manual idempotente de pedidos sintéticos | creación, reserva y vencimiento de pedidos quedan pendientes de ADR-001 |
| `pagos-notificaciones` | lectura de pagos sintéticos | confirmación manual pendiente de ADR-001 |
| `intervencion-humana` | lectura, toma y liberación de conversaciones derivadas | no llama a agente |
| `whatsapp` y `conversacion-agente` | contratos reservados para la siguiente etapa | sin adaptador, webhook ni LLM |

Los paquetes son límites de módulo y los controladores son adaptadores HTTP del primer incremento. Las consultas R2DBC siempre incluyen el restaurante autenticado. Las transiciones manuales de pedidos sintéticos están trazadas e idempotentes; el siguiente incremento extraerá los casos de uso complejos a servicios de dominio antes de habilitar creación, reservas y vencimientos. Flyway usa JDBC únicamente durante el arranque para aplicar migraciones; las rutas WebFlux no usan JDBC ni `block()`.

## Aislamiento

Las tablas dependientes incluyen `restaurante_id`. Cada consulta y actualización filtra por ese valor. Las claves únicas y foráneas compuestas refuerzan que una variante, plato, movimiento, pedido o conversación pertenezcan al mismo restaurante. Los datos semilla contienen dos restaurantes ficticios.

## Integraciones reservadas

`whatsapp`, `conversacion-agente` y RAG se conectarán mediante contratos internos documentados. No se implementan en esta etapa. El adaptador futuro debe deduplicar el identificador externo, validar firma y usar `correlation_id`.

# Tesis: agente conversacional para pedidos personalizados en restaurantes

## Fuente de verdad y propósito

El alcance funcional y técnico se rige por `Informe/tesis.tex`. Se desarrolla un **MVP para restaurantes locales** que reciben pedidos por **WhatsApp Business**, para retiro o entrega. La plataforma integra un agente conversacional con RAG y un panel administrativo para gestionar menú, disponibilidad, pedidos y conversaciones atendidas por personas.

Si una propuesta de implementación contradice el informe o este archivo, debe documentarse como `TBD` y validarse antes de implementarla.

`Informe/Entrevista_restaurante_A.pdf` aporta un caso de operación para priorizar historias y construir escenarios ficticios. Sus respuestas no sustituyen al informe ni deben convertirse automáticamente en reglas para todos los restaurantes.

## Skills locales de diseño

Las skills de esta tesis viven exclusivamente en `.agents/skills/`: `animate` (animación de interfaz), `impeccable` (jerarquía y layout), `taste-skill` (referencias y dirección visual) y `sdd-restaurant-tesis` (mantenimiento SDD). Úsalas cuando la tarea corresponda; no se consideran configuración global ni se trasladan a otros proyectos. **TBD:** `animate`, `impeccable` y `taste-skill` no están en el repositorio; ¿se agregan o se retira su mención?

## SDD obligatorio y mantenimiento sincronizado

El proyecto usa Specification-Driven Development (SDD) junto al código. La estructura vigente es:

```text
frontend/sdd/
  index.md, template.md, sistema-de-diseno.md, app-shell-auth.md, inicio.md, dashboard.md,
  catalogo.md, operacion.md, menu.md, pedidos.md, pagos-derivaciones.md
backend/sdd/
  index.md, template.md, plataforma.md, seguridad-tenancy.md, menu.md, catalogo.md,
  operacion.md, pedidos.md, pagos.md, intervencion-humana.md, resumen-negocio.md,
  persistencia.md
```

- Las tareas T4 y T5 crean además `crm.md` y `marca.md` en `frontend/sdd/` y en `backend/sdd/`, con `template.md` y su fila en el índice.
- Antes de cambiar una función o componente cubierto, leer el `index.md` y el registro SDD de su módulo. Si no existe, crearlo con `template.md` en la misma tarea.
- **Regla obligatoria:** cada adición, modificación o eliminación de UI, endpoint, contrato, permiso, regla, estado, migración o comportamiento cubierto exige actualizar los archivos SDD correspondientes y este `AGENTS.md` en el mismo commit o tarea. No se permite diferir esa sincronización.
- Para mantener este archivo compacto, actualizar la línea `Última sincronización SDD` con el alcance real del cambio; actualizar además el índice y el documento de módulo, no solo la fecha.
- Si el cambio cruza frontend y backend, actualizar ambos SDD y `docs/contratos-api.md` cuando varíen entradas, salidas, errores o permisos. Mantener `TBD` con una pregunta concreta en vez de inventar una decisión.
- El SDD describe la implementación verificada: propósito, fuente, actores, contratos/estados visibles, validaciones, efectos de datos, dependencias, pruebas y exclusiones. No duplica el informe ni contradice sus reglas.

**Última sincronización SDD:** 2026-11-09 — Rediseño del frontend, etapa 1: estructura general (menú lateral por grupos, barra compacta en tableta, menú de pantalla completa en móvil, preferencia de tema Claro/Oscuro/Sistema implementada, aviso de marca sin AA desde `contrast` del backend, `index.html` con `viewport` y `lang`, páginas antiguas en zona clara), Inicio como resumen breve por rol (`frontend/sdd/inicio.md`) y Dashboard de ADMIN como página propia (`frontend/sdd/dashboard.md`), sin cambios de API ni permisos. Etapa 0 (rama `feature/rediseno-frontend`): sistema de diseño en `frontend/sdd/sistema-de-diseno.md` con Geist y Geist Mono autoalojadas (OFL), tokens claro y oscuro derivados de la marca (sin AA según el backend, la acción usa el color por defecto), preferencia de tema Claro/Oscuro/Sistema por persona (Oscuro por defecto en COCINA; se implementa en la etapa 1), estados de pedido y pago con color, icono y texto, componentes `ds-*` y guía viva `muestra-sistema.html`; proxy `/api` de Vite para desarrollo. Sin cambios de API, permisos ni reglas; ninguna página adoptada aún. Antes, 2026-11-08 — T1 (pedidos: filtros, búsqueda y paginación en backend, `allowedTransitions` por rol, retroceso con motivo, deshacer de cocina, historial con rol y tipo de cambio, COCINA sin montos; V10) y T2 (menú: `available` por plato calculado en backend, `availability.tracked` en V11, búsqueda y filtros de categoría, disponibilidad y visibilidad en el cliente) implementados con pruebas JUnit/Testcontainers. T3 (Inicio: dashboard de ADMIN con rango hoy/7/30 días, comparación, indicadores definidos en `backend/sdd/resumen-negocio.md` y servicios de lectura por módulo; CAJA ve cobrado y por cobrar de hoy; COCINA sin montos). T4 (CRM: `customer`, `conversation_message` y CHECK de estados en V12; pestañas, búsqueda, hilo, respuesta STAFF idempotente con control y sin WhatsApp, ficha del cliente; tomar/liberar con regla de dueño, transacción y auditoría). T5 (marca: `restaurant_branding` en V13, colores con contraste WCAG AA contra blanco calculado en backend, logo validado por contenido y guardado por R2DBC, auditoría; panel con Configuración → Marca y tema por variables CSS). Reserva y pago siguen TBD (ADR-001).

## Etapa actual y entregables

- **Etapa actual: plataforma web y su backend.** Construir primero los contratos, la persistencia, las reglas de negocio y el panel. Usar pedidos y conversaciones sintéticos para probar las pantallas hasta que se integre WhatsApp.
- Mantener en el diseño los límites para integrar después WhatsApp, agente y RAG; no implementar todavía esos adaptadores, el modelo ni el índice de recuperación.
- El panel inicial administra pedidos existentes de prueba; no incluye captura manual de pedidos ni un sistema de punto de venta. Las ventas presenciales solo ajustan disponibilidad desde el panel.
- **Incremento en curso (T1–T5):** pedidos con avanzar, retroceder, deshacer, filtros y búsqueda; filtros de menú; dashboard de ADMIN; CRM de conversaciones y clientes; y marca del restaurante. Se trabaja una rama por tarea, cada una a partir de la anterior, y cada tarea sincroniza SDD, índices y este archivo.
- El orden de trabajo de esta etapa prioriza completar las pantallas de pedidos antes de integrar el agente. **TBD — cronograma académico:** ¿debe actualizarse la tabla de sprints de `Informe/tesis.tex`, que ubica RAG antes del flujo de pedidos? No modificar el informe sin acordarlo.

## Alcance obligatorio del MVP

- Solo se implementa el canal **WhatsApp Business**; otros canales quedan fuera del MVP.
- El agente consulta el menú con RAG, incluso ante expresiones imprecisas sobre platos o ingredientes.
- El backend es la fuente de verdad para precio vigente, disponibilidad y personalizaciones permitidas. El LLM nunca cambia esos datos directamente.
- El carrito y el pedido conservan la configuración **por unidad**: variante, extras e ingredientes retirados permitidos.
- Antes de crear la solicitud para el restaurante, el cliente recibe resumen, total y solicita confirmación.
- El restaurante acepta o rechaza la solicitud; luego puede preparar, marcar listo y completar. Se deben manejar cancelación y vencimiento.
- El pago mantiene un estado independiente del pedido. El personal del restaurante es el único que puede confirmarlo manualmente; recibir un comprobante no equivale a pago confirmado.
- El panel administra menú, opciones, disponibilidad, horarios o condiciones de retiro/entrega, pedidos, pagos, pausa de recepción y conversaciones derivadas.
- Ante ambigüedad, opción no configurada o mención de alergias, se deriva a una persona. Mientras una persona controla una conversación, el agente permanece suspendido y conserva el contexto.
- Desarrollo, pruebas y sesiones de evaluación usan exclusivamente datos sintéticos o ficticios.

## Exclusiones explícitas

- Atención en mesa, reservas de mesas, división de cuentas y gestión de repartidores.
- Recetas, materias primas, compras, desperdicios o inventario de ingredientes.
- Pasarelas o verificación automática de pagos.
- Garantías sobre alérgenos: cualquier mención de alergia se deriva al personal.
- Notas de voz, repetir automáticamente el pedido anterior, descuentos por chat y búsqueda basada en videos no configurados en el menú.
- Cálculo de ganancia: el sistema no guarda costos, recetas ni compras; el dashboard muestra ingresos, cobros y ventas no concretadas. Un costo opcional por plato queda `TBD` para una etapa posterior.

## Arquitectura y límites

- Panel con React, TypeScript y Vite; backend con Java 21, Spring Boot y WebFlux; PostgreSQL con acceso no bloqueante mediante R2DBC o equivalente.
- Docker Compose debe levantar frontend, backend y PostgreSQL para desarrollo y demostración, con datos persistentes en un volumen y configuración mediante variables de entorno. Mantener una guía de arranque y no guardar secretos en el repositorio.
- Desplegar un **monolito modular reactivo**. No incorporar microservicios, Kafka, mensajería distribuida ni consistencia distribuida en este MVP.
- Módulos: `whatsapp`, `conversacion-agente`, `menu-rag`, `pedidos-disponibilidad`, `pagos-notificaciones`, `administracion` e `intervencion-humana`.
- Cada módulo expone contratos internos claros y oculta su persistencia e implementación. Ningún módulo accede directamente a las tablas internas de otro.
- Los adaptadores de WhatsApp, IA, RAG, persistencia y servicios externos traducen protocolos: las reglas de negocio pertenecen a los módulos de dominio.
- No usar `block()`, JDBC síncrono ni I/O bloqueante dentro de flujos WebFlux.
- Todo dato, conversación e índice RAG se asocia a `restaurante_id`; una consulta nunca puede recuperar ni modificar información de otro restaurante.

## Panel web: funciones y permisos

- Diseñar para computadora o tableta en caja y cocina, y para móvil del administrador. Mostrar claramente cargas, errores de validación, cambios pendientes y confirmaciones de operaciones sensibles.
- Sistema de diseño común (`frontend/sdd/sistema-de-diseno.md`): el estado nunca se indica solo con color (color, icono y texto), contraste mínimo de 4.5:1, foco visible, objetivos táctiles de 44 px (56 px en Cocina), animaciones de 300 ms como máximo que respetan `prefers-reduced-motion`. Tema claro como base y preferencia Claro/Oscuro/Sistema por persona, con Oscuro por defecto en COCINA.
- `ADMIN`: configura usuarios, menú, horarios, zonas, tarifas, recepción de pedidos y disponibilidad; consulta pedidos, pagos y conversaciones derivadas; avanza pedidos y puede retroceder un paso con motivo obligatorio; ve el dashboard completo, usa el CRM y configura la marca del restaurante.
- `CAJA`: consulta menú y configuración; ajusta disponibilidad por ventas locales o agotados; acepta o rechaza solicitudes; actualiza estados permitidos; registra y confirma pagos manualmente; atiende derivaciones; puede retroceder un paso un pedido con motivo obligatorio; usa el CRM y ve el cobrado y por cobrar del día.
- `COCINA`: consulta pedidos aceptados y sus modificaciones **por unidad**. Solo puede pasar un pedido de aceptado a preparando y de preparando a listo, con un toque y sin motivo, y puede **deshacer** su propio último cambio dentro de una ventana corta configurable. No retrocede estados, no acepta, rechaza, completa ni cancela, no cambia precios, disponibilidad ni pagos, y no ve montos.
- Menú: gestionar categorías, platos, descripciones, ingredientes informativos, variantes, extras con recargo e ingredientes retirables. Permitir instrucciones de preparación únicamente cuando el plato las tenga configuradas; las solicitudes fuera de configuración pasan a una persona. Incluir búsqueda por nombre, descripción o ingrediente y filtros por categoría, disponibilidad y visibilidad; el backend indica si cada plato está disponible.
- Operación diaria: mostrar disponibilidad por plato o porción, marcar agotado y registrar ajustes por ventas presenciales con motivo y autor. Administrar horarios y cierres excepcionales; permitir pausar o reanudar la recepción de nuevas solicitudes.
- Retiro y entrega: configurar zonas habilitadas y tarifa por zona. El personal asigna la zona según la dirección indicada; no inferir ubicación con geolocalización. Para retiro, conservar nombre y hora acordada; para entrega, nombre, teléfono, dirección y referencia cuando se necesite.
- Pedidos: lista con el número de pedido destacado, filtrable por estado, modalidad, estado de pago y rango de fechas (zona horaria del restaurante), con búsqueda por número, nombre o teléfono del cliente y paginación en el backend; y detalle con unidades separadas, variantes, extras, ingredientes retirados, subtotal, tarifa de entrega, total, modalidad y hora estimada. Mostrar quién confirmó el cliente y si el restaurante aceptó o rechazó. Permitir transiciones, retrocesos, deshacer y cancelaciones solo si el backend las autoriza: el backend devuelve las transiciones permitidas según el rol y el frontend solo muestra esas. Cada retroceso o deshacer registra usuario, rol, fecha, estado anterior y nuevo, motivo si existe y `correlation_id`. **TBD:** ¿número correlativo por restaurante (#0001) en lugar de `PED-XXXXXXXX`?
- Pagos: mostrar medio, importe, comprobante o referencia cuando exista, estado y persona que lo verificó. Recibir una imagen o declaración de pago nunca cambia por sí sola el estado a confirmado.
- Derivaciones: lista de conversaciones que requieren atención, motivo, contexto, responsable y control humano. Mientras el personal tenga el control, el agente no responde. Tomar el control solo es posible si la derivación está abierta o ya es de quien la toma; tomar y liberar quedan en la auditoría y se ejecutan en una sola transacción.
- Inicio (todos los roles, solo lectura): resumen breve de lo que pide atención según el rol, con endpoints existentes; todos ven además el plato más vendido y las próximas tareas. `ADMIN`: pedidos por aceptar, por cobrar de hoy, conversaciones por contestar, platos agotados, accesos rápidos y una tarjeta que lleva al Dashboard. `CAJA`: por aceptar, cobrado y por cobrar de hoy, y conversaciones por contestar. `COCINA`: por preparar, en preparación y listos, sin montos.
- Dashboard de `ADMIN` (página propia «Dashboard», visible en el menú solo para `ADMIN`; solo lectura): rango de hoy, 7 o 30 días, con comparación frente al período anterior de igual duración. Indicadores: cobrado, por cobrar, ventas completadas (por fecha de completado), ventas no concretadas por causa, ticket promedio, tasa de aceptación, tiempos de decisión y de preparación, pedidos por hora, platos y extras más vendidos, retiro frente a entrega, clientes nuevos y recurrentes, derivaciones sin contestar, platos agotados y retrocesos por rol por día. El backend los calcula con decimal exacto y la zona horaria del restaurante, y sus definiciones viven en `backend/sdd/resumen-negocio.md`. De estos montos, CAJA ve en Inicio solo cobrado y por cobrar del día; COCINA no ve montos.
- CRM (`ADMIN` y `CAJA`): conversaciones con las pestañas "Por contestar" (el último mensaje es del cliente; se calcula, no se guarda), "Con control humano" y "Todas"; búsqueda por nombre o teléfono; hilo de mensajes y ficha del cliente con sus pedidos. Responder como persona exige tener el control, guarda el mensaje como `STAFF` con idempotencia y **no envía nada por WhatsApp** (TBD). Los mensajes se deduplican por identificador externo.
- Marca del restaurante (Configuración, solo `ADMIN`): color principal y secundario (formato hexadecimal) y logo PNG, JPEG o WebP de hasta 2 MB, validado por su contenido real en el servidor y guardado en PostgreSQL mediante R2DBC. El backend calcula los avisos de contraste WCAG AA (4.5:1) y el panel solo los muestra; todo cambio queda auditado. Cada restaurante ve y modifica únicamente su marca.

## Backend y contratos del panel

- Definir un contrato versionado para autenticación, menú, disponibilidad, horarios y zonas, pedidos, pagos y derivaciones. Antes de desarrollar cada flujo, documentar operación, actor autorizado, entrada, salida, validaciones, errores y estados afectados. El frontend debe consumir ese contrato y no recalcular precios ni decidir transiciones.
- Resolver la identidad del restaurante desde el usuario autenticado y validar también el `restaurante_id` de cada recurso solicitado. Una URL o cuerpo manipulado no puede acceder a otro restaurante.
- Aplicar precios con decimal exacto; validar variante, extras e ingredientes retirables por cada unidad antes de calcular el total. Conservar en el pedido una copia del nombre, opciones y precios aplicados para que cambios posteriores del menú no alteren ventas anteriores.
- Registrar ajustes de disponibilidad, reservas, cambios de pedido, confirmaciones de pago y derivaciones con usuario u origen, fecha y `correlation_id`. Las operaciones mutantes sensibles deben ser idempotentes cuando puedan repetirse.
- Ejecutar comprobación y reserva de disponibilidad en una transacción atómica. No permitir saldo negativo ni dos reservas de la misma última unidad. Un rechazo, cancelación o vencimiento libera la reserva exactamente una vez.
- Mantener el estado de pago separado del pedido. La aceptación o preparación no implica pago confirmado; aplicar una política explícita por medio de pago antes de bloquear o permitir una transición.

## Reglas de dominio obligatorias

- La disponibilidad se controla por plato, unidad o porción configurada; nunca por ingredientes.
- La comprobación y reserva de disponibilidad se ejecutan atómicamente. La disponibilidad no puede ser negativa.
- Tras la confirmación del cliente, la reserva se mantiene durante un tiempo configurable mientras el restaurante decide. Se libera al rechazar, cancelar o vencer.
- Las ventas presenciales se reflejan modificando la disponibilidad desde el panel.
- Cuando la recepción de pedidos está pausada, se informa indisponibilidad operativa y no se crean solicitudes nuevas.
- La configuración de cada unidad se valida contra las opciones permitidas del plato antes de calcular o confirmar el total.
- Un mensaje repetido de WhatsApp no puede repetir sus efectos: validar firma, deduplicar por identificador externo y registrar `correlation_id` en los flujos relevantes.

## Estados y operaciones sensibles

- Distinguir el estado del carrito, la confirmación del cliente, la decisión del restaurante, el estado del pedido y el estado del pago.
- Flujo de pedido esperado: borrador/carrito -> confirmado por cliente -> pendiente de decisión del restaurante -> aceptado o rechazado -> preparando -> listo -> completado. También se contemplan cancelado y vencido.
- Definir formalmente los valores persistidos y todas las transiciones permitidas antes de codificar. Los estados exactos de pago y el momento exacto de creación de la reserva son `TBD` hasta validación del diseño.
- Las operaciones que afectan disponibilidad, reserva, total, aceptación, cancelación y pago manual requieren validación en el backend, trazabilidad y pruebas de concurrencia o idempotencia según corresponda.
- Transiciones de pedido (decide solo el backend; valores persistidos en inglés): `PENDING_DECISION` pasa a `ACCEPTED` o `REJECTED`; `ACCEPTED` a `PREPARING` o `CANCELLED`; `PREPARING` a `READY`; `READY` a `COMPLETED`. `COMPLETED`, `REJECTED`, `CANCELLED` y `EXPIRED` no tienen transiciones. Aceptar, rechazar, completar y cancelar corresponden a ADMIN y CAJA.
- Retroceso (ADMIN y CAJA): `PREPARING` a `ACCEPTED` y `READY` a `PREPARING`, con motivo obligatorio elegido de una lista (`ERROR_AL_AVANZAR`, `CLIENTE_CAMBIO_PEDIDO`, `FALTA_PRODUCTO`, `OTRO`); el texto libre es obligatorio solo con `OTRO`. No se retrocede desde `COMPLETED`, `CANCELLED`, `REJECTED` ni `EXPIRED`. Volver de `ACCEPTED` a `PENDING_DECISION` no se permite: **TBD** según ADR-001, porque afecta la reserva.
- COCINA solo avanza `ACCEPTED` a `PREPARING` y `PREPARING` a `READY`, sin motivo. Puede **deshacer** únicamente el último cambio hecho por esa misma persona, sin motivo, dentro de una ventana configurable (2 minutos por defecto) y solo si el pedido sigue en el estado que dejó; pasado ese tiempo lo corrige caja. Retroceder o deshacer no libera ni crea reservas ni cambia el pago. Cada cambio de estado guarda el rol de quien lo hizo y su tipo (`AVANCE`, `RETROCESO` o `DESHACER`). **TBD:** ¿cómo identificar a la persona si cocina comparte una cuenta (PIN por persona)?

## Base de datos y migraciones

- Usar una base PostgreSQL para el prototipo, con `restaurante_id` en toda entidad de negocio dependiente del restaurante (excepto la propia entidad `restaurante`), claves y consultas que impidan referencias entre restaurantes. Incluir al menos dos restaurantes ficticios en pruebas de aislamiento.
- Modelar restaurante (con zona horaria y marca: colores y logo) y usuarios; categorías, platos, variantes, extras y opciones retirables; horarios y zonas; disponibilidad y movimientos; clientes, conversaciones y mensajes; carritos y unidades; pedidos, unidades configuradas e historial; reservas; pagos; derivaciones; auditoría e idempotencia.
- Cada unidad de carrito y pedido tiene su propia configuración. No representar dos unidades distintas mediante una sola fila con cantidad y una única lista de modificaciones.
- La disponibilidad representa platos, unidades o porciones vendibles, no materias primas. Cada ajuste, reserva, liberación y consumo debe poder explicarse desde el historial.
- Crear y versionar migraciones solo después de aprobar el modelo y los estados. Añadir restricciones y claves para cantidades no negativas, unicidad de mensajes externos y relaciones válidas por restaurante. No guardar contraseñas, tokens ni datos de pago sensibles en texto plano.
- `Planificacion/modelo-base-datos.md` debe concordar con este archivo y con el informe; las referencias antiguas a Kafka, outbox y omnicanalidad no forman parte del MVP.

## Contrato del agente con el backend

El modelo interpreta lenguaje, solicita una función estructurada y redacta la respuesta. El backend valida y ejecuta. Como mínimo, los contratos deberán cubrir:

- Buscar o recuperar información de menú por restaurante y consulta; devuelve platos y contexto verificable para responder.
- Consultar detalle de un plato; devuelve precio vigente, disponibilidad y opciones permitidas.
- Crear o recuperar carrito; agregar, cambiar o quitar una unidad configurada; devuelve el carrito recalculado y errores de validación si existen.
- Preparar resumen y solicitar confirmación del cliente; devuelve líneas, modificaciones, total y condiciones de retiro/entrega.
- Confirmar solicitud y aplicar la regla de reserva aprobada; devuelve el pedido creado, su estado y el vencimiento de la reserva cuando corresponda, o un motivo de rechazo.
- Consultar estado de pedido y registrar o solicitar una derivación humana; nunca expone datos de otro restaurante.

Las funciones mutantes exigen `restaurante_id`, identidad de conversación o cliente, un identificador de idempotencia y validación de autorización. Los nombres, esquemas JSON y códigos de error se documentan antes de integrar el agente con el backend.

## RAG y conocimiento del menú

- El conocimiento recuperable se forma con platos, descripciones, ingredientes, categorías, variantes, extras e ingredientes retirables del menú.
- Cada documento, embedding y consulta se filtra por `restaurante_id`.
- Una actualización del menú debe actualizar o invalidar el contenido recuperable correspondiente.
- RAG aporta contexto para responder; no sustituye la consulta transaccional de precio, disponibilidad ni modificaciones permitidas.

## Calidad, documentación y colaboración

- Antes de implementar una historia, registrar objetivo, criterios de aceptación, reglas, datos de prueba y módulo responsable.
- Mantener en `docs/`: requisitos e historias, arquitectura modular, contratos internos/agente, modelo de datos y estados, decisiones de arquitectura (ADR), plan de validación y guía de ejecución.
- Cada cambio debe incluir pruebas pertinentes: unitarias; integración con persistencia y módulos; extremo a extremo con conversaciones; concurrencia para reservas; deduplicación de mensajes; y evaluación de recuperación RAG con consultas de referencia.
- El trabajo se integra mediante ramas cortas y pull requests. No modificar de forma simultánea un contrato compartido sin acordarlo y actualizar su documento en el mismo cambio.
- Cualquier decisión incompleta se marca como `TBD` con la pregunta concreta que debe resolverse.

## Secuencia para dos desarrolladores

1. Registrar historias, criterios de aceptación y escenarios de la entrevista; acordar estados y transiciones, permisos, modelo de datos y contratos API antes de programar operaciones sensibles. Resolver por ADR los `TBD` de pago y reserva.
2. Preparar estructura del monolito y frontend, migraciones, autenticación, datos ficticios y Docker Compose; comprobar que el sistema se levante con una guía reproducible.
3. Trabajar en paralelo por contrato: una persona implementa persistencia, dominio y API; la otra construye la interfaz con datos sintéticos que sigan ese mismo contrato. Integrar en incrementos de menú y opciones, disponibilidad, horarios, zonas y pausa.
4. Completar panel de pedidos, vista de cocina, pagos y derivaciones con escenarios sintéticos. Probar cada flujo contra el backend antes de integrar WhatsApp.
5. Integrar después WhatsApp, agente y RAG según el informe; validar el flujo completo con datos ficticios y sesiones de uso.

Revisar en pareja cada cambio de contrato compartido y actualizar su documento en el mismo pull request. No trabajar simultáneamente sobre la misma definición sin acordar responsable. La entrega de cada historia exige criterios de aceptación cumplidos y pruebas proporcionadas al riesgo: permisos y aislamiento, personalización por unidad, precios, disponibilidad, estados, pago manual e idempotencia. Simular el pico descrito en la entrevista (15 a 20 conversaciones simultáneas) como escenario de carga, sin convertir la cifra de un solo restaurante en garantía general de rendimiento.

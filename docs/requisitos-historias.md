# Historias del incremento administrativo

| ID | Historia | Criterio de aceptación | Estado |
|---|---|---|---|
| HU-01 | Como ADMIN, gestiono categorías, platos y sus opciones permitidas. | No se guardan precios negativos ni opciones de otro restaurante. | Implementar |
| HU-02 | Como CAJA, ajusto disponibilidad por ventas locales o agotados. | Se registra motivo, actor y correlación; no queda saldo negativo ni se duplica un reintento. | Implementar |
| HU-03 | Como personal, consulto pedidos sintéticos con cada unidad separada. | Cocina solo lee; se muestran importes y opciones históricas. | Implementar |
| HU-04 | Como ADMIN, configuro horarios, zonas, tarifa y pausa. | CAJA consulta; solo ADMIN modifica. | Implementar |
| HU-05 | Como CAJA, tomo una derivación humana. | Solo una persona puede controlar una conversación derivada; el historial permanece visible. | Implementado (T4) |
| HU-12 | Como ADMIN, configuro la marca del restaurante. | Colores hexadecimales con aviso de contraste WCAG AA; logo PNG/JPEG/WebP hasta 2 MB validado por contenido; auditado; cada restaurante ve solo su marca. | Implementado (T5) |
| HU-11 | Como ADMIN o CAJA, atiendo conversaciones desde un CRM. | Pestañas por contestar, control humano y todas; búsqueda; hilo; respuesta solo con control, idempotente y sin envío por WhatsApp; ficha del cliente con pedidos; aislado por restaurante. | Implementado (T4) |
| HU-06 | Como personal, registro pagos manuales. | Pendiente de ADR-001; el comprobante no confirma un pago. | TBD |
| HU-07 | Como restaurante, acepto o rechazo una solicitud y avanzo su preparación. | ADMIN/CAJA ejecutan transiciones y retrocesos con motivo; COCINA avanza a preparando/listo y deshace su último cambio en 2 minutos; todo idempotente y auditado con rol y tipo de cambio; la reserva al crear la solicitud sigue pendiente. | Implementado parcialmente (T1) |
| HU-09 | Como personal, filtro y busco pedidos. | Filtros por estado, modalidad, pago y fecha (zona del restaurante), búsqueda por número, nombre o teléfono y paginación en el backend, siempre aislados por restaurante. | Implementado (T1) |
| HU-08 | Como miembro del personal, consulto un inicio compartido del restaurante. | Ve solo datos de su restaurante: nombre, estado de recepción, plato más vendido, tareas y lo que pide atención según su rol (ADMIN: por aceptar, por cobrar, por contestar y platos agotados; CAJA: por aceptar, cobrado, por cobrar y por contestar; COCINA: por preparar, en preparación y listos, sin montos); no puede modificar tareas. | Implementado (rediseño, etapa 1) |
| HU-10 | Como ADMIN, consulto indicadores del negocio por período en la página Dashboard. | Hoy, 7 o 30 días con comparación frente al período anterior; definiciones verificables en el SDD; aislado por restaurante; sin ganancia. | Implementado (T3) |

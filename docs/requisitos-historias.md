# Historias del incremento administrativo

| ID | Historia | Criterio de aceptación | Estado |
|---|---|---|---|
| HU-01 | Como ADMIN, gestiono categorías, platos y sus opciones permitidas. | No se guardan precios negativos ni opciones de otro restaurante. | Implementar |
| HU-02 | Como CAJA, ajusto disponibilidad por ventas locales o agotados. | Se registra motivo, actor y correlación; no queda saldo negativo ni se duplica un reintento. | Implementar |
| HU-03 | Como personal, consulto pedidos sintéticos con cada unidad separada. | Cocina solo lee; se muestran importes y opciones históricas. | Implementar |
| HU-04 | Como ADMIN, configuro horarios, zonas, tarifa y pausa. | CAJA consulta; solo ADMIN modifica. | Implementar |
| HU-05 | Como CAJA, tomo una derivación humana. | Solo una persona puede controlar una conversación derivada; el historial permanece visible. | Implementar |
| HU-06 | Como personal, registro pagos manuales. | Pendiente de ADR-001; el comprobante no confirma un pago. | TBD |
| HU-07 | Como restaurante, acepto o rechazo una solicitud y avanzo su preparación. | ADMIN/CAJA ejecutan transiciones y retrocesos con motivo; COCINA avanza a preparando/listo y deshace su último cambio en 2 minutos; todo idempotente y auditado con rol y tipo de cambio; la reserva al crear la solicitud sigue pendiente. | Implementado parcialmente (T1) |
| HU-09 | Como personal, filtro y busco pedidos. | Filtros por estado, modalidad, pago y fecha (zona del restaurante), búsqueda por número, nombre o teléfono y paginación en el backend, siempre aislados por restaurante. | Implementado (T1) |
| HU-08 | Como miembro del personal, consulto un inicio compartido del restaurante. | Ve solo el nombre, estado, plato más vendido y tareas de su restaurante; no puede modificar tareas en este incremento. | Implementado |

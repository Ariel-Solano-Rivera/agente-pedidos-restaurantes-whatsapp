import { statusLabel } from '../../design/StatusBadge';

/** Contrato de `GET /orders`, `GET /orders/facets` y `allowedTransitions` (docs/contratos-api.md). */
export type Transition = { targetStatus: string; direction: 'FORWARD' | 'BACKWARD'; requiresReason: boolean; destructive: boolean };
export type OrderSummary = { id: string; publicCode: string; status: string; paymentStatus: string | null; fulfillmentType: 'PICKUP' | 'DELIVERY'; customerName: string; phone: string; items: string; total: number | null; createdAt: string; allowedTransitions: Transition[] };
export type OrderPage = { items: OrderSummary[]; page: number; size: number; total: number };
export type Facets = { status: Record<string, number>; fulfillment: Record<string, number>; paymentStatus: Record<string, number>; range: Record<string, number> };
type OrderOption = { type: 'EXTRA' | 'REMOVED_INGREDIENT' | 'INSTRUCTION'; name: string; amount: number | null };
export type OrderUnit = { id: string; dish: string; variant: string; quantity: number; unitPrice: number | null; extrasTotal: number | null; lineTotal: number | null; options: OrderOption[] };
export type HistoryEntry = { previousStatus: string; newStatus: string; changeType: 'AVANCE' | 'RETROCESO' | 'DESHACER'; reasonCode: string | null; reason: string; actorEmail: string | null; actorRole: string; createdAt: string };
/** `GET /orders/{id}`: importes y pago llegan `null` para COCINA. */
export type OrderDetail = {
  id: string; publicCode: string; status: string; paymentStatus: string | null; fulfillmentType: 'PICKUP' | 'DELIVERY'; customerName: string; phone: string; total: number | null; createdAt: string;
  deliveryAddress: string; deliveryReference: string; deliveryZone: string; pickupTime: string | null; subtotal: number | null; deliveryFee: number | null; customerConfirmedAt: string;
  restaurantDecisionBy: string | null; units: OrderUnit[]; allowedTransitions: Transition[]; undo: { targetStatus: string; expiresAt: string } | null; history: HistoryEntry[];
};
/** `GET /payments?orderId=` (ADMIN, CAJA). */
export type Payment = { id: string; method: string; amount: number; status: string; reference: string | null; verifiedBy: string | null; verifiedAt: string | null };
/** Lo mínimo que necesita la confirmación de una transición. */
export type OrderRef = { id: string; publicCode: string; status: string; customerName: string };

export const reasonLabels: Record<string, string> = { ERROR_AL_AVANZAR: 'Se avanzó por error', CLIENTE_CAMBIO_PEDIDO: 'El cliente cambió el pedido', FALTA_PRODUCTO: 'Falta un producto', OTRO: 'Otro motivo' };
export const roleLabels: Record<string, string> = { ADMIN: 'Administración', CAJA: 'Caja', COCINA: 'Cocina', SYSTEM: 'Sistema' };
export const methodLabels: Record<string, string> = { CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta' };

export type Filters = { status: string; fulfillment: string; paymentStatus: string; range: string; from: string; to: string; q: string };
export const emptyFilters: Filters = { status: '', fulfillment: '', paymentStatus: '', range: '', from: '', to: '', q: '' };

/** Texto del botón según la transición que devuelve el backend; el panel no decide cuáles existen. */
export function actionLabel(from: string, transition: Transition) {
  const target = transition.targetStatus;
  if (target === 'ACCEPTED' && from === 'PENDING_DECISION') return 'Aceptar';
  if (target === 'REJECTED') return 'Rechazar';
  if (target === 'CANCELLED') return 'Cancelar pedido';
  if (target === 'COMPLETED') return 'Marcar completado';
  return `${transition.direction === 'BACKWARD' ? 'Volver a' : 'Pasar a'} ${statusLabel(target)}`;
}

export const money = (value: number | null | undefined) => value == null ? '' : new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
/** «hace 6 min», «hace 3 h» o la fecha corta si pasó más de un día. */
export function since(value: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return relative.format(-minutes, 'minute');
  if (minutes < 24 * 60) return relative.format(-Math.round(minutes / 60), 'hour');
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short' }).format(new Date(value));
}
export const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '';
export const clock = (value: string) => new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const shortDate = (value: string) => new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));

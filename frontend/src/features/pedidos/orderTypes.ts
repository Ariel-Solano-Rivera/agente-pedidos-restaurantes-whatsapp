import { statusLabel } from '../../design/StatusBadge';

/** Contrato de `GET /orders`, `GET /orders/facets` y `allowedTransitions` (docs/contratos-api.md). */
export type Transition = { targetStatus: string; direction: 'FORWARD' | 'BACKWARD'; requiresReason: boolean; destructive: boolean };
export type OrderSummary = { id: string; publicCode: string; status: string; paymentStatus: string | null; fulfillmentType: 'PICKUP' | 'DELIVERY'; customerName: string; phone: string; items: string; total: number | null; createdAt: string; allowedTransitions: Transition[] };
export type OrderPage = { items: OrderSummary[]; page: number; size: number; total: number };
export type Facets = { status: Record<string, number>; fulfillment: Record<string, number>; paymentStatus: Record<string, number>; range: Record<string, number> };
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
export const clock = (value: string) => new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const shortDate = (value: string) => new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));

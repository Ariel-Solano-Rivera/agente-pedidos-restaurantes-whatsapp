import { Icon, IconName } from './Icon';

/** Estados de pedido y de pago: color, icono y texto a la vez (ver frontend/sdd/sistema-de-diseno.md). */
export const orderStatuses: Record<string, { label: string; icon: IconName }> = {
  PENDING_DECISION: { label: 'Por aceptar', icon: 'clock' },
  ACCEPTED: { label: 'Aceptado', icon: 'check' },
  PREPARING: { label: 'En preparación', icon: 'flame' },
  READY: { label: 'Listo', icon: 'bell' },
  COMPLETED: { label: 'Completado', icon: 'checkDouble' },
  REJECTED: { label: 'Rechazado', icon: 'xCircle' },
  CANCELLED: { label: 'Cancelado', icon: 'ban' },
  EXPIRED: { label: 'Vencido', icon: 'hourglass' },
};

export const paymentStatuses: Record<string, { label: string; icon: IconName }> = {
  PENDING: { label: 'Pendiente', icon: 'dashedCircle' },
  PENDING_VERIFICATION: { label: 'Por verificar', icon: 'receipt' },
  CONFIRMED: { label: 'Confirmado', icon: 'checkCircle' },
  REJECTED: { label: 'Rechazado', icon: 'xCircle' },
  NOT_REQUIRED: { label: 'No requerido', icon: 'minusCircle' },
};

export const statusLabel = (status?: string | null) => (status && orderStatuses[status]?.label) || status || 'Sin estado';
export const paymentLabel = (status?: string | null) => (status && paymentStatuses[status]?.label) || status || 'Sin pago';

export function StatusBadge({ status }: { status: string }) {
  const meta = orderStatuses[status] ?? { label: status, icon: 'alert' as IconName };
  return <span className="ds-badge" data-status={status}><Icon name={meta.icon} size={14} />{meta.label}</span>;
}

export function PaymentBadge({ status }: { status: string }) {
  const meta = paymentStatuses[status] ?? { label: status, icon: 'alert' as IconName };
  return <span className="ds-badge" data-payment={status}><Icon name={meta.icon} size={14} />Pago {meta.label.toLowerCase()}</span>;
}

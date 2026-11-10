import { useEffect, useRef } from 'react';
import { statusLabel, paymentLabel } from '../../design/StatusBadge';
import { Transition } from './orderTypes';

/**
 * Detalle del pedido con el diseño de T1 (comanda e historial). Se muestra en una zona de tema claro
 * hasta su rediseño en la etapa 3 (ver frontend/sdd/pedidos.md).
 */
type OrderOption = { type: 'EXTRA' | 'REMOVED_INGREDIENT' | 'INSTRUCTION'; name: string; amount: number | null };
type OrderUnit = { id: string; dish: string; variant: string; quantity: number; lineTotal: number | null; options: OrderOption[] };
type HistoryEntry = { previousStatus: string; newStatus: string; changeType: 'AVANCE' | 'RETROCESO' | 'DESHACER'; reasonCode: string | null; reason: string; actorEmail: string | null; actorRole: string; createdAt: string };
export type OrderDetail = {
  id: string; publicCode: string; status: string; paymentStatus: string | null; fulfillmentType: 'PICKUP' | 'DELIVERY'; customerName: string; phone: string; total: number | null; createdAt: string;
  deliveryAddress: string; deliveryReference: string; deliveryZone: string; pickupTime: string; subtotal: number | null; deliveryFee: number | null; customerConfirmedAt: string;
  restaurantDecisionBy: string | null; units: OrderUnit[]; allowedTransitions: Transition[]; undo: { targetStatus: string; expiresAt: string } | null; history: HistoryEntry[];
};

export const reasonLabels: Record<string, string> = { ERROR_AL_AVANZAR: 'Se avanzó por error', CLIENTE_CAMBIO_PEDIDO: 'El cliente cambió el pedido', FALTA_PRODUCTO: 'Falta un producto', OTRO: 'Otro motivo' };
const changeLabels: Record<string, string> = { AVANCE: 'Avance', RETROCESO: 'Retroceso', DESHACER: 'Deshacer' };
const money = (value: number | null) => value === null ? '' : new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No registrado';

function UnitLines({ units }: { units: OrderUnit[] }) {
  return <>{units.map(unit => {
    const of = (type: OrderOption['type']) => unit.options.filter(option => option.type === type);
    return <article key={unit.id} className="order-card-unit"><div className="order-card-unit-heading"><div><strong>{unit.quantity}× {unit.dish}</strong><span>{unit.variant}</span></div>{unit.lineTotal !== null && <b>{money(unit.lineTotal)}</b>}</div>
      {of('EXTRA').length > 0 && <p><span>Extras:</span> {of('EXTRA').map(option => `${option.name}${option.amount ? ` (+${money(option.amount)})` : ''}`).join(' · ')}</p>}
      {of('REMOVED_INGREDIENT').length > 0 && <p><span>Sin:</span> {of('REMOVED_INGREDIENT').map(option => option.name).join(' · ')}</p>}
      {of('INSTRUCTION').length > 0 && <p><span>Preparación:</span> {of('INSTRUCTION').map(option => option.name).join(' · ')}</p>}</article>;
  })}</>;
}

function History({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return <p className="empty-state">Sin cambios de estado registrados.</p>;
  return <ol className="order-history">{entries.map((entry, index) => <li key={index} className={`history-${entry.changeType.toLowerCase()}`}>
    <div><span className={`history-badge ${entry.changeType.toLowerCase()}`}>{changeLabels[entry.changeType]}</span><strong>{statusLabel(entry.previousStatus)} → {statusLabel(entry.newStatus)}</strong></div>
    <small>{dateTime(entry.createdAt)} · {entry.actorEmail || 'Usuario'} ({entry.actorRole})</small>
    {(entry.reasonCode || entry.reason) && <small>Motivo: {[entry.reasonCode ? reasonLabels[entry.reasonCode] : '', entry.reason].filter(Boolean).join(' — ')}</small>}
  </li>)}</ol>;
}

function OrderTicket({ order }: { order: OrderDetail }) {
  const delivery = order.fulfillmentType === 'DELIVERY';
  return <div className="order-ticket">
    <section className="ticket-customer"><h3>Cliente</h3><strong>{order.customerName}</strong><span>{order.phone || 'Teléfono no registrado'}</span>
      {delivery ? <span>Envío: {order.deliveryAddress || 'Dirección por confirmar'}{order.deliveryReference ? ` · ${order.deliveryReference}` : ''}{order.deliveryZone ? ` · Zona ${order.deliveryZone}` : ''}</span> : <span>Retiro: {dateTime(order.pickupTime)}</span>}</section>
    <section className="ticket-units"><h3>Pedido</h3><UnitLines units={order.units} /></section>
    {order.total !== null && <section className="ticket-summary"><dl><div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>{delivery && <div><dt>Envío</dt><dd>{money(order.deliveryFee)}</dd></div>}<div className="ticket-total"><dt>Total</dt><dd>{money(order.total)}</dd></div></dl></section>}
    <section className="ticket-meta"><span>Cliente confirmó: {dateTime(order.customerConfirmedAt)}</span><span>Decisión del restaurante: {order.restaurantDecisionBy || 'Pendiente'}</span>{order.paymentStatus && <span>Pago: {paymentLabel(order.paymentStatus)}</span>}<span>Recibido: {dateTime(order.createdAt)}</span></section>
    <section><h3>Historial de estados</h3><History entries={order.history} /></section>
  </div>;
}

export function LegacyOrderDetailDialog({ order, onClose }: { order?: OrderDetail; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (order && !ref.current?.open) ref.current?.showModal(); if (!order) ref.current?.close(); }, [order]);
  return <div className="legacy-page" data-theme="light">
    <dialog className="menu-dialog order-dialog" ref={ref} onClose={onClose} aria-labelledby="order-viewer-title">{order && <>
      <div className="dialog-header"><h2 id="order-viewer-title"><span className="order-code">{order.publicCode}</span> · {statusLabel(order.status)}</h2><button type="button" className="dialog-close" onClick={() => ref.current?.close()}>Cerrar</button></div>
      <OrderTicket order={order} />
    </>}</dialog>
  </div>;
}

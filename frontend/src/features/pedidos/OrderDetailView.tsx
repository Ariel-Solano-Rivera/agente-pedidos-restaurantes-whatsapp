import { useCallback, useEffect, useState } from 'react';
import { Icon, IconName } from '../../design/Icon';
import { EmptyState, Skeleton } from '../../design/States';
import { orderStatuses, PaymentBadge, StatusBadge, statusLabel } from '../../design/StatusBadge';
import { api } from '../../shared/api';
import { actionLabel, dateTime, HistoryEntry, methodLabels, money, OrderDetail, OrderUnit, Payment, reasonLabels, roleLabels, since, Transition } from './orderTypes';
import { Countdown } from './Countdown';
import './order-detail.css';

/** Flujo principal de AGENTS.md, solo para mostrar los próximos pasos en gris; las acciones salen de `allowedTransitions`. */
const MAIN_FLOW = ['PENDING_DECISION', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];
const changeMeta: Record<HistoryEntry['changeType'], { label: string; icon: IconName }> = {
  AVANCE: { label: 'Avance', icon: 'arrowRight' }, RETROCESO: { label: 'Retroceso', icon: 'arrowLeft' }, DESHACER: { label: 'Deshacer', icon: 'undo' },
};

type Step = { key: string; kind: 'done' | 'current' | 'next'; icon: IconName; title: string; time?: string; who?: string; change?: HistoryEntry['changeType']; from?: string; reason?: string; status?: string };

/** Pasos en orden cronológico: recepción, confirmación del cliente, cada cambio del historial y los próximos del flujo principal. */
function timeline(order: OrderDetail): Step[] {
  const entries = [...order.history].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const steps: Step[] = [
    { key: 'received', kind: 'done', icon: 'receipt', title: 'Pedido recibido', time: order.createdAt },
    { key: 'confirmed', kind: 'done', icon: 'checkCircle', title: 'El cliente confirmó el pedido', time: order.customerConfirmedAt },
    ...entries.map((entry, index) => ({
      key: `h${index}`, kind: 'done' as const, icon: orderStatuses[entry.newStatus]?.icon ?? 'alert', status: entry.newStatus,
      title: statusLabel(entry.newStatus), time: entry.createdAt, who: `${entry.actorEmail ?? 'Usuario'} · ${roleLabels[entry.actorRole] ?? entry.actorRole}`,
      change: entry.changeType, from: entry.previousStatus,
      reason: [entry.reasonCode ? reasonLabels[entry.reasonCode] ?? entry.reasonCode : '', entry.reason].filter(Boolean).join(' — '),
    })),
  ];
  steps[steps.length - 1] = { ...steps[steps.length - 1], kind: 'current' };
  const position = MAIN_FLOW.indexOf(order.status);
  if (position >= 0) for (const status of MAIN_FLOW.slice(position + 1)) steps.push({ key: `n-${status}`, kind: 'next', icon: orderStatuses[status].icon, title: statusLabel(status), status });
  return steps;
}

function Unit({ unit, index, kitchen }: { unit: OrderUnit; index: number; kitchen: boolean }) {
  const extras = unit.options.filter(option => option.type === 'EXTRA');
  const removed = unit.options.filter(option => option.type === 'REMOVED_INGREDIENT');
  const notes = unit.options.filter(option => option.type === 'INSTRUCTION');
  return <li className="od-unit">
    <span className="od-unit__index ds-num" aria-label={`Unidad ${index + 1}`}>{index + 1}</span>
    <div className="od-unit__body">
      <div className="od-unit__head">
        <div><b>{unit.quantity > 1 ? `${unit.quantity}× ` : ''}{unit.dish}</b><span>{unit.variant}</span></div>
        {!kitchen && unit.lineTotal !== null && <b className="ds-num">{money(unit.lineTotal)}</b>}
      </div>
      {(extras.length + removed.length + notes.length) > 0 ? <ul className="od-mods" aria-label="Modificaciones">
        {extras.map(option => <li key={`e-${option.name}`} className="od-mod od-mod--plus"><Icon name="check" size={14} />{option.name}{!kitchen && option.amount ? <span className="ds-num"> +{money(option.amount)}</span> : null}</li>)}
        {removed.map(option => <li key={`r-${option.name}`} className="od-mod od-mod--minus"><Icon name="ban" size={14} />Sin {option.name.toLowerCase()}</li>)}
        {notes.map(option => <li key={`n-${option.name}`} className="od-mod"><Icon name="chat" size={14} />{option.name}</li>)}
      </ul> : <p className="od-unit__plain">Sin modificaciones</p>}
      {!kitchen && unit.unitPrice !== null && Boolean(unit.extrasTotal) && <p className="od-unit__breakdown ds-num">Base {money(unit.unitPrice)} + extras {money(unit.extrasTotal)}</p>}
    </div>
  </li>;
}

export function OrderDetailView({ auth, orderId, kitchen, busy, notice, onBack, onAction, onUndo, refreshKey }: {
  auth: string; orderId: string; kitchen: boolean; busy: boolean; notice?: { tone: 'ok' | 'error'; text: string }; refreshKey: number;
  onBack: () => void; onAction: (order: OrderDetail, transition: Transition) => void; onUndo: (order: OrderDetail) => void;
}) {
  const [order, setOrder] = useState<OrderDetail>(); const [payments, setPayments] = useState<Payment[] | null>(null); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const detail = await api<OrderDetail>(`/orders/${orderId}`, auth); setOrder(detail);
      if (!kitchen) setPayments(await api<Payment[]>(`/payments?orderId=${orderId}`, auth).catch(() => null));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo cargar el pedido.'); }
  }, [auth, orderId, kitchen]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [orderId]);

  const back = <button type="button" className="ds-btn ds-btn--ghost od-back" onClick={onBack}><Icon name="arrowLeft" size={18} />Volver a pedidos</button>;
  if (error) return <section className="od">{back}<div className="ds-card"><EmptyState illustration="error" title="No pudimos abrir el pedido" description={error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => void load()}><Icon name="refresh" />Reintentar</button>} /></div></section>;
  if (!order) return <section className="od" aria-busy="true">{back}<div className="od-loading"><Skeleton width="40%" height={32} /><Skeleton width="25%" height={16} /><div className="od-grid"><div className="ds-card"><Skeleton height={180} /></div><div className="ds-card"><Skeleton height={180} /></div></div></div></section>;

  const delivery = order.fulfillmentType === 'DELIVERY';
  const forward = order.allowedTransitions.filter(item => item.direction === 'FORWARD' && !item.destructive);
  const others = order.allowedTransitions.filter(item => item.direction === 'BACKWARD' || item.destructive);
  const decision = [...order.history].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find(entry => entry.previousStatus === 'PENDING_DECISION');
  const undoOpen = kitchen && order.undo && new Date(order.undo.expiresAt).getTime() > Date.now();

  return <section className="od" aria-busy={busy}>
    {back}
    <header className="od-header">
      <div className="od-header__title">
        <div className="od-header__line"><h1 className="od-code">{order.publicCode}</h1><StatusBadge status={order.status} /></div>
        <p>Recibido {dateTime(order.createdAt)}{Date.now() - new Date(order.createdAt).getTime() < 86_400_000 ? ` · ${since(order.createdAt)}` : ''}</p>
      </div>
      {(order.allowedTransitions.length > 0 || undoOpen) && <div className="od-actions" aria-label="Acciones del pedido">
        {others.map(transition => <button key={transition.targetStatus} type="button" className={`ds-btn ds-btn--secondary ${transition.destructive ? 'order-tile__danger' : ''} ${kitchen ? 'ds-btn--lg' : ''}`} disabled={busy} onClick={() => onAction(order, transition)}>
          {transition.direction === 'BACKWARD' && <Icon name="arrowLeft" size={18} />}{actionLabel(order.status, transition)}</button>)}
        {undoOpen && order.undo && <button type="button" className="ds-btn ds-btn--secondary ds-btn--lg" disabled={busy} onClick={() => onUndo(order)}>
          <Icon name="undo" size={18} />Deshacer (volver a {statusLabel(order.undo.targetStatus)}) · <Countdown until={order.undo.expiresAt} onExpire={load} /></button>}
        {forward.map(transition => <button key={transition.targetStatus} type="button" className={`ds-btn ds-btn--primary ${kitchen ? 'ds-btn--lg' : ''}`} disabled={busy} onClick={() => onAction(order, transition)}>
          {actionLabel(order.status, transition)}<Icon name="arrowRight" size={18} /></button>)}
      </div>}
    </header>

    {notice && <p className="orders-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}

    <div className="od-grid">
      <div className="od-main">
        <section className="ds-card od-section od-section--units" aria-labelledby="od-units">
          <h2 id="od-units">Pedido <span className="ds-muted">· {order.units.length} {order.units.length === 1 ? 'unidad' : 'unidades'}</span></h2>
          <ol className="od-units">{order.units.map((unit, index) => <Unit key={unit.id} unit={unit} index={index} kitchen={kitchen} />)}</ol>
          {!kitchen && order.total !== null && <dl className="od-totals">
            <div><dt>Subtotal</dt><dd className="ds-num">{money(order.subtotal)}</dd></div>
            {delivery && <div><dt>Tarifa de entrega{order.deliveryZone ? ` · ${order.deliveryZone}` : ''}</dt><dd className="ds-num">{money(order.deliveryFee)}</dd></div>}
            <div className="od-totals__total"><dt>Total</dt><dd className="ds-num">{money(order.total)}</dd></div>
          </dl>}
        </section>

        <section className="ds-card od-section od-section--timeline" aria-labelledby="od-timeline">
          <h2 id="od-timeline">Línea de tiempo</h2>
          <ol className="od-timeline">{timeline(order).map(step => <li key={step.key} className="od-step" data-kind={step.kind} data-change={step.change} data-status={step.status}>
            <span className="od-step__dot" aria-hidden="true"><Icon name={step.change === 'RETROCESO' ? 'arrowLeft' : step.change === 'DESHACER' ? 'undo' : step.icon} size={16} /></span>
            <div className="od-step__body">
              <p className="od-step__title">
                <b>{step.title}</b>
                {step.kind === 'current' && <span className="od-step__tag od-step__tag--current">Estado actual</span>}
                {step.kind === 'next' && <span className="od-step__tag">Próximo</span>}
                {step.change && step.change !== 'AVANCE' && <span className="od-step__tag od-step__tag--change"><Icon name={changeMeta[step.change].icon} size={13} />{changeMeta[step.change].label} desde {statusLabel(step.from)}</span>}
              </p>
              {step.time && <p className="od-step__meta"><time dateTime={step.time}>{dateTime(step.time)}</time>{step.who ? ` · ${step.who}` : ''}</p>}
              {step.reason && <p className="od-step__reason">Motivo: {step.reason}</p>}
            </div>
          </li>)}</ol>
        </section>
      </div>

      <aside className="od-side">
        <section className="ds-card od-section" aria-labelledby="od-customer">
          <h2 id="od-customer">Cliente y entrega</h2>
          <p className="od-strong">{order.customerName}</p>
          <p className="od-line"><Icon name="phone" size={16} />{order.phone || 'Sin teléfono'}</p>
          <p className="od-line"><Icon name={delivery ? 'moto' : 'bag'} size={16} />{delivery ? 'Entrega a domicilio' : 'Retiro en local'}</p>
          {delivery ? <dl className="od-facts">
            <div><dt>Dirección</dt><dd>{order.deliveryAddress || 'Por confirmar'}</dd></div>
            {order.deliveryReference && <div><dt>Referencia</dt><dd>{order.deliveryReference}</dd></div>}
            <div><dt>Zona</dt><dd>{order.deliveryZone || 'Sin asignar'}</dd></div>
          </dl> : <dl className="od-facts"><div><dt>Hora acordada</dt><dd>{order.pickupTime ? dateTime(order.pickupTime) : 'Por acordar'}</dd></div></dl>}
        </section>

        {!kitchen && <section className="ds-card od-section" aria-labelledby="od-payment">
          <h2 id="od-payment">Pago</h2>
          {order.paymentStatus && <PaymentBadge status={order.paymentStatus} />}
          {payments === null ? <p className="od-muted">No se pudo cargar el detalle del pago.</p>
            : payments.length === 0 ? <p className="od-muted">Sin pagos registrados.</p>
              : payments.map(payment => <dl key={payment.id} className="od-facts od-payment">
                <div><dt>Medio</dt><dd>{methodLabels[payment.method] ?? payment.method}</dd></div>
                <div><dt>Importe</dt><dd className="ds-num">{money(payment.amount)}</dd></div>
                <div><dt>Comprobante o referencia</dt><dd>{payment.reference || 'Sin referencia'}</dd></div>
                <div><dt>Verificado por</dt><dd>{payment.verifiedBy ? `${payment.verifiedBy} · ${dateTime(payment.verifiedAt)}` : 'Sin verificar'}</dd></div>
              </dl>)}
          <p className="od-hint">Un comprobante o una declaración del cliente no confirma el pago: lo confirma el personal.</p>
        </section>}

        <section className="ds-card od-section" aria-labelledby="od-decision">
          <h2 id="od-decision">Confirmación y decisión</h2>
          <dl className="od-facts">
            <div><dt>El cliente confirmó</dt><dd>{dateTime(order.customerConfirmedAt) || 'Sin registro'}</dd></div>
            <div><dt>Restaurante</dt><dd>{decision ? `${decision.newStatus === 'REJECTED' ? 'Rechazó' : 'Aceptó'} ${order.restaurantDecisionBy ?? decision.actorEmail ?? ''} · ${dateTime(decision.createdAt)}` : order.status === 'PENDING_DECISION' ? 'Pendiente de decisión' : order.restaurantDecisionBy ?? 'Sin registro'}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  </section>;
}

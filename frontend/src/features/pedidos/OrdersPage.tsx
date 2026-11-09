import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, User } from '../../shared/api';

type Transition = { targetStatus: string; direction: 'FORWARD' | 'BACKWARD'; requiresReason: boolean; destructive: boolean };
type OrderSummary = { id: string; publicCode: string; status: string; paymentStatus: string | null; fulfillmentType: 'PICKUP' | 'DELIVERY'; customerName: string; phone: string; items: string; total: number | null; createdAt: string; allowedTransitions: Transition[] };
type OrderOption = { type: 'EXTRA' | 'REMOVED_INGREDIENT' | 'INSTRUCTION'; name: string; amount: number | null };
type OrderUnit = { id: string; dish: string; variant: string; quantity: number; lineTotal: number | null; options: OrderOption[] };
type HistoryEntry = { previousStatus: string; newStatus: string; changeType: 'AVANCE' | 'RETROCESO' | 'DESHACER'; reasonCode: string | null; reason: string; actorEmail: string | null; actorRole: string; createdAt: string };
type OrderDetail = Omit<OrderSummary, 'items'> & { deliveryAddress: string; deliveryReference: string; deliveryZone: string; pickupTime: string; subtotal: number | null; deliveryFee: number | null; customerConfirmedAt: string; restaurantDecisionBy: string | null; units: OrderUnit[]; undo: { targetStatus: string; expiresAt: string } | null; history: HistoryEntry[] };
type Page = { items: OrderSummary[]; page: number; size: number; total: number };
type Filters = { status: string; fulfillment: string; paymentStatus: string; range: string; from: string; to: string; q: string };
type PendingAction = { order: OrderSummary; transition: Transition };

const PAGE_SIZE = 12;
const statusLabels: Record<string, string> = { PENDING_DECISION: 'Por aceptar', ACCEPTED: 'Aceptado', PREPARING: 'En preparación', READY: 'Listo', COMPLETED: 'Completado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado', EXPIRED: 'Vencido' };
const paymentLabels: Record<string, string> = { NOT_REQUIRED: 'No requerido', PENDING: 'Pendiente', PENDING_VERIFICATION: 'Por verificar', CONFIRMED: 'Confirmado', REJECTED: 'Rechazado' };
const reasonLabels: Record<string, string> = { ERROR_AL_AVANZAR: 'Se avanzó por error', CLIENTE_CAMBIO_PEDIDO: 'El cliente cambió el pedido', FALTA_PRODUCTO: 'Falta un producto', OTRO: 'Otro motivo' };
const changeLabels: Record<string, string> = { AVANCE: 'Avance', RETROCESO: 'Retroceso', DESHACER: 'Deshacer' };
const emptyFilters: Filters = { status: '', fulfillment: '', paymentStatus: '', range: '', from: '', to: '', q: '' };

const money = (value: number | null) => value === null ? '' : new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No registrado';
const statusLabel = (value?: string | null) => value ? statusLabels[value] || value : 'No registrado';

function actionLabel(transition: Transition) {
  if (transition.targetStatus === 'REJECTED') return 'Rechazar';
  if (transition.targetStatus === 'CANCELLED') return 'Cancelar pedido';
  return `${transition.direction === 'BACKWARD' ? 'Retroceder' : 'Avanzar'} a ${statusLabel(transition.targetStatus)}`;
}

function query(filters: Filters, page: number) {
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
  for (const [key, value] of Object.entries(filters)) if (value && !((key === 'from' || key === 'to') && filters.range !== 'CUSTOM')) params.set(key, value.trim());
  return `/orders?${params}`;
}

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
    <section className="ticket-meta"><span>Cliente confirmó: {dateTime(order.customerConfirmedAt)}</span><span>Decisión del restaurante: {order.restaurantDecisionBy || 'Pendiente'}</span>{order.paymentStatus && <span>Pago: {paymentLabels[order.paymentStatus] || order.paymentStatus}</span>}<span>Recibido: {dateTime(order.createdAt)}</span></section>
    <section><h3>Historial de estados</h3><History entries={order.history} /></section>
  </div>;
}

function ConfirmDialog({ pending, busy, error, onCancel, onConfirm }: { pending?: PendingAction; busy: boolean; error: string; onCancel: () => void; onConfirm: (reasonCode?: string, reason?: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reasonCode, setReasonCode] = useState(''); const [reason, setReason] = useState(''); const [localError, setLocalError] = useState('');
  useEffect(() => { if (pending) { setReasonCode(''); setReason(''); setLocalError(''); if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [pending]);
  if (!pending) return <dialog ref={ref} className="menu-dialog" />;
  const { order, transition } = pending;
  const backward = transition.direction === 'BACKWARD';
  function submit(event: FormEvent) {
    event.preventDefault();
    if (backward && !reasonCode) { setLocalError('Elige el motivo del retroceso.'); return; }
    if (backward && reasonCode === 'OTRO' && !reason.trim()) { setLocalError('Describe el motivo cuando eliges «Otro motivo».'); return; }
    onConfirm(backward ? reasonCode : undefined, reason.trim() || undefined);
  }
  return <dialog ref={ref} className="menu-dialog transition-dialog" aria-labelledby="transition-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <form onSubmit={submit} className="menu-form">
      <div className="dialog-header"><h2 id="transition-title">{actionLabel(transition)}</h2></div>
      <p className="transition-path"><b>{order.publicCode}</b> <span>{statusLabel(order.status)}</span> → <span className={transition.destructive ? 'destructive' : ''}>{statusLabel(transition.targetStatus)}</span></p>
      {backward && <fieldset className="reason-options"><legend>Motivo del retroceso</legend>{Object.entries(reasonLabels).map(([code, label]) => <label key={code}><input type="radio" name="reason" value={code} checked={reasonCode === code} onChange={() => setReasonCode(code)} />{label}</label>)}</fieldset>}
      {backward && <label>Detalle {reasonCode === 'OTRO' ? '(obligatorio)' : '(opcional)'}<textarea maxLength={300} value={reason} onChange={event => setReason(event.target.value)} rows={3} /></label>}
      {transition.destructive && <p className="warning">Esta acción cierra el pedido y no se puede revertir desde el panel.</p>}
      {(localError || error) && <p className="error" role="alert">{localError || error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Volver</button><button type="submit" className={transition.destructive ? 'order-action destructive' : 'order-action'} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar'}</button></div>
    </form>
  </dialog>;
}

function OrderCard({ order, detail, kitchen, busy, onOpen, onAction, onUndo }: { order: OrderSummary; detail?: OrderDetail; kitchen: boolean; busy: boolean; onOpen: () => void; onAction: (transition: Transition) => void; onUndo: () => void }) {
  const delivery = order.fulfillmentType === 'DELIVERY';
  return <article className="order-card">
    <header><div><p className="order-code">{order.publicCode}</p><time>{dateTime(order.createdAt)}</time></div><span className={`pill order-card-status status-${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span></header>
    <div className="order-card-scroll">
      <section className="order-card-client"><p className="card-section-label">Cliente</p><h2>{order.customerName}</h2><span>{order.phone || 'Teléfono no registrado'}</span></section>
      <section className="order-card-fulfillment"><div className="order-card-fulfillment-head"><strong>{delivery ? 'Envío' : 'Retiro en local'}</strong>{delivery && detail?.deliveryFee != null && <b>Tarifa {money(detail.deliveryFee)}</b>}</div>
        {detail && (delivery ? <><span>{detail.deliveryAddress || 'Dirección por confirmar'}</span>{detail.deliveryReference && <span>Referencia: {detail.deliveryReference}</span>}{detail.deliveryZone && <span>Zona: {detail.deliveryZone}</span>}</> : <span>Hora acordada: {dateTime(detail.pickupTime)}</span>)}</section>
      <section className="order-card-items"><p className="card-section-label">Pedido</p>{detail ? <UnitLines units={detail.units} /> : <p className="order-card-loading">{order.items}</p>}</section>
    </div>
    <footer>
      {order.total !== null && <div className="order-card-total"><span>Total</span><strong>{money(order.total)}</strong>{order.paymentStatus && <small>Pago: {paymentLabels[order.paymentStatus] || order.paymentStatus}</small>}</div>}
      <div className="order-card-tools">
        <button type="button" className="icon-action" aria-label={`Ver comanda e historial de ${order.publicCode}`} title="Ver comanda e historial" onClick={onOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" /></svg></button>
        {order.allowedTransitions.map(transition => <button key={transition.targetStatus} type="button" disabled={busy} onClick={() => onAction(transition)}
          className={`order-action ${transition.direction === 'BACKWARD' ? 'backward' : ''} ${transition.destructive ? 'destructive' : ''}`}>{busy ? 'Actualizando…' : actionLabel(transition)}</button>)}
        {kitchen && detail?.undo && <button type="button" className="order-action backward" disabled={busy} onClick={onUndo}>Deshacer (volver a {statusLabel(detail.undo.targetStatus)})</button>}
      </div>
    </footer>
  </article>;
}

export function OrdersPage({ auth, user }: { auth: string; user: User }) {
  const kitchen = user.roles.includes('ROLE_COCINA');
  const [filters, setFilters] = useState<Filters>(emptyFilters); const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const [data, setData] = useState<Page>(); const [loadError, setLoadError] = useState(''); const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<Record<string, OrderDetail>>({}); const [selected, setSelected] = useState<OrderDetail>();
  const [pending, setPending] = useState<PendingAction>(); const [busy, setBusy] = useState(''); const [actionError, setActionError] = useState(''); const [notice, setNotice] = useState('');
  const viewer = useRef<HTMLDialogElement>(null);

  useEffect(() => { const timer = setTimeout(() => { setFilters(current => current.q === search ? current : { ...current, q: search }); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const result = await api<Page>(query(filters, page), auth); setData(result);
      const entries = await Promise.all(result.items.map(async item => [item.id, await api<OrderDetail>(`/orders/${item.id}`, auth)] as const));
      setDetails(Object.fromEntries(entries));
    } catch (caught) { setLoadError(caught instanceof Error ? caught.message : 'No se pudieron cargar los pedidos.'); }
    finally { setLoading(false); }
  }, [auth, filters, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (selected && !viewer.current?.open) viewer.current?.showModal(); }, [selected]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(current => ({ ...current, [key]: value })); setPage(0); }

  async function run(order: OrderSummary, path: string, body?: object) {
    setBusy(order.id); setActionError(''); setNotice('');
    try {
      const result = await api<{ status: string; changeType: string }>(path, auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined });
      setPending(undefined); setNotice(`${order.publicCode}: ${statusLabel(result.status)}.`); await load();
    } catch (caught) { const message = caught instanceof Error ? caught.message : 'No se pudo actualizar el pedido.'; if (pending) setActionError(message); else setNotice(message); }
    finally { setBusy(''); }
  }

  function act(order: OrderSummary, transition: Transition) {
    if (kitchen) { void run(order, `/orders/${order.id}/transitions`, { targetStatus: transition.targetStatus }); return; }
    setActionError(''); setPending({ order, transition });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const activeFilters = Object.entries(filters).some(([key, value]) => value && key !== 'from' && key !== 'to');

  return <section className="page-content orders-page">
    <header className="page-heading"><div><h1>Pedidos</h1><p>{kitchen ? 'Pedidos aceptados para preparar. Un toque avanza el estado; puedes deshacer tu último cambio por unos minutos.' : 'Filtra, revisa y cambia el estado de cada solicitud. El sistema solo ofrece los cambios permitidos para tu rol.'}</p></div></header>
    <form className="order-filters" role="search" onSubmit={event => event.preventDefault()}>
      <label className="filter-search">Buscar<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="PED-…, nombre o teléfono" maxLength={80} /></label>
      <label>Estado<select value={filters.status} onChange={event => update('status', event.target.value)}><option value="">Todos</option>{Object.entries(statusLabels).filter(([code]) => !kitchen || ['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'].includes(code)).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      <label>Modalidad<select value={filters.fulfillment} onChange={event => update('fulfillment', event.target.value)}><option value="">Todas</option><option value="PICKUP">Retiro</option><option value="DELIVERY">Entrega</option></select></label>
      {!kitchen && <label>Pago<select value={filters.paymentStatus} onChange={event => update('paymentStatus', event.target.value)}><option value="">Todos</option>{Object.entries(paymentLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>}
      <label>Fecha<select value={filters.range} onChange={event => update('range', event.target.value)}><option value="">Todas</option><option value="TODAY">Hoy</option><option value="LAST_7_DAYS">Últimos 7 días</option><option value="CUSTOM">Personalizado</option></select></label>
      {filters.range === 'CUSTOM' && <><label>Desde<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label><label>Hasta<input type="date" value={filters.to} min={filters.from} onChange={event => update('to', event.target.value)} /></label></>}
      {(activeFilters || search) && <button type="button" className="secondary" onClick={() => { setFilters(emptyFilters); setSearch(''); setPage(0); }}>Limpiar filtros</button>}
    </form>
    <p className="orders-count" aria-live="polite">{loading ? 'Cargando pedidos…' : data ? `${data.total} pedido${data.total === 1 ? '' : 's'}` : ''}</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    {loadError && <p className="error" role="alert">No se pudo cargar la cola de pedidos: {loadError}</p>}
    {data?.items.length === 0 && !loading && <section className="menu-empty"><h2>No hay pedidos con estos filtros</h2><p>{activeFilters || search ? 'Prueba con otros filtros o límpialos.' : 'Las solicitudes confirmadas aparecerán aquí cuando el canal conversacional esté integrado.'}</p></section>}
    {data && data.items.length > 0 && <section className="order-card-grid" aria-busy={loading}>{data.items.map(order => <OrderCard key={order.id} order={order} detail={details[order.id]} kitchen={kitchen} busy={busy === order.id}
      onOpen={() => setSelected(details[order.id])} onAction={transition => act(order, transition)} onUndo={() => void run(order, `/orders/${order.id}/undo`)} />)}</section>}
    {data && data.total > PAGE_SIZE && <nav className="pagination" aria-label="Páginas de pedidos"><button type="button" className="secondary" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {totalPages}</span><button type="button" className="secondary" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
    <ConfirmDialog pending={pending} busy={Boolean(busy)} error={actionError} onCancel={() => setPending(undefined)} onConfirm={(reasonCode, reason) => pending && void run(pending.order, `/orders/${pending.order.id}/transitions`, { targetStatus: pending.transition.targetStatus, reasonCode, reason })} />
    <dialog className="menu-dialog order-dialog" ref={viewer} onClose={() => setSelected(undefined)} aria-labelledby="order-viewer-title">{selected && <><div className="dialog-header"><h2 id="order-viewer-title"><span className="order-code">{selected.publicCode}</span> · {statusLabel(selected.status)}</h2><button type="button" className="dialog-close" onClick={() => viewer.current?.close()}>Cerrar</button></div><OrderTicket order={selected} /></>}</dialog>
  </section>;
}

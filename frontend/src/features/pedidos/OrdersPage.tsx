import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ActionMenu } from '../../design/ActionMenu';
import { Dropdown } from '../../design/Dropdown';
import { FilterGroup } from '../../design/FilterGroup';
import { Icon } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { orderStatuses, paymentStatuses, PaymentBadge, StatusBadge, statusLabel } from '../../design/StatusBadge';
import { api, User } from '../../shared/api';
import { OrderDetailView } from './OrderDetailView';
import { clock, CONFIRMABLE_PAYMENT, emptyFilters, Facets, Filters, money, OrderDetail, OrderPage, OrderRef, OrderSort, OrderSummary, shortDate, shortLabel, since, sortOptions, Transition } from './orderTypes';
import { PaymentConfirmDialog, PendingPayment } from './PaymentConfirmDialog';
import { PendingAction, TransitionDialog } from './TransitionDialog';
import './orders.css';

const PAGE_SIZE = 12;
const KITCHEN_STATUSES = ['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

function params(filters: Filters, extra: Record<string, string> = {}) {
  const search = new URLSearchParams(extra);
  for (const [key, value] of Object.entries(filters)) {
    if (!value.trim()) continue;
    if ((key === 'from' || key === 'to') && filters.range !== 'CUSTOM') continue;
    search.set(key, value.trim());
  }
  return search.toString();
}

function DateRangeDialog({ open, initial, onClose, onApply }: { open: boolean; initial: { from: string; to: string }; onClose: () => void; onApply: (from: string, to: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [from, setFrom] = useState(initial.from); const [to, setTo] = useState(initial.to); const [error, setError] = useState('');
  useEffect(() => { if (open) { setFrom(initial.from); setTo(initial.to); setError(''); if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [open, initial.from, initial.to]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!from || !to) { setError('Elige la fecha inicial y la final.'); return; }
    if (to < from) { setError('La fecha final no puede ser anterior a la inicial.'); return; }
    onApply(from, to);
  }
  return <dialog ref={ref} className="ds-modal orders-dialog" aria-labelledby="range-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    {open && <form onSubmit={submit}>
      <div className="ds-modal__body">
        <h2 id="range-title">Rango personalizado</h2>
        <p className="orders-dialog__customer">Fechas en la zona horaria del restaurante; incluye ambos días.</p>
        <div className="orders-range">
          <label className="ds-field"><span className="ds-field__label">Desde</span><input className="ds-input" type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
          <label className="ds-field"><span className="ds-field__label">Hasta</span><input className="ds-input" type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
        </div>
        {error && <p className="ds-field__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      </div>
      <div className="ds-modal__actions"><button type="button" className="ds-btn ds-btn--secondary" onClick={onClose}>Cancelar</button><button type="submit" className="ds-btn ds-btn--primary">Aplicar rango</button></div>
    </form>}
  </dialog>;
}

function OrderCard({ order, kitchen, busy, undo, onOpen, onAction, onUndo, onConfirmPayment }: {
  order: OrderSummary; kitchen: boolean; busy: boolean; undo?: OrderDetail['undo']; onOpen: () => void; onAction: (transition: Transition) => void; onUndo: () => void; onConfirmPayment: () => void;
}) {
  const delivery = order.fulfillmentType === 'DELIVERY';
  const forward = order.allowedTransitions.filter(item => item.direction === 'FORWARD' && !item.destructive);
  const others = order.allowedTransitions.filter(item => item.direction === 'BACKWARD' || item.destructive);
  const canConfirmPayment = !kitchen && Boolean(order.paymentId) && CONFIRMABLE_PAYMENT.includes(order.paymentStatus ?? '');
  return <article className="order-tile" data-status={order.status} aria-labelledby={`order-${order.id}`} aria-busy={busy}>
    <header className="order-tile__head">
      <div>
        <h2 id={`order-${order.id}`} className="order-tile__code"><button type="button" className="order-tile__open" onClick={onOpen} aria-label={`Ver detalle de ${order.publicCode}`} title="Ver detalle">{order.publicCode}</button></h2>
        <p className="order-tile__time"><time dateTime={order.createdAt} title={new Date(order.createdAt).toLocaleString('es-EC')}>{since(order.createdAt)} · {clock(order.createdAt)}</time></p>
      </div>
      <StatusBadge status={order.status} />
    </header>
    <div className="order-tile__customer">
      <b>{order.customerName}</b>
      <span className="order-tile__meta"><Icon name="phone" size={16} />{order.phone || 'Sin teléfono'}</span>
      <span className="order-tile__meta"><Icon name={delivery ? 'moto' : 'bag'} size={16} />{delivery ? 'Entrega a domicilio' : 'Retiro en local'}</span>
    </div>
    <p className="order-tile__items">{order.items}</p>
    {!kitchen && <div className="order-tile__money">
      {order.paymentStatus ? <PaymentBadge status={order.paymentStatus} /> : <span />}
      {order.total !== null && <b className="ds-num">{money(order.total)}</b>}
    </div>}
    {/* Acciones compactas (bloque B): botón principal de una palabra, «Cobrado» corto y menú «⋯» para retroceder, rechazar o cancelar. Todo sale de `allowedTransitions`. */}
    <footer className="order-tile__actions">
      {forward.map(transition => <button key={transition.targetStatus} type="button" className={`ds-btn ds-btn--primary ${kitchen ? 'ds-btn--lg' : ''}`} disabled={busy} onClick={() => onAction(transition)}>
        {shortLabel(transition)}
      </button>)}
      {canConfirmPayment && <button type="button" className="ds-btn ds-btn--secondary order-tile__paid" disabled={busy} onClick={onConfirmPayment} title="Confirmar el pago recibido"><Icon name="coins" size={18} />Cobrado</button>}
      {kitchen && undo && <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={onUndo}><Icon name="undo" size={18} />Deshacer (volver a {statusLabel(undo.targetStatus)})</button>}
      <ActionMenu label={`Más acciones de ${order.publicCode}`} disabled={busy} size={kitchen ? 56 : 44}
        items={[{ id: 'detail', label: 'Ver detalle', icon: 'eye', onSelect: onOpen },
          ...(kitchen ? [] : others.map(transition => ({ id: transition.targetStatus, label: shortLabel(transition), icon: (transition.direction === 'BACKWARD' ? 'undo' : transition.targetStatus === 'REJECTED' ? 'xCircle' : 'ban') as 'undo' | 'xCircle' | 'ban', danger: transition.destructive, onSelect: () => onAction(transition) })))]} />
    </footer>
  </article>;
}

export function OrdersPage({ auth, user, preset }: { auth: string; user: User; preset?: Partial<Filters> }) {
  const kitchen = user.roles.includes('ROLE_COCINA') && !user.roles.includes('ROLE_ADMIN');
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, ...preset }); const [search, setSearch] = useState(preset?.q ?? ''); const [page, setPage] = useState(0); const [sort, setSort] = useState<OrderSort>('CREATED_DESC');
  const [data, setData] = useState<OrderPage>(); const [facets, setFacets] = useState<Facets>(); const [facetsLoading, setFacetsLoading] = useState(true);
  const [loadError, setLoadError] = useState(''); const [loading, setLoading] = useState(true);
  const [undos, setUndos] = useState<Record<string, OrderDetail['undo']>>({});
  /** Pedido abierto en detalle; la lista conserva filtros, página y posición al volver. */
  const [detailId, setDetailId] = useState<string>(); const [refreshKey, setRefreshKey] = useState(0); const listScroll = useRef(0);
  const [pending, setPending] = useState<PendingAction>(); const [pendingPayment, setPendingPayment] = useState<PendingPayment>(); const [busy, setBusy] = useState(''); const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string }>(); const [rangeOpen, setRangeOpen] = useState(false); const [filtersOpen, setFiltersOpen] = useState(false);

  // La búsqueda espera 300 ms antes de consultar.
  useEffect(() => { const timer = setTimeout(() => { setFilters(current => current.q === search ? current : { ...current, q: search }); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const result = await api<OrderPage>(`/orders?${params(filters, { page: String(page), size: String(PAGE_SIZE), sort })}`, auth);
      setData(result);
      // Solo COCINA necesita el detalle para saber si puede deshacer su último cambio.
      if (kitchen) setUndos(Object.fromEntries(await Promise.all(result.items.map(async item => [item.id, (await api<OrderDetail>(`/orders/${item.id}`, auth)).undo] as const))));
    } catch (caught) { setLoadError(caught instanceof Error ? caught.message : 'No se pudieron cargar los pedidos.'); }
    finally { setLoading(false); }
  }, [auth, filters, page, sort, kitchen]);

  const loadFacets = useCallback(async () => {
    setFacetsLoading(true);
    try { setFacets(await api<Facets>(`/orders/facets?${params(filters)}`, auth)); } catch { setFacets(undefined); } finally { setFacetsLoading(false); }
  }, [auth, filters]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadFacets(); }, [loadFacets]);

  function update(changes: Partial<Filters>) { setFilters(current => ({ ...current, ...changes })); setPage(0); }
  function clearAll() { setFilters(emptyFilters); setSearch(''); setPage(0); setSort('CREATED_DESC'); }

  /** Confirmación manual del pago (ADMIN y CAJA): el backend valida estado, aislamiento e idempotencia. */
  async function confirmPayment(order: OrderRef, paymentId: string) {
    setBusy(order.id); setActionError('');
    try {
      await api(`/payments/${paymentId}/confirm`, auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setPendingPayment(undefined);
      setNotice({ tone: 'ok', text: `Pago de ${order.publicCode} confirmado.` });
      setRefreshKey(key => key + 1);
      await Promise.all([load(), loadFacets()]);
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : 'No se pudo confirmar el pago.'); }
    finally { setBusy(''); }
  }

  async function run(order: OrderRef, path: string, body?: object) {
    setBusy(order.id); setActionError('');
    try {
      const result = await api<{ status: string; changeType: string }>(path, auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined });
      setPending(undefined);
      const target = `«${statusLabel(result.status)}»`;
      setNotice({ tone: 'ok', text: result.changeType === 'DESHACER' ? `Cambio deshecho: ${order.publicCode} volvió a ${target}.`
        : result.changeType === 'RETROCESO' ? `${order.publicCode} volvió a ${target}.` : `${order.publicCode} pasó a ${target}.` });
      setRefreshKey(key => key + 1);
      await Promise.all([load(), loadFacets()]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo actualizar el pedido.';
      if (pending) setActionError(message); else setNotice({ tone: 'error', text: `${order.publicCode}: ${message}` });
    } finally { setBusy(''); }
  }
  function act(order: OrderRef, transition: Transition) {
    // COCINA avanza con un toque y sin motivo; el resto confirma (y retroceder pide motivo).
    if (kitchen) { void run(order, `/orders/${order.id}/transitions`, { targetStatus: transition.targetStatus }); return; }
    setActionError(''); setPending({ order, transition });
  }
  function open(order: OrderSummary) { listScroll.current = window.scrollY; setNotice(undefined); setDetailId(order.id); }
  function closeDetail() {
    setDetailId(undefined); setNotice(undefined);
    requestAnimationFrame(() => window.scrollTo({ top: listScroll.current }));
  }

  const sum = (group?: Record<string, number>) => group ? Object.values(group).reduce((total, value) => total + value, 0) : undefined;
  const count = (group: keyof Facets, value: string) => facets ? facets[group][value] ?? 0 : null;
  const statusOptions = Object.entries(orderStatuses).filter(([code]) => !kitchen || KITCHEN_STATUSES.includes(code));
  const activeCount = [filters.status, filters.fulfillment, filters.paymentStatus, filters.range].filter(Boolean).length + (filters.q ? 1 : 0);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const first = data && data.total ? page * PAGE_SIZE + 1 : 0; const last = data ? Math.min(data.total, (page + 1) * PAGE_SIZE) : 0;
  const today = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const dialogs = <>
    <PaymentConfirmDialog pending={pendingPayment} busy={Boolean(busy)} error={actionError} onCancel={() => setPendingPayment(undefined)} onConfirm={() => pendingPayment && void confirmPayment(pendingPayment.order, pendingPayment.paymentId)} />
    <TransitionDialog pending={pending} busy={Boolean(busy)} error={actionError} onCancel={() => setPending(undefined)}
      onConfirm={(reasonCode, reason) => pending && void run(pending.order, `/orders/${pending.order.id}/transitions`, { targetStatus: pending.transition.targetStatus, reasonCode, reason })} />
  </>;

  if (detailId) return <>
    <OrderDetailView auth={auth} orderId={detailId} kitchen={kitchen} busy={Boolean(busy)} notice={notice} refreshKey={refreshKey} onBack={closeDetail}
      onAction={(order, transition) => act(order, transition)} onUndo={order => void run(order, `/orders/${order.id}/undo`)}
      onConfirmPayment={(order, paymentId, amount) => { setActionError(''); setPendingPayment({ order, paymentId, amount }); }} />
    {dialogs}
  </>;

  return <section className="orders">
    <PageHeader title="Pedidos" subtitle={kitchen ? 'Pedidos aceptados para preparar. Un toque avanza el estado y puedes deshacer tu último cambio por unos minutos.' : 'Revisa las solicitudes y cambia su estado. Solo ves los cambios que tu rol puede hacer.'}
      aside={<span className="orders-today"><Icon name="calendar" size={16} />{today}</span>} />

    <div className="orders-toolbar">
      <label className="ds-search orders-search">
        <span className="ds-sr-only">Buscar pedidos</span><Icon name="search" />
        <input className="ds-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="PED-…, nombre o teléfono" maxLength={80} />
      </label>
      <button type="button" className="ds-btn ds-btn--secondary orders-filters-toggle" aria-expanded={filtersOpen} aria-controls="orders-filters" onClick={() => setFiltersOpen(value => !value)}>
        Filtros{activeCount > 0 && <span className="ds-chip__count">{activeCount}</span>}
      </button>
    </div>

    <div id="orders-filters" className="ds-card orders-filters" data-open={filtersOpen}>
      <FilterGroup legend="Estado" loading={facetsLoading} value={filters.status} onChange={value => update({ status: value })}
        options={[{ value: '', label: 'Todos', count: facets ? sum(facets.status) : null }, ...statusOptions.map(([code, meta]) => ({ value: code, label: meta.label, count: count('status', code) }))]} />
      {/* Modalidad, fecha y pago como menús desplegables (bloque B); el estado sigue como botones. */}
      <div className="orders-filters__row" role="group" aria-label="Más filtros">
        <Dropdown label="Modalidad" loading={facetsLoading} value={filters.fulfillment} onChange={value => update({ fulfillment: value })}
          options={[{ value: '', label: 'Todas', count: facets ? sum(facets.fulfillment) : null }, { value: 'PICKUP', label: 'Retiro', count: count('fulfillment', 'PICKUP') }, { value: 'DELIVERY', label: 'Entrega', count: count('fulfillment', 'DELIVERY') }]} />
        <Dropdown label="Fecha" loading={facetsLoading} value={filters.range} onChange={value => value === 'CUSTOM' ? setRangeOpen(true) : update({ range: value, from: '', to: '' })}
          options={[{ value: '', label: 'Todas', count: facets?.range.ALL ?? null }, { value: 'TODAY', label: 'Hoy', count: count('range', 'TODAY') }, { value: 'LAST_7_DAYS', label: 'Últimos 7 días', count: count('range', 'LAST_7_DAYS') },
            { value: 'CUSTOM', label: 'Personalizado', detail: filters.range === 'CUSTOM' && filters.from ? `${shortDate(filters.from)} – ${shortDate(filters.to)}` : undefined, count: filters.range === 'CUSTOM' ? count('range', 'CUSTOM') : undefined }]} />
        {!kitchen && <Dropdown label="Pago" loading={facetsLoading} value={filters.paymentStatus} onChange={value => update({ paymentStatus: value })}
          options={[{ value: '', label: 'Todos', count: facets ? sum(facets.paymentStatus) : null }, ...Object.entries(paymentStatuses).map(([code, meta]) => ({ value: code, label: meta.label, count: count('paymentStatus', code) }))]} />}
      </div>
    </div>

    <div className="orders-summary">
      <p aria-live="polite">{loading && !data ? 'Cargando pedidos…' : data ? <><b className="ds-num">{data.total}</b> {data.total === 1 ? 'pedido' : 'pedidos'}{activeCount ? ' con los filtros elegidos' : ''}</> : ''}</p>
      <div className="orders-summary__tools">
        {activeCount > 0 && <button type="button" className="ds-btn ds-btn--ghost" onClick={clearAll}><Icon name="close" size={16} />Limpiar filtros</button>}
        <Dropdown label="Orden" align="end" value={sort} onChange={value => { setSort(value as OrderSort); setPage(0); }} options={sortOptions} />
      </div>
    </div>

    {notice && <p className="orders-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}

    {loadError ? <div className="ds-card"><EmptyState illustration="error" title="No pudimos cargar los pedidos" description={loadError} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => void load()}><Icon name="refresh" />Reintentar</button>} /></div>
      : !data ? <div className="orders-grid" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="order-tile order-tile--loading"><Skeleton width="45%" height={22} /><Skeleton width="70%" height={16} /><Skeleton width="55%" height={14} /><Skeleton height={44} radius="var(--radius-md)" /></div>)}</div>
        : data.items.length === 0 ? <div className="ds-card"><EmptyState title={activeCount ? 'No hay pedidos con estos filtros' : 'Aún no hay pedidos'} description={activeCount ? 'Prueba con otro rango de fechas o quita algún filtro.' : 'Las solicitudes confirmadas por los clientes aparecerán aquí.'}
          action={activeCount ? <button type="button" className="ds-btn ds-btn--primary" onClick={clearAll}>Limpiar filtros</button> : undefined} /></div>
          : <div className={`orders-grid ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
            {data.items.map(order => <OrderCard key={order.id} order={order} kitchen={kitchen} busy={busy === order.id} undo={undos[order.id]}
              onOpen={() => open(order)} onAction={transition => act(order, transition)} onUndo={() => void run(order, `/orders/${order.id}/undo`)}
              onConfirmPayment={() => { setActionError(''); setPendingPayment({ order, paymentId: order.paymentId ?? '', amount: order.total }); }} />)}
          </div>}

    {data && data.total > PAGE_SIZE && <nav className="orders-pagination" aria-label="Páginas de pedidos">
      <span className="ds-muted">Mostrando <b className="ds-num">{first}–{last}</b> de <b className="ds-num">{data.total}</b></span>
      <div>
        <button type="button" className="ds-btn ds-btn--secondary" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}><Icon name="arrowLeft" size={18} />Anterior</button>
        <span className="ds-num" aria-current="page">Página {page + 1} de {totalPages}</span>
        <button type="button" className="ds-btn ds-btn--secondary" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(page + 1)}>Siguiente<Icon name="arrowRight" size={18} /></button>
      </div>
    </nav>}

    {dialogs}
    <DateRangeDialog open={rangeOpen} initial={{ from: filters.from, to: filters.to }} onClose={() => setRangeOpen(false)} onApply={(from, to) => { setRangeOpen(false); update({ range: 'CUSTOM', from, to }); }} />
  </section>;
}

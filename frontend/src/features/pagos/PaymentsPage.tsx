import { useMemo, useState } from 'react';
import { FilterGroup } from '../../design/FilterGroup';
import { Icon, IconName } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { PaymentBadge, paymentStatuses } from '../../design/StatusBadge';
import { useLoad } from '../../shared/api';
import './payments.css';

/** `GET /payments` (ADMIN, CAJA). Solo lectura: confirmar o rechazar pagos queda pendiente del ADR-001. */
type Payment = { id: string; orderId: string; orderCode: string; method: string; amount: number; status: string; reference: string | null; verifiedBy: string | null; verifiedAt: string | null };
const METHODS: Record<string, { label: string; icon: IconName }> = { CASH: { label: 'Efectivo', icon: 'coins' }, TRANSFER: { label: 'Transferencia', icon: 'receipt' }, CARD: { label: 'Tarjeta', icon: 'wallet' } };
const STATUS_ORDER = ['PENDING_VERIFICATION', 'PENDING', 'REJECTED', 'CONFIRMED', 'NOT_REQUIRED'];
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export function PaymentsPage({ auth, onOpenOrder }: { auth: string; onOpenOrder: (code: string) => void }) {
  const payments = useLoad<Payment[]>('/payments', auth);
  const [status, setStatus] = useState(''); const [method, setMethod] = useState(''); const [q, setQ] = useState('');
  const all = useMemo(() => [...(payments.data ?? [])].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)), [payments.data]);
  const match = (item: Payment, skip?: 'status' | 'method') => (skip === 'status' || !status || item.status === status) && (skip === 'method' || !method || item.method === method)
    && (!q.trim() || item.orderCode.toLowerCase().includes(q.trim().toLowerCase()) || (item.reference ?? '').toLowerCase().includes(q.trim().toLowerCase()));
  const visible = all.filter(item => match(item));
  const count = (skip: 'status' | 'method', test: (item: Payment) => boolean) => all.filter(item => match(item, skip) && test(item)).length;
  const methods = [...new Set(all.map(item => item.method))];
  const filtering = Boolean(status || method || q.trim());

  return <section className="pay">
    <PageHeader title="Pagos" subtitle="Pagos registrados por pedido. Un comprobante o una declaración del cliente no confirma el pago: lo confirma el personal." />
    <p className="pay-note" role="note"><Icon name="alert" size={18} /><span><b>Solo lectura.</b> Confirmar o rechazar pagos desde el panel queda pendiente de la decisión de estados y políticas de pago (ADR-001).</span></p>

    <label className="ds-search pay-search"><span className="ds-sr-only">Buscar pagos</span><Icon name="search" />
      <input className="ds-input" type="search" value={q} maxLength={80} onChange={event => setQ(event.target.value)} placeholder="Número de pedido o referencia" /></label>
    <div className="ds-card pay-filters">
      <FilterGroup legend="Estado" value={status} onChange={setStatus}
        options={[{ value: '', label: 'Todos', count: count('status', () => true) }, ...STATUS_ORDER.filter(code => code !== 'NOT_REQUIRED').map(code => ({ value: code, label: paymentStatuses[code].label, count: count('status', item => item.status === code) }))]} />
      <FilterGroup legend="Medio" value={method} onChange={setMethod}
        options={[{ value: '', label: 'Todos', count: count('method', () => true) }, ...methods.map(code => ({ value: code, label: METHODS[code]?.label ?? code, count: count('method', item => item.method === code) }))]} />
    </div>
    <div className="pay-summary"><p aria-live="polite">{payments.data ? <><b className="ds-num">{visible.length}</b> {filtering ? `de ${all.length} pagos` : visible.length === 1 ? 'pago' : 'pagos'}</> : 'Cargando pagos…'}</p>
      {filtering && <button type="button" className="ds-btn ds-btn--ghost" onClick={() => { setStatus(''); setMethod(''); setQ(''); }}><Icon name="close" size={16} />Limpiar filtros</button>}</div>

    {payments.error ? <div className="ds-card"><EmptyState illustration="error" title="No pudimos cargar los pagos" description={payments.error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => void payments.reload()}><Icon name="refresh" />Reintentar</button>} /></div>
      : !payments.data ? <div className="ds-card pay-loading">{[0, 1, 2, 3].map(index => <Skeleton key={index} height={48} radius="var(--radius-md)" />)}</div>
        : visible.length === 0 ? <div className="ds-card"><EmptyState title={filtering ? 'Ningún pago coincide' : 'Sin pagos registrados'} description={filtering ? 'Prueba con otro filtro o búsqueda.' : 'Los pagos aparecerán cuando los clientes elijan cómo pagar sus pedidos.'} /></div>
          : <div className="ds-table-wrap"><table className="ds-table pay-table">
            <thead><tr><th scope="col">Pedido</th><th scope="col">Medio</th><th scope="col" className="is-num">Importe</th><th scope="col">Estado</th><th scope="col">Comprobante o referencia</th><th scope="col">Verificado por</th></tr></thead>
            <tbody>{visible.map(item => <tr key={item.id} data-status={item.status}>
              <td data-label="Pedido"><button type="button" className="pay-order" onClick={() => onOpenOrder(item.orderCode)} aria-label={`Abrir ${item.orderCode} en Pedidos`}>{item.orderCode}<Icon name="arrowRight" size={14} /></button></td>
              <td data-label="Medio"><span className="pay-method"><Icon name={METHODS[item.method]?.icon ?? 'wallet'} size={16} />{METHODS[item.method]?.label ?? item.method}</span></td>
              <td data-label="Importe" className="is-num"><b>{money(item.amount)}</b></td>
              <td data-label="Estado"><PaymentBadge status={item.status} /></td>
              <td data-label="Referencia">{item.reference ? <span className="pay-ref">{item.reference}</span> : <span className="pay-muted">Sin referencia</span>}</td>
              <td data-label="Verificado por">{item.verifiedBy ? <span className="pay-verified"><b>{item.verifiedBy}</b>{item.verifiedAt && <span>{dateTime(item.verifiedAt)}</span>}</span> : <span className="pay-muted">Sin verificar</span>}</td>
            </tr>)}</tbody>
          </table></div>}
  </section>;
}

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api';

type Handoff = { id: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; reason: string; context: string; assignee: string | null; mine: boolean };
type Conversation = { id: string; customerId: string | null; customerName: string; phone: string | null; controlMode: 'AGENT' | 'HUMAN'; awaitingReply: boolean; lastAuthor: string | null; lastMessage: string | null; lastMessageAt: string; handoff: Handoff | null };
type Page = { items: Conversation[]; page: number; size: number; total: number };
type Message = { id: string; authorType: 'CUSTOMER' | 'AGENT' | 'STAFF'; authorEmail: string | null; body: string; createdAt: string };
type Customer = { id: string; name: string; phone: string; since: string; history: { orders: number; completed: number; completedAmount: number; recent: Array<{ id: string; publicCode: string; status: string; total: number; createdAt: string }> } };
type Detail = { conversation: Conversation; canReply: boolean; messages: Message[]; customer: Customer | null };

const tabs = [{ id: 'PENDING', label: 'Por contestar' }, { id: 'HUMAN', label: 'Con control humano' }, { id: 'ALL', label: 'Todas' }];
const authorLabels = { CUSTOMER: 'Cliente', AGENT: 'Agente', STAFF: 'Personal' };
const handoffLabels = { OPEN: 'Derivación abierta', IN_PROGRESS: 'En atención', RESOLVED: 'Resuelta' };
const statusLabels: Record<string, string> = { PENDING_DECISION: 'Por aceptar', ACCEPTED: 'Aceptado', PREPARING: 'En preparación', READY: 'Listo', COMPLETED: 'Completado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado', EXPIRED: 'Vencido' };
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
const when = (value: string) => new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

function ConversationView({ auth, id, onChanged }: { auth: string; id: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail>(); const [error, setError] = useState(''); const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const load = useCallback(() => api<Detail>(`/crm/conversations/${id}`, auth).then(setDetail).catch(caught => setError(caught instanceof Error ? caught.message : 'No se pudo cargar la conversación.')), [auth, id]);
  useEffect(() => { setDetail(undefined); setError(''); setDraft(''); setNotice(''); void load(); }, [load]);

  async function control(action: 'claim' | 'release') {
    if (!detail?.conversation.handoff) return;
    if (action === 'release' && !window.confirm('¿Liberar el control? La derivación quedará resuelta y la conversación volverá al agente.')) return;
    setBusy(true); setError('');
    try { await api(`/handoffs/${detail.conversation.handoff.id}/${action}`, auth, { method: 'POST' }); await load(); onChanged(); setNotice(action === 'claim' ? 'Tienes el control: el agente no responderá en esta conversación.' : 'Control liberado.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo cambiar el control.'); }
    finally { setBusy(false); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true); setError('');
    try { await api(`/crm/conversations/${id}/messages`, auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ body: draft }) }); setDraft(''); await load(); onChanged(); setNotice('Respuesta registrada (todavía no se envía por WhatsApp).'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo registrar la respuesta.'); }
    finally { setBusy(false); }
  }

  if (error && !detail) return <section className="crm-thread"><p className="error" role="alert">{error}</p></section>;
  if (!detail) return <section className="crm-thread" aria-busy="true"><p className="empty-state">Cargando conversación…</p></section>;
  const { conversation, messages, customer, canReply } = detail;
  const handoff = conversation.handoff;
  return <div className="crm-detail">
    <section className="crm-thread" aria-label={`Conversación con ${conversation.customerName}`}>
      <header className="crm-thread-header">
        <div><h2>{conversation.customerName}</h2><span>{conversation.phone || 'Sin teléfono'} · {conversation.controlMode === 'HUMAN' ? 'Control humano' : 'Atiende el agente'}</span></div>
        <div className="crm-actions">
          {handoff?.status === 'OPEN' && <button type="button" disabled={busy} onClick={() => void control('claim')}>Tomar control</button>}
          {handoff?.status === 'IN_PROGRESS' && handoff.mine && <button type="button" className="secondary" disabled={busy} onClick={() => void control('release')}>Liberar control</button>}
        </div>
      </header>
      {handoff && <p className={`crm-handoff ${handoff.status.toLowerCase()}`}><b>{handoffLabels[handoff.status]}</b> · {handoff.reason}{handoff.assignee ? ` · Responsable: ${handoff.mine ? 'tú' : handoff.assignee}` : ''}<br /><small>{handoff.context}</small></p>}
      <ol className="crm-messages">{messages.map(message => <li key={message.id} className={`bubble ${message.authorType.toLowerCase()}`}>
        <small>{authorLabels[message.authorType]}{message.authorEmail ? ` · ${message.authorEmail}` : ''} · {when(message.createdAt)}</small><p>{message.body}</p>
      </li>)}</ol>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <form className="crm-reply" onSubmit={send}>
        <label htmlFor="crm-reply">Responder como personal</label>
        <textarea id="crm-reply" rows={3} maxLength={2000} value={draft} disabled={!canReply || busy} onChange={event => setDraft(event.target.value)}
          placeholder={canReply ? 'Escribe la respuesta para el cliente…' : 'Toma el control de la derivación para responder.'} />
        <div><small>Se registra en la conversación; el envío por WhatsApp aún no está integrado.</small><button type="submit" disabled={!canReply || busy || !draft.trim()}>{busy ? 'Guardando…' : 'Registrar respuesta'}</button></div>
      </form>
    </section>
    <aside className="crm-customer" aria-label="Ficha del cliente">
      <h3>Ficha del cliente</h3>
      {customer ? <>
        <p><strong>{customer.name}</strong><br />{customer.phone}<br /><small>Cliente desde {when(customer.since)}</small></p>
        <dl className="snapshot"><div><dt>Pedidos</dt><dd>{customer.history.orders}</dd></div><div><dt>Completados</dt><dd>{customer.history.completed}</dd></div></dl>
        <p className="crm-spent">Ventas completadas: <b>{money(customer.history.completedAmount)}</b></p>
        <h4>Pedidos recientes</h4>
        {customer.history.recent.length ? <ul className="crm-orders">{customer.history.recent.map(order => <li key={order.id}><b>{order.publicCode}</b><span>{statusLabels[order.status] || order.status}</span><span>{money(order.total)}</span><small>{when(order.createdAt)}</small></li>)}</ul> : <p className="empty-state">Sin pedidos anteriores.</p>}
      </> : <p className="empty-state">La conversación no está vinculada a un cliente.</p>}
    </aside>
  </div>;
}

export function CrmPage({ auth }: { auth: string }) {
  const [tab, setTab] = useState('PENDING'); const [search, setSearch] = useState(''); const [q, setQ] = useState('');
  const [data, setData] = useState<Page>(); const [error, setError] = useState(''); const [selected, setSelected] = useState<string>();
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(() => {
    const params = new URLSearchParams({ tab, size: '50' }); if (q) params.set('q', q);
    return api<Page>(`/crm/conversations?${params}`, auth).then(result => { setData(result); setError(''); }).catch(caught => setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las conversaciones.'));
  }, [auth, tab, q]);
  useEffect(() => { void load(); }, [load]);

  return <section className="page-content crm-page">
    <header className="page-heading"><div><h1>CRM</h1><p>Conversaciones con clientes (datos ficticios). Toma el control de una derivación para responder; mientras lo tengas, el agente no responde.</p></div></header>
    <div className="crm-layout">
      <nav className="crm-list" aria-label="Conversaciones">
        <div className="segmented" role="tablist">{tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
        <label className="crm-search">Buscar<input type="search" value={search} maxLength={80} placeholder="Nombre o teléfono" onChange={event => setSearch(event.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        {data && <p className="orders-count">{data.total} conversación{data.total === 1 ? '' : 'es'}</p>}
        {data?.items.length === 0 && <p className="empty-state">No hay conversaciones en esta pestaña.</p>}
        <ul>{data?.items.map(item => <li key={item.id}><button type="button" className={selected === item.id ? 'crm-item active' : 'crm-item'} aria-current={selected === item.id} onClick={() => setSelected(item.id)}>
          <span className="crm-item-head"><strong>{item.customerName}</strong><time>{when(item.lastMessageAt)}</time></span>
          <span className="crm-item-preview">{item.lastAuthor ? `${authorLabels[item.lastAuthor as Message['authorType']]}: ` : ''}{item.lastMessage || 'Sin mensajes'}</span>
          <span className="crm-badges">{item.awaitingReply && <em className="badge pending">Por contestar</em>}{item.controlMode === 'HUMAN' && <em className="badge human">Control humano</em>}{item.handoff && item.handoff.status !== 'RESOLVED' && <em className="badge">{handoffLabels[item.handoff.status]}</em>}</span>
        </button></li>)}</ul>
      </nav>
      {selected ? <ConversationView key={selected} auth={auth} id={selected} onChanged={() => void load()} /> : <section className="crm-thread crm-placeholder"><p className="empty-state">Elige una conversación para ver el hilo y la ficha del cliente.</p></section>}
    </div>
  </section>;
}

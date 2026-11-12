import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Icon, IconName } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { StatusBadge } from '../../design/StatusBadge';
import { api } from '../../shared/api';
import './crm.css';

/** Contrato de `GET /crm/conversations`, `GET /crm/conversations/{id}` y derivaciones (docs/contratos-api.md). */
type Handoff = { id: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; reason: string; context: string; assignee: string | null; mine: boolean };
type Conversation = { id: string; customerId: string | null; customerName: string; phone: string | null; controlMode: 'AGENT' | 'HUMAN'; awaitingReply: boolean; lastAuthor: string | null; lastMessage: string | null; lastMessageAt: string; handoff: Handoff | null };
type Page = { items: Conversation[]; page: number; size: number; total: number };
type Message = { id: string; authorType: 'CUSTOMER' | 'AGENT' | 'STAFF'; authorEmail: string | null; body: string; createdAt: string };
type Customer = { id: string; name: string; phone: string; since: string; history: { orders: number; completed: number; completedAmount: number; recent: Array<{ id: string; publicCode: string; status: string; total: number; createdAt: string }> } };
type Detail = { conversation: Conversation; canReply: boolean; messages: Message[]; customer: Customer | null };
type Pane = 'list' | 'thread' | 'customer';

const TABS = [{ id: 'PENDING', label: 'Por contestar' }, { id: 'HUMAN', label: 'Con control humano' }, { id: 'ALL', label: 'Todas' }];
const authorLabels: Record<Message['authorType'], string> = { CUSTOMER: 'Cliente', AGENT: 'Agente', STAFF: 'Personal' };
const handoffMeta: Record<Handoff['status'], { label: string; icon: IconName }> = { OPEN: { label: 'Derivación abierta', icon: 'alert' }, IN_PROGRESS: { label: 'En atención', icon: 'user' }, RESOLVED: { label: 'Resuelta', icon: 'checkCircle' } };
const REFRESH_MS = 20_000;
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
const clock = (value: string) => new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const shortDate = (value: string) => new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function ago(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short' }).format(new Date(value));
}
function dayLabel(value: string) {
  const day = new Date(value); const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(day.toDateString()).getTime()) / 86_400_000);
  if (diff === 0 || diff === 1) return relative.format(-diff, 'day').replace(/^./, letter => letter.toUpperCase());
  return new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(day).replace(/^./, letter => letter.toUpperCase());
}

function ConversationBadges({ item }: { item: Conversation }) {
  return <span className="crm-badges">
    {item.awaitingReply && <span className="ds-badge" data-status="PENDING_DECISION"><Icon name="clock" size={14} />Por contestar</span>}
    {item.controlMode === 'HUMAN' && <span className="ds-badge" data-status="ACCEPTED"><Icon name="user" size={14} />Control humano</span>}
    {item.handoff && item.handoff.status === 'OPEN' && <span className="ds-badge" data-status="REJECTED"><Icon name="alert" size={14} />Derivación abierta</span>}
  </span>;
}

function ReleaseDialog({ open, busy, onCancel, onConfirm }: { open: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) { if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [open]);
  return <dialog ref={ref} className="ds-modal" aria-labelledby="crm-release-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="ds-modal__body"><h2 id="crm-release-title" style={{ fontSize: 'var(--text-xl)' }}>¿Liberar el control?</h2>
      <p className="ds-muted" style={{ margin: 0 }}>La derivación quedará resuelta y la conversación volverá al agente. Queda registrado en la auditoría.</p></div>
    <div className="ds-modal__actions"><button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={onCancel}>Volver</button><button type="button" className="ds-btn ds-btn--primary" disabled={busy} onClick={onConfirm}>{busy ? 'Liberando…' : 'Liberar control'}</button></div>
  </dialog>;
}

function CustomerCard({ customer, onOpenOrder }: { customer: Customer | null; onOpenOrder: (code: string) => void }) {
  if (!customer) return <EmptyState compact title="Sin ficha" description="La conversación no está vinculada a un cliente." />;
  return <div className="crm-customer">
    <div className="crm-customer__id"><span className="crm-avatar crm-avatar--lg" aria-hidden="true">{initials(customer.name)}</span><div><b>{customer.name}</b><span className="crm-line"><Icon name="phone" size={16} />{customer.phone}</span><span className="crm-line"><Icon name="calendar" size={16} />Cliente desde {shortDate(customer.since)}</span></div></div>
    <dl className="crm-stats">
      <div><dt>Pedidos</dt><dd className="ds-num">{customer.history.orders}</dd></div>
      <div><dt>Completados</dt><dd className="ds-num">{customer.history.completed}</dd></div>
      <div className="crm-stats__wide"><dt>Ventas completadas</dt><dd className="ds-num">{money(customer.history.completedAmount)}</dd></div>
    </dl>
    <h3 className="ds-eyebrow">Pedidos recientes</h3>
    {customer.history.recent.length ? <ul className="crm-orders">{customer.history.recent.map(order => <li key={order.id}>
      <button type="button" className="crm-order" onClick={() => onOpenOrder(order.publicCode)} aria-label={`Abrir ${order.publicCode} en Pedidos`}>
        <span className="crm-order__top"><b className="crm-order__code">{order.publicCode}</b><span className="ds-num">{money(order.total)}</span></span>
        <span className="crm-order__bottom"><StatusBadge status={order.status} /><span>{shortDate(order.createdAt)}</span></span>
      </button>
    </li>)}</ul> : <p className="crm-muted">Sin pedidos anteriores.</p>}
  </div>;
}

function Thread({ auth, id, onChanged, onBack, onShowCustomer, onOpenOrder, pane }: { auth: string; id: string; pane: Pane; onChanged: () => void; onBack: () => void; onShowCustomer: () => void; onOpenOrder: (code: string) => void }) {
  const [detail, setDetail] = useState<Detail>(); const [error, setError] = useState(''); const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string }>(); const [releasing, setReleasing] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const load = useCallback(() => api<Detail>(`/crm/conversations/${id}`, auth).then(next => { setDetail(next); setError(''); })
    .catch(caught => setError(caught instanceof Error ? caught.message : 'No se pudo cargar la conversación.')), [auth, id]);
  useEffect(() => { void load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS); return () => clearInterval(timer); }, [load]);
  // Solo se desplaza la lista de mensajes: el último queda visible sin mover la página.
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [detail?.messages.length]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);

  async function control(action: 'claim' | 'release') {
    if (!detail?.conversation.handoff) return;
    setBusy(true);
    try {
      await api(`/handoffs/${detail.conversation.handoff.id}/${action}`, auth, { method: 'POST' }); setReleasing(false); await load(); onChanged();
      setNotice({ tone: 'ok', text: action === 'claim' ? 'Tienes el control: el agente no responderá en esta conversación.' : 'Control liberado: la conversación vuelve al agente.' });
    } catch (caught) { setReleasing(false); setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo cambiar el control.' }); }
    finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!draft.trim()) return;
    setBusy(true);
    try {
      await api(`/crm/conversations/${id}/messages`, auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ body: draft.trim() }) });
      setDraft(''); await load(); onChanged(); setNotice({ tone: 'ok', text: 'Respuesta registrada. Todavía no se envía por WhatsApp.' });
    } catch (caught) { setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo registrar la respuesta.' }); }
    finally { setBusy(false); }
  }

  const back = <button type="button" className="ds-btn ds-btn--ghost crm-back" onClick={onBack}><Icon name="arrowLeft" size={18} />Conversaciones</button>;
  if (error && !detail) return <><section className="crm-pane crm-thread">{back}<EmptyState illustration="error" title="No pudimos abrir la conversación" description={error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => void load()}><Icon name="refresh" />Reintentar</button>} /></section><aside className="crm-pane crm-side" /></>;
  if (!detail) return <><section className="crm-pane crm-thread" aria-busy="true"><div className="crm-thread__loading"><Skeleton width="40%" height={24} /><Skeleton width="60%" height={60} radius="var(--radius-lg)" /><Skeleton width="50%" height={60} radius="var(--radius-lg)" /></div></section><aside className="crm-pane crm-side" aria-busy="true"><Skeleton height={120} radius="var(--radius-lg)" /></aside></>;

  const { conversation, messages, customer, canReply } = detail;
  const handoff = conversation.handoff;
  let lastDay = '';
  return <>
    <section className="crm-pane crm-thread" aria-label={`Conversación con ${conversation.customerName}`}>
      <header className="crm-thread__head">
        {back}
        <div className="crm-thread__who">
          <span className="crm-avatar" aria-hidden="true">{initials(conversation.customerName)}</span>
          <div><h2>{conversation.customerName}</h2><span className="crm-line"><Icon name={conversation.controlMode === 'HUMAN' ? 'user' : 'chat'} size={16} />{conversation.controlMode === 'HUMAN' ? `Control humano${handoff?.mine ? ': tú' : handoff?.assignee ? `: ${handoff.assignee}` : ''}` : 'Atiende el agente'}</span></div>
        </div>
        <div className="crm-thread__actions">
          <button type="button" className="ds-btn ds-btn--secondary crm-customer-toggle" aria-pressed={pane === 'customer'} onClick={onShowCustomer}><Icon name="user" size={18} />Ficha</button>
          {handoff?.status === 'OPEN' && <button type="button" className="ds-btn ds-btn--primary" disabled={busy} onClick={() => void control('claim')}><Icon name="user" size={18} />Tomar control</button>}
          {handoff?.status === 'IN_PROGRESS' && handoff.mine && <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={() => setReleasing(true)}>Liberar control</button>}
        </div>
      </header>

      {handoff && handoff.status !== 'RESOLVED' && <div className="crm-handoff" data-status={handoff.status}>
        <Icon name={handoffMeta[handoff.status].icon} size={18} />
        <div><b>{handoffMeta[handoff.status].label}: {handoff.reason}</b><span>{handoff.context}</span>{handoff.assignee && <span>Responsable: {handoff.mine ? 'tú' : handoff.assignee}</span>}</div>
      </div>}
      {notice && <p className="orders-notice crm-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}

      <ol ref={list} className="crm-messages" aria-label="Mensajes">
        {messages.length === 0 && <li className="crm-muted">Sin mensajes.</li>}
        {messages.map(message => {
          const day = dayLabel(message.createdAt); const showDay = day !== lastDay; lastDay = day;
          return [showDay && <li key={`d-${message.id}`} className="crm-day" aria-hidden="true"><span>{day}</span></li>,
            <li key={message.id} className="crm-msg" data-author={message.authorType}>
              <p className="crm-msg__meta"><b>{authorLabels[message.authorType]}</b>{message.authorEmail ? ` · ${message.authorEmail}` : ''} · <time dateTime={message.createdAt}>{clock(message.createdAt)}</time></p>
              <p className="crm-msg__body">{message.body}</p>
            </li>];
        })}
      </ol>

      <form className="crm-reply" onSubmit={send}>
        <label htmlFor="crm-reply" className="ds-sr-only">Responder como personal</label>
        <textarea id="crm-reply" className="ds-input" rows={2} maxLength={2000} value={draft} disabled={!canReply || busy}
          onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit(); }}
          placeholder={canReply ? 'Escribe la respuesta para el cliente…' : handoff?.status === 'OPEN' ? 'Toma el control de la derivación para responder.' : 'Solo responde quien tiene el control de la derivación.'} />
        <div className="crm-reply__foot">
          <span className="crm-muted"><Icon name="alert" size={14} />Se guarda en la conversación; aún no se envía por WhatsApp.</span>
          <button type="submit" className="ds-btn ds-btn--primary" disabled={!canReply || busy || !draft.trim()}>{busy ? 'Guardando…' : 'Registrar respuesta'}<Icon name="arrowRight" size={18} /></button>
        </div>
      </form>
    </section>
    <aside className="crm-pane crm-side" aria-label="Ficha del cliente">
      <header className="crm-side__head"><button type="button" className="ds-btn ds-btn--ghost crm-back" onClick={onShowCustomer}><Icon name="arrowLeft" size={18} />Conversación</button><h2>Ficha del cliente</h2></header>
      <CustomerCard customer={customer} onOpenOrder={onOpenOrder} />
    </aside>
    <ReleaseDialog open={releasing} busy={busy} onCancel={() => setReleasing(false)} onConfirm={() => void control('release')} />
  </>;
}

export function CrmPage({ auth, onOpenOrder, initialConversation }: { auth: string; onOpenOrder: (code: string) => void; initialConversation?: string }) {
  // Abierta desde Derivaciones: «Todas» para que la conversación elegida aparezca en la lista.
  const [tab, setTab] = useState(initialConversation ? 'ALL' : 'PENDING'); const [search, setSearch] = useState(''); const [q, setQ] = useState('');
  const [data, setData] = useState<Page>(); const [counts, setCounts] = useState<Record<string, number>>({}); const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | undefined>(initialConversation); const [pane, setPane] = useState<Pane>(initialConversation ? 'thread' : 'list');
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(timer); }, [search]);

  const load = useCallback(async () => {
    const params = (forTab: string, size: number) => { const query = new URLSearchParams({ tab: forTab, size: String(size) }); if (q) query.set('q', q); return query; };
    try {
      const [list, ...totals] = await Promise.all([api<Page>(`/crm/conversations?${params(tab, 50)}`, auth), ...TABS.map(item => api<Page>(`/crm/conversations?${params(item.id, 1)}`, auth))]);
      setData(list); setCounts(Object.fromEntries(TABS.map((item, index) => [item.id, totals[index].total]))); setError('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las conversaciones.'); }
  }, [auth, tab, q]);
  useEffect(() => { void load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS); return () => clearInterval(timer); }, [load]);

  function open(id: string) { setSelected(id); setPane('thread'); }

  return <section className="crm">
    <PageHeader title="CRM" subtitle="Conversaciones con clientes (datos ficticios). Toma el control de una derivación para responder; mientras lo tengas, el agente no responde." />
    <div className="crm-layout ds-card" data-pane={pane} data-selected={Boolean(selected)}>
      <nav className="crm-pane crm-list" aria-label="Conversaciones">
        <div className="ds-tabs crm-tabs" role="tablist" aria-label="Filtrar conversaciones">
          {TABS.map(item => <button key={item.id} type="button" role="tab" className="ds-tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}{counts[item.id] !== undefined && <span className="ds-chip__count">{counts[item.id]}</span>}
          </button>)}
        </div>
        <label className="ds-search crm-search"><span className="ds-sr-only">Buscar conversaciones</span><Icon name="search" />
          <input className="ds-input" type="search" value={search} maxLength={80} placeholder="Buscar por nombre o teléfono" onChange={event => setSearch(event.target.value)} /></label>
        {error && <p className="ds-field__error crm-list__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
        {!data ? <div className="crm-list__loading">{[0, 1, 2, 3].map(index => <Skeleton key={index} height={64} radius="var(--radius-md)" />)}</div>
          : data.items.length === 0 ? <EmptyState compact illustration="done" title={q ? 'Sin resultados' : tab === 'PENDING' ? 'Todo contestado' : 'Sin conversaciones'} description={q ? 'Prueba con otro nombre o teléfono.' : tab === 'PENDING' ? 'No hay conversaciones esperando respuesta.' : 'No hay conversaciones en esta pestaña.'} />
            : <ul className="crm-items">{data.items.map(item => <li key={item.id}>
              <button type="button" className="crm-item" aria-current={selected === item.id ? 'true' : undefined} onClick={() => open(item.id)}>
                <span className="crm-avatar" aria-hidden="true">{initials(item.customerName)}{item.awaitingReply && <span className="crm-avatar__dot" />}</span>
                <span className="crm-item__body">
                  <span className="crm-item__top"><b>{item.customerName}</b><time dateTime={item.lastMessageAt}>{ago(item.lastMessageAt)}</time></span>
                  <span className="crm-item__preview">{item.lastAuthor ? `${authorLabels[item.lastAuthor as Message['authorType']] ?? item.lastAuthor}: ` : ''}{item.lastMessage || 'Sin mensajes'}</span>
                  <ConversationBadges item={item} />
                </span>
              </button>
            </li>)}</ul>}
      </nav>
      {selected ? <Thread key={selected} auth={auth} id={selected} pane={pane} onChanged={() => void load()} onBack={() => setPane('list')} onShowCustomer={() => setPane(current => current === 'customer' ? 'thread' : 'customer')} onOpenOrder={onOpenOrder} />
        : <section className="crm-pane crm-thread crm-thread--empty"><EmptyState title="Elige una conversación" description="Verás el hilo de mensajes, la derivación y la ficha del cliente con sus pedidos." /></section>}
    </div>
  </section>;
}

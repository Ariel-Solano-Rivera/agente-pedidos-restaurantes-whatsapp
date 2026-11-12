import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { api, User, useLoad } from '../../shared/api';
import '../pagos/payments.css';
import './handoffs.css';

/** `GET /handoffs`, `POST /handoffs/{id}/claim` y `/release` (ADMIN, CAJA). Tomar solo si está abierta o ya es tuya; liberar solo quien la tiene. */
type Handoff = { id: string; conversationId: string; customerName: string; reason: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; assignee: string | null; createdAt: string };
const TABS: Array<{ id: Handoff['status']; label: string }> = [{ id: 'OPEN', label: 'Abiertas' }, { id: 'IN_PROGRESS', label: 'En atención' }, { id: 'RESOLVED', label: 'Resueltas' }];
const META = { OPEN: { label: 'Abierta', status: 'REJECTED', icon: 'alert' }, IN_PROGRESS: { label: 'En atención', status: 'ACCEPTED', icon: 'user' }, RESOLVED: { label: 'Resuelta', status: 'COMPLETED', icon: 'checkCircle' } } as const;
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function ago(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 60) return relative.format(-Math.max(minutes, 0), 'minute');
  if (minutes < 1440) return relative.format(-Math.round(minutes / 60), 'hour');
  return relative.format(-Math.round(minutes / 1440), 'day');
}

export function HandoffsPage({ auth, user, onOpenConversation }: { auth: string; user: User; onOpenConversation: (conversationId: string) => void }) {
  const handoffs = useLoad<Handoff[]>('/handoffs', auth);
  const [tab, setTab] = useState<Handoff['status']>('OPEN'); const [busy, setBusy] = useState<string>(); const [releasing, setReleasing] = useState<Handoff>();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string }>();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (releasing) { if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); }, [releasing]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);
  const reload = handoffs.reload;
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 20_000); return () => clearInterval(timer); }, [reload]);

  const all = handoffs.data ?? [];
  const items = all.filter(item => item.status === tab);
  const mine = (item: Handoff) => item.assignee?.toLowerCase() === user.email.toLowerCase();

  async function act(item: Handoff, action: 'claim' | 'release') {
    setBusy(item.id);
    try {
      await api(`/handoffs/${item.id}/${action}`, auth, { method: 'POST' }); setReleasing(undefined); await handoffs.reload();
      if (action === 'claim') { setNotice({ tone: 'ok', text: `Tienes el control de la conversación con ${item.customerName}. Abriéndola en el CRM…` }); onOpenConversation(item.conversationId); }
      else setNotice({ tone: 'ok', text: `Liberaste la conversación con ${item.customerName}; vuelve al agente.` });
    } catch (caught) { setReleasing(undefined); setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo cambiar el control.' }); }
    finally { setBusy(undefined); }
  }

  return <section className="hf">
    <PageHeader title="Derivaciones" subtitle="Conversaciones que el agente pasó a una persona por ambigüedad, opción no configurada o mención de alergia. Mientras alguien tiene el control, el agente no responde." />
    <div className="ds-tabs hf-tabs" role="tablist" aria-label="Estado de las derivaciones">
      {TABS.map(item => <button key={item.id} type="button" role="tab" className="ds-tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}{handoffs.data && <span className="ds-chip__count">{all.filter(entry => entry.status === item.id).length}</span>}</button>)}
    </div>
    {notice && <p className="orders-notice hf-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}

    {handoffs.error ? <div className="ds-card"><EmptyState illustration="error" title="No pudimos cargar las derivaciones" description={handoffs.error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => void handoffs.reload()}><Icon name="refresh" />Reintentar</button>} /></div>
      : !handoffs.data ? <div className="hf-list">{[0, 1].map(index => <div key={index} className="ds-card"><Skeleton width="40%" height={20} /><Skeleton width="70%" height={14} /></div>)}</div>
        : items.length === 0 ? <div className="ds-card"><EmptyState illustration="done" title={tab === 'OPEN' ? 'Nada pendiente' : tab === 'IN_PROGRESS' ? 'Nadie está atendiendo' : 'Sin derivaciones resueltas'} description={tab === 'OPEN' ? 'No hay conversaciones esperando a una persona.' : tab === 'IN_PROGRESS' ? 'Ninguna conversación tiene control humano en este momento.' : 'Las derivaciones resueltas aparecerán aquí.'} /></div>
          : <ul className="hf-list">{items.map(item => <li key={item.id} className="ds-card hf-item" data-status={item.status} aria-busy={busy === item.id}>
            <div className="hf-item__main">
              <span className="ds-badge" data-status={META[item.status].status}><Icon name={META[item.status].icon} size={14} />{META[item.status].label}</span>
              <h2>{item.customerName}</h2>
              <p className="hf-reason"><Icon name="alert" size={16} />{item.reason}</p>
              <p className="hf-meta"><time dateTime={item.createdAt}>Derivada {ago(item.createdAt)}</time>{item.assignee && <> · Responsable: <b>{mine(item) ? 'tú' : item.assignee}</b></>}</p>
            </div>
            <div className="hf-item__actions">
              {item.status === 'OPEN' && <button type="button" className="ds-btn ds-btn--primary" disabled={busy === item.id} onClick={() => void act(item, 'claim')}><Icon name="user" size={18} />Tomar control</button>}
              {item.status === 'IN_PROGRESS' && mine(item) && <button type="button" className="ds-btn ds-btn--secondary" disabled={busy === item.id} onClick={() => setReleasing(item)}>Liberar control</button>}
              <button type="button" className="ds-btn ds-btn--ghost" onClick={() => onOpenConversation(item.conversationId)}>Abrir conversación<Icon name="arrowRight" size={16} /></button>
            </div>
          </li>)}</ul>}

    <dialog ref={dialog} className="ds-modal" aria-labelledby="hf-release-title" onCancel={event => { event.preventDefault(); if (!busy) setReleasing(undefined); }}>
      {releasing && <><div className="ds-modal__body"><h2 id="hf-release-title" style={{ fontSize: 'var(--text-xl)' }}>¿Liberar el control?</h2><p className="ds-muted" style={{ margin: 0 }}>La derivación de {releasing.customerName} quedará resuelta y la conversación volverá al agente. Queda registrado en la auditoría.</p></div>
        <div className="ds-modal__actions"><button type="button" className="ds-btn ds-btn--secondary" disabled={Boolean(busy)} onClick={() => setReleasing(undefined)}>Volver</button><button type="button" className="ds-btn ds-btn--primary" disabled={Boolean(busy)} onClick={() => void act(releasing, 'release')}>Liberar control</button></div></>}
    </dialog>
  </section>;
}

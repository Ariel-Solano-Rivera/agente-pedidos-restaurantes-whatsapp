import { useCallback, useEffect, useState } from 'react';
import { View } from '../../components/AppShell';
import { Filters } from '../pedidos/orderTypes';
import { Icon, IconName } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { api, User } from '../../shared/api';
import './home.css';

type Summary = { restaurantName: string; receptionPaused: boolean; pauseReason: string; generatedAt: string; topDish: { name: string; unitsSold: number }; tasks: Array<{ id: string; title: string; scheduledFor: string }>; cash: { collected: number; receivable: number } | null };
type Page = { total: number };
type Dish = { name: string; active: boolean; available: boolean };
type Tone = 'pending' | 'accepted' | 'preparing' | 'ready' | 'money' | 'chat' | 'alert';
type Tile = { key: string; label: string; value: string | null; hint: string; icon: IconName; tone: Tone; target: View; action: string; short: string; preset?: Partial<Filters> };
type Role = 'ADMIN' | 'CAJA' | 'COCINA';

const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
const longDate = (value: string) => new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(value));
const time = (value: string | Date) => new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'; };
const REFRESH_MS = 60_000;

function roleOf(user: User): Role {
  if (user.roles.includes('ROLE_ADMIN')) return 'ADMIN';
  return user.roles.includes('ROLE_CAJA') ? 'CAJA' : 'COCINA';
}

/** Valor de una consulta que puede fallar sin tumbar el resto del resumen. */
const settled = <T,>(result: PromiseSettledResult<T>) => result.status === 'fulfilled' ? result.value : null;

async function loadTiles(role: Role, auth: string, summary: Summary): Promise<Tile[]> {
  const count = (status: string) => api<Page>(`/orders?status=${status}&size=1`, auth).then(page => page.total);
  if (role === 'COCINA') {
    const [accepted, preparing, ready] = (await Promise.allSettled([count('ACCEPTED'), count('PREPARING'), count('READY')])).map(settled);
    return [
      { key: 'accepted', label: 'Por preparar', value: accepted === null ? null : String(accepted), hint: accepted ? 'Pedidos aceptados que esperan en cocina.' : 'No hay pedidos esperando.', icon: 'check', tone: 'accepted', target: 'pedidos', action: 'Ver pedidos por preparar', short: 'Ver pedidos', preset: { status: 'ACCEPTED' } },
      { key: 'preparing', label: 'En preparación', value: preparing === null ? null : String(preparing), hint: preparing ? 'Pedidos que se están preparando ahora.' : 'Nada en preparación.', icon: 'flame', tone: 'preparing', target: 'pedidos', action: 'Ver pedidos en preparación', short: 'Ver pedidos', preset: { status: 'PREPARING' } },
      { key: 'ready', label: 'Listos', value: ready === null ? null : String(ready), hint: ready ? 'Esperan retiro o entrega.' : 'No hay pedidos listos.', icon: 'bell', tone: 'ready', target: 'pedidos', action: 'Ver pedidos listos', short: 'Ver pedidos', preset: { status: 'READY' } },
    ];
  }
  const [pendingResult, conversationsResult, dishesResult] = await Promise.allSettled([
    count('PENDING_DECISION'),
    api<Page>('/crm/conversations?tab=PENDING&size=1', auth).then(page => page.total),
    role === 'ADMIN' ? api<Dish[]>('/menu/dishes', auth) : Promise.resolve([] as Dish[]),
  ]);
  const pending = settled(pendingResult); const conversations = settled(conversationsResult); const dishes = settled(dishesResult);
  const cash = summary.cash;
  const tiles: Tile[] = [
    { key: 'pending', label: 'Por aceptar', value: pending === null ? null : String(pending), hint: pending ? 'Solicitudes que esperan tu decisión.' : 'No hay solicitudes por decidir.', icon: 'clock', tone: 'pending', target: 'pedidos', action: 'Ver pedidos por aceptar', short: 'Ver pedidos', preset: { status: 'PENDING_DECISION' } },
  ];
  if (role === 'CAJA') tiles.push({ key: 'collected', label: 'Cobrado hoy', value: cash ? money(cash.collected) : null, hint: 'Pagos confirmados por el personal.', icon: 'coins', tone: 'money', target: 'pedidos', action: 'Ver pedidos de hoy', short: 'Ver pedidos', preset: { range: 'TODAY', paymentStatus: 'CONFIRMED' } });
  tiles.push({ key: 'receivable', label: 'Por cobrar hoy', value: cash ? money(cash.receivable) : null, hint: 'Pedidos aceptados hoy sin pago confirmado.', icon: 'wallet', tone: 'money', target: 'pedidos', action: 'Ver pedidos por cobrar', short: 'Ver pedidos', preset: { range: 'TODAY' } });
  tiles.push({ key: 'conversations', label: 'Por contestar', value: conversations === null ? null : String(conversations), hint: conversations ? 'Conversaciones cuyo último mensaje es del cliente.' : 'Todas las conversaciones están al día.', icon: 'chat', tone: 'chat', target: 'crm', action: 'Abrir conversaciones por contestar', short: 'Abrir CRM' });
  if (role === 'ADMIN') {
    const soldOut = dishes?.filter(dish => dish.active && !dish.available).map(dish => dish.name) ?? null;
    const names = soldOut && soldOut.length ? soldOut.slice(0, 2).join(', ') + (soldOut.length > 2 ? ` y ${soldOut.length - 2} más` : '') : '';
    tiles.push({ key: 'soldout', label: 'Platos agotados', value: soldOut === null ? null : String(soldOut.length), hint: soldOut?.length ? names : 'Todos los platos visibles están disponibles.', icon: 'utensilsOff', tone: 'alert', target: 'menu', action: 'Revisar disponibilidad en el menú', short: 'Revisar menú' });
  }
  return tiles;
}

const quickLinks: Array<{ view: View; title: string; text: string; icon: IconName }> = [
  { view: 'pedidos', title: 'Pedidos', text: 'Aceptar, avanzar y revisar pagos.', icon: 'receipt' },
  { view: 'crm', title: 'CRM', text: 'Responder conversaciones y ver clientes.', icon: 'chat' },
  { view: 'menu', title: 'Menú', text: 'Platos, opciones y disponibilidad.', icon: 'book' },
  { view: 'configuracion', title: 'Configuración', text: 'Colores y logo del restaurante.', icon: 'settings' },
];

export function HomePage({ auth, user, onNavigate }: { auth: string; user: User; onNavigate: (view: View, preset?: Partial<Filters>) => void }) {
  const role = roleOf(user);
  const [summary, setSummary] = useState<Summary>(); const [tiles, setTiles] = useState<Tile[]>();
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [updatedAt, setUpdatedAt] = useState<Date>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api<Summary>('/dashboard', auth);
      const nextTiles = await loadTiles(role, auth, next);
      setSummary(next); setTiles(nextTiles); setError(''); setUpdatedAt(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error de conexión');
    } finally { setLoading(false); }
  }, [auth, role]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  if (error && !summary) return <section className="home">
    <PageHeader title="Inicio" />
    <div className="ds-card"><EmptyState illustration="error" title="No pudimos cargar el resumen" description={error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => void load()}><Icon name="refresh" />Reintentar</button>} /></div>
  </section>;

  return <section className="home" aria-busy={loading}>
    <PageHeader
      title={greeting()}
      subtitle={summary ? <><b>{summary.restaurantName}</b> · <span className="home-date">{longDate(summary.generatedAt)}</span></> : <Skeleton width={220} height={16} />}
      aside={<>
        {summary && <span className="home-reception" data-paused={summary.receptionPaused}><Icon name={summary.receptionPaused ? 'pause' : 'play'} size={16} />{summary.receptionPaused ? 'Recepción pausada' : 'Recepción activa'}</span>}
        <button type="button" className="ds-btn ds-btn--ghost" onClick={() => void load()} disabled={loading} aria-label="Actualizar el resumen">
          <Icon name="refresh" className={loading ? 'home-spin' : undefined} />{updatedAt ? `Actualizado ${time(updatedAt)}` : 'Actualizando…'}
        </button>
      </>} />

    {summary?.receptionPaused && <div className="home-callout" role="status"><Icon name="pause" /><div><b>No se están recibiendo pedidos nuevos.</b><span>{summary.pauseReason || 'La recepción está pausada temporalmente.'}</span></div></div>}
    {error && summary && <p className="home-stale" role="alert"><Icon name="alert" size={16} />No se pudo actualizar: {error}. Se muestran los últimos datos.</p>}

    <h2 className="ds-eyebrow home-section-label">Ahora mismo</h2>
    <div className={`home-tiles home-tiles--${role.toLowerCase()}`}>
      {tiles ? tiles.map(tile => <button key={tile.key} type="button" className="home-tile" data-tone={tile.tone} onClick={() => onNavigate(tile.target, tile.preset)} aria-label={`${tile.label}: ${tile.value ?? 'no disponible'}. ${tile.action}`}>
        <span className="home-tile__head"><span className="home-tile__icon"><Icon name={tile.icon} /></span><span className="home-tile__label">{tile.label}</span></span>
        <span className="home-tile__value ds-num">{tile.value ?? '—'}</span>
        <span className="home-tile__hint">{tile.value === null ? 'No se pudo cargar este dato.' : tile.hint}</span>
        <span className="home-tile__go" aria-hidden="true">{tile.short}<Icon name="arrowRight" size={16} /></span>
      </button>)
        : Array.from({ length: role === 'COCINA' ? 3 : role === 'CAJA' ? 4 : 4 }, (_, index) => <div key={index} className="home-tile home-tile--loading"><Skeleton width="45%" height={16} /><Skeleton width="35%" height={36} /><Skeleton width="80%" height={12} /></div>)}
    </div>

    {role === 'ADMIN' && <div className="home-admin">
      <article className="home-dashboard-card">
        <div className="home-dashboard-card__art" aria-hidden="true"><Icon name="chart" size={40} /></div>
        <div className="home-dashboard-card__text">
          <h2>Indicadores del negocio</h2>
          <p>Cobros, ventas completadas, tiempos de decisión y preparación, platos más vendidos y su comparación con el período anterior.</p>
        </div>
        <button type="button" className="ds-btn ds-btn--primary" onClick={() => onNavigate('dashboard')}>Abrir dashboard<Icon name="arrowRight" /></button>
      </article>
      <nav className="home-links" aria-label="Accesos rápidos">
        <h2 className="ds-eyebrow home-section-label">Accesos rápidos</h2>
        <ul>{quickLinks.map(link => <li key={link.view}><button type="button" className="home-link" onClick={() => onNavigate(link.view)}>
          <Icon name={link.icon} /><span><b>{link.title}</b><small>{link.text}</small></span><Icon name="arrowRight" size={16} className="home-link__arrow" />
        </button></li>)}</ul>
      </nav>
    </div>}

    <div className="home-bottom">
    <section className="home-top-dish" aria-labelledby="home-top-dish-title">
      <h2 id="home-top-dish-title" className="ds-eyebrow home-section-label">Plato más vendido</h2>
      <div className="ds-card home-top-dish__card">
        {!summary ? <><Skeleton width="60%" height={22} /><Skeleton width="45%" height={14} /></>
          : summary.topDish.unitsSold ? <>
            <span className="home-top-dish__icon" aria-hidden="true"><Icon name="flame" size={22} /></span>
            <b className="home-top-dish__name">{summary.topDish.name}</b>
            <span className="home-top-dish__units"><b className="ds-num">{summary.topDish.unitsSold}</b> {summary.topDish.unitsSold === 1 ? 'unidad vendida' : 'unidades vendidas'} en pedidos registrados</span>
          </> : <EmptyState compact title="Aún sin ventas" description="Cuando haya pedidos registrados verás aquí el plato más pedido." />}
      </div>
    </section>
    <section className="home-tasks" aria-labelledby="home-tasks-title">
      <h2 id="home-tasks-title" className="ds-eyebrow home-section-label">Próximas tareas del equipo</h2>
      <div className="ds-card home-tasks__card">
        {!summary ? <div className="home-tasks__loading"><Skeleton height={18} /><Skeleton width="70%" height={18} /></div>
          : summary.tasks.length ? <ul>{summary.tasks.map(task => <li key={task.id}><time dateTime={task.scheduledFor} className="ds-num">{time(task.scheduledFor)}</time><span>{task.title}</span></li>)}</ul>
            : <EmptyState compact illustration="done" title="Sin tareas programadas" description="No hay tareas para los próximos días." />}
      </div>
    </section>
    </div>
  </section>;
}

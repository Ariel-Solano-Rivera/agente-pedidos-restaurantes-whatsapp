import { useEffect, useState } from 'react';
import { View } from '../../components/AppShell';
import { Icon, IconName } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { api } from '../../shared/api';
import './dashboard.css';

/** `GET /dashboard/admin`: el backend calcula todo (decimal exacto y zona horaria del restaurante); aquí solo se presenta. */
type Compare<T> = { current: T; previous: T };
type Ranked = { name: string; units: number; amount: number };
type Dashboard = {
  range: string; timezone: string; from: string; to: string; previousFrom: string; previousTo: string;
  collected: Compare<number>; receivable: Compare<number>; completedSales: Compare<number>; completedOrders: Compare<number>;
  averageTicket: Compare<number | null>; acceptanceRate: Compare<number | null>; decisionMinutes: Compare<number | null>; preparationMinutes: Compare<number | null>;
  lostSales: Array<{ cause: 'REJECTED' | 'CANCELLED' | 'EXPIRED'; count: number; amount: number; previousCount: number; previousAmount: number }>;
  newCustomers: Compare<number>; returningCustomers: Compare<number>; ordersByHour: Array<{ hour: number; orders: number }>;
  topDishes: Ranked[]; topExtras: Ranked[]; fulfillment: Array<{ mode: 'PICKUP' | 'DELIVERY'; orders: number; amount: number }>;
  openHandoffs: number; soldOutDishes: string[]; backwards: Array<{ day: string; role: string; changeType: string; count: number }>;
};
type Format = 'money' | 'count' | 'percent' | 'minutes';

const RANGES = [{ id: 'TODAY', label: 'Hoy' }, { id: 'LAST_7_DAYS', label: '7 días' }, { id: 'LAST_30_DAYS', label: '30 días' }];
const previousLabel: Record<string, string> = { TODAY: 'ayer a esta hora', LAST_7_DAYS: 'los 7 días anteriores', LAST_30_DAYS: 'los 30 días anteriores' };
const lost: Record<string, { label: string; icon: IconName }> = { REJECTED: { label: 'Rechazados', icon: 'xCircle' }, CANCELLED: { label: 'Cancelados', icon: 'ban' }, EXPIRED: { label: 'Vencidos', icon: 'hourglass' } };
const roleLabels: Record<string, string> = { ADMIN: 'Administración', CAJA: 'Caja', COCINA: 'Cocina' };
const moneyFormat = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const dayFormat = new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function show(value: number | null | undefined, format: Format) {
  if (value === null || value === undefined) return 'Sin datos';
  const number = Number(value);
  if (format === 'money') return moneyFormat.format(number);
  if (format === 'percent') return `${(number * 100).toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`;
  if (format === 'minutes') return `${number.toLocaleString('es-EC', { maximumFractionDigits: 1 })} min`;
  return number.toLocaleString('es-EC');
}

/** Variación con flecha y texto, en tinta neutra: subir no siempre es bueno (p. ej., por cobrar o tiempos). */
function Delta({ value, format, range }: { value: Compare<number | null>; format: Format; range: string }) {
  const { current, previous } = value;
  if (current == null || previous == null) return <span className="db-delta">Sin datos para comparar</span>;
  const diff = Number(current) - Number(previous);
  if (diff === 0) return <span className="db-delta"><span aria-hidden="true">=</span> Igual que {previousLabel[range]}</span>;
  const shown = format === 'percent' ? `${(Math.abs(diff) * 100).toLocaleString('es-EC', { maximumFractionDigits: 1 })} pp` : show(Math.abs(diff), format);
  return <span className="db-delta" data-trend={diff > 0 ? 'up' : 'down'}>
    <span aria-hidden="true">{diff > 0 ? '▲' : '▼'}</span><span className="ds-sr-only">{diff > 0 ? 'Sube' : 'Baja'}</span> <b className="ds-num">{shown}</b> vs. {previousLabel[range]}
  </span>;
}

function Kpi({ label, icon, value, format, range, hint, hero = false }: { label: string; icon: IconName; value: Compare<number | null>; format: Format; range: string; hint?: string; hero?: boolean }) {
  return <article className={`db-kpi ${hero ? 'db-kpi--hero' : ''}`}>
    <span className="db-kpi__label"><Icon name={icon} size={18} />{label}</span>
    <strong className="db-kpi__value ds-num">{show(value.current, format)}</strong>
    <Delta value={value} format={format} range={range} />
    {hint && <span className="db-kpi__hint">{hint}</span>}
  </article>;
}

/** Columnas de una serie (magnitud): ≤ 24 px, extremo de datos redondeado, cuadrado en la base, eje recesivo y tooltip por barra. */
function HourChart({ data }: { data: Dashboard['ordersByHour'] }) {
  const [hover, setHover] = useState<number>();
  const max = Math.max(1, ...data.map(item => item.orders));
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const peak = data.reduce((best, item) => item.orders > best.orders ? item : best, data[0] ?? { hour: 0, orders: 0 });
  const slot = 28, bar = 16, height = 160, left = 28, width = left + 24 * slot;
  const y = (value: number) => height - (value / top) * height;
  const active = hover !== undefined ? data.find(item => item.hour === hover) : undefined;
  return <figure className="ds-card db-card db-card--wide">
    <figcaption className="db-card__head"><h2>Pedidos por hora</h2><p>{peak.orders ? <>Hora pico: <b className="ds-num">{peak.hour}:00</b> con <b className="ds-num">{peak.orders}</b> {peak.orders === 1 ? 'pedido' : 'pedidos'}.</> : 'Sin pedidos en el período.'}</p></figcaption>
    <div className="db-chart">
      <svg viewBox={`0 0 ${width} ${height + 26}`} role="img" aria-label={`Pedidos por hora local. Máximo ${max} a las ${peak.hour}:00.`} onMouseLeave={() => setHover(undefined)}>
        {[0, top / 2, top].map(tick => <g key={tick} className="db-grid"><line x1={left} x2={width} y1={y(tick)} y2={y(tick)} /><text x={left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
        {data.map((item, index) => {
          const x = left + index * slot + (slot - bar) / 2;
          const h = item.orders ? Math.max(4, height - y(item.orders)) : 0;
          return <g key={item.hour} className="db-bar" data-active={hover === item.hour} tabIndex={0} aria-label={`${item.hour}:00 a ${item.hour}:59, ${item.orders} ${item.orders === 1 ? 'pedido' : 'pedidos'}`}
            onMouseEnter={() => setHover(item.hour)} onFocus={() => setHover(item.hour)} onBlur={() => setHover(undefined)}>
            <rect className="db-bar__hit" x={left + index * slot} y={0} width={slot} height={height} />
            {h > 0 && <path className="db-bar__mark" d={`M${x},${height} V${height - h + 4} q0,-4 4,-4 h${bar - 8} q4,0 4,4 V${height} Z`} />}
            {index % 3 === 0 && <text className="db-axis" x={left + index * slot + slot / 2} y={height + 18} textAnchor="middle">{item.hour}</text>}
          </g>;
        })}
      </svg>
      {active && <div className="db-tooltip" role="status" style={{ left: `${((left + data.indexOf(active) * slot + slot / 2) / width) * 100}%` }}>
        <b className="ds-num">{active.hour}:00 – {active.hour}:59</b><span><span className="db-swatch" aria-hidden="true" />{active.orders} {active.orders === 1 ? 'pedido' : 'pedidos'}</span>
      </div>}
    </div>
    <details className="db-table-toggle"><summary>Ver como tabla</summary>
      <div className="ds-table-wrap"><table className="ds-table"><thead><tr><th scope="col">Hora</th><th scope="col" className="is-num">Pedidos</th></tr></thead>
        <tbody>{data.filter(item => item.orders).map(item => <tr key={item.hour}><td className="ds-num">{item.hour}:00</td><td className="is-num">{item.orders}</td></tr>)}</tbody></table></div>
    </details>
  </figure>;
}

/** Lista de barras horizontales de una serie con etiqueta directa (nombre, unidades e importe). */
function BarList({ title, items, empty, unit }: { title: string; items: Array<{ name: string; value: number; detail?: string }>; empty: string; unit: string }) {
  const max = Math.max(1, ...items.map(item => item.value));
  return <figure className="ds-card db-card">
    <figcaption className="db-card__head"><h2>{title}</h2></figcaption>
    {items.length ? <ol className="db-bars">{items.map(item => <li key={item.name} title={`${item.name}: ${item.value} ${unit}${item.detail ? ` · ${item.detail}` : ''}`}>
      <div className="db-bars__label"><span>{item.name}</span><b className="ds-num">{item.value.toLocaleString('es-EC')} {unit}</b></div>
      <div className="db-bars__track"><div className="db-bars__fill" style={{ width: `${(item.value / max) * 100}%` }} /></div>
      {item.detail && <span className="db-bars__detail ds-num">{item.detail}</span>}
    </li>)}</ol> : <EmptyState compact title="Sin datos" description={empty} />}
  </figure>;
}

export function DashboardPage({ auth, onNavigate }: { auth: string; onNavigate: (view: View) => void }) {
  const [range, setRange] = useState('TODAY'); const [data, setData] = useState<Dashboard>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<Dashboard>(`/dashboard/admin?range=${range}`, auth).then(result => { if (active) setData(result); })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'No se pudo cargar el dashboard.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth, range, attempt]);

  const filters = <fieldset className="ds-filter-group db-range" aria-label="Período">
    {RANGES.map(item => <button key={item.id} type="button" className="ds-chip" aria-pressed={range === item.id} onClick={() => setRange(item.id)}><Icon name="check" size={16} className="ds-chip__check" />{item.label}</button>)}
  </fieldset>;

  return <section className="db" aria-busy={loading}>
    <PageHeader title="Dashboard" subtitle="Indicadores del negocio frente al período anterior de igual duración. Solo lectura." aside={filters} />
    {data && <p className="db-note"><Icon name="calendar" size={16} />Comparado con {previousLabel[data.range]} · zona horaria {data.timezone} · montos con los precios copiados en cada pedido. No se calcula ganancia porque el sistema no guarda costos.</p>}

    {error && !data ? <div className="ds-card"><EmptyState illustration="error" title="No pudimos calcular los indicadores" description={error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => setAttempt(value => value + 1)}><Icon name="refresh" />Reintentar</button>} /></div>
      : !data ? <div className="db-kpis">{Array.from({ length: 4 }, (_, index) => <div key={index} className="db-kpi db-kpi--hero"><Skeleton width="50%" height={16} /><Skeleton width="65%" height={36} /><Skeleton width="80%" height={12} /></div>)}</div>
        : <div className={`db-body ${loading ? 'is-refreshing' : ''}`}>
          {error && <p className="db-stale" role="alert"><Icon name="alert" size={16} />No se pudo actualizar: {error}</p>}
          <h2 className="ds-eyebrow db-section">Ingresos y cobros</h2>
          <div className="db-kpis">
            <Kpi hero icon="coins" label="Cobrado" value={data.collected} format="money" range={data.range} hint="Pagos confirmados por el personal." />
            <Kpi hero icon="wallet" label="Por cobrar" value={data.receivable} format="money" range={data.range} hint="Aceptados sin pago confirmado." />
            <Kpi hero icon="checkDouble" label="Ventas completadas" value={data.completedSales} format="money" range={data.range} hint={`${data.completedOrders.current} ${data.completedOrders.current === 1 ? 'pedido completado' : 'pedidos completados'}.`} />
            <Kpi hero icon="receipt" label="Ticket promedio" value={data.averageTicket} format="money" range={data.range} hint="Por pedido completado." />
          </div>
          <h2 className="ds-eyebrow db-section">Operación y clientes</h2>
          <div className="db-kpis">
            <Kpi icon="check" label="Tasa de aceptación" value={data.acceptanceRate} format="percent" range={data.range} />
            <Kpi icon="clock" label="Tiempo de decisión" value={data.decisionMinutes} format="minutes" range={data.range} hint="De la confirmación a la decisión." />
            <Kpi icon="flame" label="Tiempo de preparación" value={data.preparationMinutes} format="minutes" range={data.range} hint="De aceptado a listo." />
            <Kpi icon="user" label="Clientes nuevos" value={data.newCustomers} format="count" range={data.range} hint={`${data.returningCustomers.current} recurrentes.`} />
          </div>

          <div className="db-grid">
            <HourChart data={data.ordersByHour} />
            <BarList title="Retiro frente a entrega" unit={data.fulfillment.reduce((total, item) => total + item.orders, 0) === 1 ? 'pedido' : 'pedidos'} empty="Sin pedidos completados en el período."
              items={data.fulfillment.map(item => ({ name: item.mode === 'PICKUP' ? 'Retiro en local' : 'Entrega', value: item.orders, detail: show(item.amount, 'money') }))} />
          </div>
          <div className="db-grid db-grid--halves">
            <BarList title="Platos más vendidos" unit="u." empty="Sin pedidos completados en el período." items={data.topDishes.map(item => ({ name: item.name, value: item.units, detail: show(item.amount, 'money') }))} />
            <BarList title="Extras más pedidos" unit="u." empty="Sin extras en pedidos completados." items={data.topExtras.map(item => ({ name: item.name, value: item.units, detail: show(item.amount, 'money') }))} />
          </div>

          <h2 className="ds-eyebrow db-section">Ventas no concretadas</h2>
          <div className="db-lost">{data.lostSales.map(item => <article key={item.cause} className="db-kpi db-kpi--lost" data-cause={item.cause}>
            <span className="db-kpi__label"><Icon name={lost[item.cause].icon} size={18} />{lost[item.cause].label}</span>
            <strong className="db-kpi__value ds-num">{show(item.amount, 'money')}</strong>
            <span className="db-kpi__hint ds-num">{item.count} {item.count === 1 ? 'pedido' : 'pedidos'} · antes {item.previousCount} ({show(item.previousAmount, 'money')})</span>
          </article>)}</div>

          <div className="db-grid db-grid--halves">
            <section className="ds-card db-card" aria-labelledby="db-now">
              <div className="db-card__head"><h2 id="db-now">Ahora mismo</h2><p>Estado actual, no depende del período.</p></div>
              <div className="db-now">
                <button type="button" className="db-now__item" onClick={() => onNavigate('crm')}><Icon name="chat" /><span><b className="ds-num">{data.openHandoffs}</b>Derivaciones sin contestar</span><Icon name="arrowRight" size={16} /></button>
                <button type="button" className="db-now__item" onClick={() => onNavigate('menu')}><Icon name="utensilsOff" /><span><b className="ds-num">{data.soldOutDishes.length}</b>Platos agotados</span><Icon name="arrowRight" size={16} /></button>
              </div>
              {data.soldOutDishes.length > 0 && <p className="db-soldout">{data.soldOutDishes.join(' · ')}</p>}
            </section>
            <section className="ds-card db-card" aria-labelledby="db-back">
              <div className="db-card__head"><h2 id="db-back">Retrocesos y deshacer</h2><p>Por día, rol y tipo de cambio.</p></div>
              {data.backwards.length ? <div className="ds-table-wrap"><table className="ds-table"><thead><tr><th scope="col">Día</th><th scope="col">Rol</th><th scope="col">Tipo</th><th scope="col" className="is-num">Cantidad</th></tr></thead><tbody>
                {data.backwards.map(item => <tr key={`${item.day}-${item.role}-${item.changeType}`}><td>{dayFormat.format(new Date(item.day + 'T00:00:00Z'))}</td><td>{roleLabels[item.role] ?? item.role}</td>
                  <td><span className="db-change"><Icon name={item.changeType === 'RETROCESO' ? 'arrowLeft' : 'undo'} size={14} />{item.changeType === 'RETROCESO' ? 'Retroceso' : 'Deshacer'}</span></td><td className="is-num">{item.count}</td></tr>)}
              </tbody></table></div> : <EmptyState compact illustration="done" title="Sin retrocesos" description="No hubo retrocesos ni deshacer en el período." />}
            </section>
          </div>
        </div>}
  </section>;
}

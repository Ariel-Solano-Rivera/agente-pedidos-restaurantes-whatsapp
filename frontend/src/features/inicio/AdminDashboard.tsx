import { useEffect, useState } from 'react';
import { api } from '../../shared/api';

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

const ranges = [{ id: 'TODAY', label: 'Hoy' }, { id: 'LAST_7_DAYS', label: '7 días' }, { id: 'LAST_30_DAYS', label: '30 días' }];
const previousLabel: Record<string, string> = { TODAY: 'ayer a esta hora', LAST_7_DAYS: 'los 7 días anteriores', LAST_30_DAYS: 'los 30 días anteriores' };
const lostLabels = { REJECTED: 'Rechazados', CANCELLED: 'Cancelados', EXPIRED: 'Vencidos' };
const roleLabels: Record<string, string> = { ADMIN: 'Administración', CAJA: 'Caja', COCINA: 'Cocina' };
const moneyFormat = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

function show(value: number | null, format: Format) {
  if (value === null || value === undefined) return 'Sin datos';
  const number = Number(value);
  if (format === 'money') return moneyFormat.format(number);
  if (format === 'percent') return `${(number * 100).toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`;
  if (format === 'minutes') return `${number.toLocaleString('es-EC', { maximumFractionDigits: 1 })} min`;
  return number.toLocaleString('es-EC');
}

/** Variación en texto (flecha + valor): nunca depende solo del color. */
function Delta({ value, format, range }: { value: Compare<number | null>; format: Format; range: string }) {
  const { current, previous } = value;
  if (current === null || previous === null || current === undefined || previous === undefined) return <small className="kpi-delta">Sin datos para comparar con {previousLabel[range]}</small>;
  const diff = Number(current) - Number(previous);
  if (diff === 0) return <small className="kpi-delta">Igual que {previousLabel[range]}</small>;
  const shown = format === 'percent' ? `${(Math.abs(diff) * 100).toLocaleString('es-EC', { maximumFractionDigits: 1 })} pp` : show(Math.abs(diff), format);
  return <small className="kpi-delta">{diff > 0 ? '▲' : '▼'} {shown} vs. {previousLabel[range]}</small>;
}

function Kpi({ label, value, format, range, hint }: { label: string; value: Compare<number | null>; format: Format; range: string; hint?: string }) {
  return <article className="kpi-tile"><span>{label}</span><strong>{show(value.current, format)}</strong><Delta value={value} format={format} range={range} />{hint && <p>{hint}</p>}</article>;
}

function HourChart({ data }: { data: Dashboard['ordersByHour'] }) {
  const max = Math.max(1, ...data.map(item => item.orders));
  const peak = data.reduce((best, item) => item.orders > best.orders ? item : best, data[0]);
  const width = 24 * 22, height = 140;
  return <figure className="chart-card">
    <figcaption><h3>Pedidos por hora</h3><p>{peak?.orders ? `Hora con más pedidos: ${peak.hour}:00 (${peak.orders}).` : 'Sin pedidos en el período.'}</p></figcaption>
    <svg viewBox={`0 0 ${width} ${height + 22}`} role="img" aria-label="Pedidos creados por hora local" className="hour-chart">
      <line x1="0" x2={width} y1={height} y2={height} className="chart-axis" />
      {data.map((item, index) => {
        const barHeight = item.orders ? Math.max(4, (item.orders / max) * (height - 16)) : 0;
        const x = index * 22 + 3;
        return <g key={item.hour} className="hour-bar" tabIndex={0} aria-label={`${item.hour}:00, ${item.orders} pedidos`}>
          <title>{`${item.hour}:00 – ${item.hour}:59 · ${item.orders} pedido${item.orders === 1 ? '' : 's'}`}</title>
          <rect x={index * 22} y="0" width="22" height={height} className="hit" />
          {barHeight > 0 && <path className="bar" d={`M${x},${height} V${height - barHeight + 4} q0,-4 4,-4 h8 q4,0 4,4 V${height} Z`} />}
          {index % 3 === 0 && <text x={x + 8} y={height + 16} textAnchor="middle">{item.hour}</text>}
        </g>;
      })}
    </svg>
    <details><summary>Ver tabla</summary><table className="data-table"><thead><tr><th>Hora</th><th>Pedidos</th></tr></thead><tbody>{data.filter(item => item.orders).map(item => <tr key={item.hour}><td>{item.hour}:00</td><td>{item.orders}</td></tr>)}</tbody></table></details>
  </figure>;
}

function BarList({ title, items, empty, unit }: { title: string; items: Array<{ name: string; value: number; detail: string }>; empty: string; unit: string }) {
  const max = Math.max(1, ...items.map(item => item.value));
  return <figure className="chart-card"><figcaption><h3>{title}</h3></figcaption>
    {items.length ? <ol className="bar-list">{items.map(item => <li key={item.name} title={`${item.name}: ${item.value} ${unit} · ${item.detail}`}>
      <div className="bar-list-label"><span>{item.name}</span><b>{item.value} {unit}</b></div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} /></div><small>{item.detail}</small>
    </li>)}</ol> : <p className="empty-state">{empty}</p>}
  </figure>;
}

export function AdminDashboard({ auth }: { auth: string }) {
  const [range, setRange] = useState('TODAY'); const [data, setData] = useState<Dashboard>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<Dashboard>(`/dashboard/admin?range=${range}`, auth).then(result => { if (active) setData(result); })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'No se pudo cargar el dashboard.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth, range]);

  return <section className="admin-dashboard" aria-busy={loading}>
    <div className="dashboard-toolbar"><h2>Indicadores del negocio</h2>
      <div className="segmented" role="group" aria-label="Rango de fechas">{ranges.map(item => <button key={item.id} type="button" className={range === item.id ? 'active' : ''} aria-pressed={range === item.id} onClick={() => setRange(item.id)}>{item.label}</button>)}</div>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {!data && loading && <p className="empty-state">Calculando indicadores…</p>}
    {data && <div className={loading ? 'dashboard-body refreshing' : 'dashboard-body'}>
      <p className="dashboard-note">Comparado con {previousLabel[data.range]}. Montos con los precios copiados en cada pedido; zona horaria {data.timezone}. No se calcula ganancia porque el sistema no guarda costos.</p>
      <div className="kpi-grid">
        <Kpi label="Cobrado" value={data.collected} format="money" range={data.range} hint="Pagos confirmados por el personal." />
        <Kpi label="Por cobrar" value={data.receivable} format="money" range={data.range} hint="Pedidos aceptados sin pago confirmado." />
        <Kpi label="Ventas completadas" value={data.completedSales} format="money" range={data.range} hint={`${data.completedOrders.current} pedidos completados.`} />
        <Kpi label="Ticket promedio" value={data.averageTicket} format="money" range={data.range} />
        <Kpi label="Tasa de aceptación" value={data.acceptanceRate} format="percent" range={data.range} />
        <Kpi label="Tiempo de decisión" value={data.decisionMinutes} format="minutes" range={data.range} hint="De la confirmación del cliente a la decisión." />
        <Kpi label="Tiempo de preparación" value={data.preparationMinutes} format="minutes" range={data.range} hint="De aceptado a listo." />
        <Kpi label="Clientes nuevos" value={data.newCustomers} format="count" range={data.range} hint={`${data.returningCustomers.current} recurrentes.`} />
      </div>
      <section className="lost-sales" aria-label="Ventas no concretadas"><h3>Ventas no concretadas</h3><div className="kpi-grid compact">{data.lostSales.map(item =>
        <article key={item.cause} className="kpi-tile"><span>{lostLabels[item.cause]}</span><strong>{show(item.amount, 'money')}</strong><small className="kpi-delta">{item.count} pedido{item.count === 1 ? '' : 's'} · antes {item.previousCount} ({show(item.previousAmount, 'money')})</small></article>)}</div></section>
      <div className="chart-grid">
        <HourChart data={data.ordersByHour} />
        <BarList title="Platos más vendidos" unit="u." empty="Sin pedidos completados en el período." items={data.topDishes.map(item => ({ name: item.name, value: item.units, detail: show(item.amount, 'money') }))} />
        <BarList title="Extras más pedidos" unit="u." empty="Sin extras en pedidos completados." items={data.topExtras.map(item => ({ name: item.name, value: item.units, detail: show(item.amount, 'money') }))} />
        <BarList title="Retiro frente a entrega" unit="pedidos" empty="Sin pedidos completados." items={data.fulfillment.map(item => ({ name: item.mode === 'PICKUP' ? 'Retiro en local' : 'Entrega', value: item.orders, detail: show(item.amount, 'money') }))} />
      </div>
      <div className="chart-grid">
        <article className="chart-card"><h3>Ahora mismo</h3><dl className="snapshot"><div><dt>Derivaciones sin contestar</dt><dd>{data.openHandoffs}</dd></div><div><dt>Platos agotados</dt><dd>{data.soldOutDishes.length}</dd></div></dl>
          {data.soldOutDishes.length > 0 && <p className="sold-out-list">{data.soldOutDishes.join(' · ')}</p>}</article>
        <article className="chart-card"><h3>Retrocesos y deshacer por día</h3>{data.backwards.length ? <table className="data-table"><thead><tr><th>Día</th><th>Rol</th><th>Tipo</th><th>Cantidad</th></tr></thead><tbody>
          {data.backwards.map(item => <tr key={`${item.day}-${item.role}-${item.changeType}`}><td>{item.day}</td><td>{roleLabels[item.role] || item.role}</td><td>{item.changeType === 'RETROCESO' ? 'Retroceso' : 'Deshacer'}</td><td>{item.count}</td></tr>)}</tbody></table>
          : <p className="empty-state">Sin retrocesos en el período.</p>}</article>
      </div>
    </div>}
  </section>;
}

import { User, useLoad } from '../../shared/api';
import { AdminDashboard } from './AdminDashboard';

type Summary = { restaurantName: string; receptionPaused: boolean; pauseReason: string; generatedAt: string; topDish: { name: string; unitsSold: number }; tasks: Array<{ id: string; title: string; scheduledFor: string }>; cash: { collected: number; receivable: number } | null };
const formatDate = (value: string) => new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);

export function HomePage({ auth, user, logoUrl }: { auth: string; user: User; logoUrl?: string }) {
  const { data, error } = useLoad<Summary>('/dashboard', auth);
  const admin = user.roles.includes('ROLE_ADMIN');
  if (error) return <section className="page-state"><h1>Inicio</h1><p className="error">No se pudo cargar el resumen: {error}</p></section>;
  if (!data) return <section className="page-state" aria-busy="true"><h1>Inicio</h1><p>Cargando resumen del negocio…</p></section>;
  return <section className="home-page">
    <header className="page-heading"><div><h1>Bienvenido, {user.email.split('@')[0]}</h1><p>{formatDate(data.generatedAt)}</p></div><span className={data.receptionPaused ? 'reception paused' : 'reception'}>{data.receptionPaused ? 'Recepción pausada' : 'Recepción activa'}</span></header>
    <section className="business-overview" aria-label="Resumen del negocio">
      <div className="business-identity"><img src={logoUrl || '/tesis-logo.png'} alt="" /><div><h2>{data.restaurantName}</h2><p>{data.receptionPaused ? data.pauseReason || 'La recepción está temporalmente pausada.' : 'El negocio está disponible para recibir solicitudes.'}</p></div></div>
      {!admin && <div className="top-dish"><span>Plato más vendido</span><strong>{data.topDish.name}</strong><p>{data.topDish.unitsSold ? `${data.topDish.unitsSold} unidades en pedidos registrados` : 'Aún no hay pedidos registrados.'}</p></div>}
    </section>
    {!admin && data.cash && <section className="kpi-grid compact cash-today" aria-label="Caja de hoy">
      <article className="kpi-tile"><span>Cobrado hoy</span><strong>{money(data.cash.collected)}</strong><p>Pagos confirmados por el personal.</p></article>
      <article className="kpi-tile"><span>Por cobrar hoy</span><strong>{money(data.cash.receivable)}</strong><p>Pedidos aceptados hoy sin pago confirmado.</p></article>
    </section>}
    {admin && <AdminDashboard auth={auth} />}
    <section className="scheduled-tasks"><div className="section-heading"><h2>Tareas programadas</h2><p>Información compartida con todo el equipo.</p></div>{data.tasks.length ? <ul>{data.tasks.map(task => <li key={task.id}><time dateTime={task.scheduledFor}>{formatTime(task.scheduledFor)}</time><span>{task.title}</span></li>)}</ul> : <p className="empty-state">No hay tareas programadas para los próximos días.</p>}</section>
  </section>;
}

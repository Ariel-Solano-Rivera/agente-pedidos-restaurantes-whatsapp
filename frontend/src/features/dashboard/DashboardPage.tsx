import { PageHeader } from '../../design/States';
import { AdminDashboard } from './AdminDashboard';

/** Página propia del dashboard de ADMIN (antes dentro de Inicio). Su rediseño visual es la etapa 5. */
export function DashboardPage({ auth }: { auth: string }) {
  return <section>
    <PageHeader title="Dashboard" subtitle="Indicadores del negocio con comparación frente al período anterior. Solo lectura." />
    <div className="legacy-page" data-theme="light"><AdminDashboard auth={auth} /></div>
  </section>;
}

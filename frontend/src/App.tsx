import { FormEvent, useEffect, useState } from 'react';
import { ReactNode } from 'react';
import { AppShell, canSee, View } from './components/AppShell';
import { CatalogPage } from './features/catalogo/CatalogPage';
import { CrmPage } from './features/crm/CrmPage';
import { SettingsPage } from './features/configuracion/SettingsPage';
import { KitchenBoard } from './features/cocina/KitchenBoard';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { HomePage } from './features/inicio/HomePage';
import { MenuPage } from './features/menu/MenuPage';
import { OrdersPage } from './features/pedidos/OrdersPage';
import { Filters } from './features/pedidos/orderTypes';
import { api, User } from './shared/api';
import { useBranding } from './shared/branding';

const initialAuth = localStorage.getItem('restaurant.auth') || '';

function Login({ onLogin }: { onLogin: (auth: string, user: User) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!email.trim() || !password) { setError('Ingresa tu usuario o correo y tu contraseña para continuar.'); return; } setError(''); setSubmitting(true); try { const auth = btoa(`${email.trim()}:${password}`); onLogin(auth, await api<User>('/me', auth)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.'); } finally { setSubmitting(false); } }
  return <main className="login"><section className="login-brand" aria-label="Plataforma administrativa de la tesis"><img src="/tesis-logo.png" alt="Logo del agente inteligente para restaurantes" /><p>Gestión de pedidos e inventario para negocios locales.</p></section><section className="login-panel"><div className="login-heading"><h1>Inicia sesión</h1><p>Accede al panel administrativo del restaurante.</p></div><form onSubmit={submit}><label htmlFor="login-identity">Usuario o correo<input id="login-identity" name="username" autoComplete="username" placeholder="Ej.: admin@marazul.test" value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(error)} disabled={submitting} /></label><label htmlFor="login-password">Contraseña<input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Ej.: password" value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(error)} disabled={submitting} /></label>{error && <p className="error" role="alert">{error}</p>}<button type="submit" disabled={submitting}>{submitting ? 'Ingresando…' : 'Iniciar sesión'}</button></form><p className="login-demo">Acceso de demostración: <b>admin@marazul.test</b> · contraseña <b>password</b></p></section></main>;
}

export default function App() {
  const [auth, setAuth] = useState(initialAuth); const [user, setUser] = useState<User | null>(null); const [view, setView] = useState<View>('inicio');
  /** Filtros con los que Inicio abre Pedidos (p. ej., «Por aceptar»); el menú lateral los descarta. */
  const [ordersPreset, setOrdersPreset] = useState<Partial<Filters>>();
  const navigate = (next: View, preset?: Partial<Filters>) => { setOrdersPreset(preset); setView(next); };
  const brand = useBranding(auth, Boolean(auth && user));
  useEffect(() => { if (auth) api<User>('/me', auth).then(setUser).catch(() => { setAuth(''); localStorage.removeItem('restaurant.auth'); }); }, [auth]);
  if (!auth || !user) return <Login onLogin={(nextAuth, nextUser) => { localStorage.setItem('restaurant.auth', nextAuth); setAuth(nextAuth); setUser(nextUser); }} />;
  const current: View = canSee(user, view) ? view : 'inicio';
  /** Páginas aún no rediseñadas: conservan sus estilos en una zona de tema claro (ver frontend/sdd/app-shell-auth.md). */
  const legacy = (page: ReactNode) => <div className="legacy-page" data-theme="light">{page}</div>;
  const content = current === 'inicio' ? <HomePage auth={auth} user={user} onNavigate={navigate} />
    : current === 'dashboard' ? <DashboardPage auth={auth} onNavigate={view => navigate(view)} />
    : current === 'cocina' ? <KitchenBoard auth={auth} user={user} />
      : current === 'catalogo' ? legacy(<CatalogPage auth={auth} user={user} />)
        : current === 'menu' ? <MenuPage auth={auth} user={user} />
          : current === 'crm' ? <CrmPage auth={auth} onOpenOrder={code => navigate('pedidos', { q: code })} />
            : current === 'configuracion' ? legacy(<SettingsPage auth={auth} branding={brand.branding} logoUrl={brand.logoUrl} onBrandingChanged={brand.reload} />)
              : <OrdersPage key={JSON.stringify(ordersPreset ?? {})} auth={auth} user={user} preset={ordersPreset} />;
  return <AppShell user={user} logoUrl={brand.logoUrl} view={current} onViewChange={next => navigate(next)} onLogout={() => { localStorage.removeItem('restaurant.auth'); setAuth(''); setUser(null); navigate('inicio'); }}>{content}</AppShell>;
}

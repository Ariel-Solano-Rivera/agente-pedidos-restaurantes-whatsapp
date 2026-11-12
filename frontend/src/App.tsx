import { useEffect, useState } from 'react';
import { AppShell, canSee, View } from './components/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { CatalogPage } from './features/catalogo/CatalogPage';
import { CrmPage } from './features/crm/CrmPage';
import { SettingsPage } from './features/configuracion/SettingsPage';
import { KitchenBoard } from './features/cocina/KitchenBoard';
import { OperationPage } from './features/operacion/OperationPage';
import { PaymentsPage } from './features/pagos/PaymentsPage';
import { HandoffsPage } from './features/derivaciones/HandoffsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { HomePage } from './features/inicio/HomePage';
import { MenuPage } from './features/menu/MenuPage';
import { OrdersPage } from './features/pedidos/OrdersPage';
import { Filters } from './features/pedidos/orderTypes';
import { api, User } from './shared/api';
import { useBranding } from './shared/branding';

const initialAuth = localStorage.getItem('restaurant.auth') || '';

export default function App() {
  const [auth, setAuth] = useState(initialAuth); const [user, setUser] = useState<User | null>(null); const [view, setView] = useState<View>('inicio');
  /** Filtros con los que Inicio abre Pedidos (p. ej., «Por aceptar»); el menú lateral los descarta. */
  const [ordersPreset, setOrdersPreset] = useState<Partial<Filters>>();
  /** Conversación con la que Derivaciones abre el CRM. */
  const [crmConversation, setCrmConversation] = useState<string>();
  const navigate = (next: View, preset?: Partial<Filters>, conversation?: string) => { setOrdersPreset(preset); setCrmConversation(conversation); setView(next); };
  const brand = useBranding(auth, Boolean(auth && user));
  useEffect(() => { if (auth) api<User>('/me', auth).then(setUser).catch(() => { setAuth(''); localStorage.removeItem('restaurant.auth'); }); }, [auth]);
  if (!auth || !user) return <LoginPage onLogin={(nextAuth, nextUser) => { localStorage.setItem('restaurant.auth', nextAuth); setAuth(nextAuth); setUser(nextUser); }} />;
  const current: View = canSee(user, view) ? view : 'inicio';
  const content = current === 'inicio' ? <HomePage auth={auth} user={user} onNavigate={navigate} />
    : current === 'dashboard' ? <DashboardPage auth={auth} onNavigate={view => navigate(view)} />
    : current === 'cocina' ? <KitchenBoard auth={auth} user={user} />
      : current === 'catalogo' ? <CatalogPage auth={auth} user={user} />
        : current === 'operacion' ? <OperationPage auth={auth} user={user} />
        : current === 'menu' ? <MenuPage auth={auth} user={user} />
          : current === 'crm' ? <CrmPage key={crmConversation ?? 'crm'} auth={auth} initialConversation={crmConversation} onOpenOrder={code => navigate('pedidos', { q: code })} />
          : current === 'derivaciones' ? <HandoffsPage auth={auth} user={user} onOpenConversation={id => navigate('crm', undefined, id)} />
          : current === 'pagos' ? <PaymentsPage auth={auth} onOpenOrder={code => navigate('pedidos', { q: code })} />
            : current === 'configuracion' ? <SettingsPage auth={auth} branding={brand.branding} logoUrl={brand.logoUrl} onBrandingChanged={brand.reload} />
              : <OrdersPage key={JSON.stringify(ordersPreset ?? {})} auth={auth} user={user} preset={ordersPreset} />;
  return <AppShell user={user} logoUrl={brand.logoUrl} view={current} onViewChange={next => navigate(next)} onLogout={() => { localStorage.removeItem('restaurant.auth'); setAuth(''); setUser(null); navigate('inicio'); }}>{content}</AppShell>;
}

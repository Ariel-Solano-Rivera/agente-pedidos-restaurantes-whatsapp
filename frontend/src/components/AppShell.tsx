import { ReactNode } from 'react';
import { User } from '../shared/api';

export type View = 'inicio' | 'catalogo' | 'menu' | 'pedidos' | 'crm' | 'configuracion';
type IconName = 'home' | 'catalog' | 'menu' | 'orders' | 'crm' | 'settings' | 'user' | 'logout';
/** `roles` solo oculta secciones que el backend negaría con 403; la autorización sigue en el backend. */
const navigation: Array<{ id: View; label: string; icon: IconName; roles?: string[] }> = [{ id: 'inicio', label: 'Inicio', icon: 'home' }, { id: 'pedidos', label: 'Pedidos', icon: 'orders' }, { id: 'crm', label: 'CRM', icon: 'crm', roles: ['ROLE_ADMIN', 'ROLE_CAJA'] }, { id: 'menu', label: 'Menú', icon: 'menu' }, { id: 'catalogo', label: 'Catálogo', icon: 'catalog' }, { id: 'configuracion', label: 'Configuración', icon: 'settings', roles: ['ROLE_ADMIN'] }];

function SidebarIcon({ name }: { name: IconName }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></>,
    catalog: <><path d="M4 5h16v4H4zM4 11h16v4H4zM4 17h16v2H4z" /></>,
    menu: <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    orders: <><path d="M6 3h12v18H6z" /><path d="M9 3v3h6V3M9 11h6M9 15h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
    crm: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
    user: <><circle cx="12" cy="8" r="3.25" /><path d="M5.5 21c.6-3.4 3-5.25 6.5-5.25s5.9 1.85 6.5 5.25" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></>
  };
  return <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function AppShell({ user, logoUrl, view, onViewChange, onLogout, children }: { user: User; logoUrl?: string; view: View; onViewChange: (view: View) => void; onLogout: () => void; children: ReactNode }) {
  return <div className="dashboard-shell"><aside className="sidebar"><div className="sidebar-brand"><img src={logoUrl || '/tesis-logo.png'} alt="" /><span>Restaurant Admin</span></div><nav className="sidebar-nav" aria-label="Secciones principales"><p className="sidebar-section-label">Panel principal</p>{navigation.filter(item => !item.roles || item.roles.some(role => user.roles.includes(role))).map(item => <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} aria-current={view === item.id ? 'page' : undefined} onClick={() => onViewChange(item.id)}><SidebarIcon name={item.icon} /><span>{item.label}</span></button>)}</nav><div className="sidebar-user"><div className="sidebar-user-heading"><span className="sidebar-avatar"><SidebarIcon name="user" /></span><div><strong>{user.email}</strong><small>{user.roles.map(role => role.replace('ROLE_', '')).join(' · ')}</small></div></div><button className="logout" onClick={onLogout}><SidebarIcon name="logout" /><span>Cerrar sesión</span></button></div></aside><main className="workspace">{children}</main></div>;
}

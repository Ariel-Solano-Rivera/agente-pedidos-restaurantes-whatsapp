import { ReactNode, useEffect, useRef } from 'react';
import { Icon, IconName } from '../design/Icon';
import { User } from '../shared/api';
import { ThemePreference, useThemePreference } from '../shared/theme';
import './AppShell.css';

export type View = 'inicio' | 'dashboard' | 'pedidos' | 'cocina' | 'operacion' | 'crm' | 'derivaciones' | 'pagos' | 'menu' | 'catalogo' | 'configuracion';
type NavItem = { id: View; label: string; icon: IconName; roles?: string[] };

/** `roles` solo oculta secciones que el backend negaría con 403; la autorización sigue en el backend. */
const groups: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Operación', items: [{ id: 'inicio', label: 'Inicio', icon: 'home' }, { id: 'pedidos', label: 'Pedidos', icon: 'receipt' }, { id: 'cocina', label: 'Cocina', icon: 'flame' }, { id: 'operacion', label: 'Operación diaria', icon: 'calendar', roles: ['ROLE_ADMIN', 'ROLE_CAJA'] }, { id: 'crm', label: 'CRM', icon: 'chat', roles: ['ROLE_ADMIN', 'ROLE_CAJA'] }, { id: 'derivaciones', label: 'Derivaciones', icon: 'alert', roles: ['ROLE_ADMIN', 'ROLE_CAJA'] }, { id: 'pagos', label: 'Pagos', icon: 'wallet', roles: ['ROLE_ADMIN', 'ROLE_CAJA'] }] },
  { label: 'Análisis', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'chart', roles: ['ROLE_ADMIN'] }] },
  { label: 'Carta', items: [{ id: 'menu', label: 'Menú', icon: 'book' }, { id: 'catalogo', label: 'Catálogo', icon: 'tag' }] },
  { label: 'Ajustes', items: [{ id: 'configuracion', label: 'Configuración', icon: 'settings', roles: ['ROLE_ADMIN'] }] },
];
const roleLabels: Record<string, string> = { ROLE_ADMIN: 'Administración', ROLE_CAJA: 'Caja', ROLE_COCINA: 'Cocina' };
const themes: Array<{ id: ThemePreference; label: string; icon: IconName }> = [{ id: 'light', label: 'Claro', icon: 'sun' }, { id: 'dark', label: 'Oscuro', icon: 'moon' }, { id: 'system', label: 'Sistema', icon: 'monitor' }];

export const viewLabel = (view: View) => groups.flatMap(group => group.items).find(item => item.id === view)?.label ?? '';
export const canSee = (user: User, view: View) => {
  const item = groups.flatMap(group => group.items).find(entry => entry.id === view);
  return Boolean(item && (!item.roles || item.roles.some(role => user.roles.includes(role))));
};

function visibleGroups(user: User) {
  return groups.map(group => ({ ...group, items: group.items.filter(item => canSee(user, item.id)) })).filter(group => group.items.length);
}

function Navigation({ user, view, onSelect, variant }: { user: User; view: View; onSelect: (view: View) => void; variant: 'side' | 'sheet' }) {
  return <nav className={`shell-nav shell-nav--${variant}`} aria-label="Secciones principales">
    {visibleGroups(user).map(group => <div className="shell-nav__group" key={group.label}>
      <p className="shell-nav__label">{group.label}</p>
      <ul>{group.items.map(item => <li key={item.id}>
        <button type="button" className="shell-nav__item" aria-current={view === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>
          <Icon name={item.icon} size={variant === 'sheet' ? 24 : 20} /><span>{item.label}</span>
        </button>
      </li>)}</ul>
    </div>)}
  </nav>;
}

function ThemeControl({ preference, onChange }: { preference: ThemePreference; onChange: (next: ThemePreference) => void }) {
  return <fieldset className="shell-theme">
    <legend className="shell-nav__label">Tema</legend>
    <div className="shell-theme__options">{themes.map(theme => <button key={theme.id} type="button" title={`Tema ${theme.label.toLowerCase()}`} aria-pressed={preference === theme.id} onClick={() => onChange(theme.id)}>
      <Icon name={theme.icon} size={16} /><span>{theme.label}</span>
    </button>)}</div>
  </fieldset>;
}

function UserCard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const role = user.roles.map(item => roleLabels[item] ?? item.replace('ROLE_', '')).join(' · ');
  return <div className="shell-user">
    <span className="shell-user__avatar" aria-hidden="true">{user.email.slice(0, 1).toUpperCase()}</span>
    <div className="shell-user__text"><strong title={user.email}>{user.email}</strong><small>{role}</small></div>
    <button type="button" className="shell-icon-button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="logout" /></button>
  </div>;
}

export function AppShell({ user, logoUrl, view, onViewChange, onLogout, children }: { user: User; logoUrl?: string; view: View; onViewChange: (view: View) => void; onLogout: () => void; children: ReactNode }) {
  const { preference, setPreference } = useThemePreference(user);
  const sheet = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const logo = logoUrl || '/tesis-logo.png';

  function select(next: View) {
    sheet.current?.close();
    onViewChange(next);
  }
  // Al cambiar de sección, el foco va al contenido para lectores de pantalla y teclado.
  useEffect(() => { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [view]);

  return <div className="shell ds-root">
    <a className="shell-skip" href="#contenido">Saltar al contenido</a>

    <aside className="shell-side" aria-label="Navegación">
      <div className="shell-brand"><img src={logo} alt="" /><span>Panel del<br />restaurante</span></div>
      <Navigation user={user} view={view} onSelect={select} variant="side" />
      <div className="shell-side__footer">
        <ThemeControl preference={preference} onChange={setPreference} />
        <UserCard user={user} onLogout={onLogout} />
      </div>
    </aside>

    <header className="shell-topbar">
      <img src={logo} alt="" />
      <span className="shell-topbar__title">{viewLabel(view)}</span>
      <button type="button" className="ds-btn ds-btn--secondary" onClick={() => sheet.current?.showModal()} aria-haspopup="dialog"><Icon name="menu" />Menú</button>
    </header>

    <dialog ref={sheet} className="shell-sheet" aria-label="Menú">
      <div className="shell-sheet__head">
        <div className="shell-brand"><img src={logo} alt="" /><span>Panel del restaurante</span></div>
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => sheet.current?.close()}><Icon name="close" />Cerrar</button>
      </div>
      <Navigation user={user} view={view} onSelect={select} variant="sheet" />
      <div className="shell-sheet__footer">
        <ThemeControl preference={preference} onChange={setPreference} />
        <UserCard user={user} onLogout={onLogout} />
      </div>
    </dialog>

    <main id="contenido" ref={main} tabIndex={-1} className="shell-main">{children}</main>
  </div>;
}

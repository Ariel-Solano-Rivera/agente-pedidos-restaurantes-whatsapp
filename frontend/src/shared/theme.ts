import { useEffect, useState } from 'react';
import { User } from './api';

export type ThemePreference = 'light' | 'dark' | 'system';
const PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];
const storageKey = (email: string) => `restaurant.theme.${email.toLowerCase()}`;

/** Por defecto: Oscuro para COCINA y Claro para el resto (tema claro como base). */
export const defaultPreference = (user: User): ThemePreference => user.roles.includes('ROLE_COCINA') && !user.roles.includes('ROLE_ADMIN') ? 'dark' : 'light';

function readPreference(user: User): ThemePreference {
  try {
    const stored = localStorage.getItem(storageKey(user.email));
    if (stored && PREFERENCES.includes(stored as ThemePreference)) return stored as ThemePreference;
  } catch { /* almacenamiento bloqueado: se usa el valor por defecto */ }
  return defaultPreference(user);
}

/**
 * Preferencia de tema por persona, guardada solo en este navegador. «Sistema» sigue a
 * `prefers-color-scheme` y sus cambios. Aplica `data-theme` en <html> y lo quita al cerrar sesión.
 */
export function useThemePreference(user: User) {
  const [preference, setPreference] = useState<ThemePreference>(() => readPreference(user));
  useEffect(() => { setPreference(readPreference(user)); }, [user]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && query.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    query.addEventListener('change', apply);
    return () => { query.removeEventListener('change', apply); delete document.documentElement.dataset.theme; };
  }, [preference]);

  function change(next: ThemePreference) {
    setPreference(next);
    try { localStorage.setItem(storageKey(user.email), next); } catch { /* se mantiene solo en memoria */ }
  }
  return { preference, setPreference: change };
}

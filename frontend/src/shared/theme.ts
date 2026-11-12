import { createContext, useContext, useEffect, useState } from 'react';
import { User } from './api';

export type ThemePreference = 'light' | 'dark';
/** Una sola preferencia para el menú lateral y Configuración → Apariencia; la provee AppShell. */
export const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (next: ThemePreference) => void } | null>(null);
export const useTheme = () => { const value = useContext(ThemeContext); if (!value) throw new Error('useTheme debe usarse dentro de AppShell'); return value; };
const PREFERENCES: ThemePreference[] = ['light', 'dark'];
const storageKey = (email: string) => `restaurant.theme.${email.toLowerCase()}`;

/** Por defecto: Oscuro para COCINA y Claro para el resto (tema claro como base). */
export const defaultPreference = (user: User): ThemePreference => user.roles.includes('ROLE_COCINA') && !user.roles.includes('ROLE_ADMIN') ? 'dark' : 'light';

function readPreference(user: User): ThemePreference {
  try {
    const stored = localStorage.getItem(storageKey(user.email));
    if (stored && PREFERENCES.includes(stored as ThemePreference)) return stored as ThemePreference;
    // «Sistema» se retiró (segunda ronda, bloque A): quien lo tenía guardado vuelve a Claro.
    if (stored === 'system') return 'light';
  } catch { /* almacenamiento bloqueado: se usa el valor por defecto */ }
  return defaultPreference(user);
}

/**
 * Preferencia de tema por persona (Claro u Oscuro), guardada solo en este navegador.
 * Aplica `data-theme` en <html> y lo quita al cerrar sesión.
 */
export function useThemePreference(user: User) {
  const [preference, setPreference] = useState<ThemePreference>(() => readPreference(user));
  useEffect(() => { setPreference(readPreference(user)); }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = preference;
    return () => { delete document.documentElement.dataset.theme; };
  }, [preference]);

  function change(next: ThemePreference) {
    setPreference(next);
    try { localStorage.setItem(storageKey(user.email), next); } catch { /* se mantiene solo en memoria */ }
  }
  return { preference, setPreference: change };
}

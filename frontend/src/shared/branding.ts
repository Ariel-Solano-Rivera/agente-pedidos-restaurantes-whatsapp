import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type ContrastCheck = { color: string; usage: string; against: string; ratio: number; passesAA: boolean };
export type Branding = { primaryColor: string; secondaryColor: string; hasLogo: boolean; updatedAt: string | null; contrast: ContrastCheck[] };

const VARIABLES = { primaryColor: '--brand-primary', secondaryColor: '--brand-secondary' } as const;

/**
 * Aplica la marca del restaurante del usuario con variables CSS; sin sesión vuelve al tema por defecto.
 * El panel no calcula contraste: si `contrast` del backend indica que el color principal no cumple AA,
 * marca `data-brand-contrast="low"` y los tokens usan el color de acción por defecto (src/design/tokens.css).
 */
export function applyBranding(branding?: Pick<Branding, 'primaryColor' | 'secondaryColor'> & Partial<Pick<Branding, 'contrast'>>) {
  const root = document.documentElement; const style = root.style;
  for (const [key, variable] of Object.entries(VARIABLES)) {
    const value = branding?.[key as keyof typeof VARIABLES];
    if (value) style.setProperty(variable, value); else style.removeProperty(variable);
  }
  const primary = branding?.primaryColor?.toLowerCase();
  const lowContrast = Boolean(primary && branding?.contrast?.some(check => check.color.toLowerCase() === primary && !check.passesAA));
  if (lowContrast) root.dataset.brandContrast = 'low'; else delete root.dataset.brandContrast;
}

export function useBranding(auth: string, enabled: boolean) {
  const [branding, setBranding] = useState<Branding>(); const [logoUrl, setLogoUrl] = useState('');
  const reload = useCallback(async () => {
    if (!enabled) { setBranding(undefined); setLogoUrl(''); applyBranding(); return; }
    try {
      const next = await api<Branding>('/branding', auth); setBranding(next); applyBranding(next);
      if (!next.hasLogo) { setLogoUrl(''); return; }
      const response = await fetch('/api/v1/branding/logo', { headers: { Authorization: `Basic ${auth}` } });
      setLogoUrl(response.ok ? URL.createObjectURL(await response.blob()) : '');
    } catch { applyBranding(); }
  }, [auth, enabled]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => () => { if (logoUrl) URL.revokeObjectURL(logoUrl); }, [logoUrl]);
  return { branding, logoUrl, reload };
}

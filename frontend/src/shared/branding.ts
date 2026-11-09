import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type ContrastCheck = { color: string; usage: string; against: string; ratio: number; passesAA: boolean };
export type Branding = { primaryColor: string; secondaryColor: string; hasLogo: boolean; updatedAt: string | null; contrast: ContrastCheck[] };

const VARIABLES = { primaryColor: '--brand-primary', secondaryColor: '--brand-secondary' } as const;

/** Aplica la marca del restaurante del usuario con variables CSS; sin sesión vuelve al tema por defecto de styles.css. */
export function applyBranding(branding?: Pick<Branding, 'primaryColor' | 'secondaryColor'>) {
  const style = document.documentElement.style;
  for (const [key, variable] of Object.entries(VARIABLES)) {
    const value = branding?.[key as keyof typeof VARIABLES];
    if (value) style.setProperty(variable, value); else style.removeProperty(variable);
  }
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

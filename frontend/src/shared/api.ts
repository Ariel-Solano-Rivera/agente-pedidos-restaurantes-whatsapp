import { useEffect, useState } from 'react';

export type User = { email: string; restaurantId: string; roles: string[] };
type ApiError = { message: string };

export async function api<T>(path: string, auth: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch('/api/v1' + path, { ...init, headers: { Authorization: `Basic ${auth}`, ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(init?.headers || {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error((body as ApiError).message || 'No se pudo completar la operación');
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function useLoad<T>(path: string, auth: string) {
  const [data, setData] = useState<T>(); const [error, setError] = useState('');
  const load = () => api<T>(path, auth).then(setData).catch(caught => setError(caught instanceof Error ? caught.message : 'Error de conexión'));
  useEffect(() => { void load(); }, [path, auth]);
  return { data, error, reload: load };
}

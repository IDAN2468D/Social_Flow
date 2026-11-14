/**
 * Client-side JWT session helpers for checking expiration and clearing stale
 * tokens stored under localStorage("socialflow_user") before API calls hit 401.
 */

const STORAGE_KEY = 'socialflow_user';

export function isJwtExpired(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return true;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && 'token' in parsed) {
      delete parsed.token;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // Ignore malformed storage entries
  }
}

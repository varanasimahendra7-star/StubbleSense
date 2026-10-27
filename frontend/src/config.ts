/**
 * Application runtime configuration.
 * Dynamically resolves API_BASE_URL to match current hostname (localhost vs 127.0.0.1)
 * to ensure session cookies are sent as same-site requests.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://localhost:8000');

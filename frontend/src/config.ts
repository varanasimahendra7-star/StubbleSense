/**
 * Application runtime configuration.
 * VITE_API_BASE_URL is loaded from environment variables with a localhost fallback.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000';

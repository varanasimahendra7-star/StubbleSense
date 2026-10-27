
/**
 * Application runtime configuration.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
    ? 'https://stubblesense.onrender.com'
    : (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000'));

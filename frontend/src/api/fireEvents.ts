import { API_BASE_URL } from '../config';
import type { FireEventsResponse } from '../types/api';

/**
 * Fetch synthetic fire observation events from the backend.
 */
export async function getFireEvents(params?: {
  district?: string;
  state?: string;
  date?: string;
}): Promise<FireEventsResponse> {
  const url = new URL(`${API_BASE_URL}/api/fire-events`);

  if (params?.district && params.district !== 'all') {
    url.searchParams.set('district', params.district);
  }
  if (params?.state && params.state !== 'all') {
    url.searchParams.set('state', params.state);
  }
  if (params?.date && params.date !== 'all') {
    url.searchParams.set('date', params.date);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch fire events (HTTP ${response.status}: ${response.statusText})`);
  }

  const data: unknown = await response.json();
  if (
    typeof data === 'object' &&
    data !== null &&
    'total' in data &&
    'items' in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return data as FireEventsResponse;
  }

  throw new Error('Invalid fire events payload received from server');
}

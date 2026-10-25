import { API_BASE_URL } from '../config';
import type { HealthResponse } from '../types/api';

/**
 * Fetch system health status from the backend API.
 */
export async function getHealthStatus(): Promise<HealthResponse> {
  const url = `${API_BASE_URL}/api/health`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    'app' in data &&
    'environment' in data
  ) {
    const candidate = data as Record<string, unknown>;
    return {
      status: String(candidate.status),
      app: String(candidate.app),
      environment: String(candidate.environment),
    };
  }

  throw new Error('Unexpected response structure received from health endpoint');
}

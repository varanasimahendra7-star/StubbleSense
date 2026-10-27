import { notifyAuthExpired } from './auth';
import { API_BASE_URL } from '../config';
import type { VillageRiskResponse } from '../types/api';

/**
 * Fetch explainable village risk rankings from the backend API.
 */
export async function getVillageRiskRankings(params?: {
  state?: string;
  district?: string;
  category?: string;
  min_score?: number;
}): Promise<VillageRiskResponse> {
  const url = new URL(`${API_BASE_URL}/api/villages/risk`);

  if (params?.state && params.state !== 'all') {
    url.searchParams.set('state', params.state);
  }
  if (params?.district && params.district !== 'all') {
    url.searchParams.set('district', params.district);
  }
  if (params?.category && params.category !== 'all') {
    url.searchParams.set('category', params.category);
  }
  if (params?.min_score !== undefined) {
    url.searchParams.set('min_score', String(params.min_score));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      notifyAuthExpired();
    }
    throw new Error(`Failed to load village risk rankings (HTTP ${response.status}: ${response.statusText})`);
  }

  const data: unknown = await response.json();
  if (
    typeof data === 'object' &&
    data !== null &&
    'total' in data &&
    'items' in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return data as VillageRiskResponse;
  }

  throw new Error('Invalid village risk ranking response received from server');
}

import { API_BASE_URL } from '../config';
import type { EquipmentListResponse, VillageAllocationResponse } from '../types/api';

/**
 * Fetch list of synthetic equipment with optional filters.
 */
export async function getEquipmentList(params?: {
  equipment_type?: string;
  status?: string;
  district?: string;
  state?: string;
}): Promise<EquipmentListResponse> {
  const url = new URL(`${API_BASE_URL}/api/equipment`);

  if (params?.equipment_type && params.equipment_type !== 'all') {
    url.searchParams.set('equipment_type', params.equipment_type);
  }
  if (params?.status && params.status !== 'all') {
    url.searchParams.set('status', params.status);
  }
  if (params?.district && params.district !== 'all') {
    url.searchParams.set('district', params.district);
  }
  if (params?.state && params.state !== 'all') {
    url.searchParams.set('state', params.state);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load equipment list (HTTP ${response.status}: ${response.statusText})`);
  }

  const data: unknown = await response.json();
  if (
    typeof data === 'object' &&
    data !== null &&
    'total' in data &&
    'items' in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return data as EquipmentListResponse;
  }

  throw new Error('Invalid equipment list payload received from server');
}

/**
 * Fetch equipment recommendations for a selected village.
 */
export async function getEquipmentRecommendations(
  villageId: string,
  options?: {
    max_distance_km?: number;
    include_unavailable?: boolean;
    equipment_type?: string;
  }
): Promise<VillageAllocationResponse> {
  const url = new URL(`${API_BASE_URL}/api/equipment/recommendations`);
  url.searchParams.set('village_id', villageId);

  if (options?.max_distance_km !== undefined) {
    url.searchParams.set('max_distance_km', String(options.max_distance_km));
  }
  if (options?.include_unavailable !== undefined) {
    url.searchParams.set('include_unavailable', String(options.include_unavailable));
  }
  if (options?.equipment_type && options.equipment_type !== 'all') {
    url.searchParams.set('equipment_type', options.equipment_type);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    let detailMsg = response.statusText;
    try {
      const errJson = (await response.json()) as { detail?: string };
      if (errJson?.detail) {
        detailMsg = errJson.detail;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(`Failed to load recommendations (${detailMsg})`);
  }

  const data: unknown = await response.json();
  if (
    typeof data === 'object' &&
    data !== null &&
    'village' in data &&
    'recommendations' in data &&
    Array.isArray((data as { recommendations: unknown }).recommendations)
  ) {
    return data as VillageAllocationResponse;
  }

  throw new Error('Invalid equipment recommendation response received from server');
}

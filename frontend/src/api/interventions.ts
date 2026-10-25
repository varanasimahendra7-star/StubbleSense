import { API_BASE_URL } from '../config';
import type {
  FieldVerificationPayload,
  InterventionCreatePayload,
  InterventionItem,
  InterventionListResponse,
  InterventionStatusUpdatePayload,
} from '../types/api';

/**
 * Fetch interventions list with optional filtering.
 */
export async function getInterventions(params?: {
  village_id?: string;
  status?: string;
  completion_status?: string;
  district?: string;
}): Promise<InterventionListResponse> {
  const url = new URL(`${API_BASE_URL}/api/interventions`);

  if (params?.village_id && params.village_id !== 'all') {
    url.searchParams.set('village_id', params.village_id);
  }
  if (params?.status && params.status !== 'all') {
    url.searchParams.set('status', params.status);
  }
  if (params?.completion_status && params.completion_status !== 'all') {
    url.searchParams.set('completion_status', params.completion_status);
  }
  if (params?.district && params.district !== 'all') {
    url.searchParams.set('district', params.district);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load interventions (HTTP ${response.status}: ${response.statusText})`);
  }

  const data: unknown = await response.json();
  if (
    typeof data === 'object' &&
    data !== null &&
    'total' in data &&
    'items' in data &&
    Array.isArray((data as { items: unknown }).items)
  ) {
    return data as InterventionListResponse;
  }

  throw new Error('Invalid interventions payload received from server');
}

/**
 * Fetch detailed intervention record including full audit trail and field verification.
 */
export async function getInterventionDetail(id: string): Promise<InterventionItem> {
  const response = await fetch(`${API_BASE_URL}/api/interventions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch intervention ${id} (HTTP ${response.status})`);
  }

  return (await response.json()) as InterventionItem;
}

/**
 * Create a new residue intervention linked to a village and optional machinery.
 */
export async function createIntervention(payload: InterventionCreatePayload): Promise<InterventionItem> {
  const response = await fetch(`${API_BASE_URL}/api/interventions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errJson = (await response.json()) as { detail?: string };
      if (errJson?.detail) detail = errJson.detail;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Failed to create intervention (${detail})`);
  }

  return (await response.json()) as InterventionItem;
}

/**
 * Transition intervention status and append to audit history.
 */
export async function updateInterventionStatus(
  id: string,
  payload: InterventionStatusUpdatePayload
): Promise<InterventionItem> {
  const response = await fetch(`${API_BASE_URL}/api/interventions/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errJson = (await response.json()) as { detail?: string };
      if (errJson?.detail) detail = errJson.detail;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Failed to update status (${detail})`);
  }

  return (await response.json()) as InterventionItem;
}

/**
 * Record ground field verification and elevate status to Field-Verified.
 */
export async function recordFieldVerification(
  id: string,
  payload: FieldVerificationPayload
): Promise<InterventionItem> {
  const response = await fetch(`${API_BASE_URL}/api/interventions/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errJson = (await response.json()) as { detail?: string };
      if (errJson?.detail) detail = errJson.detail;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Failed to record verification (${detail})`);
  }

  return (await response.json()) as InterventionItem;
}

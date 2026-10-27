import { API_BASE_URL } from '../config';
import type {
  AuthResponse,
  DemoAccountsResponse,
  RegistrationStatusResponse,
  UserProfile,
  UserRegisterRequest,
} from '../types/api';

export const AUTH_EXPIRED_EVENT = 'stubble_auth_expired';

export function notifyAuthExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

let inMemoryCsrfToken: string | null = null;

/**
 * Retrieve CSRF token from document cookie or in-memory fallback.
 */
export function getCsrfToken(): string | null {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  return inMemoryCsrfToken;
}

/**
 * Sign in using username and password. Sets HttpOnly session and CSRF cookies on the browser.
 */
export async function loginUser(credentials: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include', // Crucial: send/receive cookies
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    let detail = 'Authentication failed. Please check your credentials.';
    try {
      const err = (await response.json()) as { detail?: string };
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as AuthResponse;
  if (data.csrf_token) {
    inMemoryCsrfToken = data.csrf_token;
  }
  return data;
}

/**
 * Log out and clear the session and CSRF cookies on the server.
 */
export async function logoutUser(): Promise<void> {
  const csrf = getCsrfToken();
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    credentials: 'include',
  });
  inMemoryCsrfToken = null;
}

/**
 * Restore current session from server HttpOnly cookie.
 */
export async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Not authenticated');
  }

  return (await response.json()) as UserProfile;
}

/**
 * Retrieve evaluation demo accounts metadata and prefill credentials when enabled.
 */
export async function getDemoAccounts(): Promise<DemoAccountsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/demo-accounts`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    return {
      enabled: false,
      notice: 'Evaluation demo accounts are currently unavailable.',
      accounts: [],
    };
  }

  return (await response.json()) as DemoAccountsResponse;
}

/**
 * List all registered users (super_admin only).
 */
export async function listUsers(): Promise<UserProfile[]> {
  const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve user accounts roster');
  }

  return (await response.json()) as UserProfile[];
}

/**
 * Provision a new user account (authorized administrators).
 */
export async function createUser(payload: {
  username: string;
  password: string;
  full_name: string;
  role: string;
}): Promise<UserProfile> {
  const csrf = getCsrfToken();
  const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = 'Account provisioning failed.';
    try {
      const err = (await response.json()) as { detail?: string };
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  return (await response.json()) as UserProfile;
}

/**
 * Retrieve public registration status and role policy metadata.
 */
export async function getRegistrationStatus(): Promise<RegistrationStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/registration-status`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    return {
      enabled: false,
      notice: 'Public registration status currently unavailable.',
      policy: 'Self-registration disabled.',
      roles: [],
    };
  }

  return (await response.json()) as RegistrationStatusResponse;
}

/**
 * Submit public self-registration for operational personnel.
 * Creates an account in PENDING inactive state requiring administrator activation.
 */
export async function registerUser(payload: UserRegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = 'Registration failed. Please check your submission.';
    try {
      const err = (await response.json()) as { detail?: string };
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  return (await response.json()) as AuthResponse;
}

/**
 * Update user account status (e.g. approve, reject, deactivate, or activate).
 */
export async function updateUserStatus(
  userId: string,
  statusOrActive: boolean | string
): Promise<UserProfile> {
  const csrf = getCsrfToken();
  const bodyPayload =
    typeof statusOrActive === 'boolean'
      ? { is_active: statusOrActive }
      : { status: statusOrActive, is_active: statusOrActive === 'active' };

  const response = await fetch(`${API_BASE_URL}/api/auth/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    let detail = 'Failed to update user account status.';
    try {
      const err = (await response.json()) as { detail?: string };
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  return (await response.json()) as UserProfile;
}

/**
 * Retrieve operational staff accounts (field_officer and equipment_coordinator) for District or Super Admin.
 */
export async function listStaff(): Promise<UserProfile[]> {
  const response = await fetch(`${API_BASE_URL}/api/auth/staff`, {
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
    let detail = 'Failed to load staff roster.';
    try {
      const err = (await response.json()) as { detail?: string };
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return (await response.json()) as UserProfile[];
}

/**
 * Delete or soft-delete a user account with CSRF protection.
 */
export async function deleteUser(
  userId: string
): Promise<{ message: string; deleted_id: string; soft_deleted: boolean }> {
  const csrf = getCsrfToken();
  const response = await fetch(`${API_BASE_URL}/api/auth/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    let detail = 'Failed to delete user account.';
    try {
      const err = (await response.json()) as { detail?: string };
      if (err?.detail) detail = err.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail);
  }

  return (await response.json()) as { message: string; deleted_id: string; soft_deleted: boolean };
}

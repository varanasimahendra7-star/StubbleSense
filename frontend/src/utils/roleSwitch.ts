import type { DemoAccountItem, UserRole } from '../types/api';

export interface RoleCardConfigItem {
  role: UserRole;
  defaultUsername: string;
  title: string;
  subtitle: string;
}

export const ROLE_CARD_CONFIG: RoleCardConfigItem[] = [
  {
    role: 'super_admin',
    defaultUsername: 'eval_superadmin',
    title: 'Super Admin',
    subtitle: 'Full system & user roster',
  },
  {
    role: 'admin',
    defaultUsername: 'eval_admin',
    title: 'District Admin',
    subtitle: 'District ops & staff roster',
  },
  {
    role: 'field_officer',
    defaultUsername: 'eval_field_officer',
    title: 'Field Officer',
    subtitle: 'Field ops & spot audit',
  },
  {
    role: 'equipment_coordinator',
    defaultUsername: 'eval_equipment_coord',
    title: 'Equipment Coord',
    subtitle: 'Machinery dispatch ops',
  },
];

export interface RoleSwitchResult {
  selectedRole: UserRole;
  username: string;
  password: string;
  errorMessage: null;
  demoNotice: string;
}

/**
 * Resolves account details (username and display title) for a given role.
 */
export function resolveAccountForRole(
  role: UserRole,
  demoAccounts: DemoAccountItem[] = []
): { resolvedUsername: string; resolvedLabel: string } {
  const matched = demoAccounts.find((a) => a.role === role);
  const config = ROLE_CARD_CONFIG.find((c) => c.role === role);
  const resolvedUsername = matched?.username || config?.defaultUsername || role;
  const resolvedLabel = matched?.label || config?.title || role;
  return { resolvedUsername, resolvedLabel };
}

/**
 * Handles role-switching when a user selects an evaluation role card.
 *
 * Requirements:
 * 1. Clears the password field so an old/stale password cannot be submitted accidentally.
 * 2. Synchronizes username with selected role.
 * 3. Never auto-inserts or exposes passwords in the frontend.
 * 4. Clears any previous error message.
 * 5. Provides explicit notice prompting user to enter their password and sign in (never claims login succeeded).
 */
export function handleRoleSwitch(
  role: UserRole,
  options?: { demoAccounts?: DemoAccountItem[] }
): RoleSwitchResult {
  const { resolvedUsername, resolvedLabel } = resolveAccountForRole(role, options?.demoAccounts);

  return {
    selectedRole: role,
    username: resolvedUsername,
    password: '', // Always cleared when switching roles
    errorMessage: null,
    demoNotice: `Selected role: ${resolvedLabel} (@${resolvedUsername}). Please enter your password and click "Sign In to Dashboard".`,
  };
}

/**
 * Resolves the matching UserRole from an input username string (case-insensitive).
 * Returns null if no matching role is found.
 */
export function resolveRoleFromUsername(
  rawUsername: string,
  demoAccounts: DemoAccountItem[] = []
): UserRole | null {
  const trimmed = rawUsername.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const matchedAccount = demoAccounts.find((a) => a.username.toLowerCase() === trimmed);
  if (matchedAccount) {
    return matchedAccount.role;
  }

  const configMatch = ROLE_CARD_CONFIG.find(
    (c) =>
      c.defaultUsername.toLowerCase() === trimmed ||
      `${c.role}_demo` === trimmed ||
      c.role === trimmed
  );
  return configMatch ? configMatch.role : null;
}

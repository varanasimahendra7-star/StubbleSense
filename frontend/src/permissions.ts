import type { NavigationTab, UserRole } from './types/api';

export interface RolePermissions {
  allowedTabs: NavigationTab[];
  defaultTab: NavigationTab;
  tabLabels: Partial<Record<NavigationTab, string>>;
  canCreateIntervention: boolean;
  canVerifyField: boolean;
  canTransitionToApproved: boolean;
  canTransitionToInProgress: boolean;
  canTransitionToCompleted: boolean;
  canTransitionToCancelled: boolean;
  canAllocateEquipment: boolean;
  canViewAllInterventions: boolean;
  canManageUsers: boolean;
  canProvisionStaff: boolean;
  canProvisionAdmins: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  super_admin: {
    allowedTabs: ['overview', 'map', 'risk', 'allocation', 'tracking', 'users'],
    defaultTab: 'overview',
    tabLabels: {
      overview: 'Overview',
      map: 'Fire Map',
      risk: 'Risk Ranking',
      allocation: 'Equipment Allocation',
      tracking: 'Interventions & Verification',
      users: 'User & Role Management',
    },
    canCreateIntervention: true,
    canVerifyField: true,
    canTransitionToApproved: true,
    canTransitionToInProgress: true,
    canTransitionToCompleted: true,
    canTransitionToCancelled: true,
    canAllocateEquipment: true,
    canViewAllInterventions: true,
    canManageUsers: true,
    canProvisionStaff: true,
    canProvisionAdmins: true,
  },
  admin: {
    allowedTabs: ['overview', 'map', 'risk', 'allocation', 'tracking', 'staff'],
    defaultTab: 'overview',
    tabLabels: {
      overview: 'Overview',
      map: 'Fire Map',
      risk: 'Risk Ranking',
      allocation: 'Equipment Allocation',
      tracking: 'Interventions & Verification',
      staff: 'Staff Provisioning',
    },
    canCreateIntervention: true,
    canVerifyField: true,
    canTransitionToApproved: true,
    canTransitionToInProgress: true,
    canTransitionToCompleted: true,
    canTransitionToCancelled: true,
    canAllocateEquipment: true,
    canViewAllInterventions: true,
    canManageUsers: false,
    canProvisionStaff: true,
    canProvisionAdmins: false,
  },
  field_officer: {
    allowedTabs: ['field-ops', 'map'],
    defaultTab: 'field-ops',
    tabLabels: {
      'field-ops': 'Field Operations',
      map: 'Fire Hotspot Map (Read-Only)',
    },
    canCreateIntervention: false,
    canVerifyField: true,
    canTransitionToApproved: false,
    canTransitionToInProgress: true,
    canTransitionToCompleted: true,
    canTransitionToCancelled: false,
    canAllocateEquipment: false,
    canViewAllInterventions: false,
    canManageUsers: false,
    canProvisionStaff: false,
    canProvisionAdmins: false,
  },
  equipment_coordinator: {
    allowedTabs: ['equipment-ops', 'map'],
    defaultTab: 'equipment-ops',
    tabLabels: {
      'equipment-ops': 'Equipment Operations',
      map: 'Fire Hotspot Map (Read-Only)',
    },
    canCreateIntervention: false,
    canVerifyField: false,
    canTransitionToApproved: false,
    canTransitionToInProgress: true,
    canTransitionToCompleted: false,
    canTransitionToCancelled: false,
    canAllocateEquipment: true,
    canViewAllInterventions: false,
    canManageUsers: false,
    canProvisionStaff: false,
    canProvisionAdmins: false,
  },
};

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.field_officer;
}

export function isTabPermitted(role: UserRole, tab: NavigationTab): boolean {
  return getPermissions(role).allowedTabs.includes(tab);
}

export function getDefaultTabForRole(role: UserRole): NavigationTab {
  return getPermissions(role).defaultTab;
}

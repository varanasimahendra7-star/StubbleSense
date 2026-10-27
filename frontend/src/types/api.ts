export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
  demo_accounts_enabled?: boolean;
}

export type BackendStatus = 'loading' | 'connected' | 'unavailable';

export type NavigationTab =
  | 'overview'
  | 'map'
  | 'risk'
  | 'allocation'
  | 'tracking'
  | 'field-ops'
  | 'equipment-ops'
  | 'users'
  | 'staff';

export interface FireObservation {
  id: string;
  latitude: number;
  longitude: number;
  district: string;
  state: string;
  observed_at: string;
  confidence: 'high' | 'nominal' | 'low' | string;
  brightness_kelvin: number;
  frp_mw: number;
  satellite: string;
  is_synthetic: boolean;
}

export interface FireEventsResponse {
  total: number;
  data_notice: string;
  items: FireObservation[];
}

export interface FireFilters {
  state: string;
  district: string;
  date: string;
  confidence: string;
}

export type RiskCategory = 'Critical' | 'High' | 'Medium' | 'Low';

export interface VillageRiskItem {
  id: string;
  name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_category: RiskCategory;
  nearby_fire_count: number;
  high_confidence_fire_count: number;
  reasons: string[];
  is_synthetic: boolean;
}

export interface VillageRiskResponse {
  total: number;
  data_notice: string;
  scoring_formula_summary: string;
  items: VillageRiskItem[];
}

export interface RiskFilterOptions {
  state: string;
  category: string;
  sortBy: 'score_desc' | 'score_asc' | 'name' | 'district';
  searchQuery: string;
}

export type EquipmentStatus = 'Available' | 'In-Use' | 'Maintenance' | string;

export interface EquipmentItem {
  id: string;
  name: string;
  equipment_type: string;
  category: string;
  hub_name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  status: EquipmentStatus;
  capacity_acres_per_day: number;
  daily_rental_inr: number;
  contact_officer: string;
  is_synthetic: boolean;
}

export interface EquipmentRecommendation {
  equipment: EquipmentItem;
  distance_km: number;
  suitability_score: number;
  recommendation_reasons: string[];
  caution_notice: string;
}

export interface EquipmentListResponse {
  total: number;
  data_notice: string;
  items: EquipmentItem[];
}

export interface VillageAllocationResponse {
  village: VillageRiskItem;
  total_recommendations: number;
  data_notice: string;
  recommendations: EquipmentRecommendation[];
}

export type InterventionStatus = 'Proposed' | 'Approved' | 'In Progress' | 'Completed' | 'Cancelled';
export type CompletionStatus = 'Pending' | 'Self-Reported' | 'Field-Verified';
export type VerificationOutcome =
  | 'Verified Cleared'
  | 'Partial Residue Remaining'
  | 'Violation Detected / Fire Evidence Found'
  | 'Inaccessible / Flagged';

export interface InterventionAuditItem {
  id: number;
  intervention_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  reason?: string | null;
  timestamp: string;
}

export interface FieldVerificationItem {
  id: number;
  intervention_id: string;
  verifier_name: string;
  verified_at: string;
  outcome: VerificationOutcome | string;
  verified_acres: number;
  evidence_metadata: Record<string, unknown>;
  verification_notes?: string | null;
  is_synthetic: boolean;
}

export interface InterventionItem {
  id: string;
  village_id: string;
  village_name: string;
  district: string;
  state: string;
  equipment_id?: string | null;
  equipment_name?: string | null;
  intervention_type: string;
  target_acres: number;
  status: InterventionStatus;
  completion_status: CompletionStatus;
  assigned_officer_id?: string | null;
  created_at: string;
  updated_at: string;
  notes?: string | null;
  is_synthetic: boolean;
  audits: InterventionAuditItem[];
  verification?: FieldVerificationItem | null;
}

export interface InterventionCreatePayload {
  village_id: string;
  equipment_id?: string | null;
  intervention_type: string;
  target_acres: number;
  assigned_officer_id?: string | null;
  notes?: string | null;
  requested_by: string;
}

export interface InterventionStatusUpdatePayload {
  new_status: InterventionStatus;
  changed_by: string;
  reason?: string | null;
}

export interface FieldVerificationPayload {
  verifier_name: string;
  outcome: VerificationOutcome;
  verified_acres: number;
  evidence_metadata?: Record<string, unknown>;
  verification_notes?: string | null;
}

export interface InterventionListResponse {
  total: number;
  data_notice: string;
  items: InterventionItem[];
}

export type UserRole = 'super_admin' | 'admin' | 'field_officer' | 'equipment_coordinator';

export type UserAccountStatus = 'active' | 'pending' | 'rejected' | 'deactivated' | 'deleted' | string;

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  status?: UserAccountStatus;
  is_synthetic: boolean;
}

export interface UserDeleteResponse {
  message: string;
  user_id?: string;
  deleted_id: string;
  soft_deleted: boolean;
}

export interface AuthResponse {
  user: UserProfile;
  csrf_token?: string;
  message: string;
}

export interface DemoAccountItem {
  role: UserRole;
  label: string;
  username: string;
  password: string;
  description: string;
}

export interface DemoAccountsResponse {
  enabled: boolean;
  notice: string;
  accounts: DemoAccountItem[];
}

export interface RolePolicyItem {
  role: UserRole;
  label: string;
  description: string;
  can_self_register: boolean;
  requires_approval: boolean;
}

export interface RegistrationStatusResponse {
  enabled: boolean;
  auto_approve?: boolean;
  notice: string;
  policy: string;
  roles: RolePolicyItem[];
}

export interface UserRegisterRequest {
  username: string;
  password: string;
  full_name: string;
  role: UserRole;
}

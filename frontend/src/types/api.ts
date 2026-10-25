export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
}

export type BackendStatus = 'loading' | 'connected' | 'unavailable';

export type NavigationTab = 'overview' | 'map' | 'risk' | 'allocation' | 'tracking';

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



export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
}

export type BackendStatus = 'loading' | 'connected' | 'unavailable';

export type NavigationTab = 'overview' | 'map' | 'risk' | 'cases';

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

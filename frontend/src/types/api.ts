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

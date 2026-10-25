export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
}

export type BackendStatus = 'loading' | 'connected' | 'unavailable';

export type NavigationTab = 'overview' | 'map' | 'risk' | 'cases';

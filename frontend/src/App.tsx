import { useEffect, useState, useCallback } from 'react';
import { getHealthStatus } from './api/health';
import { API_BASE_URL } from './config';
import type { BackendStatus, HealthResponse, NavigationTab } from './types/api';
import './App.css';

export function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('loading');
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const checkHealth = useCallback(async () => {
    setIsRetrying(true);
    setBackendStatus('loading');
    setErrorMessage(null);

    try {
      const data = await getHealthStatus();
      setHealthData(data);
      setBackendStatus('connected');
      setLastChecked(new Date());
      setErrorMessage(null);
    } catch (err) {
      setBackendStatus('unavailable');
      setHealthData(null);
      setLastChecked(new Date());
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to connect to backend server');
      }
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getHealthStatus()
      .then((data) => {
        if (active) {
          setHealthData(data);
          setBackendStatus('connected');
          setLastChecked(new Date());
          setErrorMessage(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setBackendStatus('unavailable');
          setHealthData(null);
          setLastChecked(new Date());
          setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to backend server');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      {/* Accessible skip link for keyboard navigation */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Primary Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2c3.5 3 6 7 6 11a6 6 0 0 1-12 0c0-4 2.5-8 6-11z" />
              <path d="M12 18a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1.2-2.5-2.5-3.5-1.3 1-2.5 2-2.5 3.5A2.5 2.5 0 0 0 12 18z" />
            </svg>
          </div>
          <div className="brand-titles">
            <div className="brand-name-row">
              <h1 className="brand-title">StubbleSense</h1>
              <span className="brand-version" title="System version">v0.1.0</span>
            </div>
            <p className="brand-subtitle">
              Agricultural Residue Burning Intelligence &amp; Enforcement
            </p>
          </div>
        </div>

        <div className="header-meta">
          <div className="demo-badge" role="status" aria-label="Operating in demo mode">
            <span className="demo-badge-dot" aria-hidden="true" />
            <span className="demo-badge-text">Demo Mode</span>
          </div>

          <div
            className={`status-pill status-${backendStatus}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-indicator-dot" aria-hidden="true" />
            <span className="status-text">
              {backendStatus === 'loading' && 'Checking Backend...'}
              {backendStatus === 'connected' && 'Backend Connected'}
              {backendStatus === 'unavailable' && 'Backend Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="app-nav" aria-label="Main Navigation">
        <ul className="nav-list" role="tablist">
          <li role="presentation">
            <button
              id="tab-overview"
              role="tab"
              type="button"
              className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              aria-selected={activeTab === 'overview'}
              aria-controls="panel-overview"
              onClick={() => setActiveTab('overview')}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>Overview</span>
            </button>
          </li>
          <li role="presentation">
            <button
              id="tab-map"
              role="tab"
              type="button"
              className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
              aria-selected={activeTab === 'map'}
              aria-controls="panel-map"
              onClick={() => setActiveTab('map')}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              <span>Fire Map</span>
            </button>
          </li>
          <li role="presentation">
            <button
              id="tab-risk"
              role="tab"
              type="button"
              className={`nav-item ${activeTab === 'risk' ? 'active' : ''}`}
              aria-selected={activeTab === 'risk'}
              aria-controls="panel-risk"
              onClick={() => setActiveTab('risk')}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
              <span>Risk Ranking</span>
            </button>
          </li>
          <li role="presentation">
            <button
              id="tab-cases"
              role="tab"
              type="button"
              className={`nav-item ${activeTab === 'cases' ? 'active' : ''}`}
              aria-selected={activeTab === 'cases'}
              aria-controls="panel-cases"
              onClick={() => setActiveTab('cases')}
            >
              <svg
                className="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              <span>Officer Cases</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Main Content Area */}
      <main id="main-content" className="app-main" tabIndex={-1}>
        {/* Backend Connectivity Status Banner */}
        <section
          className={`connectivity-card card-${backendStatus}`}
          aria-labelledby="connectivity-title"
        >
          <div className="connectivity-header">
            <div className="connectivity-title-group">
              <div className="connectivity-icon" aria-hidden="true">
                {backendStatus === 'connected' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {backendStatus === 'loading' && (
                  <svg className="spinning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                )}
                {backendStatus === 'unavailable' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>
              <div>
                <h2 id="connectivity-title" className="connectivity-title">
                  {backendStatus === 'connected' && 'FastAPI Backend Operational'}
                  {backendStatus === 'loading' && 'Connecting to Backend API...'}
                  {backendStatus === 'unavailable' && 'Backend Service Unavailable'}
                </h2>
                <p className="connectivity-url">
                  Endpoint target: <code>{API_BASE_URL}/api/health</code>
                </p>
              </div>
            </div>

            <button
              type="button"
              className="retry-button"
              onClick={() => void checkHealth()}
              disabled={isRetrying}
              aria-label="Retry backend connection check"
            >
              <svg
                className={`button-icon ${isRetrying ? 'spinning-icon' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>{isRetrying ? 'Checking...' : 'Refresh Status'}</span>
            </button>
          </div>

          <div className="connectivity-body">
            {backendStatus === 'connected' && healthData && (
              <div className="health-metrics-grid">
                <div className="health-metric">
                  <span className="health-metric-label">Application</span>
                  <strong className="health-metric-value">{healthData.app}</strong>
                </div>
                <div className="health-metric">
                  <span className="health-metric-label">Status</span>
                  <span className="health-metric-badge success">{healthData.status}</span>
                </div>
                <div className="health-metric">
                  <span className="health-metric-label">Environment</span>
                  <strong className="health-metric-value">{healthData.environment}</strong>
                </div>
                <div className="health-metric">
                  <span className="health-metric-label">Last Checked</span>
                  <span className="health-metric-value text-muted">
                    {lastChecked ? lastChecked.toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
              </div>
            )}

            {backendStatus === 'unavailable' && (
              <div className="error-container">
                <p className="error-message">
                  <strong>Connection Error:</strong> {errorMessage || 'Unable to reach backend service.'}
                </p>
                <p className="error-help">
                  Please verify that the FastAPI backend server is running locally:
                  <br />
                  <code>cd backend &amp;&amp; ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload</code>
                </p>
              </div>
            )}

            {backendStatus === 'loading' && (
              <p className="loading-message">
                Querying <code>GET /api/health</code> to verify API connectivity...
              </p>
            )}
          </div>
        </section>

        {/* View Content Panels */}
        {activeTab === 'overview' && (
          <section
            id="panel-overview"
            role="tabpanel"
            aria-labelledby="tab-overview"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Regional Monitoring Overview</h2>
              <p className="section-description">
                Real-time surveillance of crop residue burning incidents across Punjab and Haryana agricultural corridors.
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Active Burn Clusters</span>
                  <span className="stat-pill alert">Demo Feed</span>
                </div>
                <div className="stat-number">24</div>
                <p className="stat-detail">Thermal anomalies detected within last 12 hours</p>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Regional Smoke Dispersion</span>
                  <span className="stat-pill warning">High Inversion</span>
                </div>
                <div className="stat-number">AQI 318</div>
                <p className="stat-detail">Wind vector heading southeast towards NCR</p>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">High-Risk Districts</span>
                  <span className="stat-pill info">5 Districts</span>
                </div>
                <div className="stat-number">Sangrur</div>
                <p className="stat-detail">Highest harvest residue density (89% harvested)</p>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Field Verification</span>
                  <span className="stat-pill success">14 Dispatched</span>
                </div>
                <div className="stat-number">18</div>
                <p className="stat-detail">Ground inspection cases assigned to nodal officers</p>
              </div>
            </div>

            <div className="features-preview-grid">
              <div className="feature-card">
                <div className="feature-icon-wrapper fire-accent" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  </svg>
                </div>
                <h3>Satellite Hotspot Mapping</h3>
                <p>
                  High-cadence thermal fire hotspot detection ingested from VIIRS and MODIS earth observation telemetry.
                </p>
                <button
                  type="button"
                  className="card-action-button"
                  onClick={() => setActiveTab('map')}
                >
                  View Fire Map &rarr;
                </button>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper risk-accent" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10" />
                    <path d="M12 20V4" />
                    <path d="M6 20v-6" />
                  </svg>
                </div>
                <h3>Predictive Risk Scoring</h3>
                <p>
                  Machine-learning-informed risk ranking fusing historical burn patterns, crop cutting progress, and weather models.
                </p>
                <button
                  type="button"
                  className="card-action-button"
                  onClick={() => setActiveTab('risk')}
                >
                  View Risk Matrix &rarr;
                </button>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper case-accent" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  </svg>
                </div>
                <h3>Officer Action Workflows</h3>
                <p>
                  Direct dispatch queues for agricultural field officers to conduct spot audits, issue notices, and record mitigations.
                </p>
                <button
                  type="button"
                  className="card-action-button"
                  onClick={() => setActiveTab('cases')}
                >
                  View Case Queue &rarr;
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'map' && (
          <section
            id="panel-map"
            role="tabpanel"
            aria-labelledby="tab-map"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Satellite Fire Hotspot Map</h2>
              <p className="section-description">
                Interactive spatial layer displaying active thermal anomalies, FIRMS telemetry, and wind trajectories.
              </p>
            </div>

            <div className="placeholder-container map-placeholder">
              <div className="placeholder-badge">Planned Milestone 4</div>
              <div className="map-grid-graphic" aria-hidden="true">
                <div className="map-coordinate-line lat-1" />
                <div className="map-coordinate-line lat-2" />
                <div className="map-coordinate-line lon-1" />
                <div className="map-coordinate-line lon-2" />
                <div className="simulated-hotspot hotspot-1" title="Simulated Hotspot 31.14°N, 75.34°E" />
                <div className="simulated-hotspot hotspot-2" title="Simulated Hotspot 30.22°N, 74.95°E" />
                <div className="simulated-hotspot hotspot-3" title="Simulated Hotspot 29.88°N, 76.41°E" />
              </div>
              <div className="placeholder-content">
                <h3>Punjab &amp; Haryana Geographic Bounding Box</h3>
                <p>
                  Coordinates: <code>29.5°N - 32.5°N, 73.8°E - 77.2°E</code>
                </p>
                <p className="placeholder-meta">
                  Will integrate Leaflet / MapLibre GL with real NASA FIRMS VIIRS 375m active fire data.
                </p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'risk' && (
          <section
            id="panel-risk"
            role="tabpanel"
            aria-labelledby="tab-risk"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>District &amp; Tehsil Risk Ranking</h2>
              <p className="section-description">
                Vulnerability index calculated from harvest schedules, soil moisture, and localized burn probability.
              </p>
            </div>

            <div className="placeholder-container">
              <div className="placeholder-badge">Planned Milestone 5</div>
              <div className="table-preview-wrapper">
                <table className="demo-table" aria-label="Demo Risk Ranking Preview">
                  <thead>
                    <tr>
                      <th scope="col">Priority</th>
                      <th scope="col">District</th>
                      <th scope="col">State</th>
                      <th scope="col">Risk Index</th>
                      <th scope="col">Harvest Stage</th>
                      <th scope="col">Advisory Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="priority-badge critical">#1</span></td>
                      <td><strong>Sangrur</strong></td>
                      <td>Punjab</td>
                      <td><span className="risk-score high">0.94</span></td>
                      <td>Late Harvest (Residue exposed)</td>
                      <td>Deploy Happy Seeder subsidy fleet</td>
                    </tr>
                    <tr>
                      <td><span className="priority-badge high">#2</span></td>
                      <td><strong>Firozpur</strong></td>
                      <td>Punjab</td>
                      <td><span className="risk-score high">0.88</span></td>
                      <td>Peak Combine Operation</td>
                      <td>Dispatch nodal officer patrol</td>
                    </tr>
                    <tr>
                      <td><span className="priority-badge medium">#3</span></td>
                      <td><strong>Kaithal</strong></td>
                      <td>Haryana</td>
                      <td><span className="risk-score medium">0.76</span></td>
                      <td>Mid Harvest</td>
                      <td>Alert panchayat monitoring unit</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="placeholder-meta">
                Dynamic risk calculation engine will compute hourly rankings via backend API endpoints.
              </p>
            </div>
          </section>
        )}

        {activeTab === 'cases' && (
          <section
            id="panel-cases"
            role="tabpanel"
            aria-labelledby="tab-cases"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Officer Enforcement Cases</h2>
              <p className="section-description">
                Field verification registry for agricultural nodal officers, satellite anomaly correlation, and incident actions.
              </p>
            </div>

            <div className="placeholder-container">
              <div className="placeholder-badge">Planned Milestone 6</div>
              <div className="cases-cards-preview">
                <div className="case-card-preview">
                  <div className="case-card-top">
                    <span className="case-id">CASE-PB-2026-081</span>
                    <span className="status-badge pending">Under Inspection</span>
                  </div>
                  <h4>Tarn Taran — Sector 4 Farm Cluster</h4>
                  <p className="case-meta">Detected: Today 08:32 IST | Officer: S. Sandhu (Dispatched)</p>
                  <p className="case-notes">Thermal anomaly verified by S-NPP pass. Field officer en route for GPS geotagged report.</p>
                </div>
                <div className="case-card-preview">
                  <div className="case-card-top">
                    <span className="case-id">CASE-HR-2026-042</span>
                    <span className="status-badge resolved">Resolved / Ex-situ</span>
                  </div>
                  <h4>Karnal — Village Nilokheri</h4>
                  <p className="case-meta">Detected: Yesterday 16:15 IST | Officer: R. Verma</p>
                  <p className="case-notes">Farmer opted for baler machine collection under bio-mass plant supply agreement.</p>
                </div>
              </div>
              <p className="placeholder-meta">
                Full CRUD case lifecycle management with SQLite persistence will be integrated in subsequent milestones.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-left">
          <span>StubbleSense &copy; 2026</span>
          <span className="footer-separator">&bull;</span>
          <span>Agricultural Environmental Intelligence</span>
        </div>
        <div className="footer-right">
          <span>Active Endpoint: <code>{API_BASE_URL}</code></span>
        </div>
      </footer>
    </div>
  );
}

export default App;

import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser, logoutUser, AUTH_EXPIRED_EVENT } from './api/auth';
import { getHealthStatus } from './api/health';
import { EquipmentAllocation } from './components/EquipmentAllocation';
import { FireMap } from './components/FireMap';
import { InterventionTracking } from './components/InterventionTracking';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { UserManagement } from './components/UserManagement';
import { VillageRiskRanking } from './components/VillageRiskRanking';
import { API_BASE_URL } from './config';
import { getDefaultTabForRole, getPermissions, isTabPermitted } from './permissions';
import type { BackendStatus, HealthResponse, NavigationTab, UserProfile } from './types/api';
import './App.css';

function NavIcon({ tabKey }: { tabKey: NavigationTab }) {
  if (tabKey === 'overview') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  if (tabKey === 'map') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    );
  }
  if (tabKey === 'risk') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    );
  }
  if (tabKey === 'allocation' || tabKey === 'equipment-ops') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (tabKey === 'tracking' || tabKey === 'field-ops') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    );
  }
  if (tabKey === 'users') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M12 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
      </svg>
    );
  }
  if (tabKey === 'staff') {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7.5" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    );
  }
  return null;
}

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [registeredUsername, setRegisteredUsername] = useState<string>('');

  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('loading');
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [fireEventCount, setFireEventCount] = useState<number>(16);

  const handleTabChange = useCallback((tab: NavigationTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('stubble_active_tab', tab);
    }
  }, []);

  // Listen for automatic auth expiration triggered by API 401s
  useEffect(() => {
    const handleExpired = () => {
      setCurrentUser(null);
      setSessionExpiredNotice('Your session has expired or is invalid. Please sign in again.');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('stubble_active_tab');
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, []);

  // Check auth session on startup with tab preservation
  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((user) => {
        if (active) {
          setCurrentUser(user);
          const savedTab = typeof window !== 'undefined'
            ? (sessionStorage.getItem('stubble_active_tab') as NavigationTab | null)
            : null;
          if (savedTab && isTabPermitted(user.role, savedTab)) {
            setActiveTab(savedTab);
          } else {
            const defTab = getDefaultTabForRole(user.role);
            setActiveTab(defTab);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('stubble_active_tab', defTab);
            }
          }
          setIsAuthChecking(false);
        }
      })
      .catch(() => {
        if (active) {
          setCurrentUser(null);
          setIsAuthChecking(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // non-blocking
    } finally {
      setCurrentUser(null);
      setSessionExpiredNotice(null);
      setActiveTab('overview');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('stubble_active_tab');
      }
    }
  };

  // If still restoring session
  if (isAuthChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="spinner" aria-hidden="true" />
        <p>Restoring StubbleSense security credentials...</p>
      </div>
    );
  }

  // If not authenticated, render LoginPage or RegisterPage
  if (!currentUser) {
    if (authView === 'register') {
      return (
        <RegisterPage
          onBackToLogin={(prefilled) => {
            if (prefilled) setRegisteredUsername(prefilled);
            setAuthView('login');
          }}
        />
      );
    }

    return (
      <LoginPage
        sessionExpiredNotice={sessionExpiredNotice}
        initialUsername={registeredUsername}
        onNavigateToRegister={() => setAuthView('register')}
        onLoginSuccess={(user) => {
          setSessionExpiredNotice(null);
          setCurrentUser(user);
          const defTab = getDefaultTabForRole(user.role);
          setActiveTab(defTab);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('stubble_active_tab', defTab);
          }
        }}
      />
    );
  }

  // Centralized role permissions
  const permissions = getPermissions(currentUser.role);
  const isCurrentTabPermitted = isTabPermitted(currentUser.role, activeTab);

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
          {/* User Profile & Role Display */}
          <div className="user-profile-meta" role="region" aria-label="Authenticated staff profile">
            <span className="user-name">{currentUser.full_name}</span>
            <span className={`user-role-badge role-${currentUser.role}`}>
              {currentUser.role === 'super_admin' && 'Developer Super Admin'}
              {currentUser.role === 'admin' && 'District Admin'}
              {currentUser.role === 'field_officer' && 'Field Officer'}
              {currentUser.role === 'equipment_coordinator' && 'Equipment Coordinator'}
            </span>
            <button
              type="button"
              className="btn-signout"
              onClick={() => void handleLogout()}
              aria-label="Sign out from session"
            >
              Sign Out
            </button>
          </div>

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

      {/* Navigation Bar - Render strictly permitted tabs for current role */}
      <nav className="app-nav" aria-label="Main Navigation">
        <ul className="nav-list" role="tablist">
          {permissions.allowedTabs.map((tabKey) => {
            const label = permissions.tabLabels[tabKey] || tabKey;
            const isActive = activeTab === tabKey;
            return (
              <li key={tabKey} role="presentation">
                <button
                  id={`tab-${tabKey}`}
                  role="tab"
                  type="button"
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tabKey}`}
                  onClick={() => handleTabChange(tabKey)}
                >
                  <NavIcon tabKey={tabKey} />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
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
              <div className="section-header-title-row">
                <h2>Regional Monitoring Overview</h2>
                {currentUser && (
                  <span className={`overview-scope-badge ${currentUser.role === 'super_admin' ? 'super-admin' : currentUser.role === 'admin' ? 'district-admin' : 'operational'}`}>
                    {currentUser.role === 'super_admin'
                      ? 'Platform Super Admin Scope'
                      : currentUser.role === 'admin'
                      ? 'District Operational Scope'
                      : currentUser.role === 'field_officer'
                      ? 'Field Officer Scope'
                      : 'Equipment Coordinator Scope'}
                  </span>
                )}
              </div>
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
                <div className="stat-number">{fireEventCount}</div>
                <p className="stat-detail">Thermal observations in Punjab &amp; Haryana demo dataset</p>
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
                  onClick={() => handleTabChange('map')}
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
                  onClick={() => handleTabChange('risk')}
                >
                  View Risk Matrix &rarr;
                </button>
              </div>

              {permissions.canAllocateEquipment && (
                <div className="feature-card">
                  <div className="feature-icon-wrapper case-accent" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <h3>Residue Equipment Allocation</h3>
                  <p>
                    Proximity-based Custom Hiring Center advisor matching high-risk villages with nearby Happy Seeders, balers, and mulchers.
                  </p>
                  <button
                    type="button"
                    className="card-action-button"
                    onClick={() => handleTabChange('allocation')}
                  >
                    Allocate Equipment &rarr;
                  </button>
                </div>
              )}

              {permissions.canViewAllInterventions && (
                <div className="feature-card">
                  <div className="feature-icon-wrapper case-accent" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      <path d="m9 14 2 2 4-4" />
                    </svg>
                  </div>
                  <h3>Intervention &amp; Field Verification</h3>
                  <p>
                    Lifecycle tracking with immutable audit trails and ground spot audits distinguishing self-reported from field-verified clearances.
                  </p>
                  <button
                    type="button"
                    className="card-action-button"
                    onClick={() => handleTabChange('tracking')}
                  >
                    Track Interventions &rarr;
                  </button>
                </div>
              )}

              {currentUser?.role === 'super_admin' && (
                <div className="feature-card">
                  <div className="feature-icon-wrapper user-accent" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <h3>System User &amp; Role Management</h3>
                  <p>
                    Platform-wide governance: inspect full roster, deactivate/activate accounts, and provision administrators, field officers, or coordinators.
                  </p>
                  <button
                    type="button"
                    className="card-action-button"
                    onClick={() => handleTabChange('users')}
                  >
                    Manage User Roster &rarr;
                  </button>
                </div>
              )}

              {currentUser?.role === 'admin' && (
                <div className="feature-card">
                  <div className="feature-icon-wrapper user-accent" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  </div>
                  <h3>District Staff Provisioning</h3>
                  <p>
                    Onboard operational field officers and equipment coordinators for local blocks. Admin accounts and full system user roster remain Super Admin only.
                  </p>
                  <button
                    type="button"
                    className="card-action-button"
                    onClick={() => handleTabChange('staff')}
                  >
                    Provision District Staff &rarr;
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Access Denied Fallback if navigating to forbidden tab */}
        {!isCurrentTabPermitted && (
          <section className="access-denied-panel" role="alert">
            <div className="access-denied-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2>Access Restricted by Role Policy</h2>
            <p>
              Your authenticated role (<strong>{currentUser.role}</strong>) does not have authorization to view the <code>{activeTab}</code> module.
            </p>
            <button
              type="button"
              className="btn-return-permitted"
              onClick={() => setActiveTab(permissions.defaultTab)}
            >
              Return to Permitted Dashboard ({permissions.tabLabels[permissions.defaultTab]}) &rarr;
            </button>
          </section>
        )}

        {/* Tab Panels Guarded by isCurrentTabPermitted */}
        {isCurrentTabPermitted && activeTab === 'map' && (
          <section
            id="panel-map"
            role="tabpanel"
            aria-labelledby="tab-map"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>
                Interactive Fire Hotspot Map
                {(currentUser.role === 'field_officer' || currentUser.role === 'equipment_coordinator') && (
                  <span className="read-only-badge">Operational Spatial Surveillance (Read-Only)</span>
                )}
              </h2>
              <p className="section-description">
                Interactive spatial visualization of agricultural residue burning observations across Punjab and Haryana.
              </p>
            </div>

            <FireMap onEventCountUpdate={setFireEventCount} />
          </section>
        )}

        {isCurrentTabPermitted && activeTab === 'risk' && (
          <section
            id="panel-risk"
            role="tabpanel"
            aria-labelledby="tab-risk"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Explainable Village Risk Rankings</h2>
              <p className="section-description">
                Deterministic agricultural residue risk ranking calculated from thermal proximity, satellite confidence, observation recency, and combustion intensity.
              </p>
            </div>

            <VillageRiskRanking
              onNavigateToMap={() => {
                setActiveTab('map');
              }}
            />
          </section>
        )}

        {isCurrentTabPermitted && activeTab === 'allocation' && (
          <section
            id="panel-allocation"
            role="tabpanel"
            aria-labelledby="tab-allocation"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Residue Management Equipment Allocation</h2>
              <p className="section-description">
                Proximity-based Custom Hiring Center machinery advisor recommending Happy Seeders, balers, and mulchers to mitigate crop residue burning.
              </p>
            </div>

            <EquipmentAllocation
              onNavigateToMap={() => {
                setActiveTab('map');
              }}
            />
          </section>
        )}

        {isCurrentTabPermitted && activeTab === 'tracking' && (
          <section
            id="panel-tracking"
            role="tabpanel"
            aria-labelledby="tab-tracking"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Intervention Tracking &amp; Field Verification</h2>
              <p className="section-description">
                Lifecycle management for crop residue interventions, audit trails, and on-site ground verification records.
              </p>
            </div>

            <InterventionTracking
              currentUser={currentUser}
              mode="standard"
              onNavigateToMap={() => {
                setActiveTab('map');
              }}
              onNavigateToAllocation={() => {
                setActiveTab('allocation');
              }}
            />
          </section>
        )}

        {/* Dedicated Field Operations View for Field Officer */}
        {isCurrentTabPermitted && activeTab === 'field-ops' && (
          <section
            id="panel-field-ops"
            role="tabpanel"
            aria-labelledby="tab-field-ops"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Field Operations &amp; Verification Roster</h2>
              <p className="section-description">
                Dedicated field inspector portal displaying agricultural residue interventions assigned to your jurisdiction for spot audits and verification.
              </p>
            </div>

            <InterventionTracking
              currentUser={currentUser}
              mode="field_officer"
              onNavigateToMap={() => {
                setActiveTab('map');
              }}
            />
          </section>
        )}

        {/* Dedicated Equipment Operations View for Equipment Coordinator */}
        {isCurrentTabPermitted && activeTab === 'equipment-ops' && (
          <section
            id="panel-equipment-ops"
            role="tabpanel"
            aria-labelledby="tab-equipment-ops"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>Equipment Operations &amp; CHC Fleet Explorer</h2>
              <p className="section-description">
                Custom Hiring Center machinery inventory, proximity machinery advisor, and dispatch mobilization for Approved interventions.
              </p>
            </div>

            <EquipmentAllocation
              onNavigateToMap={() => {
                setActiveTab('map');
              }}
            />
          </section>
        )}

        {/* User Management for Super Admin */}
        {isCurrentTabPermitted && activeTab === 'users' && (
          <section
            id="panel-users"
            role="tabpanel"
            aria-labelledby="tab-users"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>System User &amp; Role Administration</h2>
              <p className="section-description">
                Manage registered user accounts, inspect operational role assignments, and provision administrator and staff credentials.
              </p>
            </div>

            <UserManagement mode="full" currentUser={currentUser} />
          </section>
        )}

        {/* Staff Provisioning for District Admin */}
        {isCurrentTabPermitted && activeTab === 'staff' && (
          <section
            id="panel-staff"
            role="tabpanel"
            aria-labelledby="tab-staff"
            className="tab-panel"
          >
            <div className="section-header">
              <h2>District Staff Account Provisioning</h2>
              <p className="section-description">
                Provision operational accounts for field verification officers and Custom Hiring Center equipment coordinators.
              </p>
            </div>

            <UserManagement mode="staff_only" currentUser={currentUser} />
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

import { useEffect, useId, useState } from 'react';
import { getDemoAccounts, loginUser } from '../api/auth';
import type { DemoAccountItem, UserProfile, UserRole } from '../types/api';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  sessionExpiredNotice?: string | null;
  initialUsername?: string;
  onNavigateToRegister?: () => void;
}

export function LoginPage({
  onLoginSuccess,
  sessionExpiredNotice,
  initialUsername = '',
  onNavigateToRegister,
}: LoginPageProps) {
  const [username, setUsername] = useState<string>(initialUsername);
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoAccountsEnabled, setDemoAccountsEnabled] = useState<boolean>(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountItem[]>([]);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const usernameId = useId();
  const passwordId = useId();

  // Inspect environment capability and retrieve evaluation accounts on mount
  useEffect(() => {
    let active = true;
    getDemoAccounts()
      .then((res) => {
        if (active) {
          setDemoAccountsEnabled(res.enabled);
          setDemoAccounts(res.accounts || []);
          if (res.enabled) {
            setDemoNotice(res.notice);
          } else {
            setDemoNotice(null);
          }
        }
      })
      .catch(() => {
        if (active) {
          setDemoAccountsEnabled(false);
          setDemoAccounts([]);
          setDemoNotice(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const authRes = await loginUser({
        username: username.trim(),
        password,
      });
      onLoginSuccess(authRes.user);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemoRole = (role: UserRole) => {
    if (!demoAccountsEnabled) {
      setDemoNotice(
        'Evaluation demo accounts are disabled in configuration (ENABLE_DEV_DEMO_ACCOUNTS=false). ' +
        'Please sign in with credentials created via CLI bootstrap ("python backend/app/cli/create_user.py").'
      );
      return;
    }

    const matched = demoAccounts.find((a) => a.role === role);
    if (matched) {
      setUsername(matched.username);
      setPassword(matched.password);
      setDemoNotice(`Populated ${matched.label} credentials (${matched.username}). Click "Sign In to Dashboard" to authenticate.`);
      setErrorMessage(null);
    } else {
      setErrorMessage(`Credentials for ${role} could not be located in this evaluation environment.`);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">
            <svg
              width="32"
              height="32"
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
          <h1 className="login-title">StubbleSense</h1>
          <p className="login-subtitle">
            Agricultural Environmental Intelligence &amp; Residue Governance
          </p>
        </div>

        {/* Security / Session Notice */}
        {sessionExpiredNotice ? (
          <div className="login-warning-alert" role="alert">
            <strong>SESSION NOTIFICATION</strong>
            <p>{sessionExpiredNotice}</p>
          </div>
        ) : (
          <div className="login-notice" role="region" aria-label="Authentication security notice">
            <strong>SECURE ACCESS PORTAL</strong>
            <p>
              Authorized personnel only. Access permissions are strictly enforced according to assigned role.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="login-error-alert" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {demoNotice && (
          <div className="login-demo-notice-alert" role="status">
            <span>{demoNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor={usernameId} className="login-label">
              Username:
            </label>
            <input
              id={usernameId}
              type="text"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or officer_username"
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor={passwordId} className="login-label">
              Password:
            </label>
            <input
              id={passwordId}
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
          </button>

          {onNavigateToRegister && (
            <div className="login-register-prompt">
              <span>Need an operational staff account?</span>
              <button
                type="button"
                className="login-register-link"
                onClick={onNavigateToRegister}
              >
                Register for Clearance
              </button>
            </div>
          )}
        </form>

        {/* Quick Demo Role Picker for Local Evaluation */}
        <div className="demo-credentials-box">
          <div className="demo-box-header">
            <span className="demo-box-label">Evaluation Demo Accounts:</span>
            {!demoAccountsEnabled ? (
              <span className="demo-status-pill disabled">Disabled</span>
            ) : (
              <span className="demo-status-pill enabled">Evaluation Mode Active</span>
            )}
          </div>

          {!demoAccountsEnabled ? (
            <div className="evaluation-notice-box disabled" role="note">
              <strong>Evaluation Accounts Disabled</strong>
              <p>
                Synthetic demo accounts are disabled in configuration (<code>ENABLE_DEV_DEMO_ACCOUNTS=false</code>).
                To evaluate with demo accounts, start the backend with <code>ENABLE_DEV_DEMO_ACCOUNTS=true</code>.
              </p>
            </div>
          ) : (
            <div className="evaluation-notice-box active" role="note">
              <strong>Evaluation Mode Active</strong>
              <p>
                Click any role below to populate credentials into the sign-in form, then click <strong>Sign In to Dashboard</strong>.
              </p>
            </div>
          )}

          <div className="demo-buttons-grid">
            <button
              type="button"
              className={`demo-role-btn ${!demoAccountsEnabled ? 'disabled' : ''}`}
              disabled={!demoAccountsEnabled}
              onClick={() => handleSelectDemoRole('super_admin')}
              title={demoAccountsEnabled ? 'Developer Super Admin' : 'Demo accounts disabled in backend configuration'}
            >
              <strong>Super Admin</strong>
              <span>Developer system</span>
            </button>
            <button
              type="button"
              className={`demo-role-btn ${!demoAccountsEnabled ? 'disabled' : ''}`}
              disabled={!demoAccountsEnabled}
              onClick={() => handleSelectDemoRole('admin')}
              title={demoAccountsEnabled ? 'District Admin' : 'Demo accounts disabled in backend configuration'}
            >
              <strong>District Admin</strong>
              <span>District operations (RBAC)</span>
            </button>
            <button
              type="button"
              className={`demo-role-btn ${!demoAccountsEnabled ? 'disabled' : ''}`}
              disabled={!demoAccountsEnabled}
              onClick={() => handleSelectDemoRole('field_officer')}
              title={demoAccountsEnabled ? 'Field Officer' : 'Demo accounts disabled in backend configuration'}
            >
              <strong>Field Officer</strong>
              <span>Verifications &amp; audit</span>
            </button>
            <button
              type="button"
              className={`demo-role-btn ${!demoAccountsEnabled ? 'disabled' : ''}`}
              disabled={!demoAccountsEnabled}
              onClick={() => handleSelectDemoRole('equipment_coordinator')}
              title={demoAccountsEnabled ? 'Equipment Coordinator' : 'Demo accounts disabled in backend configuration'}
            >
              <strong>Equipment Coord</strong>
              <span>Machinery dispatch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

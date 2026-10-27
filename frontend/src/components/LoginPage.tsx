import { useEffect, useId, useState } from 'react';
import { getDemoAccounts, loginUser } from '../api/auth';
import type { DemoAccountItem, UserProfile, UserRole } from '../types/api';
import {
  ROLE_CARD_CONFIG,
  handleRoleSwitch,
  resolveRoleFromUsername,
} from '../utils/roleSwitch';
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
  const [password, setPassword] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        return params.get('eval_key') || params.get('eval_password') || '';
      }
    } catch {
      // Ignore
    }
    return '';
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoAccountsEnabled, setDemoAccountsEnabled] = useState<boolean>(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountItem[]>([]);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const usernameId = useId();
  const passwordId = useId();

  // Derived role synchronized with username and demo accounts
  const selectedRole = resolveRoleFromUsername(username, demoAccounts);

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

  // Clean evaluation key/password from URL search params if present
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        if (params.has('eval_key') || params.has('eval_password')) {
          params.delete('eval_key');
          params.delete('eval_password');
          const cleanQuery = params.toString();
          const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '') + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
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
    const nextState = handleRoleSwitch(role, { demoAccounts });
    setUsername(nextState.username);
    setPassword(nextState.password); // Clears password so previous role's password is not accidentally submitted
    setErrorMessage(nextState.errorMessage);
    setDemoNotice(nextState.demoNotice);

    const passEl = document.getElementById(passwordId);
    if (passEl) passEl.focus();
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
            <div className="login-label-row">
              <label htmlFor={passwordId} className="login-label">
                Password:
              </label>
              <button
                type="button"
                className="login-toggle-pw-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
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

        {/* Quick Demo Role Picker for Evaluation */}
        <div className="demo-credentials-box">
          <div className="demo-box-header">
            <span className="demo-box-label">Evaluation Roles & Workflows:</span>
            {!demoAccountsEnabled ? (
              <span className="demo-status-pill neutral">Standard Access</span>
            ) : (
              <span className="demo-status-pill enabled">Evaluation Ready</span>
            )}
          </div>

          {!demoAccountsEnabled ? (
            <div className="evaluation-notice-box neutral" role="note">
              <strong>Standard Access Mode</strong>
              <p>
                Staff and evaluators must sign in with their provisioned credentials.
              </p>
            </div>
          ) : (
            <div className="evaluation-notice-box active" role="note">
              <strong>Evaluation Mode Active</strong>
              <p>
                {demoNotice || 'Click any role below to populate its username in the sign-in form. Enter your evaluation password and click Sign In to Dashboard.'}
              </p>
            </div>
          )}

          <div className="demo-buttons-grid" role="group" aria-label="Evaluation Roles and Workflows">
            {ROLE_CARD_CONFIG.map((config) => {
              const isSelected = selectedRole === config.role;
              return (
                <button
                  key={config.role}
                  type="button"
                  className={`demo-role-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDemoRole(config.role)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${config.title} evaluation role`}
                  title={`Select ${config.title} evaluation role (${config.defaultUsername})`}
                >
                  <span className="demo-role-btn-header">
                    <strong>{config.title}</strong>
                    {isSelected && (
                      <span className="demo-role-check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </span>
                  <span>{config.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useId, useState } from 'react';
import { getRegistrationStatus, registerUser } from '../api/auth';
import type { RegistrationStatusResponse, UserRole } from '../types/api';
import './RegisterPage.css';

interface RegisterPageProps {
  onBackToLogin: (prefilledUsername?: string) => void;
}

interface RoleCardMeta {
  label: string;
  badge: string;
  isPrivileged: boolean;
  desc: string;
}

const ROLE_DETAILS: Record<UserRole, RoleCardMeta> = {
  super_admin: {
    label: 'Super Admin (System Bootstrap Only)',
    badge: 'Bootstrap Only',
    isPrivileged: true,
    desc: 'Full system authority & user management. Provisioned exclusively via secure server CLI bootstrap (create_user.py); cannot be self-registered.',
  },
  admin: {
    label: 'District Admin (District Administrator)',
    badge: 'Super Admin Only',
    isPrivileged: true,
    desc: 'District governance, risk monitoring, and intervention planning. Provisioned exclusively by an authorized Super Admin; cannot be self-registered.',
  },
  field_officer: {
    label: 'Field Officer (Ground Verification & Audit)',
    badge: 'Requires Approval',
    isPrivileged: false,
    desc: 'Ground verification, spot inspections, and intervention clearance for assigned records. Account is created in PENDING inactive state until activated by an administrator.',
  },
  equipment_coordinator: {
    label: 'Equipment Coordinator (Machinery Dispatch)',
    badge: 'Requires Approval',
    isPrivileged: false,
    desc: 'Custom Hiring Center machinery allocation, equipment status tracking, and dispatch mobilization. Account is created in PENDING inactive state until activated by an administrator.',
  },
};

export function RegisterPage({ onBackToLogin }: RegisterPageProps) {
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('field_officer');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatusResponse | null>(null);
  const [successData, setSuccessData] = useState<{
    username: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    message: string;
  } | null>(null);

  const fullNameId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const roleSelectId = useId();

  // Inspect environment registration policy on mount
  useEffect(() => {
    let active = true;
    getRegistrationStatus()
      .then((status) => {
        if (active) {
          setRegistrationStatus(status);
        }
      })
      .catch(() => {
        if (active) {
          setRegistrationStatus({
            enabled: false,
            notice: 'Public self-registration status check failed.',
            policy: 'Self-registration disabled by default.',
            roles: [],
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation checks
    if (fullName.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters.');
      return;
    }
    if (username.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    if (selectedRole === 'super_admin') {
      setErrorMessage(
        'Super Admin accounts cannot be self-registered. Only the secure server CLI bootstrap (create_user.py) may provision a super admin.'
      );
      return;
    }

    if (selectedRole === 'admin') {
      setErrorMessage(
        'District Admin accounts cannot be self-registered. Only an authorized Super Admin can provision administrator accounts.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerUser({
        full_name: fullName.trim(),
        username: username.trim(),
        password,
        role: selectedRole,
      });

      setSuccessData({
        username: res.user.username,
        fullName: res.user.full_name,
        role: res.user.role,
        isActive: res.user.is_active,
        message: res.message,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeRoleMeta = ROLE_DETAILS[selectedRole];

  return (
    <div className="register-page-container">
      <div className="register-card">
        {/* Brand Header */}
        <div className="register-brand">
          <div className="register-logo" aria-hidden="true">
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
          <h1 className="register-title">StubbleSense</h1>
          <p className="register-subtitle">
            Staff Portal Registration &amp; Role Clearance
          </p>
        </div>

        {/* Security & Clearance Governance Banner */}
        <div className="register-notice" role="region" aria-label="Registration policy notice">
          <div className="register-notice-header">
            <strong>SECURITY GOVERNANCE &amp; CLEARANCE</strong>
            {registrationStatus?.enabled ? (
              registrationStatus.auto_approve ? (
                <span className="register-status-badge enabled">Evaluation Mode: Auto-Activation Enabled</span>
              ) : (
                <span className="register-status-badge enabled">Self-Registration Active (Pending Approval)</span>
              )
            ) : (
              <span className="register-status-badge disabled">Self-Registration Disabled by Default</span>
            )}
          </div>
          <p>
            {registrationStatus?.auto_approve
              ? 'In this evaluation environment, self-registered Field Officer and Equipment Coordinator accounts are automatically activated upon submission and ready for immediate sign in.'
              : 'Self-registered staff accounts are created in a PENDING (inactive) state and must be reviewed and activated by a District or Super Administrator before portal access is granted.'}
          </p>
        </div>

        {/* Disabled Environment Warning */}
        {registrationStatus && !registrationStatus.enabled && (
          <div className="register-warning-alert" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <strong>ENVIRONMENT POLICY: REGISTRATION DISABLED</strong>
              <p>
                Self-registration is disabled in this environment (<code>ENABLE_PUBLIC_REGISTRATION=false</code>).
                Direct staff provisioning by an administrator or server CLI bootstrap is required.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="register-error-alert" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Confirmation View */}
        {successData ? (
          <div className="register-success-panel" role="status">
            <div className="success-icon-wrap" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="success-title">
              {successData.isActive ? 'Registration Complete & Activated' : 'Registration Submitted'}
            </h2>
            <p className="success-intro">
              {successData.isActive
                ? 'Your operational account has been automatically activated for evaluation. You can now proceed directly to sign in.'
                : 'Your account request has been registered and is awaiting administrator verification.'}
            </p>

            <div className="success-details-card">
              <div className="success-detail-row">
                <span className="detail-label">Full Name:</span>
                <span className="detail-val">{successData.fullName}</span>
              </div>
              <div className="success-detail-row">
                <span className="detail-label">Username:</span>
                <span className="detail-val"><code>{successData.username}</code></span>
              </div>
              <div className="success-detail-row">
                <span className="detail-label">Requested Role:</span>
                <span className="detail-val role-tag">{ROLE_DETAILS[successData.role]?.label || successData.role}</span>
              </div>
              <div className="success-detail-row">
                <span className="detail-label">Account Status:</span>
                <span className={`detail-val ${successData.isActive ? 'status-active' : 'status-pending'}`}>
                  {successData.isActive ? 'Active (Ready for Sign In)' : 'Pending Administrator Approval'}
                </span>
              </div>
            </div>

            <p className="success-security-note">
              Password credentials have been securely stored with salted bcrypt hashing.
              {successData.isActive
                ? ' Your credentials are valid immediately; proceed to sign in with your chosen password.'
                : ' Once your District Administrator approves your clearance, you will be able to log in.'}
            </p>

            <button
              type="button"
              className="register-submit-btn"
              onClick={() => onBackToLogin(successData.username)}
            >
              {successData.isActive ? 'Sign In Now' : 'Proceed to Sign In'}
            </button>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="register-form">
            <div className="register-field">
              <label htmlFor={fullNameId} className="register-label">
                Full Name:
              </label>
              <input
                id={fullNameId}
                type="text"
                className="register-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jaswinder Singh"
                autoComplete="name"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor={usernameId} className="register-label">
                Username:
              </label>
              <input
                id={usernameId}
                type="text"
                className="register-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jsingh_officer"
                autoComplete="username"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor={roleSelectId} className="register-label">
                Operational Role / Clearance Request:
              </label>
              <select
                id={roleSelectId}
                className="register-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              >
                <option value="field_officer">Field Officer (Ground Verification &amp; Audit)</option>
                <option value="equipment_coordinator">Equipment Coordinator (Machinery Dispatch)</option>
                <option value="admin">District Admin (District Administrator)</option>
                <option value="super_admin">Super Admin (System Bootstrap Only)</option>
              </select>

              {/* Dynamic Role Explanation & Policy Box */}
              <div className={`role-policy-box ${activeRoleMeta.isPrivileged ? 'privileged' : 'operational'}`}>
                <div className="role-policy-header">
                  <span className="role-policy-title">{activeRoleMeta.label}</span>
                  <span className={`role-policy-pill ${activeRoleMeta.isPrivileged ? 'pill-restricted' : registrationStatus?.auto_approve ? 'pill-auto' : 'pill-approval'}`}>
                    {activeRoleMeta.isPrivileged
                      ? activeRoleMeta.badge
                      : registrationStatus?.auto_approve
                      ? 'Auto-Activated (Eval)'
                      : activeRoleMeta.badge}
                  </span>
                </div>
                <p className="role-policy-desc">
                  {registrationStatus?.auto_approve && !activeRoleMeta.isPrivileged
                    ? activeRoleMeta.desc.replace('Account is created in PENDING inactive state until activated by an administrator.', 'Account is automatically activated upon registration for local evaluation.')
                    : activeRoleMeta.desc}
                </p>
                {activeRoleMeta.isPrivileged && (
                  <p className="role-policy-warning">
                    ⚠️ Administrative restriction: Requests for this role cannot be self-registered and will be rejected.
                  </p>
                )}
              </div>
            </div>

            <div className="register-field-row">
              <div className="register-field">
                <label htmlFor={passwordId} className="register-label">
                  Password:
                </label>
                <input
                  id={passwordId}
                  type="password"
                  className="register-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="register-field">
                <label htmlFor={confirmPasswordId} className="register-label">
                  Confirm Password:
                </label>
                <input
                  id={confirmPasswordId}
                  type="password"
                  className="register-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="register-submit-btn"
              disabled={isLoading || activeRoleMeta.isPrivileged}
            >
              {isLoading
                ? 'Submitting Registration...'
                : activeRoleMeta.isPrivileged
                ? 'Restricted Role (Cannot Self-Register)'
                : 'Submit Registration Request'}
            </button>

            <div className="register-actions-row">
              <button
                type="button"
                className="register-back-btn"
                onClick={() => onBackToLogin()}
              >
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

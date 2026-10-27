import { useEffect, useState, useId } from 'react';
import { createUser, deleteUser, listStaff, listUsers, updateUserStatus } from '../api/auth';
import type { UserProfile, UserRole } from '../types/api';
import './UserManagement.css';

interface UserManagementProps {
  mode: 'full' | 'staff_only';
  currentUser: UserProfile;
}

export function UserManagement({ mode, currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('field_officer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal states
  const [rejectModalUser, setRejectModalUser] = useState<UserProfile | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<UserProfile | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const usernameId = useId();
  const passwordId = useId();
  const fullNameId = useId();
  const roleSelectId = useId();

  const isSuperAdmin = currentUser.role === 'super_admin';
  const effectiveMode = isSuperAdmin ? mode : 'staff_only';

  const refreshRoster = async () => {
    try {
      const data = isSuperAdmin && effectiveMode === 'full'
        ? await listUsers()
        : await listStaff();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh user accounts.');
    }
  };

  useEffect(() => {
    let active = true;
    const fetchInitialRoster = async () => {
      try {
        const data = isSuperAdmin && effectiveMode === 'full'
          ? await listUsers()
          : await listStaff();
        if (active) {
          setUsers(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load user accounts.');
          setIsLoading(false);
        }
      }
    };

    fetchInitialRoster();
    return () => {
      active = false;
    };
  }, [isSuperAdmin, effectiveMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessToast(null);

    // Front-line defense: enforce that only super_admin may request admin role
    if (!isSuperAdmin && (selectedRole === 'admin' || selectedRole === 'super_admin')) {
      setError('District Admins are strictly restricted from provisioning administrator accounts.');
      setIsSubmitting(false);
      return;
    }

    try {
      const newUser = await createUser({
        username: username.trim(),
        password,
        full_name: fullName.trim(),
        role: selectedRole,
      });

      setSuccessToast(`Account '${newUser.username}' successfully created with role '${newUser.role}'.`);
      setUsername('');
      setPassword('');
      setFullName('');
      setSelectedRole(effectiveMode === 'staff_only' ? 'field_officer' : 'admin');
      await refreshRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account provisioning failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (user: UserProfile) => {
    setError(null);
    setSuccessToast(null);
    try {
      await updateUserStatus(user.id, 'active');
      setSuccessToast(`Account '@${user.username}' has been approved and activated.`);
      await refreshRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve and activate user account.');
    }
  };

  const handleDeactivate = async (user: UserProfile) => {
    setError(null);
    setSuccessToast(null);
    try {
      await updateUserStatus(user.id, 'deactivated');
      setSuccessToast(`Account '@${user.username}' has been deactivated.`);
      await refreshRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate user account.');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalUser) return;
    setIsActionLoading(true);
    setError(null);
    setSuccessToast(null);
    try {
      await updateUserStatus(rejectModalUser.id, 'rejected');
      setSuccessToast(`Registration request for '@${rejectModalUser.username}' has been rejected.`);
      setRejectModalUser(null);
      await refreshRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject registration request.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser) return;
    setIsActionLoading(true);
    setError(null);
    setSuccessToast(null);
    try {
      const res = await deleteUser(deleteModalUser.id);
      setSuccessToast(res.message);
      setDeleteModalUser(null);
      await refreshRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user account.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (u: UserProfile) => {
    const status = u.status || (u.is_active ? 'active' : 'pending');
    if (status === 'active') {
      return <span className="um-status-dot active">Active</span>;
    }
    if (status === 'rejected') {
      return <span className="um-status-dot rejected">Rejected</span>;
    }
    if (status === 'deactivated') {
      return <span className="um-status-dot deactivated">Deactivated</span>;
    }
    return <span className="um-status-dot pending">Pending Approval</span>;
  };

  const renderActions = (u: UserProfile) => {
    if (u.id === currentUser.id) {
      return <span className="um-tag-pill current-user">Current User</span>;
    }
    if (!isSuperAdmin && (u.role === 'admin' || u.role === 'super_admin')) {
      return <span className="um-tag-pill protected">Protected Admin</span>;
    }

    const status = u.status || (u.is_active ? 'active' : 'pending');

    if (status === 'pending') {
      return (
        <div className="um-action-group">
          <button
            type="button"
            className="um-action-btn activate"
            onClick={() => handleApprove(u)}
            title="Approve registration and activate account"
          >
            Approve &amp; Activate
          </button>
          <button
            type="button"
            className="um-action-btn reject"
            onClick={() => setRejectModalUser(u)}
            title="Reject registration request"
          >
            Reject
          </button>
          <button
            type="button"
            className="um-action-btn delete"
            onClick={() => setDeleteModalUser(u)}
            title="Delete account"
          >
            Delete
          </button>
        </div>
      );
    }

    if (status === 'rejected') {
      return (
        <div className="um-action-group">
          <button
            type="button"
            className="um-action-btn activate"
            onClick={() => handleApprove(u)}
            title="Re-approve and activate account"
          >
            Approve &amp; Activate
          </button>
          <button
            type="button"
            className="um-action-btn delete"
            onClick={() => setDeleteModalUser(u)}
            title="Delete account"
          >
            Delete
          </button>
        </div>
      );
    }

    if (status === 'active') {
      return (
        <div className="um-action-group">
          <button
            type="button"
            className="um-action-btn deactivate"
            onClick={() => handleDeactivate(u)}
            title="Deactivate account"
          >
            Deactivate
          </button>
          <button
            type="button"
            className="um-action-btn delete"
            onClick={() => setDeleteModalUser(u)}
            title="Delete account"
          >
            Delete
          </button>
        </div>
      );
    }

    // Deactivated
    return (
      <div className="um-action-group">
        <button
          type="button"
          className="um-action-btn activate"
          onClick={() => handleApprove(u)}
          title="Re-activate account"
        >
          Activate
        </button>
        <button
          type="button"
          className="um-action-btn delete"
          onClick={() => setDeleteModalUser(u)}
          title="Delete account"
        >
          Delete
        </button>
      </div>
    );
  };

  return (
    <div className="user-management-container">
      {/* Toast Alert */}
      {successToast && (
        <div className="um-toast success" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successToast}</span>
          <button type="button" onClick={() => setSuccessToast(null)} className="um-toast-close" aria-label="Close notification">&times;</button>
        </div>
      )}

      {error && (
        <div className="um-toast error" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="um-toast-close" aria-label="Close notification">&times;</button>
        </div>
      )}

      <div className="um-workspace-grid">
        {/* Left Column: Provisioning Form */}
        <div className="um-card provision-card">
          <div className="um-card-header">
            <h3>{effectiveMode === 'full' ? 'Provision New Account' : 'Provision District Staff'}</h3>
            <span className={`um-badge ${effectiveMode === 'full' ? 'badge-super' : 'badge-admin'}`}>
              {effectiveMode === 'full' ? 'Super Admin Authority' : 'District Admin Scope'}
            </span>
          </div>

          <p className="um-card-description">
            {effectiveMode === 'full'
              ? 'Provision system administrative accounts or operational staff accounts. Super Admin accounts require CLI bootstrap.'
              : 'Provision nodal field inspection officers and Custom Hiring Center machinery coordinators. Creating or managing administrator accounts is restricted exclusively to Super Admin.'}
          </p>

          <form onSubmit={handleSubmit} className="um-form">
            <div className="um-field">
              <label htmlFor={fullNameId} className="um-label">Full Name &amp; Designation:</label>
              <input
                id={fullNameId}
                type="text"
                className="um-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. S. Sandhu (Field Officer)"
                required
                minLength={2}
              />
            </div>

            <div className="um-field">
              <label htmlFor={usernameId} className="um-label">Username:</label>
              <input
                id={usernameId}
                type="text"
                className="um-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. nodal_officer_sandhu"
                required
                minLength={3}
                autoComplete="off"
              />
            </div>

            <div className="um-field">
              <label htmlFor={passwordId} className="um-label">Initial Password (min 8 chars):</label>
              <input
                id={passwordId}
                type="password"
                className="um-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="um-field">
              <label htmlFor={roleSelectId} className="um-label">Assigned Role:</label>
              <select
                id={roleSelectId}
                className="um-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              >
                {isSuperAdmin && effectiveMode === 'full' && (
                  <option value="admin">District Admin (admin)</option>
                )}
                <option value="field_officer">Field Officer (field_officer)</option>
                <option value="equipment_coordinator">Equipment Coordinator (equipment_coordinator)</option>
              </select>
            </div>

            <div className="um-form-actions">
              <button
                type="submit"
                className="um-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Provisioning...' : 'Provision Account &rarr;'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: User Roster Table with Actions */}
        <div className="um-card roster-card">
          <div className="um-card-header">
            <h3>{effectiveMode === 'full' ? 'System User Roster' : 'District Operational Staff Roster'}</h3>
            <span className="um-count-pill">{users.length} {effectiveMode === 'full' ? 'Registered' : 'Staff'}</span>
          </div>

          <p className="um-card-description">
            {effectiveMode === 'full'
              ? 'Complete system roster. Review pending applicant registrations, approve or reject staff, deactivate accounts, or safely delete records.'
              : 'Authorized block staff roster. Review pending staff registrations, approve, reject, deactivate, or delete field officers and equipment coordinators.'}
          </p>

          {isLoading && (
            <div className="um-loading">
              <div className="spinner" aria-hidden="true" />
              <p>Loading user accounts...</p>
            </div>
          )}

          {!isLoading && (
            <div className="um-table-wrapper">
              <table className="um-table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Type</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="um-empty-cell">
                        No user accounts found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="um-user-cell">
                            <strong>{u.full_name}</strong>
                            <span className="um-user-sub">@{u.username}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`um-role-badge role-${u.role}`}>
                            {u.role === 'super_admin' && 'Super Admin'}
                            {u.role === 'admin' && 'District Admin'}
                            {u.role === 'field_officer' && 'Field Officer'}
                            {u.role === 'equipment_coordinator' && 'Equip Coord'}
                          </span>
                        </td>
                        <td>
                          {getStatusBadge(u)}
                        </td>
                        <td>
                          <span className="um-type-tag">
                            {u.is_synthetic ? 'Synthetic Demo' : 'Provisioned'}
                          </span>
                        </td>
                        <td>
                          {renderActions(u)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalUser && (
        <div className="um-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="um-modal-card">
            <div className="um-modal-header danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h4 id="delete-dialog-title">Confirm Account Deletion</h4>
            </div>
            <div className="um-modal-body">
              <p>
                Are you sure you want to delete user <strong>@{deleteModalUser.username}</strong> (
                <em>{deleteModalUser.full_name}</em>)?
              </p>
              <div className="um-modal-meta">
                <span>Role: <strong>{deleteModalUser.role}</strong></span>
                <span>Status: <strong>{deleteModalUser.status || (deleteModalUser.is_active ? 'active' : 'pending')}</strong></span>
              </div>
              <p className="um-modal-warning">
                🛡️ <strong>Safety Guarantee:</strong> If this user has associated operational history (interventions, audits, or ground verifications), the account will be safely archived (soft-deleted) without losing historical records. Accounts with no history will be permanently purged.
              </p>
            </div>
            <div className="um-modal-actions">
              <button
                type="button"
                className="um-modal-btn cancel"
                disabled={isActionLoading}
                onClick={() => setDeleteModalUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="um-modal-btn confirm-danger"
                disabled={isActionLoading}
                onClick={handleConfirmDelete}
              >
                {isActionLoading ? 'Deleting...' : `Delete @${deleteModalUser.username}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalUser && (
        <div className="um-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title">
          <div className="um-modal-card">
            <div className="um-modal-header warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h4 id="reject-dialog-title">Reject Registration Request</h4>
            </div>
            <div className="um-modal-body">
              <p>
                Are you sure you want to reject the registration request for{' '}
                <strong>@{rejectModalUser.username}</strong> (<em>{rejectModalUser.full_name}</em>)?
              </p>
              <div className="um-modal-meta">
                <span>Requested Role: <strong>{rejectModalUser.role}</strong></span>
              </div>
              <p className="um-modal-warning">
                This will mark the account as <strong>REJECTED</strong> and prevent the user from logging in.
              </p>
            </div>
            <div className="um-modal-actions">
              <button
                type="button"
                className="um-modal-btn cancel"
                disabled={isActionLoading}
                onClick={() => setRejectModalUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="um-modal-btn confirm-warning"
                disabled={isActionLoading}
                onClick={handleConfirmReject}
              >
                {isActionLoading ? 'Rejecting...' : `Reject @${rejectModalUser.username}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

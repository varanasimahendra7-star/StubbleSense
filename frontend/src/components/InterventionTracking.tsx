import { useEffect, useState, useId } from 'react';
import { getEquipmentList } from '../api/equipment';
import {
  createIntervention,
  getInterventions,
  recordFieldVerification,
  updateInterventionStatus,
} from '../api/interventions';
import { getVillageRiskRankings } from '../api/villageRisk';
import type {
  EquipmentItem,
  FieldVerificationPayload,
  InterventionCreatePayload,
  InterventionItem,
  InterventionStatus,
  UserProfile,
  VerificationOutcome,
  VillageRiskItem,
} from '../types/api';
import { getPermissions } from '../permissions';
import './InterventionTracking.css';

interface InterventionTrackingProps {
  onNavigateToMap?: () => void;
  onNavigateToAllocation?: () => void;
  currentUser?: UserProfile | null;
  mode?: 'standard' | 'field_officer' | 'equipment_coordinator';
}

export function InterventionTracking({
  onNavigateToMap,
  onNavigateToAllocation,
  currentUser,
  mode = 'standard',
}: InterventionTrackingProps) {
  const role = currentUser?.role || 'admin';
  const permissions = getPermissions(role);
  const isFieldOfficerMode = mode === 'field_officer' || role === 'field_officer';
  const isEquipCoordMode = mode === 'equipment_coordinator' || role === 'equipment_coordinator';

  // Main data states
  const [interventions, setInterventions] = useState<InterventionItem[]>([]);
  const [dataNotice, setDataNotice] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // References for dropdowns
  const [villages, setVillages] = useState<VillageRiskItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');

  // Selected intervention for Detail / Audit drawer
  const [activeIntervention, setActiveIntervention] = useState<InterventionItem | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState<boolean>(false);
  const [isStatusActionOpen, setIsStatusActionOpen] = useState<boolean>(false);
  const [targetNextStatus, setTargetNextStatus] = useState<InterventionStatus>('Approved');

  // Create Form State
  const [createVillageId, setCreateVillageId] = useState<string>('');
  const [createEquipmentId, setCreateEquipmentId] = useState<string>('');
  const [createType, setCreateType] = useState<string>('In-situ Happy Seeding');
  const [createAcres, setCreateAcres] = useState<number>(30);
  const [createNotes, setCreateNotes] = useState<string>('');
  const [createRequestedBy, setCreateRequestedBy] = useState<string>('Agricultural Nodal Coordinator');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Status Update Form State
  const [statusActor, setStatusActor] = useState<string>(
    currentUser ? `${currentUser.full_name} (${currentUser.role})` : 'Nodal Field Coordinator'
  );
  const [statusReason, setStatusReason] = useState<string>('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  // Verification Form State
  const [verifierName, setVerifierName] = useState<string>(
    currentUser ? currentUser.full_name : 'Nodal Field Officer S. Sandhu'
  );
  const [verifyOutcome, setVerifyOutcome] = useState<VerificationOutcome>('Verified Cleared');
  const [verifyAcres, setVerifyAcres] = useState<number>(30);
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [isSubmittingVerify, setIsSubmittingVerify] = useState<boolean>(false);

  // Accessible IDs
  const filterStatusId = useId();
  const filterCompletionId = useId();
  const filterDistrictId = useId();
  const formVillageId = useId();
  const formEquipmentId = useId();
  const formTypeId = useId();
  const formAcresId = useId();
  const formRequesterId = useId();
  const formNotesId = useId();
  const statusActorId = useId();
  const statusReasonId = useId();
  const verifierNameId = useId();
  const verifyOutcomeId = useId();
  const verifyAcresId = useId();
  const verifyNotesId = useId();

  // Load villages and equipment for form selection
  useEffect(() => {
    let active = true;

    getVillageRiskRankings()
      .then((res) => {
        if (!active) return;
        setVillages(res.items);
        if (res.items.length > 0) {
          setCreateVillageId(res.items[0].id);
        }
      })
      .catch(() => {
        // non-blocking
      });

    getEquipmentList()
      .then((res) => {
        if (!active) return;
        setEquipmentList(res.items);
      })
      .catch(() => {
        // non-blocking
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch interventions on filter change
  useEffect(() => {
    let active = true;

    getInterventions({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      completion_status: completionFilter !== 'all' ? completionFilter : undefined,
      district: districtFilter !== 'all' ? districtFilter : undefined,
    })
      .then((res) => {
        if (!active) return;
        setInterventions(res.items);
        setDataNotice(res.data_notice);
        setIsLoading(false);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load interventions');
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [statusFilter, completionFilter, districtFilter]);

  const reloadInterventions = async (keepActiveId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getInterventions({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        completion_status: completionFilter !== 'all' ? completionFilter : undefined,
        district: districtFilter !== 'all' ? districtFilter : undefined,
      });
      setInterventions(res.items);
      setDataNotice(res.data_notice);

      if (keepActiveId) {
        const updated = res.items.find((item) => item.id === keepActiveId);
        if (updated) setActiveIntervention(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload interventions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCreate(true);
    setError(null);

    const payload: InterventionCreatePayload = {
      village_id: createVillageId,
      equipment_id: createEquipmentId ? createEquipmentId : null,
      intervention_type: createType,
      target_acres: Number(createAcres),
      requested_by: createRequestedBy,
      notes: createNotes ? createNotes : undefined,
    };

    try {
      const created = await createIntervention(payload);
      setIsCreateOpen(false);
      setSuccessToast(`Intervention ${created.id} created successfully.`);
      setTimeout(() => setSuccessToast(null), 5000);
      await reloadInterventions(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create intervention');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenStatusAction = (nextStatus: InterventionStatus) => {
    setTargetNextStatus(nextStatus);
    setStatusReason(
      nextStatus === 'Approved'
        ? 'Operational feasibility reviewed and subsidized dispatch approved.'
        : nextStatus === 'In Progress'
        ? 'Machinery mobilized and residue processing initiated on fields.'
        : nextStatus === 'Completed'
        ? 'Field treatment completed. Self-reported awaiting ground officer verification.'
        : 'Intervention cancelled.'
    );
    setIsStatusActionOpen(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntervention) return;

    setIsSubmittingStatus(true);
    setError(null);

    try {
      const updated = await updateInterventionStatus(activeIntervention.id, {
        new_status: targetNextStatus,
        changed_by: statusActor,
        reason: statusReason,
      });
      setActiveIntervention(updated);
      setIsStatusActionOpen(false);
      setSuccessToast(`Status updated to ${targetNextStatus} (${updated.completion_status}).`);
      setTimeout(() => setSuccessToast(null), 5000);
      await reloadInterventions(updated.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleOpenVerify = () => {
    if (!activeIntervention) return;
    setVerifyAcres(activeIntervention.target_acres);
    setVerifyOutcome('Verified Cleared');
    setVerifyNotes(
      `Synthetic ground inspection confirmed stubble incorporation using ${
        activeIntervention.equipment_name || activeIntervention.intervention_type
      }. Zero active fires.`
    );
    setIsVerifyOpen(true);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntervention) return;

    setIsSubmittingVerify(true);
    setError(null);

    const payload: FieldVerificationPayload = {
      verifier_name: verifierName,
      outcome: verifyOutcome,
      verified_acres: Number(verifyAcres),
      evidence_metadata: {
        inspection_lat: 30.25,
        inspection_lon: 75.85,
        device_id: 'DEMO-TABLET-01',
        method: 'GPS walking audit & anomaly check',
        is_synthetic: true,
      },
      verification_notes: verifyNotes,
    };

    try {
      const updated = await recordFieldVerification(activeIntervention.id, payload);
      setActiveIntervention(updated);
      setIsVerifyOpen(false);
      setSuccessToast(`Ground verification recorded. Completion status elevated to Field-Verified.`);
      setTimeout(() => setSuccessToast(null), 5000);
      await reloadInterventions(updated.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record verification');
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  // Metrics
  const totalCount = interventions.length;
  const inProgressCount = interventions.filter((i) => i.status === 'In Progress').length;
  const selfReportedCount = interventions.filter((i) => i.completion_status === 'Self-Reported').length;
  const fieldVerifiedCount = interventions.filter((i) => i.completion_status === 'Field-Verified').length;

  return (
    <div className="interventions-module">
      {/* Synthetic Demo Notice Banner */}
      <div className="demo-notice-banner" role="region" aria-label="Synthetic demo data notice">
        <div className="demo-notice-header">
          <svg className="notice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <strong>DEMO DATA NOTICE &amp; FIELD VERIFICATION POLICY</strong>
        </div>
        <p className="demo-notice-body">
          All intervention records, audit trails, and officer field inspections are
          <strong> synthetic demonstration records</strong>. StubbleSense enforces a strict separation:
          marking an intervention as completed logs a <strong>Self-Reported</strong> completion, while only an official
          inspection log elevates it to <strong>Field-Verified</strong>.
          Demonstration entries do NOT represent actual physical on-site audits.
        </p>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="success-toast" role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successToast}</span>
        </div>
      )}

      {/* KPI Metrics Summary Row */}
      <div className="kpi-summary-grid">
        <div className="kpi-metric-card">
          <span className="kpi-label">
            {isFieldOfficerMode ? 'Assigned Interventions' : 'Total Interventions'}
          </span>
          <span className="kpi-value">{totalCount}</span>
          <span className="kpi-sub">
            {isFieldOfficerMode ? 'Cases assigned to your field jurisdiction' : 'Across Punjab & Haryana demo clusters'}
          </span>
        </div>
        <div className="kpi-metric-card in-progress">
          <span className="kpi-label">Active / In Progress</span>
          <span className="kpi-value">{inProgressCount}</span>
          <span className="kpi-sub">Machinery currently deployed in fields</span>
        </div>
        <div className="kpi-metric-card self-reported">
          <span className="kpi-label">Self-Reported Completed</span>
          <span className="kpi-value">{selfReportedCount}</span>
          <span className="kpi-sub">Awaiting on-site field verification</span>
        </div>
        <div className="kpi-metric-card field-verified">
          <span className="kpi-label">Field-Verified Completed</span>
          <span className="kpi-value">{fieldVerifiedCount}</span>
          <span className="kpi-sub">Verified on-site by agricultural nodal officers</span>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="interventions-controls-bar">
        <div className="filters-group">
          <div className="control-field">
            <label htmlFor={filterStatusId} className="control-label">
              Lifecycle Status:
            </label>
            <select
              id={filterStatusId}
              className="control-select"
              value={statusFilter}
              onChange={(e) => {
                setIsLoading(true);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Proposed">Proposed</option>
              <option value="Approved">Approved</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="control-field">
            <label htmlFor={filterCompletionId} className="control-label">
              Verification State:
            </label>
            <select
              id={filterCompletionId}
              className="control-select"
              value={completionFilter}
              onChange={(e) => {
                setIsLoading(true);
                setCompletionFilter(e.target.value);
              }}
            >
              <option value="all">All Verification States</option>
              <option value="Pending">Pending Audit</option>
              <option value="Self-Reported">Self-Reported</option>
              <option value="Field-Verified">Field-Verified</option>
            </select>
          </div>

          <div className="control-field">
            <label htmlFor={filterDistrictId} className="control-label">
              District:
            </label>
            <select
              id={filterDistrictId}
              className="control-select"
              value={districtFilter}
              onChange={(e) => {
                setIsLoading(true);
                setDistrictFilter(e.target.value);
              }}
            >
              <option value="all">All Districts</option>
              <option value="Sangrur">Sangrur (Punjab)</option>
              <option value="Karnal">Karnal (Haryana)</option>
            </select>
          </div>
        </div>

        {permissions.canCreateIntervention && (
          <div className="action-buttons-group">
            <button
              type="button"
              className="btn-create-intervention"
              onClick={() => setIsCreateOpen(true)}
              aria-label="Create new intervention requisition"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Intervention</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content: List & Details Drawer */}
      <div className="interventions-workspace" aria-busy={isLoading}>
        {isLoading && (
          <div className="state-card loading-state">
            <div className="spinner" aria-hidden="true" />
            <p>Loading intervention records and audit trails from SQLite persistence...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="state-card error-state">
            <p>
              <strong>Error:</strong> {error}
            </p>
            <button
              type="button"
              className="action-btn secondary"
              onClick={() => void reloadInterventions()}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && interventions.length === 0 && (
          <div className="state-card empty-state">
            <h4>No Interventions Found</h4>
            <p>No agricultural residue interventions match the current filter criteria.</p>
            <button
              type="button"
              className="action-btn secondary"
              onClick={() => {
                setStatusFilter('all');
                setCompletionFilter('all');
                setDistrictFilter('all');
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}

        {!isLoading && !error && interventions.length > 0 && (
          <div className="interventions-grid">
            {interventions.map((item) => {
              const statusClass =
                item.status === 'Completed'
                  ? 'status-completed'
                  : item.status === 'In Progress'
                  ? 'status-inprogress'
                  : item.status === 'Approved'
                  ? 'status-approved'
                  : item.status === 'Cancelled'
                  ? 'status-cancelled'
                  : 'status-proposed';

              const completionClass =
                item.completion_status === 'Field-Verified'
                  ? 'completion-field-verified'
                  : item.completion_status === 'Self-Reported'
                  ? 'completion-self-reported'
                  : 'completion-pending';

              const isSelected = activeIntervention?.id === item.id;

              return (
                <article
                  key={item.id}
                  className={`intervention-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setActiveIntervention(item)}
                >
                  <div className="card-top-row">
                    <div className="card-id-group">
                      <span className="intervention-id">{item.id}</span>
                      <span className={`status-badge ${statusClass}`}>{item.status}</span>
                    </div>

                    <div className="card-completion-group">
                      <span className={`completion-badge ${completionClass}`}>
                        {item.completion_status === 'Field-Verified' && '✓ Field-Verified'}
                        {item.completion_status === 'Self-Reported' && '⏳ Self-Reported'}
                        {item.completion_status === 'Pending' && 'Pending Verification'}
                      </span>
                    </div>
                  </div>

                  <div className="card-village-block">
                    <h4 className="village-heading">{item.village_name}</h4>
                    <span className="district-tag">{item.district}, {item.state}</span>
                  </div>

                  <div className="card-specs-row">
                    <div className="spec-pill">
                      <span className="spec-tag">Type:</span>
                      <strong className="spec-val">{item.intervention_type}</strong>
                    </div>
                    <div className="spec-pill">
                      <span className="spec-tag">Target:</span>
                      <strong className="spec-val">{item.target_acres} Acres</strong>
                    </div>
                    {item.equipment_name && (
                      <div className="spec-pill full-width">
                        <span className="spec-tag">Assigned Unit:</span>
                        <span className="spec-val">{item.equipment_name}</span>
                      </div>
                    )}
                  </div>

                  {item.verification ? (
                    <div className="card-verification-preview verified">
                      <span className="v-label">Ground Outcome:</span>
                      <strong className="v-val">{item.verification.outcome}</strong>
                      <span className="v-sub">by {item.verification.verifier_name}</span>
                    </div>
                  ) : item.completion_status === 'Self-Reported' ? (
                    <div className="card-verification-preview pending">
                      <span className="v-label">Verification Notice:</span>
                      <span className="v-val">Farmer/operator self-reported completion. Pending on-site spot inspection.</span>
                    </div>
                  ) : null}

                  <div className="card-footer-row">
                    <span className="audit-count-tag">{item.audits.length} Audit Event{item.audits.length === 1 ? '' : 's'}</span>
                    <button
                      type="button"
                      className="view-detail-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIntervention(item);
                      }}
                      aria-label={`View audit timeline and actions for ${item.id}`}
                    >
                      Inspect Timeline &rarr;
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {dataNotice && (
          <p className="interventions-footnote">
            <em>Provenance:</em> {dataNotice}
          </p>
        )}
      </div>

      {/* Selected Intervention Detail & Audit Timeline Modal */}
      {activeIntervention && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
        >
          <div className="modal-dialog drawer-dialog">
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="dialog-id-badge">{activeIntervention.id}</span>
                <h3 id="drawer-title">{activeIntervention.village_name} Residue Intervention</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActiveIntervention(null)}
                aria-label="Close intervention details"
              >
                &times;
              </button>
            </div>

            {/* Overview Meta Box */}
            <div className="drawer-overview-grid">
              <div className="overview-col">
                <span className="ov-label">Target Village:</span>
                <strong className="ov-val">{activeIntervention.village_name} ({activeIntervention.district}, {activeIntervention.state})</strong>
                <span className="ov-sub">ID: <code>{activeIntervention.village_id}</code></span>
              </div>
              <div className="overview-col">
                <span className="ov-label">Machinery:</span>
                <strong className="ov-val">{activeIntervention.equipment_name || 'Custom Hiring Mobilization'}</strong>
                <span className="ov-sub">Type: {activeIntervention.intervention_type}</span>
              </div>
              <div className="overview-col">
                <span className="ov-label">Planned Acreage:</span>
                <strong className="ov-val">{activeIntervention.target_acres} Acres</strong>
                <span className="ov-sub">Synthetic Demo Record</span>
              </div>
              <div className="overview-col">
                <span className="ov-label">Current State:</span>
                <div className="badge-row">
                  <span className={`status-badge status-${activeIntervention.status.toLowerCase().replace(/\s+/g, '')}`}>
                    {activeIntervention.status}
                  </span>
                  <span className={`completion-badge completion-${activeIntervention.completion_status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {activeIntervention.completion_status}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar based on current status and role permissions */}
            <div className="drawer-actions-bar">
              <span className="actions-bar-label">Available Lifecycle Actions:</span>
              <div className="actions-button-row">
                {activeIntervention.status === 'Proposed' && permissions.canTransitionToApproved && (
                  <button
                    type="button"
                    className="action-btn primary"
                    onClick={() => handleOpenStatusAction('Approved')}
                  >
                    Approve Intervention &rarr;
                  </button>
                )}

                {activeIntervention.status === 'Approved' && permissions.canTransitionToInProgress && (
                  <button
                    type="button"
                    className="action-btn inprogress"
                    onClick={() => handleOpenStatusAction('In Progress')}
                  >
                    {isEquipCoordMode ? 'Mobilize & Dispatch Machinery \u2192' : 'Start In-Progress Mobilization \u2192'}
                  </button>
                )}

                {activeIntervention.status === 'In Progress' && permissions.canTransitionToCompleted && (
                  <button
                    type="button"
                    className="action-btn completed"
                    onClick={() => handleOpenStatusAction('Completed')}
                  >
                    Log Self-Reported Completion &rarr;
                  </button>
                )}

                {permissions.canVerifyField && (
                  <button
                    type="button"
                    className="action-btn verify"
                    onClick={handleOpenVerify}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>
                      {activeIntervention.verification ? 'Update Field Verification' : 'Conduct Ground Field Verification'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Ground Verification Report Card */}
            {activeIntervention.verification ? (
              <div className="field-verification-card">
                <div className="fv-header">
                  <div className="fv-title">
                    <span className="fv-badge">OFFICIAL GROUND AUDIT</span>
                    <h4>Field Verification Completed</h4>
                  </div>
                  <span className={`fv-outcome-tag outcome-${activeIntervention.verification.outcome.toLowerCase().replace(/[^a-z]/g, '')}`}>
                    {activeIntervention.verification.outcome}
                  </span>
                </div>

                <div className="fv-details-grid">
                  <div className="fv-item">
                    <span className="fv-label">Inspecting Nodal Officer:</span>
                    <strong>{activeIntervention.verification.verifier_name}</strong>
                  </div>
                  <div className="fv-item">
                    <span className="fv-label">Verified Acreage:</span>
                    <strong>{activeIntervention.verification.verified_acres} Acres</strong>
                  </div>
                  <div className="fv-item">
                    <span className="fv-label">Audit Timestamp:</span>
                    <span>{new Date(activeIntervention.verification.verified_at).toLocaleString()}</span>
                  </div>
                  <div className="fv-item">
                    <span className="fv-label">Inspection Evidence:</span>
                    <span>Method: GPS Transect / Satellite cleared</span>
                  </div>
                </div>

                {activeIntervention.verification.verification_notes && (
                  <p className="fv-notes">
                    <strong>Officer Field Notes:</strong> {activeIntervention.verification.verification_notes}
                  </p>
                )}

                <p className="fv-disclaimer">
                  <em>Notice:</em> This is a demonstration verification entry. StubbleSense records verify adherence to environmental protocols in simulation mode.
                </p>
              </div>
            ) : (
              <div className="unverified-callout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  <strong>No On-Site Ground Inspection Recorded Yet</strong>
                  <p>
                    {activeIntervention.status === 'Completed'
                      ? 'This intervention is self-reported as finished by field actors, but remains unconfirmed until an official nodal officer conducts a physical spot audit.'
                      : 'Intervention is currently active in administrative or field stages. Ground verification can be conducted upon completion.'}
                  </p>
                </div>
              </div>
            )}

            {/* Audit History Timeline */}
            <div className="audit-timeline-container">
              <h4 className="timeline-title">Status Transition Audit Trail ({activeIntervention.audits.length} Events)</h4>
              <ol className="timeline-list">
                {activeIntervention.audits.map((audit) => (
                  <li key={audit.id} className="timeline-item">
                    <div className="timeline-marker" aria-hidden="true" />
                    <div className="timeline-content">
                      <div className="timeline-meta-row">
                        <span className="timeline-transition">
                          {audit.from_status !== 'None' ? `${audit.from_status} → ` : ''}
                          <strong>{audit.to_status}</strong>
                        </span>
                        <span className="timeline-time">
                          {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;{' '}
                          {new Date(audit.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="timeline-actor">Actor: <strong>{audit.changed_by}</strong></span>
                      {audit.reason && <p className="timeline-reason">{audit.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="modal-footer">
              <div className="footer-links-group">
                {onNavigateToMap && (
                  <button
                    type="button"
                    className="action-btn secondary link-style-btn"
                    onClick={() => {
                      setActiveIntervention(null);
                      onNavigateToMap();
                    }}
                  >
                    View Village on Fire Map &rarr;
                  </button>
                )}
                {onNavigateToAllocation && (
                  <button
                    type="button"
                    className="action-btn secondary link-style-btn"
                    onClick={() => {
                      setActiveIntervention(null);
                      onNavigateToAllocation();
                    }}
                  >
                    Inspect CHC Machinery &rarr;
                  </button>
                )}
              </div>
              <button
                type="button"
                className="action-btn secondary"
                onClick={() => setActiveIntervention(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Create New Intervention */}
      {isCreateOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="create-modal-title">Initiate Crop Residue Intervention</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="form-field">
                <label htmlFor={formVillageId} className="field-label">
                  Target Village:
                </label>
                <select
                  id={formVillageId}
                  className="field-input"
                  value={createVillageId}
                  onChange={(e) => setCreateVillageId(e.target.value)}
                  required
                >
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.district}, {v.state}) — Risk {v.risk_category} ({v.risk_score.toFixed(1)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-fields-grid">
                <div className="form-field">
                  <label htmlFor={formTypeId} className="field-label">
                    Intervention Method:
                  </label>
                  <select
                    id={formTypeId}
                    className="field-input"
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                  >
                    <option value="In-situ Happy Seeding">In-situ Happy Seeding</option>
                    <option value="In-situ Mulching">In-situ Mulching</option>
                    <option value="Ex-situ Baler Collection">Ex-situ Baler Collection</option>
                    <option value="Bio-decomposer Spraying">Bio-decomposer Spraying</option>
                    <option value="Custom Hiring Mobilization">Custom Hiring Mobilization</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor={formAcresId} className="field-label">
                    Planned Area (Acres):
                  </label>
                  <input
                    id={formAcresId}
                    type="number"
                    min={1}
                    max={2000}
                    className="field-input"
                    value={createAcres}
                    onChange={(e) => setCreateAcres(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor={formEquipmentId} className="field-label">
                  Assign CHC Machinery (Optional):
                </label>
                <select
                  id={formEquipmentId}
                  className="field-input"
                  value={createEquipmentId}
                  onChange={(e) => setCreateEquipmentId(e.target.value)}
                >
                  <option value="">-- No specific unit (General CHC Mobilization) --</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.hub_name}, {eq.district}) [{eq.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor={formRequesterId} className="field-label">
                  Requested By:
                </label>
                <input
                  id={formRequesterId}
                  type="text"
                  className="field-input"
                  value={createRequestedBy}
                  onChange={(e) => setCreateRequestedBy(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor={formNotesId} className="field-label">
                  Operational Notes:
                </label>
                <textarea
                  id={formNotesId}
                  rows={2}
                  className="field-input textarea"
                  placeholder="e.g. Farmland cluster north of canal; farmer committee requested subsidized baler deployment."
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="action-btn secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-btn primary"
                  disabled={isSubmittingCreate}
                >
                  {isSubmittingCreate ? 'Creating...' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Transition Status Action */}
      {isStatusActionOpen && activeIntervention && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-modal-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="status-modal-title">Transition Status to {targetNextStatus}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsStatusActionOpen(false)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="modal-form">
              {targetNextStatus === 'Completed' && (
                <div className="modal-warning-banner" role="alert">
                  <strong>COMPLETION NOTICE: SELF-REPORTED STATUS</strong>
                  <p>
                    Transitioning to <strong>Completed</strong> records a <em>Self-Reported</em> completion.
                    It will remain unverified until a designated agricultural nodal officer conducts an on-site field verification audit.
                  </p>
                </div>
              )}

              <div className="form-field">
                <label htmlFor={statusActorId} className="field-label">
                  Actor Label:
                </label>
                <input
                  id={statusActorId}
                  type="text"
                  className="field-input"
                  value={statusActor}
                  onChange={(e) => setStatusActor(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor={statusReasonId} className="field-label">
                  Operational Justification (Logged to Audit Trail):
                </label>
                <textarea
                  id={statusReasonId}
                  rows={3}
                  className="field-input textarea"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="action-btn secondary"
                  onClick={() => setIsStatusActionOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-btn primary"
                  disabled={isSubmittingStatus}
                >
                  {isSubmittingStatus ? 'Updating...' : `Confirm ${targetNextStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Field Verification Form */}
      {isVerifyOpen && activeIntervention && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-modal-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="verify-modal-title">Record Ground Field Verification</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsVerifyOpen(false)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <div className="modal-warning-banner" role="alert">
              <strong>DEMONSTRATION RECORD NOTICE</strong>
              <p>
                This recorded verification is an illustrative demonstration entry. It updates completion status
                to <strong>Field-Verified</strong> in simulation memory and logs evidence metadata.
              </p>
            </div>

            <form onSubmit={handleVerifySubmit} className="modal-form">
              <div className="form-field">
                <label htmlFor={verifierNameId} className="field-label">
                  Nodal Inspecting Officer:
                </label>
                <input
                  id={verifierNameId}
                  type="text"
                  className="field-input"
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  required
                />
              </div>

              <div className="form-fields-grid">
                <div className="form-field">
                  <label htmlFor={verifyOutcomeId} className="field-label">
                    Ground Audit Outcome:
                  </label>
                  <select
                    id={verifyOutcomeId}
                    className="field-input"
                    value={verifyOutcome}
                    onChange={(e) => setVerifyOutcome(e.target.value as VerificationOutcome)}
                  >
                    <option value="Verified Cleared">Verified Cleared (No Burning)</option>
                    <option value="Partial Residue Remaining">Partial Residue Remaining</option>
                    <option value="Violation Detected / Fire Evidence Found">Violation Detected / Fire Evidence Found</option>
                    <option value="Inaccessible / Flagged">Inaccessible / Flagged</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor={verifyAcresId} className="field-label">
                    Verified Acreage:
                  </label>
                  <input
                    id={verifyAcresId}
                    type="number"
                    min={0.1}
                    max={2000}
                    step={0.5}
                    className="field-input"
                    value={verifyAcres}
                    onChange={(e) => setVerifyAcres(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor={verifyNotesId} className="field-label">
                  Ground Verification Observations:
                </label>
                <textarea
                  id={verifyNotesId}
                  rows={3}
                  className="field-input textarea"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="action-btn secondary"
                  onClick={() => setIsVerifyOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-btn primary"
                  disabled={isSubmittingVerify}
                >
                  {isSubmittingVerify ? 'Recording...' : 'Record Field Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

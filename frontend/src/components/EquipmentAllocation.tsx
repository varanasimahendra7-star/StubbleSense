import { useEffect, useState, useId } from 'react';
import { getEquipmentList, getEquipmentRecommendations } from '../api/equipment';
import { getVillageRiskRankings } from '../api/villageRisk';
import type {
  EquipmentItem,
  EquipmentRecommendation,
  VillageRiskItem,
} from '../types/api';
import './EquipmentAllocation.css';

interface EquipmentAllocationProps {
  onNavigateToMap?: (village?: VillageRiskItem) => void;
}

type AllocationViewTab = 'advisor' | 'fleet';

interface SimulationDetails {
  machine: EquipmentItem;
  village: VillageRiskItem;
  distanceKm: number;
}

export function EquipmentAllocation({ onNavigateToMap }: EquipmentAllocationProps) {
  const [activeSubTab, setActiveSubTab] = useState<AllocationViewTab>('advisor');

  // Village selection and recommendation state
  const [villages, setVillages] = useState<VillageRiskItem[]>([]);
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');
  const [selectedVillage, setSelectedVillage] = useState<VillageRiskItem | null>(null);
  const [recommendations, setRecommendations] = useState<EquipmentRecommendation[]>([]);
  const [recommendationNotice, setRecommendationNotice] = useState<string>('');
  const [isLoadingRecs, setIsLoadingRecs] = useState<boolean>(true);
  const [recsError, setRecsError] = useState<string | null>(null);

  // Filters for Advisor
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50.0);
  const [advisorTypeFilter, setAdvisorTypeFilter] = useState<string>('all');
  const [includeUnavailable, setIncludeUnavailable] = useState<boolean>(false);

  // Fleet Explorer state
  const [fleetItems, setFleetItems] = useState<EquipmentItem[]>([]);
  const [fleetNotice, setFleetNotice] = useState<string>('');
  const [isLoadingFleet, setIsLoadingFleet] = useState<boolean>(true);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [fleetStatusFilter, setFleetStatusFilter] = useState<string>('all');
  const [fleetTypeFilter, setFleetTypeFilter] = useState<string>('all');
  const [fleetStateFilter, setFleetStateFilter] = useState<string>('all');

  // Simulation Modal state
  const [simModalOpen, setSimModalOpen] = useState<boolean>(false);
  const [activeSimulation, setActiveSimulation] = useState<SimulationDetails | null>(null);
  const [simTargetAcres, setSimTargetAcres] = useState<number>(30);
  const [simPriority, setSimPriority] = useState<string>('High');
  const [simNotes, setSimNotes] = useState<string>('');
  const [simConfirmationId, setSimConfirmationId] = useState<string | null>(null);

  // Accessible IDs
  const villageSelectId = useId();
  const maxDistanceSelectId = useId();
  const advisorTypeSelectId = useId();
  const includeUnavailableId = useId();
  const fleetStatusSelectId = useId();
  const fleetTypeSelectId = useId();
  const fleetStateSelectId = useId();
  const simAcresInputId = useId();
  const simPrioritySelectId = useId();
  const simNotesInputId = useId();

  // Load villages for the village selector
  useEffect(() => {
    let active = true;

    getVillageRiskRankings()
      .then((res) => {
        if (!active) return;
        setVillages(res.items);
        if (res.items.length > 0) {
          // Pre-select top-risk village
          const initialVillage = res.items[0];
          setSelectedVillageId(initialVillage.id);
          setSelectedVillage(initialVillage);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRecsError(err instanceof Error ? err.message : 'Failed to load villages list');
        setIsLoadingRecs(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch recommendations whenever village or filters change
  useEffect(() => {
    if (!selectedVillageId) return;

    let active = true;

    getEquipmentRecommendations(selectedVillageId, {
      max_distance_km: maxDistanceKm,
      include_unavailable: includeUnavailable,
      equipment_type: advisorTypeFilter !== 'all' ? advisorTypeFilter : undefined,
    })
      .then((res) => {
        if (!active) return;
        setRecommendations(res.recommendations);
        setSelectedVillage(res.village);
        setRecommendationNotice(res.data_notice);
        setIsLoadingRecs(false);
        setRecsError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRecsError(err instanceof Error ? err.message : 'Failed to load equipment recommendations');
        setIsLoadingRecs(false);
      });

    return () => {
      active = false;
    };
  }, [selectedVillageId, maxDistanceKm, includeUnavailable, advisorTypeFilter]);

  // Fetch fleet items when fleet explorer tab is activated or fleet filters change
  useEffect(() => {
    if (activeSubTab !== 'fleet') return;

    let active = true;

    getEquipmentList({
      status: fleetStatusFilter !== 'all' ? fleetStatusFilter : undefined,
      equipment_type: fleetTypeFilter !== 'all' ? fleetTypeFilter : undefined,
      state: fleetStateFilter !== 'all' ? fleetStateFilter : undefined,
    })
      .then((res) => {
        if (!active) return;
        setFleetItems(res.items);
        setFleetNotice(res.data_notice);
        setIsLoadingFleet(false);
        setFleetError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setFleetError(err instanceof Error ? err.message : 'Failed to load fleet registry');
        setIsLoadingFleet(false);
      });

    return () => {
      active = false;
    };
  }, [activeSubTab, fleetStatusFilter, fleetTypeFilter, fleetStateFilter]);

  const handleVillageChange = (newVillageId: string) => {
    setIsLoadingRecs(true);
    setSelectedVillageId(newVillageId);
    const found = villages.find((v) => v.id === newVillageId);
    if (found) {
      setSelectedVillage(found);
    }
  };

  const handleOpenSimulation = (rec: EquipmentRecommendation) => {
    if (!selectedVillage) return;
    setActiveSimulation({
      machine: rec.equipment,
      village: selectedVillage,
      distanceKm: rec.distance_km,
    });
    setSimTargetAcres(Math.round(rec.equipment.capacity_acres_per_day * 2));
    setSimPriority('High');
    setSimNotes('');
    setSimConfirmationId(null);
    setSimModalOpen(true);
  };

  const handleSubmitSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    const fakeId = `SIM-REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    setSimConfirmationId(fakeId);
  };

  const handleCloseSimulation = () => {
    setSimModalOpen(false);
    setActiveSimulation(null);
    setSimConfirmationId(null);
  };

  // Fleet summary counts
  const availableCount = fleetItems.filter((m) => m.status === 'Available').length;
  const inUseCount = fleetItems.filter((m) => m.status === 'In-Use').length;
  const maintenanceCount = fleetItems.filter((m) => m.status === 'Maintenance').length;

  return (
    <div className="equipment-module">
      {/* Synthetic Demo Notice Banner */}
      <div className="demo-notice-banner" role="region" aria-label="Synthetic demo data notice">
        <div className="demo-notice-header">
          <svg className="notice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <strong>DEMO DATA NOTICE &amp; SIMULATION POLICY</strong>
        </div>
        <p className="demo-notice-body">
          All machinery records, Custom Hiring Centers (CHCs), rates, and allocation recommendations are
          <strong> synthetic demonstration records</strong>. StubbleSense matches machinery using geodesic distance
          and simulated capacity, but <strong>does NOT execute real physical dispatches, leases, or certified burn prevention</strong>.
        </p>
      </div>

      {/* Sub-view switcher tabs */}
      <div className="allocation-subnav" role="tablist" aria-label="Allocation Sub Views">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'advisor'}
          className={`subnav-tab ${activeSubTab === 'advisor' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('advisor')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span>Village Mitigation Advisor</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'fleet'}
          className={`subnav-tab ${activeSubTab === 'fleet' ? 'active' : ''}`}
          onClick={() => {
            setIsLoadingFleet(true);
            setActiveSubTab('fleet');
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span>CHC Fleet Explorer ({fleetItems.length > 0 ? fleetItems.length : '18'} Units)</span>
        </button>
      </div>

      {/* VIEW A: Village Mitigation Advisor */}
      {activeSubTab === 'advisor' && (
        <div className="advisor-view">
          {/* Target Village & Search Radius Controls */}
          <div className="advisor-controls-card">
            <div className="control-group">
              <label htmlFor={villageSelectId} className="control-label">
                Select Target Village:
              </label>
              <select
                id={villageSelectId}
                className="control-select village-select"
                value={selectedVillageId}
                onChange={(e) => handleVillageChange(e.target.value)}
              >
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.district}, {v.state}) — Score {v.risk_score.toFixed(1)} [{v.risk_category}]
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label htmlFor={maxDistanceSelectId} className="control-label">
                Search Radius:
              </label>
              <select
                id={maxDistanceSelectId}
                className="control-select"
                value={maxDistanceKm}
                onChange={(e) => {
                  setIsLoadingRecs(true);
                  setMaxDistanceKm(Number(e.target.value));
                }}
              >
                <option value={15}>15 km (Local Hubs)</option>
                <option value={25}>25 km (District Hubs)</option>
                <option value={50}>50 km (Regional Corridor)</option>
                <option value={100}>100 km (Inter-District)</option>
              </select>
            </div>

            <div className="control-group">
              <label htmlFor={advisorTypeSelectId} className="control-label">
                Machinery Filter:
              </label>
              <select
                id={advisorTypeSelectId}
                className="control-select"
                value={advisorTypeFilter}
                onChange={(e) => {
                  setIsLoadingRecs(true);
                  setAdvisorTypeFilter(e.target.value);
                }}
              >
                <option value="all">All Machinery Types</option>
                <option value="Happy Seeder">Happy Seeder (In-situ)</option>
                <option value="Super SMS">Super SMS (In-situ)</option>
                <option value="Paddy Straw Baler">Paddy Straw Baler (Ex-situ)</option>
                <option value="Mulcher">Paddy Mulcher (In-situ)</option>
                <option value="Zero Till Drill">Zero Till Drill (In-situ)</option>
                <option value="Shrub Master">Shrub Master (In-situ)</option>
                <option value="Reversible Plough">Reversible Plough (In-situ)</option>
                <option value="Straw Rake">Straw Rake (Ex-situ)</option>
              </select>
            </div>

            <div className="control-group-checkbox">
              <input
                type="checkbox"
                id={includeUnavailableId}
                checked={includeUnavailable}
                onChange={(e) => {
                  setIsLoadingRecs(true);
                  setIncludeUnavailable(e.target.checked);
                }}
                className="control-checkbox"
              />
              <label htmlFor={includeUnavailableId} className="checkbox-label">
                Show In-Use / Maintenance machinery
              </label>
            </div>
          </div>

          {/* Selected Village Summary Header */}
          {selectedVillage && (
            <div className="selected-village-card">
              <div className="village-card-main">
                <div className="village-title-row">
                  <h3 className="village-name">{selectedVillage.name}</h3>
                  <span className={`risk-badge ${selectedVillage.risk_category.toLowerCase()}`}>
                    {selectedVillage.risk_category} Risk ({selectedVillage.risk_score.toFixed(1)} / 100)
                  </span>
                </div>
                <p className="village-location">
                  District: <strong>{selectedVillage.district}</strong>, State: <strong>{selectedVillage.state}</strong> |
                  Coordinates: <code>{selectedVillage.latitude.toFixed(4)}°N, {selectedVillage.longitude.toFixed(4)}°E</code>
                </p>
                <p className="village-subtext">
                  Synthetic fires detected in proximity: <strong>{selectedVillage.nearby_fire_count}</strong> ({selectedVillage.high_confidence_fire_count} high-confidence).
                </p>
              </div>

              {onNavigateToMap && (
                <button
                  type="button"
                  className="village-map-link-btn"
                  onClick={() => onNavigateToMap(selectedVillage)}
                  aria-label={`View ${selectedVillage.name} on Interactive Fire Map`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  </svg>
                  <span>View on Fire Map</span>
                </button>
              )}
            </div>
          )}

          {/* Recommendations Content Area */}
          <div className="recommendations-container" aria-busy={isLoadingRecs}>
            {isLoadingRecs && (
              <div className="state-card loading-state">
                <div className="spinner" aria-hidden="true" />
                <p>Computing geodesic distances and evaluating CHC machinery suitability...</p>
              </div>
            )}

            {!isLoadingRecs && recsError && (
              <div className="state-card error-state">
                <p>
                  <strong>Error:</strong> {recsError}
                </p>
                <button
                  type="button"
                  className="retry-btn"
                  onClick={() => {
                    setIsLoadingRecs(true);
                    setRecsError(null);
                    getEquipmentRecommendations(selectedVillageId, {
                      max_distance_km: maxDistanceKm,
                      include_unavailable: includeUnavailable,
                      equipment_type: advisorTypeFilter !== 'all' ? advisorTypeFilter : undefined,
                    })
                      .then((res) => {
                        setRecommendations(res.recommendations);
                        setIsLoadingRecs(false);
                      })
                      .catch((err: unknown) => {
                        setRecsError(err instanceof Error ? err.message : 'Failed to reload recommendations');
                        setIsLoadingRecs(false);
                      });
                  }}
                >
                  Retry Loading
                </button>
              </div>
            )}

            {!isLoadingRecs && !recsError && recommendations.length === 0 && (
              <div className="state-card empty-state">
                <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <h4>No Matching Machinery Found</h4>
                <p>
                  No equipment matching your criteria is stationed within {maxDistanceKm} km of {selectedVillage?.name}.
                </p>
                <div className="empty-actions">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => setMaxDistanceKm(100)}
                  >
                    Expand Search Radius to 100 km
                  </button>
                  <button
                    type="button"
                    className="action-btn secondary"
                    onClick={() => {
                      setAdvisorTypeFilter('all');
                      setIncludeUnavailable(true);
                    }}
                  >
                    Reset Type Filter &amp; Include In-Use Units
                  </button>
                </div>
              </div>
            )}

            {!isLoadingRecs && !recsError && recommendations.length > 0 && (
              <div className="recommendations-list">
                <div className="recommendations-meta">
                  <span className="results-count">
                    Found <strong>{recommendations.length}</strong> suitable machinery unit{recommendations.length === 1 ? '' : 's'} within {maxDistanceKm} km
                  </span>
                  <span className="provenance-tag">
                    {recommendationNotice ? 'Synthetic Demonstration Data' : ''}
                  </span>
                </div>

                <div className="recommendation-cards-grid">
                  {recommendations.map((rec) => {
                    const eq = rec.equipment;
                    const statusClass =
                      eq.status === 'Available'
                        ? 'status-available'
                        : eq.status === 'In-Use'
                        ? 'status-inuse'
                        : 'status-maintenance';

                    return (
                      <article key={eq.id} className="recommendation-card">
                        <div className="rec-card-header">
                          <div>
                            <div className="rec-badge-row">
                              <span className={`status-pill ${statusClass}`}>{eq.status}</span>
                              <span className="category-pill">{eq.category}</span>
                              <span className="distance-pill">
                                <strong>{rec.distance_km.toFixed(1)} km</strong> away
                              </span>
                            </div>
                            <h4 className="eq-name">{eq.name}</h4>
                            <span className="eq-id">{eq.id} &bull; {eq.equipment_type}</span>
                          </div>

                          <div className="suitability-score-box" title="Suitability matching score">
                            <span className="score-val">{rec.suitability_score.toFixed(0)}</span>
                            <span className="score-label">Fit Score</span>
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="eq-specs-grid">
                          <div className="spec-item">
                            <span className="spec-label">Processing Capacity:</span>
                            <strong className="spec-value">{eq.capacity_acres_per_day} acres/day</strong>
                          </div>
                          <div className="spec-item">
                            <span className="spec-label">Subsidized Rental:</span>
                            <strong className="spec-value">₹{eq.daily_rental_inr.toLocaleString()}/day</strong>
                          </div>
                          <div className="spec-item">
                            <span className="spec-label">Stationed Hub:</span>
                            <span className="spec-value">{eq.hub_name} ({eq.district})</span>
                          </div>
                          <div className="spec-item">
                            <span className="spec-label">Nodal Contact:</span>
                            <span className="spec-value">{eq.contact_officer}</span>
                          </div>
                        </div>

                        {/* Explainable Matching Factors */}
                        <div className="rec-reasons-block">
                          <h5 className="reasons-heading">Transparent Suitability Factors:</h5>
                          <ul className="reasons-list">
                            {rec.recommendation_reasons.map((reason, idx) => (
                              <li key={idx} className="reason-item">
                                <svg className="reason-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Card Caution Notice */}
                        <p className="card-caution-text">
                          <em>Notice:</em> {rec.caution_notice}
                        </p>

                        {/* Action CTA */}
                        <div className="rec-card-footer">
                          <button
                            type="button"
                            className="simulate-req-btn"
                            onClick={() => handleOpenSimulation(rec)}
                            aria-label={`Simulate allocation requisition for ${eq.name}`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                            </svg>
                            <span>Simulate Allocation Request</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW B: CHC Fleet Explorer */}
      {activeSubTab === 'fleet' && (
        <div className="fleet-view">
          {/* Fleet Filters */}
          <div className="fleet-filters-bar">
            <div className="control-group">
              <label htmlFor={fleetStatusSelectId} className="control-label">
                Status:
              </label>
              <select
                id={fleetStatusSelectId}
                className="control-select"
                value={fleetStatusFilter}
                onChange={(e) => {
                  setIsLoadingFleet(true);
                  setFleetStatusFilter(e.target.value);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="Available">Available Only</option>
                <option value="In-Use">In-Use Only</option>
                <option value="Maintenance">Maintenance Only</option>
              </select>
            </div>

            <div className="control-group">
              <label htmlFor={fleetTypeSelectId} className="control-label">
                Equipment Type:
              </label>
              <select
                id={fleetTypeSelectId}
                className="control-select"
                value={fleetTypeFilter}
                onChange={(e) => {
                  setIsLoadingFleet(true);
                  setFleetTypeFilter(e.target.value);
                }}
              >
                <option value="all">All Machinery Types</option>
                <option value="Happy Seeder">Happy Seeder</option>
                <option value="Super SMS">Super SMS</option>
                <option value="Paddy Straw Baler">Paddy Straw Baler</option>
                <option value="Mulcher">Paddy Mulcher</option>
                <option value="Zero Till Drill">Zero Till Drill</option>
                <option value="Shrub Master">Shrub Master</option>
                <option value="Reversible Plough">Reversible Plough</option>
                <option value="Straw Rake">Straw Rake</option>
              </select>
            </div>

            <div className="control-group">
              <label htmlFor={fleetStateSelectId} className="control-label">
                State:
              </label>
              <select
                id={fleetStateSelectId}
                className="control-select"
                value={fleetStateFilter}
                onChange={(e) => {
                  setIsLoadingFleet(true);
                  setFleetStateFilter(e.target.value);
                }}
              >
                <option value="all">All States</option>
                <option value="Punjab">Punjab</option>
                <option value="Haryana">Haryana</option>
              </select>
            </div>
          </div>

          {/* Fleet Status Summary Cards */}
          <div className="fleet-metrics-row">
            <div className="metric-badge-card">
              <span className="metric-badge-label">Total Units</span>
              <span className="metric-badge-number">{fleetItems.length}</span>
            </div>
            <div className="metric-badge-card available">
              <span className="metric-badge-label">Available Units</span>
              <span className="metric-badge-number">{availableCount}</span>
            </div>
            <div className="metric-badge-card inuse">
              <span className="metric-badge-label">In-Use Units</span>
              <span className="metric-badge-number">{inUseCount}</span>
            </div>
            <div className="metric-badge-card maintenance">
              <span className="metric-badge-label">Under Maintenance</span>
              <span className="metric-badge-number">{maintenanceCount}</span>
            </div>
          </div>

          {/* Fleet List Area */}
          <div className="fleet-list-container" aria-busy={isLoadingFleet}>
            {isLoadingFleet && (
              <div className="state-card loading-state">
                <div className="spinner" aria-hidden="true" />
                <p>Loading Custom Hiring Center machinery inventory...</p>
              </div>
            )}

            {!isLoadingFleet && fleetError && (
              <div className="state-card error-state">
                <p>
                  <strong>Error:</strong> {fleetError}
                </p>
                <button
                  type="button"
                  className="retry-btn"
                  onClick={() => {
                    setIsLoadingFleet(true);
                    setFleetError(null);
                    getEquipmentList({
                      status: fleetStatusFilter !== 'all' ? fleetStatusFilter : undefined,
                      equipment_type: fleetTypeFilter !== 'all' ? fleetTypeFilter : undefined,
                      state: fleetStateFilter !== 'all' ? fleetStateFilter : undefined,
                    })
                      .then((res) => {
                        setFleetItems(res.items);
                        setIsLoadingFleet(false);
                      })
                      .catch((err: unknown) => {
                        setFleetError(err instanceof Error ? err.message : 'Failed to reload fleet');
                        setIsLoadingFleet(false);
                      });
                  }}
                >
                  Retry Loading
                </button>
              </div>
            )}

            {!isLoadingFleet && !fleetError && fleetItems.length === 0 && (
              <div className="state-card empty-state">
                <p>No equipment matching current filters.</p>
                <button
                  type="button"
                  className="action-btn secondary"
                  onClick={() => {
                    setFleetStatusFilter('all');
                    setFleetTypeFilter('all');
                    setFleetStateFilter('all');
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {!isLoadingFleet && !fleetError && fleetItems.length > 0 && (
              <div className="fleet-grid">
                {fleetItems.map((item) => {
                  const statusClass =
                    item.status === 'Available'
                      ? 'status-available'
                      : item.status === 'In-Use'
                      ? 'status-inuse'
                      : 'status-maintenance';

                  return (
                    <div key={item.id} className="fleet-item-card">
                      <div className="fleet-item-header">
                        <div>
                          <div className="rec-badge-row">
                            <span className={`status-pill ${statusClass}`}>{item.status}</span>
                            <span className="category-pill">{item.category}</span>
                          </div>
                          <h4 className="fleet-item-title">{item.name}</h4>
                          <span className="fleet-item-id">{item.id} &bull; {item.equipment_type}</span>
                        </div>
                      </div>

                      <div className="fleet-item-details">
                        <div className="fleet-detail-row">
                          <span className="f-label">CHC Hub:</span>
                          <span className="f-val">{item.hub_name}</span>
                        </div>
                        <div className="fleet-detail-row">
                          <span className="f-label">Jurisdiction:</span>
                          <span className="f-val">{item.district}, {item.state}</span>
                        </div>
                        <div className="fleet-detail-row">
                          <span className="f-label">Capacity:</span>
                          <strong className="f-val">{item.capacity_acres_per_day} acres/day</strong>
                        </div>
                        <div className="fleet-detail-row">
                          <span className="f-label">Subsidized Rate:</span>
                          <strong className="f-val">₹{item.daily_rental_inr.toLocaleString()}/day</strong>
                        </div>
                        <div className="fleet-detail-row">
                          <span className="f-label">Nodal Contact:</span>
                          <span className="f-val">{item.contact_officer}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {fleetNotice && (
              <p className="fleet-footnote">
                <em>Notice:</em> {fleetNotice}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Accessible Simulation Modal */}
      {simModalOpen && activeSimulation && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sim-modal-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="sim-badge" aria-hidden="true">
                  SIMULATION
                </div>
                <h3 id="sim-modal-title">Simulate Allocation Requisition</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseSimulation}
                aria-label="Close simulation dialog"
              >
                &times;
              </button>
            </div>

            {/* Crucial non-dispatch simulation warning banner */}
            <div className="modal-warning-banner" role="alert">
              <strong>DISCLAIMER: DEMONSTRATION WORKFLOW ONLY</strong>
              <p>
                Submitting this simulated requisition will <strong>NOT</strong> physically book, lease, or dispatch
                machinery to {activeSimulation.village.name}. This is an interactive workflow demonstration for administrative evaluation.
              </p>
            </div>

            {!simConfirmationId ? (
              <form onSubmit={handleSubmitSimulation} className="modal-form">
                <div className="modal-summary-box">
                  <div className="summary-col">
                    <span className="sum-label">Target Village:</span>
                    <strong className="sum-val">
                      {activeSimulation.village.name} ({activeSimulation.village.district})
                    </strong>
                    <span className="sum-sub">
                      Risk Level: {activeSimulation.village.risk_category} ({activeSimulation.village.risk_score.toFixed(1)}/100)
                    </span>
                  </div>
                  <div className="summary-col">
                    <span className="sum-label">Allocated Machinery:</span>
                    <strong className="sum-val">{activeSimulation.machine.name}</strong>
                    <span className="sum-sub">
                      {activeSimulation.machine.hub_name} ({activeSimulation.distanceKm.toFixed(1)} km away)
                    </span>
                  </div>
                </div>

                <div className="form-fields-grid">
                  <div className="form-field">
                    <label htmlFor={simAcresInputId} className="field-label">
                      Target Area to Treat (Acres):
                    </label>
                    <input
                      id={simAcresInputId}
                      type="number"
                      min={1}
                      max={200}
                      className="field-input"
                      value={simTargetAcres}
                      onChange={(e) => setSimTargetAcres(Number(e.target.value))}
                      required
                    />
                    <span className="field-hint">
                      Capacity: {activeSimulation.machine.capacity_acres_per_day} acres/day (~
                      {(simTargetAcres / activeSimulation.machine.capacity_acres_per_day).toFixed(1)} days work)
                    </span>
                  </div>

                  <div className="form-field">
                    <label htmlFor={simPrioritySelectId} className="field-label">
                      Simulated Dispatch Urgency:
                    </label>
                    <select
                      id={simPrioritySelectId}
                      className="field-input"
                      value={simPriority}
                      onChange={(e) => setSimPriority(e.target.value)}
                    >
                      <option value="Urgent">Urgent (Imminent Residue Burning)</option>
                      <option value="High">High (Harvest Completed in 48h)</option>
                      <option value="Standard">Standard Pre-Sowing Scheduling</option>
                    </select>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor={simNotesInputId} className="field-label">
                    Nodal Coordinator Operational Notes:
                  </label>
                  <textarea
                    id={simNotesInputId}
                    rows={3}
                    className="field-input textarea"
                    placeholder="e.g. Coordinate with Village Sarpanch for field entry via North canal road..."
                    value={simNotes}
                    onChange={(e) => setSimNotes(e.target.value)}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="action-btn secondary"
                    onClick={handleCloseSimulation}
                  >
                    Cancel Simulation
                  </button>
                  <button type="submit" className="action-btn primary">
                    Submit Simulated Request
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal-confirmation">
                <div className="confirmation-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h4>Simulated Request Logged Successfully</h4>
                <p className="conf-id">
                  Demonstration Requisition Reference: <code>{simConfirmationId}</code>
                </p>
                <div className="conf-details-box">
                  <p>
                    <strong>Simulated Target:</strong> {activeSimulation.village.name} ({activeSimulation.village.district})
                  </p>
                  <p>
                    <strong>Assigned Unit:</strong> {activeSimulation.machine.name} stationed at {activeSimulation.machine.hub_name}
                  </p>
                  <p>
                    <strong>Simulated Priority:</strong> {simPriority} | <strong>Area:</strong> {simTargetAcres} acres
                  </p>
                  <p>
                    <strong>Estimated Est. Hub Transit:</strong> ~{(activeSimulation.distanceKm / 25).toFixed(1)} hours ({activeSimulation.distanceKm.toFixed(1)} km)
                  </p>
                </div>
                <p className="conf-reminder">
                  Notice: This requisition is recorded only in temporary browser memory. No actual machinery dispatch, reservation, or payment has been triggered.
                </p>
                <button
                  type="button"
                  className="action-btn primary"
                  onClick={handleCloseSimulation}
                >
                  Close Confirmation
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

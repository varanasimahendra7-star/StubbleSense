import { useEffect, useState, useMemo } from 'react';
import { getVillageRiskRankings } from '../api/villageRisk';
import type { RiskCategory, RiskFilterOptions, VillageRiskItem } from '../types/api';
import './VillageRiskRanking.css';

interface VillageRiskRankingProps {
  onNavigateToMap?: (village: VillageRiskItem) => void;
}

export function VillageRiskRanking({ onNavigateToMap }: VillageRiskRankingProps) {
  const [villages, setVillages] = useState<VillageRiskItem[]>([]);
  const [dataNotice, setDataNotice] = useState<string>('');
  const [formulaSummary, setFormulaSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<VillageRiskItem | null>(null);
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(false);

  const [filters, setFilters] = useState<RiskFilterOptions>({
    state: 'all',
    category: 'all',
    sortBy: 'score_desc',
    searchQuery: '',
  });

  const loadRankings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getVillageRiskRankings();
      setVillages(response.items);
      setDataNotice(response.data_notice);
      setFormulaSummary(response.scoring_formula_summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load village risk rankings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    getVillageRiskRankings()
      .then((response) => {
        if (active) {
          setVillages(response.items);
          setDataNotice(response.data_notice);
          setFormulaSummary(response.scoring_formula_summary);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load village risk rankings');
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Filtered and sorted village items
  const processedVillages = useMemo(() => {
    const result = villages.filter((v) => {
      if (filters.state !== 'all' && v.state.toLowerCase() !== filters.state.toLowerCase()) {
        return false;
      }
      if (filters.category !== 'all' && v.risk_category.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = v.name.toLowerCase().includes(query);
        const matchesDistrict = v.district.toLowerCase().includes(query);
        if (!matchesName && !matchesDistrict) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (filters.sortBy === 'score_desc') return b.risk_score - a.risk_score;
      if (filters.sortBy === 'score_asc') return a.risk_score - b.risk_score;
      if (filters.sortBy === 'name') return a.name.localeCompare(b.name);
      if (filters.sortBy === 'district') return a.district.localeCompare(b.district);
      return 0;
    });

    return result;
  }, [villages, filters]);

  const categoryStats = useMemo(() => {
    const stats: Record<RiskCategory, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    villages.forEach((v) => {
      stats[v.risk_category] = (stats[v.risk_category] || 0) + 1;
    });
    return stats;
  }, [villages]);

  const handleResetFilters = () => {
    setFilters({
      state: 'all',
      category: 'all',
      sortBy: 'score_desc',
      searchQuery: '',
    });
  };

  return (
    <div className="village-risk-module">
      {/* Synthetic Demo Provenance Banner */}
      <div className="synthetic-notice-banner" role="alert">
        <div className="synthetic-notice-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="synthetic-notice-text">
          <strong>DEMO DATA NOTICE:</strong>{' '}
          {dataNotice || 'All village risk scores are illustrative synthetic calculations based on demo fire events. They are NOT certified or field-validated risk predictions.'}
        </div>
      </div>

      {/* Category Summary KPIs */}
      <div className="category-kpi-grid">
        <div
          className={`kpi-card critical ${filters.category === 'Critical' ? 'active-filter' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, category: prev.category === 'Critical' ? 'all' : 'Critical' }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setFilters((prev) => ({ ...prev, category: prev.category === 'Critical' ? 'all' : 'Critical' }));
            }
          }}
          aria-label="Filter by Critical risk category"
        >
          <div className="kpi-header">
            <span className="kpi-tag critical">Score &ge; 75</span>
            <span className="kpi-dot critical" aria-hidden="true" />
          </div>
          <div className="kpi-count">{categoryStats.Critical}</div>
          <div className="kpi-label">Critical Priority Villages</div>
        </div>

        <div
          className={`kpi-card high ${filters.category === 'High' ? 'active-filter' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, category: prev.category === 'High' ? 'all' : 'High' }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setFilters((prev) => ({ ...prev, category: prev.category === 'High' ? 'all' : 'High' }));
            }
          }}
          aria-label="Filter by High risk category"
        >
          <div className="kpi-header">
            <span className="kpi-tag high">Score 50 - 74</span>
            <span className="kpi-dot high" aria-hidden="true" />
          </div>
          <div className="kpi-count">{categoryStats.High}</div>
          <div className="kpi-label">High Priority Villages</div>
        </div>

        <div
          className={`kpi-card medium ${filters.category === 'Medium' ? 'active-filter' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, category: prev.category === 'Medium' ? 'all' : 'Medium' }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setFilters((prev) => ({ ...prev, category: prev.category === 'Medium' ? 'all' : 'Medium' }));
            }
          }}
          aria-label="Filter by Medium risk category"
        >
          <div className="kpi-header">
            <span className="kpi-tag medium">Score 25 - 49</span>
            <span className="kpi-dot medium" aria-hidden="true" />
          </div>
          <div className="kpi-count">{categoryStats.Medium}</div>
          <div className="kpi-label">Medium Priority Villages</div>
        </div>

        <div
          className={`kpi-card low ${filters.category === 'Low' ? 'active-filter' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, category: prev.category === 'Low' ? 'all' : 'Low' }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setFilters((prev) => ({ ...prev, category: prev.category === 'Low' ? 'all' : 'Low' }));
            }
          }}
          aria-label="Filter by Low risk category"
        >
          <div className="kpi-header">
            <span className="kpi-tag low">Score &lt; 25</span>
            <span className="kpi-dot low" aria-hidden="true" />
          </div>
          <div className="kpi-count">{categoryStats.Low}</div>
          <div className="kpi-label">Low Risk / Baseline</div>
        </div>
      </div>

      {/* Transparent Scoring Formula Collapsible */}
      <div className="formula-explainer-card">
        <div className="formula-header">
          <div className="formula-title-group">
            <span className="formula-badge">Explainable AI Formula</span>
            <h3 className="formula-title">How Village Risk Scores Are Computed</h3>
          </div>
          <button
            type="button"
            className="toggle-formula-btn"
            onClick={() => setShowFormulaDetails((prev) => !prev)}
            aria-expanded={showFormulaDetails}
            aria-controls="formula-breakdown-details"
          >
            {showFormulaDetails ? 'Hide Formula Details' : 'Show Formula Details'}
          </button>
        </div>

        <p className="formula-summary-text">
          {formulaSummary || 'Risk Score = min(100, Proximity Density + Confidence Severity + Recency + High FRP Intensity).'}
        </p>

        {showFormulaDetails && (
          <div id="formula-breakdown-details" className="formula-breakdown-grid">
            <div className="formula-step">
              <span className="step-num">1</span>
              <h4>Thermal Proximity (Max 45 pts)</h4>
              <p>Fires within 5 km add +20 pts; fires within 15 km add +12 pts.</p>
            </div>
            <div className="formula-step">
              <span className="step-num">2</span>
              <h4>Satellite Confidence (Max 30 pts)</h4>
              <p>High-confidence thermal observations add +15 pts each.</p>
            </div>
            <div className="formula-step">
              <span className="step-num">3</span>
              <h4>Observation Recency (Max 20 pts)</h4>
              <p>Demo observation on reference date 2026-10-25 adds +20 pts; prior day adds +12 pts.</p>
            </div>
            <div className="formula-step">
              <span className="step-num">4</span>
              <h4>Synthetic FRP Intensity (Max 15 pts)</h4>
              <p>Nearby synthetic observation with FRP &ge; 25 MW adds +15 pts (proxy for elevated thermal emission).</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="risk-toolbar" role="search" aria-label="Village risk filters">
        <div className="filter-field search-field">
          <label htmlFor="risk-search" className="filter-label">Search Village or District</label>
          <input
            id="risk-search"
            type="text"
            className="filter-input"
            placeholder="e.g. Khurana, Sangrur, Kaithal..."
            value={filters.searchQuery}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="risk-filter-state" className="filter-label">State</label>
          <select
            id="risk-filter-state"
            className="filter-select"
            value={filters.state}
            onChange={(e) => setFilters((prev) => ({ ...prev, state: e.target.value }))}
          >
            <option value="all">All States</option>
            <option value="Punjab">Punjab</option>
            <option value="Haryana">Haryana</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="risk-filter-category" className="filter-label">Risk Category</label>
          <select
            id="risk-filter-category"
            className="filter-select"
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          >
            <option value="all">All Categories</option>
            <option value="Critical">Critical (&ge; 75)</option>
            <option value="High">High (50 - 74)</option>
            <option value="Medium">Medium (25 - 49)</option>
            <option value="Low">Low (&lt; 25)</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="risk-sort-by" className="filter-label">Sort By</label>
          <select
            id="risk-sort-by"
            className="filter-select"
            value={filters.sortBy}
            onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as RiskFilterOptions['sortBy'] }))}
          >
            <option value="score_desc">Risk Score: Highest First</option>
            <option value="score_asc">Risk Score: Lowest First</option>
            <option value="name">Village Name (A-Z)</option>
            <option value="district">District (A-Z)</option>
          </select>
        </div>

        <button
          type="button"
          className="reset-filters-btn"
          onClick={handleResetFilters}
          aria-label="Reset risk filters"
        >
          Reset Filters
        </button>
      </div>

      {/* Main Table + Detail Modal Container */}
      <div className="risk-content-layout">
        <div className="ranking-table-container">
          {isLoading && (
            <div className="ranking-overlay-status">
              <div className="loading-spinner" aria-hidden="true" />
              <span>Computing explainable village risk rankings...</span>
            </div>
          )}

          {error && (
            <div className="ranking-overlay-status error">
              <span>{error}</span>
              <button type="button" className="retry-btn-small" onClick={() => void loadRankings()}>
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && processedVillages.length === 0 && (
            <div className="ranking-empty-state">
              <p>No villages match the active filter criteria.</p>
              <button type="button" className="retry-btn-small" onClick={handleResetFilters}>
                Clear Filters
              </button>
            </div>
          )}

          {/* Accessible Data Table following modern guidance */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Village Risk Rankings Directory"
            className="table-wrapper"
          >
            <table className="risk-data-table">
              <caption className="sr-only">
                Ranked agricultural villages ordered by synthetic residue burning risk
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="th-rank">Rank</th>
                  <th scope="col" className="th-village">Village</th>
                  <th scope="col" className="th-region">District &amp; State</th>
                  <th scope="col" className="th-score">Risk Score</th>
                  <th scope="col" className="th-category">Category</th>
                  <th scope="col" className="th-factors">Top Factors</th>
                  <th scope="col" className="th-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {processedVillages.map((village, idx) => {
                  const isTopCritical = village.risk_category === 'Critical';
                  const isHigh = village.risk_category === 'High';
                  const isMedium = village.risk_category === 'Medium';
                  const rankNumber = idx + 1;

                  return (
                    <tr
                      key={village.id}
                      className={`risk-table-row ${selectedVillage?.id === village.id ? 'row-selected' : ''}`}
                      onClick={() => setSelectedVillage(village)}
                    >
                      <td className="td-rank">
                        <span className={`rank-indicator ${isTopCritical ? 'rank-critical' : isHigh ? 'rank-high' : isMedium ? 'rank-medium' : 'rank-low'}`}>
                          #{rankNumber}
                        </span>
                      </td>
                      <th scope="row" className="td-village">
                        <div className="village-name-cell">
                          <strong className="village-name">{village.name}</strong>
                          <span className="village-id-sub">{village.id}</span>
                        </div>
                      </th>
                      <td className="td-region">
                        <div className="region-cell">
                          <span className="district-text">{village.district}</span>
                          <span className="state-text">{village.state}</span>
                        </div>
                      </td>
                      <td className="td-score">
                        <div className="score-cell">
                          <div className="score-number-row">
                            <span className="score-val">{village.risk_score.toFixed(1)}</span>
                            <span className="score-max">/100</span>
                          </div>
                          <div className="score-progress-track" aria-hidden="true">
                            <div
                              className={`score-progress-fill ${village.risk_category.toLowerCase()}`}
                              style={{ width: `${Math.min(100, village.risk_score)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="td-category">
                        <span className={`category-badge ${village.risk_category.toLowerCase()}`}>
                          {village.risk_category}
                        </span>
                      </td>
                      <td className="td-factors">
                        <div className="factors-summary">
                          {village.nearby_fire_count > 0 ? (
                            <span className="factor-tag">
                              {village.nearby_fire_count} fire(s) within 15 km
                            </span>
                          ) : (
                            <span className="factor-tag low">Zero nearby fires</span>
                          )}
                          {village.high_confidence_fire_count > 0 && (
                            <span className="factor-tag alert">
                              {village.high_confidence_fire_count} high conf
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td-actions">
                        <button
                          type="button"
                          className="inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVillage(village);
                          }}
                          aria-label={`Inspect ${village.name} risk factors`}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Village Detail Panel */}
        {selectedVillage && (
          <aside className="village-detail-sidebar" aria-label="Village Risk Breakdown">
            <div className="detail-sidebar-header">
              <span className="detail-badge-demo">Synthetic Risk Profile</span>
              <button
                type="button"
                className="close-detail-btn"
                onClick={() => setSelectedVillage(null)}
                aria-label="Close village detail panel"
              >
                &times;
              </button>
            </div>

            <div className="detail-main-header">
              <h3 className="detail-village-title">{selectedVillage.name}</h3>
              <p className="detail-location-sub">
                {selectedVillage.district}, {selectedVillage.state}
              </p>
            </div>

            <div className="detail-score-box">
              <div className="score-box-top">
                <span className="score-box-label">Composite Risk Score</span>
                <span className={`category-badge ${selectedVillage.risk_category.toLowerCase()}`}>
                  {selectedVillage.risk_category} Priority
                </span>
              </div>
              <div className="score-box-number">
                {selectedVillage.risk_score.toFixed(1)}
                <span className="score-box-max"> / 100</span>
              </div>
              <div className="score-progress-track large">
                <div
                  className={`score-progress-fill ${selectedVillage.risk_category.toLowerCase()}`}
                  style={{ width: `${Math.min(100, selectedVillage.risk_score)}%` }}
                />
              </div>
            </div>

            <div className="detail-coordinates-row">
              <div className="coord-item">
                <span className="coord-label">Latitude</span>
                <strong className="coord-val">{selectedVillage.latitude.toFixed(4)}° N</strong>
              </div>
              <div className="coord-item">
                <span className="coord-label">Longitude</span>
                <strong className="coord-val">{selectedVillage.longitude.toFixed(4)}° E</strong>
              </div>
            </div>

            <div className="detail-reasons-section">
              <h4 className="reasons-heading">Contributing Risk Factors</h4>
              <ul className="reasons-list">
                {selectedVillage.reasons.map((reason, rIdx) => (
                  <li key={rIdx} className="reason-item">
                    <span className="reason-bullet" aria-hidden="true">&bull;</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {onNavigateToMap && (
              <button
                type="button"
                className="view-on-map-action-btn"
                onClick={() => onNavigateToMap(selectedVillage)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                </svg>
                <span>Locate District on Fire Map &rarr;</span>
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

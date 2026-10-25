import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getFireEvents } from '../api/fireEvents';
import type { FireObservation, FireFilters } from '../types/api';
import './FireMap.css';

interface FireMapProps {
  onEventCountUpdate?: (count: number) => void;
}

export function FireMap({ onEventCountUpdate }: FireMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [events, setEvents] = useState<FireObservation[]>([]);
  const [dataNotice, setDataNotice] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FireObservation | null>(null);

  const [filters, setFilters] = useState<FireFilters>({
    state: 'all',
    district: 'all',
    date: 'all',
    confidence: 'all',
  });

  // Fetch fire observations from backend for manual retry
  const loadFireEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getFireEvents();
      setEvents(response.items);
      setDataNotice(response.data_notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fire observations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    getFireEvents()
      .then((response) => {
        if (active) {
          setEvents(response.items);
          setDataNotice(response.data_notice);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load fire observations');
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Compute available districts based on selected state
  const availableDistricts = useMemo(() => {
    const relevantEvents = filters.state === 'all'
      ? events
      : events.filter((e) => e.state.toLowerCase() === filters.state.toLowerCase());
    const districts = Array.from(new Set(relevantEvents.map((e) => e.district))).sort();
    return districts;
  }, [events, filters.state]);

  // Available dates in dataset
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(events.map((e) => e.observed_at.split('T')[0]))).sort().reverse();
    return dates;
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.state !== 'all' && event.state.toLowerCase() !== filters.state.toLowerCase()) {
        return false;
      }
      if (filters.district !== 'all' && event.district.toLowerCase() !== filters.district.toLowerCase()) {
        return false;
      }
      if (filters.date !== 'all' && !event.observed_at.startsWith(filters.date)) {
        return false;
      }
      if (filters.confidence !== 'all' && event.confidence.toLowerCase() !== filters.confidence.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [events, filters]);

  // Notify parent of count
  useEffect(() => {
    if (onEventCountUpdate) {
      onEventCountUpdate(filteredEvents.length);
    }
  }, [filteredEvents.length, onEventCountUpdate]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center on Punjab & Haryana agricultural corridor (30.5° N, 75.8° E)
      const map = L.map(mapContainerRef.current, {
        center: [30.5, 75.8],
        zoom: 7,
        minZoom: 6,
        maxZoom: 13,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      // Create layer group for fire markers
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;

      // Invalidate size to handle tab switching/initial rendering
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Update Markers on Map when filteredEvents change
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    markersLayer.clearLayers();

    filteredEvents.forEach((event) => {
      // Create custom pulsing DOM icon based on confidence / FRP
      const isHigh = event.confidence.toLowerCase() === 'high' || event.frp_mw >= 25;
      const isNominal = event.confidence.toLowerCase() === 'nominal';
      const iconClass = isHigh ? 'fire-marker-high' : isNominal ? 'fire-marker-nominal' : 'fire-marker-low';

      const customIcon = L.divIcon({
        className: 'custom-fire-marker-wrapper',
        html: `
          <div class="fire-marker-pin ${iconClass}">
            <span class="fire-marker-core"></span>
            <span class="fire-marker-pulse"></span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([event.latitude, event.longitude], { icon: customIcon });

      // Popup HTML content with explicit Synthetic demo notice
      const popupContent = `
        <div class="leaflet-fire-popup">
          <div class="popup-header">
            <span class="popup-badge demo">Synthetic Demo</span>
            <span class="popup-id">${event.id}</span>
          </div>
          <h4 class="popup-title">${event.district}, ${event.state}</h4>
          <div class="popup-grid">
            <div class="popup-row">
              <span class="popup-label">Coordinates:</span>
              <span class="popup-value">${event.latitude.toFixed(4)}°N, ${event.longitude.toFixed(4)}°E</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Observation:</span>
              <span class="popup-value">${new Date(event.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST (${event.observed_at.split('T')[0]})</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Radiative Power:</span>
              <span class="popup-value"><strong>${event.frp_mw} MW</strong></span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Brightness Temp:</span>
              <span class="popup-value">${event.brightness_kelvin} K</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Confidence:</span>
              <span class="popup-badge confidence-${event.confidence.toLowerCase()}">${event.confidence.toUpperCase()}</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Sensor Source:</span>
              <span class="popup-value text-muted">${event.satellite}</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        setSelectedEvent(event);
      });

      markersLayer.addLayer(marker);
    });

    // If map instance exists, ensure correct size
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  }, [filteredEvents]);

  // Center map on selected event when changed from list
  const handleSelectEvent = (event: FireObservation) => {
    setSelectedEvent(event);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([event.latitude, event.longitude], 10, {
        animate: true,
      });
    }
  };

  const handleResetFilters = () => {
    setFilters({
      state: 'all',
      district: 'all',
      date: 'all',
      confidence: 'all',
    });
  };

  return (
    <div className="fire-map-module">
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
          {dataNotice || 'All fire observations shown are deterministic synthetic demo events for Punjab & Haryana testing. They do NOT represent live NASA FIRMS observations.'}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="map-toolbar" role="search" aria-label="Fire observation filters">
        <div className="filter-group">
          <label htmlFor="filter-state" className="filter-label">State</label>
          <select
            id="filter-state"
            className="filter-select"
            value={filters.state}
            onChange={(e) => {
              setFilters((prev) => ({
                ...prev,
                state: e.target.value,
                district: 'all', // reset district on state change
              }));
            }}
          >
            <option value="all">All States (Punjab &amp; Haryana)</option>
            <option value="Punjab">Punjab</option>
            <option value="Haryana">Haryana</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-district" className="filter-label">District</label>
          <select
            id="filter-district"
            className="filter-select"
            value={filters.district}
            onChange={(e) => setFilters((prev) => ({ ...prev, district: e.target.value }))}
          >
            <option value="all">All Districts ({availableDistricts.length})</option>
            {availableDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-date" className="filter-label">Observation Date</label>
          <select
            id="filter-date"
            className="filter-select"
            value={filters.date}
            onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
          >
            <option value="all">All Dates</option>
            {availableDates.map((dateStr) => (
              <option key={dateStr} value={dateStr}>
                {dateStr}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-confidence" className="filter-label">Confidence</label>
          <select
            id="filter-confidence"
            className="filter-select"
            value={filters.confidence}
            onChange={(e) => setFilters((prev) => ({ ...prev, confidence: e.target.value }))}
          >
            <option value="all">All Confidence Levels</option>
            <option value="high">High Confidence</option>
            <option value="nominal">Nominal Confidence</option>
            <option value="low">Low Confidence</option>
          </select>
        </div>

        <button
          type="button"
          className="reset-filters-btn"
          onClick={handleResetFilters}
          aria-label="Reset all filters"
        >
          Reset Filters
        </button>
      </div>

      {/* Main Map + Detail Split Container */}
      <div className="map-display-layout">
        <div className="map-wrapper">
          {isLoading && (
            <div className="map-overlay-status">
              <div className="loading-spinner" aria-hidden="true" />
              <span>Loading synthetic fire observations...</span>
            </div>
          )}

          {error && (
            <div className="map-overlay-status error">
              <span>{error}</span>
              <button type="button" className="retry-btn-small" onClick={() => void loadFireEvents()}>
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && filteredEvents.length === 0 && (
            <div className="map-overlay-empty">
              <p>No synthetic fire observations match the selected filters.</p>
              <button type="button" className="retry-btn-small" onClick={handleResetFilters}>
                Clear Filters
              </button>
            </div>
          )}

          <div
            ref={mapContainerRef}
            className="leaflet-map-element"
            role="region"
            aria-label="Interactive Punjab and Haryana fire map"
          />

          {/* Map Legend */}
          <div className="map-legend" aria-label="Map Legend">
            <h4 className="legend-title">Thermal FRP Legend</h4>
            <div className="legend-item">
              <span className="legend-color high" aria-hidden="true" />
              <span>High (&ge; 25 MW / High Conf)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color nominal" aria-hidden="true" />
              <span>Nominal (15 - 25 MW)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color low" aria-hidden="true" />
              <span>Low (&lt; 15 MW)</span>
            </div>
          </div>
        </div>

        {/* Selected Event Details Panel */}
        <aside
          className="event-detail-panel"
          aria-label="Selected Fire Observation Details"
        >
          <div className="panel-header">
            <h3>Observation Detail</h3>
            <span className="filter-count-badge">
              {filteredEvents.length} active marker{filteredEvents.length === 1 ? '' : 's'}
            </span>
          </div>

          {selectedEvent ? (
            <div className="selected-card">
              <div className="selected-card-top">
                <span className="synthetic-pill">Synthetic Demo Event</span>
                <span className="selected-id">{selectedEvent.id}</span>
              </div>

              <h4 className="selected-location">
                {selectedEvent.district}, {selectedEvent.state}
              </h4>

              <div className="selected-specs-grid">
                <div className="spec-item">
                  <span className="spec-label">Latitude</span>
                  <strong className="spec-val">{selectedEvent.latitude.toFixed(4)}° N</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Longitude</span>
                  <strong className="spec-val">{selectedEvent.longitude.toFixed(4)}° E</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Radiative Power (FRP)</span>
                  <strong className="spec-val highlight">{selectedEvent.frp_mw} MW</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Brightness</span>
                  <strong className="spec-val">{selectedEvent.brightness_kelvin} K</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Confidence</span>
                  <span className={`confidence-badge ${selectedEvent.confidence.toLowerCase()}`}>
                    {selectedEvent.confidence.toUpperCase()}
                  </span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Observation Time</span>
                  <span className="spec-val">{selectedEvent.observed_at.replace('T', ' ').replace('Z', ' UTC')}</span>
                </div>
              </div>

              <div className="selected-sensor-box">
                <span className="spec-label">Satellite Platform:</span>
                <p className="sensor-name">{selectedEvent.satellite}</p>
              </div>

              <button
                type="button"
                className="deselect-btn"
                onClick={() => setSelectedEvent(null)}
              >
                Clear Selection
              </button>
            </div>
          ) : (
            <div className="no-selection-prompt">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="prompt-icon">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <p>Click any hotspot marker on the map to inspect telemetry, radiative power, and coordinates.</p>
            </div>
          )}

          {/* Quick list of visible markers */}
          <div className="visible-list-section">
            <h4 className="visible-list-title">Visible Hotspots ({filteredEvents.length})</h4>
            <div className="visible-list-scroll">
              {filteredEvents.map((evt) => (
                <button
                  key={evt.id}
                  type="button"
                  className={`hotspot-list-item ${selectedEvent?.id === evt.id ? 'active' : ''}`}
                  onClick={() => handleSelectEvent(evt)}
                >
                  <div className="list-item-left">
                    <span className={`marker-dot ${evt.confidence.toLowerCase()}`} />
                    <span className="list-item-district">{evt.district}</span>
                    <span className="list-item-state">({evt.state})</span>
                  </div>
                  <div className="list-item-right">
                    <span className="list-item-frp">{evt.frp_mw} MW</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, MapContainer, Polygon, Rectangle, TileLayer, Tooltip } from 'react-leaflet';
import { ANALYTICS_RULES, HEAT_COLORS, RANGER_POINT_COLOR } from '../constants';
import { cellBounds, formatDensity, pointsBounds } from '../utils/analytics';

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PARK_STYLE = { color: '#4c7a5c', weight: 2, fillOpacity: 0.04 };
const VILLAGE_STYLE = { color: '#ffffff', weight: 1.5, fillColor: '#1f2d27', fillOpacity: 1 };
const RANGER_POINT_STYLE = { color: '#ffffff', weight: 1, fillColor: RANGER_POINT_COLOR, fillOpacity: 0.95 };

/**
 * Kernel-density hotspot map (wireframe A1, markers 3–4) on OpenStreetMap tiles.
 * Each backend cell is drawn as a rectangle in the viridis colour of its level, and
 * the legend lists the numeric density of each level, so the map is readable without
 * relying on colour. If the tiles cannot load (offline) the park outline, heatmap and
 * village labels still show. Ranger GPS points (UC1 patrols) show where rangers have been.
 * @param {{ report: { id: string, park: object, heatmap: object, coverage: object, landmarks?: object[],
 *   patrolPoints?: Array<{ latitude: number, longitude: number }> } }} props
 */
export function HotspotMap({ report }) {
  const { t } = useTranslation();
  const { park, heatmap, coverage } = report;
  const landmarks = report.landmarks ?? [];
  const patrolPoints = report.patrolPoints ?? [];
  const hasPoints = patrolPoints.length > 0;
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showGaps, setShowGaps] = useState(true);
  const [showPoints, setShowPoints] = useState(true);

  const hasCells = Boolean(heatmap?.cells?.length && heatmap.cellSizeDeg);
  const outline = park.boundary ?? [];
  const bounds = outline.length ? pointsBounds(outline) : heatmap?.bounds ? toBounds(heatmap.bounds) : null;
  const gaps = coverage.available ? coverage.unpatrolledSectors : [];

  return (
    <section
      className="card panel map-panel"
      aria-label={t('analytics.map.title', { bandwidth: heatmap?.bandwidthMetres ?? '-' })}
    >
      <div className="panel-head">
        <h2>{t('analytics.map.title', { bandwidth: heatmap?.bandwidthMetres ?? '-' })}</h2>
        <div className="layer-toggles" role="group">
          <label className={showHeatmap ? 'toggle on' : 'toggle'}>
            <input type="checkbox" checked={showHeatmap} onChange={() => setShowHeatmap((v) => !v)} />
            {t('analytics.map.heatmap')}
          </label>
          <label
            className={coverage.available && showGaps ? 'toggle on' : 'toggle'}
            aria-disabled={!coverage.available}
          >
            <input
              type="checkbox"
              checked={coverage.available && showGaps}
              disabled={!coverage.available}
              onChange={() => setShowGaps((v) => !v)}
            />
            {t('analytics.map.coverageGaps')}
          </label>
          <label
            className={hasPoints && showPoints ? 'toggle on' : 'toggle'}
            aria-disabled={!hasPoints}
            title={hasPoints ? undefined : t('analytics.map.noPatrolPoints')}
          >
            <input
              type="checkbox"
              checked={hasPoints && showPoints}
              disabled={!hasPoints}
              onChange={() => setShowPoints((v) => !v)}
            />
            {t('analytics.map.patrolTracks')}
          </label>
        </div>
      </div>

      {bounds ? (
        <div
          className="map-frame"
          role="img"
          aria-label={t('analytics.map.a11y', {
            park: park.name,
            max: formatDensity(heatmap?.maxDensity ?? 0),
          })}
        >
          <MapContainer
            key={report.id}
            bounds={bounds}
            boundsOptions={{ padding: [12, 12] }}
            scrollWheelZoom
            zoomSnap={0.25}
            zoomDelta={0.5}
            preferCanvas
            className="leaflet-map"
          >
            <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={18} />
            {outline.length ? (
              <Polygon positions={outline.map((p) => [p.latitude, p.longitude])} pathOptions={PARK_STYLE} />
            ) : null}
            {showHeatmap && hasCells
              ? heatmap.cells.map((cell) => (
                  <Rectangle
                    key={`${cell.row}-${cell.col}`}
                    bounds={cellBounds(cell, heatmap.cellSizeDeg)}
                    pathOptions={{
                      stroke: false,
                      fillColor: HEAT_COLORS[cell.level] ?? HEAT_COLORS[0],
                      fillOpacity: 0.72,
                    }}
                  />
                ))
              : null}
            {hasPoints && showPoints
              ? patrolPoints.map((point, index) => (
                  <CircleMarker
                    key={index}
                    center={[point.latitude, point.longitude]}
                    radius={3}
                    pathOptions={RANGER_POINT_STYLE}
                  />
                ))
              : null}
            {landmarks.map((place) => (
              <CircleMarker
                key={place.name}
                center={[place.latitude, place.longitude]}
                radius={4}
                pathOptions={VILLAGE_STYLE}
              >
                <Tooltip permanent direction="right" offset={[6, 0]} className="village-label">
                  {place.name}
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      ) : null}

      {hasCells ? (
        <div className="legend" data-testid="heatmap-legend">
          <span className="muted">{t('analytics.map.legend')}</span>
          {heatmap.classBreaks.map((value, index) => (
            <span key={index} className="legend-item">
              <span className="swatch" style={{ background: HEAT_COLORS[index] }} />
              {formatDensity(value)}
              {index === heatmap.classBreaks.length - 1 ? '+' : ''}
            </span>
          ))}
          {hasPoints && showPoints ? (
            <span className="legend-item" data-testid="ranger-points-legend">
              <span className="swatch swatch-dot" style={{ background: RANGER_POINT_COLOR }} />
              {t('analytics.map.patrolPointsLegend', { count: patrolPoints.length })}
            </span>
          ) : null}
          {!coverage.available ? (
            <span className="legend-note">{t('analytics.map.layerUnavailable')}</span>
          ) : null}
        </div>
      ) : (
        <p className="muted">{t('analytics.map.noCells')}</p>
      )}

      {coverage.available && showGaps && gaps.length > 0 ? (
        <p className="gap-list" data-testid="coverage-gaps">
          {t('analytics.map.gapList', {
            days: ANALYTICS_RULES.UNPATROLLED_DAYS,
            sectors: gaps.map((gap) => gap.name).join(', '),
          })}
        </p>
      ) : null}
    </section>
  );
}

const toBounds = (b) => [
  [b.minLat, b.minLng],
  [b.maxLat, b.maxLng],
];

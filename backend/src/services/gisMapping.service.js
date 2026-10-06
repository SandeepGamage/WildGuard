const { ANALYTICS_RULES } = require('../constants/domain');
const { boundingBox, distanceM, metresPerDegLng, METRES_PER_DEG_LAT } = require('../utils/geo');

/** Kernel contributions beyond this many bandwidths are negligible (< 0.2 %). */
const KERNEL_CUTOFF_BANDWIDTHS = 3.5;
/**
 * Legend classes as shares of the peak density. Cells below the first class are
 * dropped from the response; each kept cell gets a `level` (0–4) that clients
 * map to the same colour-blind-safe (viridis) ramp.
 */
const CLASS_SHARES = Object.freeze([0.05, 0.2, 0.4, 0.6, 0.8]);

/** Round to two significant figures so legend values read cleanly. */
const roundLegend = (value) => (value > 0 ? Number(value.toPrecision(2)) : 0);
const SQ_M_PER_SQ_KM = 1e6;

/**
 * GISMappingService (implements HotspotCalculator, Fig 11). Computes a
 * Gaussian kernel density surface over a regular grid (Silverman, 1986).
 */
class GISMappingService {
  /** @param {{ cellSizeM?: number }} [options] */
  constructor({ cellSizeM = ANALYTICS_RULES.GRID_CELL_M } = {}) {
    this.cellSizeM = cellSizeM;
  }

  /**
   * @param {{ latitude: number, longitude: number }[]} points
   * @param {number} bandwidthMetres
   * @param {{ latitude: number, longitude: number }[]} [area] Polygon whose bounding box fixes the grid.
   * @returns {{ bandwidthMetres: number, cellSizeM: number, cellSizeDeg: object|null, bounds: object|null,
   *   cells: object[], maxDensity: number, classBreaks: number[] }} Densities are incidents per km².
   */
  calculateSpatialHotspots(points, bandwidthMetres = ANALYTICS_RULES.DEFAULT_BANDWIDTH_M, area = null) {
    const extent = area?.length ? area : points;
    const bounds = extent.length ? boundingBox(extent, area?.length ? 0 : bandwidthMetres * 2) : null;
    if (!bounds || points.length === 0) {
      return {
        bandwidthMetres,
        cellSizeM: this.cellSizeM,
        cellSizeDeg: null,
        bounds,
        cells: [],
        maxDensity: 0,
        classBreaks: [],
      };
    }
    const { cells, cellSizeDeg } = this.#applyKernelDensity(points, bandwidthMetres, bounds);
    const maxDensity = cells.reduce((max, cell) => Math.max(max, cell.density), 0);
    const thresholds = CLASS_SHARES.map((share) => maxDensity * share);
    return {
      bandwidthMetres,
      cellSizeM: this.cellSizeM,
      cellSizeDeg,
      bounds,
      cells: cells
        .filter((cell) => cell.density >= thresholds[0])
        .map((cell) => ({ ...cell, level: thresholds.findLastIndex((t) => cell.density >= t) })),
      maxDensity,
      classBreaks: thresholds.map(roundLegend),
    };
  }

  #applyKernelDensity(points, bandwidthMetres, bounds) {
    const midLat = (bounds.minLat + bounds.maxLat) / 2;
    const stepLat = this.cellSizeM / METRES_PER_DEG_LAT;
    const stepLng = this.cellSizeM / metresPerDegLng(midLat);
    const rows = Math.max(1, Math.ceil((bounds.maxLat - bounds.minLat) / stepLat));
    const cols = Math.max(1, Math.ceil((bounds.maxLng - bounds.minLng) / stepLng));
    const h2 = bandwidthMetres ** 2;
    const cutoff = bandwidthMetres * KERNEL_CUTOFF_BANDWIDTHS;
    const norm = SQ_M_PER_SQ_KM / (2 * Math.PI * h2);

    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      const lat = bounds.minLat + (row + 0.5) * stepLat;
      for (let col = 0; col < cols; col += 1) {
        const lng = bounds.minLng + (col + 0.5) * stepLng;
        let sum = 0;
        for (const point of points) {
          const d = distanceM(lat, lng, point.latitude, point.longitude);
          if (d <= cutoff) sum += Math.exp(-(d * d) / (2 * h2));
        }
        if (sum > 0) cells.push({ row, col, latitude: lat, longitude: lng, density: sum * norm });
      }
    }
    return { cells, cellSizeDeg: { latitude: stepLat, longitude: stepLng } };
  }
}

module.exports = { GISMappingService };

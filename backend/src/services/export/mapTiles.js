/**
 * Web Mercator basemap for the PDF hotspot map. Downloads the slippy-map tiles that
 * cover the map frame, using the same OpenStreetMap tiles as the web dashboard.
 * Tiles are cached in memory, so repeat exports of the same park reuse them.
 */
const TILE_SIZE = 256;
const MAX_ZOOM = 16;
const MAX_TILES = 64;
const CACHE_LIMIT = 256;

/** Lng/lat to Web Mercator world pixels at `zoom`. */
function project(longitude, latitude, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Smallest zoom at which the bounds are at least `minWidthPx` wide (sharp enough to print). */
function chooseZoom(bounds, minWidthPx) {
  for (let zoom = 1; zoom <= MAX_ZOOM; zoom += 1) {
    const width = project(bounds.maxLng, 0, zoom).x - project(bounds.minLng, 0, zoom).x;
    if (width >= minWidthPx) return zoom;
  }
  return MAX_ZOOM;
}

/** Tile x/y ranges (inclusive) covering a world-pixel box. */
function tileRange(pixelBox) {
  return {
    minX: Math.floor(pixelBox.minX / TILE_SIZE),
    maxX: Math.floor((pixelBox.maxX - 1) / TILE_SIZE),
    minY: Math.floor(pixelBox.minY / TILE_SIZE),
    maxY: Math.floor((pixelBox.maxY - 1) / TILE_SIZE),
  };
}

class MapTileSource {
  /**
   * @param {{ urlTemplate: string, userAgent?: string, timeoutMs?: number, fetchImpl?: typeof fetch, logger?: object }} deps
   *   `urlTemplate` uses {z}, {x} and {y}.
   */
  constructor({
    urlTemplate,
    userAgent = 'WildGuardLK/1.0 (conservation report export)',
    timeoutMs = 5000,
    fetchImpl,
    logger,
  }) {
    this.urlTemplate = urlTemplate;
    this.userAgent = userAgent;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl ?? globalThis.fetch;
    this.logger = logger;
    this.cache = new Map();
  }

  /**
   * @param {{ minX: number, maxX: number, minY: number, maxY: number }} pixelBox World pixels at `zoom`.
   * @param {number} zoom
   * @returns {Promise<{ x: number, y: number, image: Buffer }[] | null>} null when any tile is missing,
   *   so the PDF falls back to a plain background instead of a patchy map.
   */
  async getTiles(pixelBox, zoom) {
    const range = tileRange(pixelBox);
    const wanted = [];
    for (let y = range.minY; y <= range.maxY; y += 1) {
      for (let x = range.minX; x <= range.maxX; x += 1) wanted.push({ x, y });
    }
    if (wanted.length > MAX_TILES) return null;
    try {
      return await Promise.all(
        wanted.map(async ({ x, y }) => ({ x, y, image: await this.#tile(zoom, x, y) })),
      );
    } catch (error) {
      this.logger?.warn('Basemap tiles unavailable, exporting the map without them', {
        message: error.message,
      });
      return null;
    }
  }

  async #tile(zoom, x, y) {
    const url = this.urlTemplate.replace('{z}', zoom).replace('{x}', x).replace('{y}', y);
    const cached = this.cache.get(url);
    if (cached) return cached;
    const res = await this.fetchImpl(url, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Tile ${zoom}/${x}/${y} returned ${res.status}`);
    const image = Buffer.from(await res.arrayBuffer());
    if (this.cache.size >= CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(url, image);
    return image;
  }
}

module.exports = { MapTileSource, project, chooseZoom, tileRange, TILE_SIZE };

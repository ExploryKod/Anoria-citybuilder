import { createTileCoord, tryCreateTileCoord } from './BuildingIdentifiers.js';

/**
 * Occupied tiles for one building instance (1×1 today; multi-tile ready).
 *
 * @typedef {Readonly<{
 *   anchor: Readonly<{ x: number, y: number }>,
 *   tiles: ReadonlyArray<Readonly<{ x: number, y: number }>>,
 * }>} Footprint
 */

/**
 * @param {number} x
 * @param {number} y
 * @returns {Footprint}
 */
export function footprintFromAnchor(x, y) {
  const anchor = createTileCoord(x, y);
  return Object.freeze({
    anchor,
    tiles: Object.freeze([anchor]),
  });
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {Footprint}
 */
export function footprintFromRect(x, y, width, height) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const anchor = createTileCoord(x, y);
  /** @type {{ x: number, y: number }[]} */
  const tiles = [];
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      tiles.push(createTileCoord(x + dx, y + dy));
    }
  }
  return Object.freeze({
    anchor,
    tiles: Object.freeze(tiles),
  });
}

/**
 * @param {object} raw
 * @returns {Footprint | null}
 */
export function footprintFromRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const anchor = tryCreateTileCoord(raw.anchorX ?? raw.x, raw.anchorY ?? raw.y);
  if (!anchor) return null;

  if (Array.isArray(raw.footprintTiles) && raw.footprintTiles.length > 0) {
    const tiles = raw.footprintTiles
      .map((entry) => {
        if (Array.isArray(entry)) {
          return tryCreateTileCoord(entry[0], entry[1]);
        }
        return tryCreateTileCoord(entry?.x, entry?.y);
      })
      .filter(Boolean);
    if (tiles.length === 0) return footprintFromAnchor(anchor.x, anchor.y);
    return Object.freeze({
      anchor,
      tiles: Object.freeze(tiles),
    });
  }

  const width = raw.footprintWidth ?? raw.gridSize ?? 1;
  const height = raw.footprintHeight ?? raw.gridSize ?? 1;
  if (width > 1 || height > 1) {
    return footprintFromRect(anchor.x, anchor.y, width, height);
  }

  return footprintFromAnchor(anchor.x, anchor.y);
}

/**
 * @param {Footprint} footprint
 * @returns {ReadonlyArray<[number, number]>}
 */
export function footprintTilesAsPairs(footprint) {
  return footprint.tiles.map((t) => [t.x, t.y]);
}

/**
 * @param {Footprint} footprint
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function footprintOccupiesTile(footprint, x, y) {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return footprint.tiles.some((t) => t.x === tileX && t.y === tileY);
}

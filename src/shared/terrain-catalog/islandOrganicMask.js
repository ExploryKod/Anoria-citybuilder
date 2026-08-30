import { deterministicHash } from './deterministicHash.js';

/**
 * @typedef {object} IslandMaskOptions
 * @property {number} [padding=4] — max tiles the organic island extends past the playable box
 * @property {number} [seed=42]
 */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @returns {boolean}
 */
export function isPlayableTile(x, y, citySize) {
  return x >= 0 && x < citySize && y >= 0 && y < citySize;
}

/**
 * Chebyshev distance from the playable `[0, citySize)` box (0 = inside).
 *
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @returns {number}
 */
export function distanceToPlayableBox(x, y, citySize) {
  if (isPlayableTile(x, y, citySize)) return 0;

  const west = x < 0;
  const east = x >= citySize;
  const south = y < 0;
  const north = y >= citySize;

  const dx = west ? -x : east ? x - citySize + 1 : 0;
  const dy = south ? -y : north ? y - citySize + 1 : 0;
  return Math.max(dx, dy);
}

/**
 * Organic island silhouette — playable grid is always land; outside uses
 * angular waves + cell noise so the coastline is not a perfect square.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @param {IslandMaskOptions} [options]
 * @returns {boolean}
 */
export function isOrganicIslandLand(x, y, citySize, options = {}) {
  const padding = options.padding ?? 4;
  const seed = options.seed ?? 42;

  if (isPlayableTile(x, y, citySize)) return true;

  const cx = (citySize - 1) / 2;
  const cy = (citySize - 1) / 2;
  const dx = x - cx;
  const dy = y - cy;

  const rx = citySize / 2 + padding;
  const ry = citySize / 2 + padding * 0.92;
  const nx = dx / rx;
  const ny = dy / ry;
  const baseDist = Math.sqrt(nx * nx + ny * ny);

  const angle = Math.atan2(dy, dx);
  const wave =
    Math.sin(angle * 3 + seed * 0.11) * 0.18 +
    Math.sin(angle * 5 - 1.4) * 0.11 +
    Math.sin(angle * 7 + 2.3) * 0.06;

  const cellNoise = (deterministicHash(x, y, seed) % 1000) / 1000 * 0.1 - 0.05;

  return baseDist < 1.0 + wave + cellNoise;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @param {IslandMaskOptions} options
 * @returns {boolean}
 */
export function isOrganicShoreline(x, y, citySize, options) {
  if (!isOrganicIslandLand(x, y, citySize, options)) return false;

  return (
    !isOrganicIslandLand(x + 1, y, citySize, options) ||
    !isOrganicIslandLand(x - 1, y, citySize, options) ||
    !isOrganicIslandLand(x, y + 1, citySize, options) ||
    !isOrganicIslandLand(x, y - 1, citySize, options)
  );
}

/**
 * @typedef {'cliff' | 'coast' | 'grass_ext'} ShoreCellRole
 */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @param {IslandMaskOptions} options
 * @returns {ShoreCellRole | 'sea' | 'playable'}
 */
export function classifyShoreCell(x, y, citySize, options) {
  if (isPlayableTile(x, y, citySize)) return 'playable';
  if (!isOrganicIslandLand(x, y, citySize, options)) return 'sea';

  const dist = distanceToPlayableBox(x, y, citySize);
  const onShoreline = isOrganicShoreline(x, y, citySize, options);

  if (dist === 1) return 'cliff';
  if (onShoreline) return 'coast';
  return 'grass_ext';
}

/**
 * @param {number} citySize
 * @param {IslandMaskOptions} [options]
 * @returns {{ min: number, maxExclusive: number }}
 */
export function getOrganicIslandBounds(citySize, options = {}) {
  const padding = options.padding ?? 4;
  return {
    min: -padding,
    maxExclusive: citySize + padding,
  };
}

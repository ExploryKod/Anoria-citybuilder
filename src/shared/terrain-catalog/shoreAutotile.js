import { deterministicHash } from './deterministicHash.js';

/**
 * @typedef {'NE' | 'SE' | 'SW' | 'NW'} ShoreCompass
 */

/**
 * @typedef {object} ShoreAutotileResult
 * @property {string} terrainId
 * @property {ShoreCompass} compass
 * @property {number} [surfaceY]
 */

/** @type {readonly string[]} */
const STRAIGHT_CLIFF_VARIANTS = Object.freeze([
  'nature:cliff_block_stone',
  'nature:cliff_half_stone',
  'nature:cliff_steps_stone',
]);

/** @type {readonly string[]} */
const COAST_VARIANTS = Object.freeze([
  'nature:platform_beach',
  'nature:cliff_steps_stone',
  'nature:cliff_half_stone',
]);

/**
 * @param {(tx: number, ty: number) => boolean} isLand
 * @param {number} x
 * @param {number} y
 * @returns {ShoreCompass}
 */
export function resolveCompassFromSeaNeighbors(isLand, x, y) {
  const north = !isLand(x, y + 1);
  const south = !isLand(x, y - 1);
  const east = !isLand(x + 1, y);
  const west = !isLand(x - 1, y);

  if (west && south) return 'SW';
  if (west && north) return 'NW';
  if (east && south) return 'SE';
  if (east && north) return 'NE';
  if (west) return 'NW';
  if (east) return 'SE';
  if (south) return 'SW';
  if (north) return 'NE';
  return 'SW';
}

/**
 * @param {number} h
 * @param {readonly string[]} variants
 * @returns {string}
 */
function pickVariant(h, variants) {
  return variants[h % variants.length];
}

/**
 * @param {(tx: number, ty: number) => boolean} isLand
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {ShoreAutotileResult}
 */
export function resolveCliffAutotile(isLand, x, y, seed) {
  const n = isLand(x, y + 1);
  const s = isLand(x, y - 1);
  const e = isLand(x + 1, y);
  const w = isLand(x - 1, y);
  const h = deterministicHash(x, y, seed);

  if (!n && !e && s && w) {
    return { terrainId: 'nature:cliff_corner_stone', compass: 'NE' };
  }
  if (!n && !w && s && e) {
    return { terrainId: 'nature:cliff_corner_stone', compass: 'NW' };
  }
  if (!s && !e && n && w) {
    return { terrainId: 'nature:cliff_corner_stone', compass: 'SE' };
  }
  if (!s && !w && n && e) {
    return { terrainId: 'nature:cliff_corner_stone', compass: 'SW' };
  }

  if (!n && !w && e && s) {
    return { terrainId: 'nature:cliff_cornerInner_stone', compass: 'SW' };
  }
  if (!n && !e && w && s) {
    return { terrainId: 'nature:cliff_cornerInner_stone', compass: 'SE' };
  }
  if (!s && !w && n && e) {
    return { terrainId: 'nature:cliff_cornerInner_stone', compass: 'NW' };
  }
  if (!s && !e && n && w) {
    return { terrainId: 'nature:cliff_cornerInner_stone', compass: 'NE' };
  }

  if (!e && n && s && w) {
    return {
      terrainId: pickVariant(h, STRAIGHT_CLIFF_VARIANTS),
      compass: 'SE',
    };
  }
  if (!w && n && s && e) {
    return {
      terrainId: pickVariant(h, STRAIGHT_CLIFF_VARIANTS),
      compass: 'NW',
    };
  }
  if (!n && s && e && w) {
    return {
      terrainId: pickVariant(h, STRAIGHT_CLIFF_VARIANTS),
      compass: 'SW',
    };
  }
  if (!s && n && e && w) {
    return {
      terrainId: pickVariant(h, STRAIGHT_CLIFF_VARIANTS),
      compass: 'NE',
    };
  }

  if ((!n && !s && e && w) || (n && s && !e && !w)) {
    return {
      terrainId: 'nature:cliff_diagonal_stone',
      compass: resolveCompassFromSeaNeighbors(isLand, x, y),
    };
  }

  return {
    terrainId: pickVariant(h, STRAIGHT_CLIFF_VARIANTS),
    compass: resolveCompassFromSeaNeighbors(isLand, x, y),
  };
}

/**
 * @param {(tx: number, ty: number) => boolean} isLand
 * @param {number} x
 * @param {number} y
 * @param {number} distFromPlayable
 * @param {number} seed
 * @returns {ShoreAutotileResult}
 */
export function resolveCoastAutotile(isLand, x, y, distFromPlayable, seed) {
  const h = deterministicHash(x, y, seed + 19);
  const compass = resolveCompassFromSeaNeighbors(isLand, x, y);
  const surfaceY = distFromPlayable <= 2 ? -0.08 : -0.14;

  return {
    terrainId: pickVariant(h, COAST_VARIANTS),
    compass,
    surfaceY,
  };
}

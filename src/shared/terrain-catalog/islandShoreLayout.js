import { resolveBeachBorderCompass } from './beachBorderCompass.js';
import {
  classifyShoreCell,
  distanceToPlayableBox,
  getOrganicIslandBounds,
  isOrganicIslandLand,
} from './islandOrganicMask.js';
import { resolveCliffAutotile, resolveCoastAutotile } from './shoreAutotile.js';

/**
 * @typedef {'NE' | 'SE' | 'SW' | 'NW'} ShoreCompass
 */

/**
 * @typedef {'cliff' | 'coast' | 'grass_ext'} ShoreCellRole
 */

/**
 * @typedef {object} IslandShoreLayoutOptions
 * @property {number} [padding=4]
 * @property {number} [seed=42]
 */

/**
 * @typedef {object} IslandShoreTileSpec
 * @property {number} x
 * @property {number} y
 * @property {number} ring — distance from playable box
 * @property {ShoreCellRole} role
 * @property {string} terrainId — canonical `nature:*` catalog id
 * @property {ShoreCompass} compass
 * @property {number} [surfaceY]
 * @property {boolean} [decorative]
 */

/**
 * Chebyshev distance from the playable `[0, citySize)` box (0 = inside).
 * Kept for tests and legacy callers.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @returns {number}
 */
export function getShoreRingIndex(x, y, citySize) {
  return distanceToPlayableBox(x, y, citySize);
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @returns {boolean}
 */
export function isShoreCornerTile(x, y, citySize) {
  const west = x < 0;
  const east = x >= citySize;
  const south = y < 0;
  const north = y >= citySize;
  return (west || east) && (south || north);
}

/**
 * @deprecated use organic mask + shoreAutotile instead
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 * @param {number} ring
 * @returns {Pick<IslandShoreTileSpec, 'terrainId' | 'surfaceY'>}
 */
export function resolveShoreTerrainForRing(x, y, citySize, ring) {
  if (ring === 1) {
    if (isShoreCornerTile(x, y, citySize)) {
      return { terrainId: 'nature:cliff_corner_stone' };
    }
    return { terrainId: 'nature:cliff_block_stone' };
  }

  return {
    terrainId: 'nature:platform_beach',
    surfaceY: ring === 2 ? -0.1 : -0.16,
  };
}

/**
 * @param {number} citySize
 * @param {number | IslandShoreLayoutOptions} [optionsOrRingWidth]
 * @returns {IslandShoreTileSpec[]}
 */
export function buildIslandShoreLayout(citySize, optionsOrRingWidth = {}) {
  if (typeof citySize !== 'number' || citySize <= 0) {
    return [];
  }

  /** @type {IslandShoreLayoutOptions} */
  const options =
    typeof optionsOrRingWidth === 'number'
      ? { padding: optionsOrRingWidth + 2 }
      : optionsOrRingWidth;

  const padding = options.padding ?? 4;
  const seed = options.seed ?? 42;
  const maskOptions = { padding, seed };

  const isLand = (tx, ty) => isOrganicIslandLand(tx, ty, citySize, maskOptions);
  const { min, maxExclusive } = getOrganicIslandBounds(citySize, maskOptions);

  /** @type {IslandShoreTileSpec[]} */
  const tiles = [];

  for (let x = min; x < maxExclusive; x += 1) {
    for (let y = min; y < maxExclusive; y += 1) {
      const role = classifyShoreCell(x, y, citySize, maskOptions);
      if (role === 'sea' || role === 'playable') continue;

      const ring = distanceToPlayableBox(x, y, citySize);
      /** @type {Pick<IslandShoreTileSpec, 'terrainId' | 'compass' | 'surfaceY' | 'decorative'>} */
      let spec;

      if (role === 'cliff') {
        const cliff = resolveCliffAutotile(isLand, x, y, seed);
        spec = { ...cliff, decorative: true };
      } else if (role === 'coast') {
        const coast = resolveCoastAutotile(isLand, x, y, ring, seed);
        spec = { ...coast, decorative: true };
      } else {
        spec = {
          terrainId: 'nature:ground_grass',
          compass: resolveBeachBorderCompass(x, y, citySize),
          decorative: true,
        };
      }

      tiles.push({
        x,
        y,
        ring,
        role,
        terrainId: spec.terrainId,
        compass: spec.compass,
        decorative: spec.decorative,
        ...(typeof spec.surfaceY === 'number' ? { surfaceY: spec.surfaceY } : {}),
      });
    }
  }

  return tiles;
}

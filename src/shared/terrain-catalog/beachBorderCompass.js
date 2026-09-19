/**
 * Kenney `platform_beach` isometric compass labels (NE/SE/SW/NW).
 * One GLB is rotated to match each preview PNG.
 *
 * Grid: tile `x` → world X, tile `y` → world Z (+Z = north).
 * Compass = which corner/edge has the low sand cliff facing **away** from the island.
 */

/** @typedef {'NE' | 'SE' | 'SW' | 'NW'} BeachBorderCompass */

/** @type {Record<BeachBorderCompass, number>} */
export const PLATFORM_BEACH_COMPASS_YAW_STEPS = Object.freeze({
  NE: 0,
  SE: 1,
  SW: 2,
  NW: 3,
});

/**
 * @param {BeachBorderCompass} compass
 * @returns {number} radians
 */
export function beachCompassToYawRadians(compass) {
  const steps = PLATFORM_BEACH_COMPASS_YAW_STEPS[compass] ?? 0;
  return steps * (Math.PI / 2);
}

/**
 * Pick the beach tile variant so the cliff faces away from the playable island.
 *
 * @param {number} x — border tile column
 * @param {number} y — border tile row
 * @param {number} citySize — playable extent (tiles [0, citySize))
 * @returns {BeachBorderCompass}
 */
export function resolveBeachBorderCompass(x, y, citySize) {
  const west = x < 0;
  const east = x >= citySize;
  const south = y < 0;
  const north = y >= citySize;

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

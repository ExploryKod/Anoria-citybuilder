import { DEFAULT_CITY_SIZE } from '../shared/gameplay/SimulationDefaults.js';

/**
 * Resolve playable city size (WebGL-safe clamp).
 *
 * @param {number | null | undefined} citySize
 * @returns {number}
 */
export function resolveSelectedCitySize(citySize = null) {
  let selectedCitySize =
    citySize
    || parseInt(localStorage.getItem('selectedCitySize'), 10)
    || DEFAULT_CITY_SIZE
    || 16;

  // Enforce maximum size of 18 to prevent WebGL shader compilation errors.
  // In test mode, allow larger sizes to test detection.
  const testMode = localStorage.getItem('webgl-test-mode');
  const absoluteMaxSize = testMode ? 24 : 18;
  return Math.max(12, Math.min(absoluteMaxSize, selectedCitySize));
}

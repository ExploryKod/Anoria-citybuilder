/**
 * Session-scoped cumulative deaths since game start (composition, not a BC).
 * Reset on replay / new session.
 */

let cumulativeDeaths = 0;

/** @returns {number} */
export function getCumulativeDeaths() {
  return cumulativeDeaths;
}

/** @param {number} count */
export function recordDeaths(count) {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n <= 0) return cumulativeDeaths;
  cumulativeDeaths += n;
  return cumulativeDeaths;
}

export function resetCumulativeDeaths() {
  cumulativeDeaths = 0;
}

/** Game over when cumulative famine deaths reach this threshold (POC). */
export const GAME_OVER_DEATH_THRESHOLD = 25;

/** @returns {boolean} */
export function isDeathGameOverReached() {
  return cumulativeDeaths >= GAME_OVER_DEATH_THRESHOLD;
}

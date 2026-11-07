/**
 * Session-scoped cumulative deaths since game start (composition, not a BC), counted by cause so the screen can tell them apart:
 * the famine's, the poor physical health's and the suicides' (a gravely ill mind). All count towards the end of the game. Reset on replay / new session.
 */

/** The causes a death is counted under. */
export const DEATH_CAUSES = Object.freeze(['famine', 'health', 'suicide']);

const byCause = Object.fromEntries(DEATH_CAUSES.map((cause) => [cause, 0]));

/** @returns {number} every death, whatever its cause: what the end of the game counts */
export function getCumulativeDeaths() {
  return DEATH_CAUSES.reduce((sum, cause) => sum + byCause[cause], 0);
}

/** @returns {Record<'famine' | 'health' | 'suicide', number>} the deaths of each cause */
export function getDeathsByCause() {
  return { ...byCause };
}

/**
 * @param {number} count
 * @param {'famine' | 'health' | 'suicide'} cause why they died: required, so no death is counted without its cause
 * @returns {number} the total
 */
export function recordDeaths(count, cause) {
  if (!DEATH_CAUSES.includes(cause)) throw new Error(`[deaths] unknown cause "${cause}": expected one of ${DEATH_CAUSES.join(', ')}`);
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  byCause[cause] += n;
  return getCumulativeDeaths();
}

export function resetCumulativeDeaths() {
  for (const cause of DEATH_CAUSES) byCause[cause] = 0;
}

/** Game over when the deaths, of every cause together, reach this threshold (POC). */
export const GAME_OVER_DEATH_THRESHOLD = 25;

/** @returns {boolean} */
export function isDeathGameOverReached() {
  return getCumulativeDeaths() >= GAME_OVER_DEATH_THRESHOLD;
}

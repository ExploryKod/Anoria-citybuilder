/**
 * Famine consequences for the POC — growth freeze + light monthly mortality.
 *
 * Signal: `lastConsumption.totalUnfed` from the supply cycle (not leftover
 * stocks after consumption — those would mark every fed house as famished).
 */

/**
 * @param {{ totalUnfed?: number } | null | undefined} lastConsumption
 * @returns {number}
 */
export function unfedFromLastConsumption(lastConsumption) {
  const n = lastConsumption?.totalUnfed;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * @param {{ totalUnfed?: number } | null | undefined} lastConsumption
 * @returns {boolean}
 */
export function didHouseGoHungryLastConsumption(lastConsumption) {
  return unfedFromLastConsumption(lastConsumption) > 0;
}

/**
 * Monthly deaths at one house when limits are on.
 * POC rule: 1 death per hungry house per month (capped by pop / unfed).
 *
 * @param {object} params
 * @param {number} params.pop
 * @param {{ totalUnfed?: number } | null | undefined} params.lastConsumption
 * @returns {number}
 */
export function computeMonthlyFamineDeathsAtHouse({ pop, lastConsumption }) {
  const unfed = unfedFromLastConsumption(lastConsumption);
  if (unfed <= 0) return 0;
  const residents = Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
  if (residents <= 0) return 0;
  return Math.min(1, unfed, residents);
}

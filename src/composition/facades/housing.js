/**
 * ACL Housing — composition root access from legacy `src/js/`.
 *
 * Do not import `contexts/housing/domain/**` from UI. Use Housing context queries
 * (e.g. `evaluateHouseFoodAffluence`, `getFamishedPopulation`).
 */

import {
  createHousingContext,
  getOrCreateHousingContext,
} from '../createHousingContext.js';

export { createHousingContext, getOrCreateHousingContext };

/**
 * City total residential population (legacy UI helper).
 *
 * @returns {Promise<number>}
 */
export async function getCityTotalPopulation() {
  const { totalPop } = await getOrCreateHousingContext().getCityPopulationSummary();
  return totalPop;
}

/**
 * Legacy budget safety net — zero pop on houses without road access.
 *
 * @returns {Promise<{
 *   totalPopulationLost: number,
 *   totalPopulationGained: number,
 *   housesAffected: number,
 *   message: string,
 * }>}
 */
export async function clearPopulationWithoutRoadAccess() {
  return getOrCreateHousingContext().clearPopulationWithoutRoadAccess();
}

/** @returns {Promise<number>} */
export async function getFamishedPopulation() {
  const { famishedPopulation } = await getOrCreateHousingContext().getFamishedPopulation();
  return famishedPopulation;
}

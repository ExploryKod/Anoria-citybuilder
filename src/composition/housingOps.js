/**
 * Composition ops — migrated from facades/housing.js (plan_use_case_wiring Barre 5).
 * Prefer sessionApi / create*Context for new call sites.
 */

import {
  createHousingContext,
  getOrCreateHousingContext,
} from './createHousingContext.js';

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

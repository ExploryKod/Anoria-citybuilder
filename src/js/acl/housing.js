/**
 * ACL Housing — composition root access from legacy `src/js/`.
 *
 * Do not import `contexts/housing/domain/**` from UI. Use Housing context queries
 * (e.g. `evaluateHouseFoodAffluence`, `getFamishedPopulation`).
 */

import {
  createHousingContext,
  getOrCreateHousingContext,
} from '../../composition/createHousingContext.js';

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

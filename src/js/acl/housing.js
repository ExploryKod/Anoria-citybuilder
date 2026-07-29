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
 * @param {import('../stores/HousesStore.js').default | null | undefined} housesStore
 * @returns {Promise<number>}
 */
export async function getCityTotalPopulation(housesStore) {
  if (!housesStore) return 0;
  const { totalPop } = await getOrCreateHousingContext(housesStore).getCityPopulationSummary();
  return totalPop;
}

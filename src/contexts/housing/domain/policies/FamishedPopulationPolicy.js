/**
 * Famished population — residents not covered by food stored at home.
 *
 * Housing owns this **read metric**. Supply owns stock **writes** (`stocks.food`
 * on the shared Dexie row). Housing reads `pop` + `stocks` without importing Supply domain.
 *
 * @see ../docs/famished-population.md
 */

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

import { totalFoodFromStocks } from '../value-objects/FoodStocks.js';

/**
 * Food baskets available at the house for famished calculation.
 *
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function homeFoodBasketsForFamished(stocks) {
  return totalFoodFromStocks(stocks);
}

/**
 * Fed residents at one house: min(pop, home food baskets).
 *
 * @param {number} pop
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function fedPopulationAtHouse(pop, stocks) {
  const p = clampPop(pop);
  const food = homeFoodBasketsForFamished(stocks);
  return Math.min(p, food);
}

/**
 * @param {number} pop
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function famishedPopulationAtHouse(pop, stocks) {
  const p = clampPop(pop);
  return Math.max(0, p - fedPopulationAtHouse(p, stocks));
}

/**
 * City-wide famished count from residential house snapshots.
 *
 * @param {ReadonlyArray<{ pop?: number, stocks?: import('../value-objects/FoodStocks.js').FoodStocks }>} residentialHouses
 * @returns {{
 *   totalPopulation: number,
 *   fedPopulation: number,
 *   famishedPopulation: number,
 * }}
 */
export function computeCityFamishedPopulation(residentialHouses) {
  let totalPopulation = 0;
  let fedPopulation = 0;

  for (const house of residentialHouses) {
    const pop = clampPop(house.pop);
    totalPopulation += pop;
    fedPopulation += fedPopulationAtHouse(pop, house.stocks);
  }

  return {
    totalPopulation,
    fedPopulation,
    famishedPopulation: Math.max(0, totalPopulation - fedPopulation),
  };
}

/**
 * Famished population — residents not fed.
 *
 * Primary signal: `lastConsumption.totalUnfed` (same as house Régime tab).
 * Fallback: pantry coverage (`stocks` edible baskets vs pop) when no
 * consumption record exists yet.
 *
 * Housing owns this **read metric**. Supply owns stock / consumption writes.
 */

import { edibleBasketsFromCategories, totalFoodFromStocks } from '../value-objects/FoodStocks.js';
import { unfedFromLastConsumption } from './FamineConsequencesPolicy.js';

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

/**
 * Food baskets available at the house for pantry fallback.
 * Prefer category sum (Régime shelves); fall back to `food` aggregate.
 *
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function homeFoodBasketsForFamished(stocks) {
  const fromCategories = edibleBasketsFromCategories(stocks);
  if (fromCategories > 0) return fromCategories;
  return totalFoodFromStocks(stocks);
}

/**
 * Fed residents at one house (pantry fallback): min(pop, home food baskets).
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
 * Unfed residents at one house.
 * Prefers last consumption outcome (aligned with Régime tab).
 *
 * @param {number} pop
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} stocks
 * @param {{ totalUnfed?: number } | null | undefined} [lastConsumption]
 * @returns {number}
 */
export function famishedPopulationAtHouse(pop, stocks, lastConsumption = null) {
  const p = clampPop(pop);
  if (lastConsumption != null && Object.hasOwn(lastConsumption, 'totalUnfed')) {
    return Math.min(p, unfedFromLastConsumption(lastConsumption));
  }
  return Math.max(0, p - fedPopulationAtHouse(p, stocks));
}

/**
 * City-wide famished count from residential house snapshots.
 *
 * @param {ReadonlyArray<{
 *   pop?: number,
 *   stocks?: import('../value-objects/FoodStocks.js').FoodStocks,
 *   lastConsumption?: { totalUnfed?: number } | null,
 * }>} residentialHouses
 * @returns {{
 *   totalPopulation: number,
 *   fedPopulation: number,
 *   famishedPopulation: number,
 * }}
 */
export function computeCityFamishedPopulation(residentialHouses) {
  let totalPopulation = 0;
  let famishedPopulation = 0;

  for (const house of residentialHouses) {
    const pop = clampPop(house.pop);
    totalPopulation += pop;
    famishedPopulation += famishedPopulationAtHouse(
      pop,
      house.stocks,
      house.lastConsumption,
    );
  }

  return {
    totalPopulation,
    fedPopulation: Math.max(0, totalPopulation - famishedPopulation),
    famishedPopulation,
  };
}

import {
  marketBasketsFromStocks,
  totalFoodFromStocks,
} from '../value-objects/FoodStocks.js';

/**
 * City-wide food stored in residential houses.
 *
 * @param {ReadonlyArray<{ pop?: number, stocks?: import('../value-objects/FoodStocks.js').FoodStocks }>} residentialHouses
 * @returns {{
 *   totalPopulation: number,
 *   marketBaskets: number,
 *   totalBaskets: number,
 * }}
 */
export function computeCityFoodSupply(residentialHouses) {
  let totalPopulation = 0;
  let marketBaskets = 0;
  let totalBaskets = 0;

  for (const house of residentialHouses) {
    const pop = Number.isFinite(house.pop) ? Math.max(0, Math.floor(house.pop)) : 0;
    totalPopulation += pop;
    marketBaskets += marketBasketsFromStocks(house.stocks);
    totalBaskets += totalFoodFromStocks(house.stocks);
  }

  return {
    totalPopulation,
    marketBaskets,
    totalBaskets,
  };
}

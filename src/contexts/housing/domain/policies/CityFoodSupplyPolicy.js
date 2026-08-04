import {
  gatheringBasketsFromStocks,
  marketBasketsFromStocks,
  totalFoodFromStocks,
} from '../value-objects/FoodStocks.js';

/**
 * City-wide food stored in residential houses, split by source channel.
 *
 * @param {ReadonlyArray<{ pop?: number, stocks?: import('../value-objects/FoodStocks.js').FoodStocks }>} residentialHouses
 * @returns {{
 *   totalPopulation: number,
 *   gatheringBaskets: number,
 *   marketBaskets: number,
 *   totalBaskets: number,
 * }}
 */
export function computeCityFoodSupply(residentialHouses) {
  let totalPopulation = 0;
  let gatheringBaskets = 0;
  let marketBaskets = 0;
  let totalBaskets = 0;

  for (const house of residentialHouses) {
    const pop = Number.isFinite(house.pop) ? Math.max(0, Math.floor(house.pop)) : 0;
    totalPopulation += pop;
    gatheringBaskets += gatheringBasketsFromStocks(house.stocks);
    marketBaskets += marketBasketsFromStocks(house.stocks);
    totalBaskets += totalFoodFromStocks(house.stocks);
  }

  return {
    totalPopulation,
    gatheringBaskets,
    marketBaskets,
    totalBaskets,
  };
}

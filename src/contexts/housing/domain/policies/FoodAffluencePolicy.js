import { totalFoodFromStocks } from '../value-objects/FoodStocks.js';

/**
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} stocks
 * @param {number} [population=0]
 * @returns {{
 *   hasFood: boolean,
 *   totalFood: number,
 *   netFood: number,
 *   meetsFoodGoal: boolean,
 *   isInsufficient: boolean,
 * }}
 */
export function checkFoodAffluence(stocks, population = 0) {
  const pop = Number.isFinite(population) ? Math.max(0, population) : 0;
  const totalFood = totalFoodFromStocks(stocks);
  const hasFood = totalFood > 0;

  let netFood = totalFood;
  if (totalFood > 0 && pop > 0) {
    const net = totalFood - pop;
    netFood = net > 0 ? net : 0;
  }

  const meetsFoodGoal = pop > 5 && totalFood > pop * 2;
  const isInsufficient = pop >= 2 && totalFood < pop;

  return {
    hasFood,
    totalFood,
    netFood,
    meetsFoodGoal,
    isInsufficient,
  };
}

/**
 * @param {import('../value-objects/FoodStocks.js').FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function countAvailableCropTypes(stocks) {
  if (!stocks) return 0;
  const types = [
    (stocks.wheat || 0) > 0,
    (stocks.carrot || 0) > 0,
    (stocks.cabbage || 0) > 0,
  ];
  return types.filter(Boolean).length;
}

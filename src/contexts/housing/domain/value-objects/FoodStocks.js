/**
 * Food stock read model for housing evolution (mirrors Supply food fields on house rows).
 *
 * @typedef {object} FoodStocks
 * @property {number} [food]
 * @property {number} [wheat]
 * @property {number} [carrot]
 * @property {number} [cabbage]
 */

/**
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function totalFoodFromStocks(stocks) {
  if (!stocks) return 0;
  if (stocks.food !== undefined && stocks.food !== null) {
    return stocks.food;
  }
  return (stocks.wheat || 0) + (stocks.carrot || 0) + (stocks.cabbage || 0);
}

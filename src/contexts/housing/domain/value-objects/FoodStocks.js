/**
 * Food stock read model for housing (mirrors Supply food fields on house rows).
 *
 * @typedef {object} FoodStocks
 * @property {number} [food]
 * @property {number} [wheat]
 * @property {number} [carrot]
 * @property {number} [cabbage]
 * @property {number} [fruit]
 * @property {number} [game]
 */

/**
 * Cueillette & chasse stockée dans les maisons (hors circuit marché).
 *
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function gatheringBasketsFromStocks(stocks) {
  if (!stocks) return 0;
  return (stocks.fruit || 0) + (stocks.game || 0);
}

/**
 * Denrées de ferme distribuées par les marchés (blé, carotte, salade).
 *
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function marketBasketsFromStocks(stocks) {
  if (!stocks) return 0;
  return (stocks.wheat || 0) + (stocks.carrot || 0) + (stocks.cabbage || 0);
}

/**
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function totalFoodFromStocks(stocks) {
  if (!stocks) return 0;
  if (stocks.food !== undefined && stocks.food !== null) {
    return stocks.food;
  }
  return gatheringBasketsFromStocks(stocks) + marketBasketsFromStocks(stocks);
}

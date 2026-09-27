import {
  getConsumableCategories,
  getSelfProducedCategories,
  getSuppliedCategories,
  getResourceStockShape,
} from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Consumable-goods stock read model for housing (mirrors the Supply stock
 * fields on house rows). Which categories exist, which a household gathers
 * itself and which arrive through the distribution chain are all derived
 * from the catalog (`resourceRoles`) — no good is named here.
 *
 * @typedef {Record<string, number>} FoodStocks
 */

/**
 * @param {FoodStocks | null | undefined} stocks
 * @param {ReadonlyArray<string>} categories
 * @returns {number}
 */
function sumCategories(stocks, categories) {
  if (!stocks) return 0;
  return categories.reduce((sum, category) => sum + (stocks[category] || 0), 0);
}

/**
 * Goods the household produces itself (gathering), outside the market circuit.
 *
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function gatheringBasketsFromStocks(stocks) {
  return sumCategories(stocks, getSelfProducedCategories());
}

/**
 * Goods distributed to the house through the supply chain (farm → hub → market).
 *
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function marketBasketsFromStocks(stocks) {
  return sumCategories(stocks, getSuppliedCategories());
}

/**
 * Sum of visible consumable categories (what the Régime tab shows).
 *
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function edibleBasketsFromCategories(stocks) {
  return sumCategories(stocks, getConsumableCategories());
}

/**
 * Total consumable stock for affluence / evolution — prefers the persisted
 * aggregate declared in the catalog (`totalKey`).
 *
 * @param {FoodStocks | null | undefined} stocks
 * @returns {number}
 */
export function totalFoodFromStocks(stocks) {
  if (!stocks) return 0;
  const { totalKey } = getResourceStockShape();
  if (stocks[totalKey] !== undefined && stocks[totalKey] !== null) {
    return stocks[totalKey];
  }
  return edibleBasketsFromCategories(stocks);
}

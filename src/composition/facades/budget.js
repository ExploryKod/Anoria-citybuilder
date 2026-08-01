/**
 * ACL Budget — façade legacy → Accounting BC / city assets.
 */

import {
  createCityAssetsContext,
  getOrCreateCityAssetsContext,
} from '../createCityAssetsContext.js';

export { createCityAssetsContext, getOrCreateCityAssetsContext };

export {
  recordConstructionExpense,
  recordConstructionRefund,
} from '../constructionTreasuryBridge.js';

/**
 * Built asset valuation (sum of `houses.price` + first price per type).
 *
 * @returns {Promise<{ totalValue: number, pricesByType: Record<string, number> }>}
 */
export async function getCityBuildingValuation() {
  return getOrCreateCityAssetsContext().getCityBuildingValuation();
}

/** @returns {Promise<number>} */
export async function getCityTotalBuildingValue() {
  const { totalValue } = await getCityBuildingValuation();
  return totalValue;
}

/** @returns {Promise<Record<string, number>>} */
export async function getCityBuildingPricesByType() {
  const { pricesByType } = await getCityBuildingValuation();
  return pricesByType;
}

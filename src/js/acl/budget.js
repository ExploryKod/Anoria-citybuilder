/**
 * ACL Budget — façade legacy → future Accounting BC.
 *
 * Writes still delegate to BudgetManager; building valuation reads city inventory.
 */

import budgetManager from '../stores/BudgetManager.js';
import {
  createCityAssetsContext,
  getOrCreateCityAssetsContext,
} from '../../composition/createCityAssetsContext.js';

export { createCityAssetsContext, getOrCreateCityAssetsContext };

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

/**
 * @param {number} amount
 * @param {string} reason
 */
export async function recordConstructionExpense(amount, reason) {
  return budgetManager.addConstructionExpense(amount, reason);
}

/**
 * @param {number} amount
 * @param {string} reason
 */
export async function recordConstructionRefund(amount, reason) {
  return budgetManager.addIncome(amount, reason);
}

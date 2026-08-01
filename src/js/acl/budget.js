/**
 * ACL Budget — façade legacy → Accounting BC.
 *
 * Construction payments use acl/accounting.js directly.
 */

import {
  recordConstructionExpense as recordConstructionExpenseAcl,
  recordConstructionRefundIncome,
  getTreasurySnapshot,
} from './accounting.js';
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
 * @param {{ buildingInstanceId?: string }} [options]
 */
export async function recordConstructionExpense(amount, reason, options = {}) {
  if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
    return {
      success: false,
      reason: 'invalid_amount',
      message: `Invalid expense amount: ${amount}`,
    };
  }

  try {
    const budget = await getTreasurySnapshot();
    const result = await recordConstructionExpenseAcl({
      turn: budget.turn,
      amount,
      description: reason,
      buildingInstanceId: options.buildingInstanceId ?? null,
    });

    if (!result.recorded) {
      return {
        success: false,
        reason: result.reason ?? 'not_recorded',
        message: `Construction expense not recorded: ${result.reason ?? 'unknown'}`,
      };
    }

    const updatedBudget = await getTreasurySnapshot();

    return {
      success: true,
      budget: updatedBudget,
      message: `Expense of ${amount}€ processed for ${reason}`,
    };
  } catch (error) {
    console.error('Error processing expense:', error);
    return {
      success: false,
      reason: 'error',
      message: error.message ?? 'Unknown error',
    };
  }
}

/**
 * @param {number} amount
 * @param {string} reason
 * @param {{ buildingInstanceId?: string }} [options]
 */
export async function recordConstructionRefund(amount, reason, options = {}) {
  const budget = await getTreasurySnapshot();
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return budget;
  }

  await recordConstructionRefundIncome({
    turn: budget.turn,
    amount: roundedAmount,
    description: reason,
    buildingInstanceId: options.buildingInstanceId ?? null,
  });

  return getTreasurySnapshot();
}

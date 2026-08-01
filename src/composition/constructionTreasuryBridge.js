/**
 * Legacy construction payment signatures (amount, reason) → Accounting BC.
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';

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
    const accounting = getOrCreateAccountingContext();
    const budget = await accounting.getTreasurySnapshot();
    const result = await accounting.recordConstructionExpense({
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

    const updatedBudget = await accounting.getTreasurySnapshot();

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
  const accounting = getOrCreateAccountingContext();
  const budget = await accounting.getTreasurySnapshot();
  const roundedAmount = Math.round(amount);

  if (roundedAmount <= 0) {
    return budget;
  }

  await accounting.recordConstructionRefundIncome({
    turn: budget.turn,
    amount: roundedAmount,
    description: reason,
    buildingInstanceId: options.buildingInstanceId ?? null,
  });

  return accounting.getTreasurySnapshot();
}

/**
 * Legacy construction payment signatures (amount, reason) → Accounting BC.
 */

import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getSessionGameTime } from './sessionRuntime.js';
import { getBuildingDefinition } from '../shared/building-catalog/buildingCatalog.js';
import { isRoadType } from '../shared/building-catalog/roadQueries.js';

/** A road is the hamlet's and a plant or a rock has no account: they have no books to close, and a large erase would otherwise read the whole journal for each of them. */
const hasBooks = (buildingType) => !isRoadType(buildingType) && getBuildingDefinition(buildingType)?.construction?.category !== 'nature';

/**
 * Whether the player is asked before this building is demolished: every building but the roads and the nature, which have no books and no consequences.
 * @param {string} buildingType
 * @returns {boolean}
 */
export const isConfirmedBeforeDemolition = hasBooks;

/**
 * The building the player demolishes leaves with its books closed (a liquidation, see LiquidateDemolishedBuilding.js), in the turn it leaves.
 * @param {{ instanceId: string, buildingType: string }} params
 */
export async function liquidateDemolishedBuilding({ instanceId, buildingType }) {
  if (!hasBooks(buildingType)) return;
  await getOrCreateAccountingContext().liquidateDemolishedBuilding({ buildingId: instanceId, turn: getSessionGameTime() });
}

/**
 * What the demolition of a building will do to the books, for the player to read before he confirms (nothing is written).
 * @param {{ instanceId: string, buildingType: string }} params
 * @returns {ReturnType<import('../contexts/accounting/application/services/LiquidateDemolishedBuilding.js').LiquidateDemolishedBuilding['preview']>}
 */
export async function previewDemolitionLiquidation({ instanceId, buildingType }) {
  if (!hasBooks(buildingType)) return { abandoned: [], accounts: [] };
  return getOrCreateAccountingContext().previewDemolitionLiquidation({ buildingId: instanceId, turn: getSessionGameTime() });
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

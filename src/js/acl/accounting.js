/**
 * ACL Accounting — façade legacy → Accounting BC (Phase 1).
 *
 * Presenters and game code must use these entry points, not contexts/accounting/domain.
 */

import {
  createAccountingContext,
  getOrCreateAccountingContext,
  resetAccountingContextForTests,
} from '../../composition/createAccountingContext.js';

export {
  createAccountingContext,
  getOrCreateAccountingContext,
  resetAccountingContextForTests,
};

/** @returns {Promise<number>} Treasury balance (budget_current.funds) */
export async function getTreasuryBalance() {
  return getOrCreateAccountingContext().getTreasuryBalance();
}

/** @returns {Promise<object>} Admin César 3 livret — N vs N-1 comparison */
export async function getCityLedgerYearComparison() {
  return getOrCreateAccountingContext().getCityLedgerYearComparison();
}

/**
 * @param {{ periodDays?: number|null, types?: string[]|null }} [filters]
 * @returns {Promise<object>} Journal UI — grouped general ledger
 */
export async function getGeneralLedger(filters) {
  return getOrCreateAccountingContext().getGeneralLedger(filters);
}

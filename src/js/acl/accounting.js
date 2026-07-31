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

/** @returns {Promise<object>} Full treasury row (budget_current) */
export async function getTreasurySnapshot() {
  return getOrCreateAccountingContext().getTreasurySnapshot();
}

/** @returns {Promise<{ status: string, message: string, budget: object, netFlow: number }>} */
export async function getFinancialHealth() {
  return getOrCreateAccountingContext().getFinancialHealth();
}

/** @param {number|null} [startingFunds] */
export async function initializeTreasury(startingFunds = null) {
  return getOrCreateAccountingContext().initializeTreasury(startingFunds);
}

/** @param {number|null} [startingFunds] */
export async function forceReinitializeTreasury(startingFunds = null) {
  return getOrCreateAccountingContext().forceReinitializeTreasury(startingFunds);
}

/** @param {number} turn */
export async function updateTreasuryTurn(turn) {
  return getOrCreateAccountingContext().updateTreasuryTurn(turn);
}

/** @returns {Promise<Array>} */
export async function getActiveLoans() {
  return getOrCreateAccountingContext().getActiveLoans();
}

/** @param {object} loanData */
export async function addLoanToPortfolio(loanData) {
  return getOrCreateAccountingContext().addLoanToPortfolio(loanData);
}

/** @param {string} loanId @param {number} repaymentAmount */
export async function applyRepaymentToPortfolio(loanId, repaymentAmount) {
  return getOrCreateAccountingContext().applyRepaymentToPortfolio(loanId, repaymentAmount);
}

/** @param {string} loanId */
export async function advanceLoanInstallmentWithoutPayment(loanId) {
  return getOrCreateAccountingContext().advanceLoanInstallmentWithoutPayment(loanId);
}

export async function recalculateLoanTotals() {
  return getOrCreateAccountingContext().recalculateLoanTotals();
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

/** @param {{ fiscalYear?: number|null }} [options] */
export async function getIncomeStatement(options) {
  return getOrCreateAccountingContext().getIncomeStatement(options);
}

export async function getBalanceSheet() {
  return getOrCreateAccountingContext().getBalanceSheet();
}

/** @param {number} atTurn */
export async function getFinancialStatementsAtTurn(atTurn) {
  return getOrCreateAccountingContext().getFinancialStatementsAtTurn(atTurn);
}

/** @param {{ everyNTurns?: number, turns?: number[]|null, filterTurn?: number|null }} [options] */
export async function getFinancialStatementsHistory(options) {
  return getOrCreateAccountingContext().getFinancialStatementsHistory(options);
}

export async function exportJournalJson() {
  return getOrCreateAccountingContext().exportJournalJson();
}

export async function exportJournalPdf() {
  return getOrCreateAccountingContext().exportJournalPdf();
}

/** @returns {Promise<{ treasuryFunds: number, journalBalance: number, delta: number, aligned: boolean }>} */
export async function getTreasuryJournalReconciliation(options) {
  return getOrCreateAccountingContext().getTreasuryJournalReconciliation(options);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['syncTurnInformativeEntries']>[0]} params
 */
export async function syncTurnInformativeEntries(params) {
  return getOrCreateAccountingContext().syncTurnInformativeEntries(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordMaintenanceExpense']>[0]} params
 */
export async function recordMaintenanceExpense(params) {
  return getOrCreateAccountingContext().recordMaintenanceExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordConstructionExpense']>[0]} params
 */
export async function recordConstructionExpense(params) {
  return getOrCreateAccountingContext().recordConstructionExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordSalaryExpense']>[0]} params
 */
export async function recordSalaryExpense(params) {
  return getOrCreateAccountingContext().recordSalaryExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordPayrollTaxIncome']>[0]} params
 */
export async function recordPayrollTaxIncome(params) {
  return getOrCreateAccountingContext().recordPayrollTaxIncome(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordCitizenTaxIncome']>[0]} params
 */
export async function recordCitizenTaxIncome(params) {
  return getOrCreateAccountingContext().recordCitizenTaxIncome(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordLoanCapitalIncome']>[0]} params
 */
export async function recordLoanCapitalIncome(params) {
  return getOrCreateAccountingContext().recordLoanCapitalIncome(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordLoanInterestExpense']>[0]} params
 */
export async function recordLoanInterestExpense(params) {
  return getOrCreateAccountingContext().recordLoanInterestExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordLoanRepaymentExpense']>[0]} params
 */
export async function recordLoanRepaymentExpense(params) {
  return getOrCreateAccountingContext().recordLoanRepaymentExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordInfoLoanInstallment']>[0]} params
 */
export async function recordInfoLoanInstallment(params) {
  return getOrCreateAccountingContext().recordInfoLoanInstallment(params);
}

/** @deprecated Use recordInfoLoanInstallment */
export async function recordLoanDefaultInstallment(params) {
  return getOrCreateAccountingContext().recordLoanDefaultInstallment(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordCommerceImportExpense']>[0]} params
 */
export async function recordCommerceImportExpense(params) {
  return getOrCreateAccountingContext().recordCommerceImportExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordCommerceExportIncome']>[0]} params
 */
export async function recordCommerceExportIncome(params) {
  return getOrCreateAccountingContext().recordCommerceExportIncome(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordCapitalFundsIncome']>[0]} params
 */
export async function recordCapitalFundsIncome(params) {
  return getOrCreateAccountingContext().recordCapitalFundsIncome(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordExceptionalExpense']>[0]} params
 */
export async function recordExceptionalExpense(params) {
  return getOrCreateAccountingContext().recordExceptionalExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordCommercialRouteExpense']>[0]} params
 */
export async function recordCommercialRouteExpense(params) {
  return getOrCreateAccountingContext().recordCommercialRouteExpense(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordConstructionRefundIncome']>[0]} params
 */
export async function recordConstructionRefundIncome(params) {
  return getOrCreateAccountingContext().recordConstructionRefundIncome(params);
}

/**
 * @param {Parameters<ReturnType<typeof createAccountingContext>['recordLedgerEntry']>[0]} params
 */
export async function recordLedgerEntry(params) {
  return getOrCreateAccountingContext().recordLedgerEntry(params);
}

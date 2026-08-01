/**
 * Game-facing ACL — thin legacy signatures over acl/accounting.js.
 *
 * Boot-only state (budgetReadyPromise) stays here; orchestration lives in the BC.
 */

export {
  getTreasurySnapshot,
  getTreasuryBalance,
  getFinancialHealth,
  getActiveLoans,
  updateTreasuryTurn,
  recalculateLoanTotals,
  initializeTreasury,
  forceReinitializeTreasury,
  addLoanToPortfolio,
  applyRepaymentToPortfolio,
  advanceLoanInstallmentWithoutPayment,
  flushJournalSessionToDexie,
  getBudgetSummary,
  getIncomeBreakdown,
  getExpenseBreakdown,
  canAfford,
  collectCitizenTaxes,
  recordSalaries,
  recordPayrollTax,
  recordBuildingMaintenance,
  recordExceptionalRepairExpense,
  recordCommercialRouteFee,
  recordImportExpense,
  recordExportIncome,
  recordLoanCapital,
  recordLoanInterest,
  recordLoanRepayment,
  saveBudgetTurnEnrichment,
  cleanupOldBudgetTurnSnapshotsByAge,
  cleanupOldJournalEntries,
  readInitialFundsFromImportMeta,
  getCommercialRouteFee,
} from './accounting.js';

import { recordInfoLoanInstallmentForGame } from './accounting.js';

export {
  setBudgetReadyPromise,
  awaitBudgetReady,
} from '../budgetReadyGate.js';

/** @deprecated Prefer recordInfoLoanInstallmentForGame — kept for PretsPanel. */
export async function recordInfoLoanInstallment(params) {
  return recordInfoLoanInstallmentForGame(params);
}

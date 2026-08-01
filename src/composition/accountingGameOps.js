/**
 * Composition ops — migrated from facades/accountingGame.js (plan_use_case_wiring Barre 5).
 * Prefer sessionApi / create*Context for new call sites.
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
  recordUnemploymentBenefits,
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
} from './accountingOps.js';

import { recordInfoLoanInstallmentForGame } from './accountingOps.js';

export {
  setBudgetReadyPromise,
  awaitBudgetReady,
} from './budgetReadyGate.js';

/** @deprecated Prefer recordInfoLoanInstallmentForGame — kept for PretsPanel. */
export async function recordInfoLoanInstallment(params) {
  return recordInfoLoanInstallmentForGame(params);
}

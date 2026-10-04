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
  initializeTreasury,
  forceReinitializeTreasury,
  flushJournalSessionToDexie,
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
  cleanupOldJournalYears,
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

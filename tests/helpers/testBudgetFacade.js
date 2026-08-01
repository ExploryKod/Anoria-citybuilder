/**
 * Test-only treasury façade — replaces deleted stores/BudgetManager.js.
 * Production code must use js/acl/accounting.js and js/acl/accountingGame.js.
 */
import db from '../../src/core/persistence/dexie/db.js';
import sessionJournalStore from '../../src/js/acl/accountingSessionJournal.js';
import {
  initializeTreasury,
  getTreasurySnapshot,
  getFinancialHealth,
  updateTreasuryTurn,
  getActiveLoans,
  advanceLoanInstallmentWithoutPayment,
  forceReinitializeTreasury,
  resetAccountingContextForTests,
  getOrCreateAccountingContext,
} from '../../src/js/acl/accounting.js';
import { resetSessionLedgerBufferForTests } from '../../src/js/acl/accountingSessionJournal.js';
import {
  recordConstructionExpense,
  recordConstructionRefund,
} from '../../src/js/acl/budget.js';
import * as accountingGame from '../../src/js/acl/accountingGame.js';

/** @deprecated Tests only — use acl/accounting.js in production. */
export class TestBudgetFacade {
  constructor() {
    this.db = db;
    this.journalManager = sessionJournalStore;
    this.config = null;
  }

  /** @param {object} [extraDeps] */
  wireAccountingContext(extraDeps = {}) {
    getOrCreateAccountingContext({
      db: this.db,
      journalManager: this.journalManager,
      ...extraDeps,
    });
  }

  async initialize(startingFunds = null) {
    this.wireAccountingContext();
    return initializeTreasury(startingFunds);
  }

  async getCurrentBudget() {
    return getTreasurySnapshot();
  }

  async calculateLoanTotals() {
    return accountingGame.recalculateLoanTotals();
  }

  async addConstructionRefund(amount, description, options = {}) {
    return recordConstructionRefund(amount, description, options);
  }

  async addLoan(amount, description = 'Loan', loanData = null) {
    return accountingGame.recordLoanCapital(amount, description, loanData);
  }

  async addLoanInterest(amount, description = 'Loan Interest', loanId = null) {
    return accountingGame.recordLoanInterest(amount, description, loanId);
  }

  async repayLoan(amount, description = 'Loan Repayment', loanId = null) {
    return accountingGame.recordLoanRepayment(amount, description, loanId);
  }

  async recordInfoLoanInstallment(params) {
    return accountingGame.recordInfoLoanInstallment(params);
  }

  async advanceLoanInstallmentWithoutPayment(loanId) {
    return advanceLoanInstallmentWithoutPayment(loanId);
  }

  async getActiveLoans() {
    return getActiveLoans();
  }

  async addConstructionExpense(amount, reason = 'unknown', options = {}) {
    return recordConstructionExpense(amount, reason, options);
  }

  async addJournalEntry(turn, type, amount, description) {
    return this.journalManager.addJournalEntry(turn, type, amount, description);
  }

  async getJournalEntries(maxAge = null) {
    return this.journalManager.getJournalEntries(maxAge);
  }

  async getJournalEntriesForTurn(turn) {
    return this.journalManager.getJournalEntriesForTurn(turn);
  }

  async cleanupOldJournalEntries(maxAge = 60) {
    return this.journalManager.cleanupOldJournalEntries(maxAge);
  }

  async getMonthlyFinancialSummary() {
    return this.journalManager.getMonthlyFinancialSummary();
  }

  async getYearlyFinancialSummary() {
    return this.journalManager.getYearlyFinancialSummary();
  }

  async getBudgetSummary() {
    return accountingGame.getBudgetSummary();
  }

  async updateTurn(turn) {
    return updateTreasuryTurn(turn);
  }

  async addImportExpense(amount, description, productId = 'unknown', partnerId = null) {
    return accountingGame.recordImportExpense(amount, description, productId, partnerId);
  }

  async addExportIncome(amount, description, productId = 'unknown', partnerId = null) {
    return accountingGame.recordExportIncome(amount, description, productId, partnerId);
  }

  async addExceptionalExpense(amount, description) {
    return accountingGame.recordExceptionalRepairExpense(amount, description);
  }

  async addCommercialRouteFee(amount, description, partnerId) {
    return accountingGame.recordCommercialRouteFee(amount, description, partnerId);
  }

  async addBuildingMaintenance(amount, description = 'Maintenance bâtiments', turn = null) {
    return accountingGame.recordBuildingMaintenance(amount, description, turn, { db: this.db });
  }

  async addSalaries(salaryPerMonth, population, description = null, turn = null) {
    return accountingGame.recordSalaries(salaryPerMonth, population, description, turn);
  }

  async addSalaryTax(salaryAmount, taxRate, description = null, turn = null) {
    return accountingGame.recordPayrollTax(salaryAmount, taxRate, description, turn);
  }

  async addTaxes(time = 0) {
    return accountingGame.collectCitizenTaxes(time, { db: this.db });
  }

  async getIncomeBreakdown() {
    return accountingGame.getIncomeBreakdown();
  }

  async getExpenseBreakdown() {
    return accountingGame.getExpenseBreakdown();
  }

  async forceReinitialize(startingFunds = null) {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();
    this.wireAccountingContext();
    return forceReinitializeTreasury(startingFunds);
  }

  async getFinancialHealth() {
    return getFinancialHealth();
  }
}

/** Drop-in alias so existing tests keep `BudgetManager` naming. */
export { TestBudgetFacade as BudgetManager };

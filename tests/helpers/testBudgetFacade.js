/**
 * Test-only treasury façade — replaces deleted stores/BudgetManager.js.
 * Production code must use composition/accountingOps.js and accountingGame.js.
 */
import db from '../../src/core/persistence/dexie/db.js';
import sessionJournalStore from '../../src/composition/accountingSessionJournal.js';
import {
  initializeTreasury,
  getTreasurySnapshot,
  getFinancialHealth,
  getActiveLoans,
  forceReinitializeTreasury,
  resetAccountingContextForTests,
  getOrCreateAccountingContext,
} from '../../src/composition/accountingOps.js';
import { resetSessionLedgerBufferForTests } from '../../src/composition/accountingSessionJournal.js';
import {
  recordConstructionExpense,
  recordConstructionRefund,
} from '../../src/composition/budgetOps.js';
import * as accountingGame from '../../src/composition/accountingGameOps.js';

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

  async getActiveLoans() {
    return getActiveLoans();
  }

  async addConstructionExpense(amount, reason = 'unknown', options = {}) {
    return recordConstructionExpense(amount, reason, options);
  }

  async addJournalEntry(turn, type, amount, description) {
    return this.journalManager.addJournalEntry(turn, type, amount, description);
  }

  async getJournalEntries() {
    return this.journalManager.getJournalEntries();
  }

  async getJournalEntriesForTurn(turn) {
    return this.journalManager.getJournalEntriesForTurn(turn);
  }

  async cleanupOldJournalYears(keepYears) {
    return this.journalManager.cleanupOldJournalYears(keepYears);
  }

  async getMonthlyFinancialSummary() {
    return this.journalManager.getMonthlyFinancialSummary();
  }

  async getYearlyFinancialSummary() {
    return this.journalManager.getYearlyFinancialSummary();
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

  async addTaxes(time = 0) {
    return accountingGame.collectCitizenTaxes(time, { db: this.db });
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

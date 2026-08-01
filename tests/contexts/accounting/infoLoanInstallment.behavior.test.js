/**
 * Behavior tests — informative loan installments (`info_*` journal types).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JournalManager } from '../../../src/js/stores/JournalManager.js';
import { BudgetManager } from '../../../src/js/stores/BudgetManager.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/stores/SessionLedgerBuffer.js';
import {
  getOrCreateAccountingContext,
  resetAccountingContextForTests,
} from '../../../src/composition/createAccountingContext.js';
import { processLoanPayments } from '../../../src/js/ui/loans/LoansManager.js';
import { isInformativeJournalType } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/journalAggregations.js';
import { buildInfoMovementBusinessKey } from '../../../src/contexts/accounting/domain/policies/LedgerInformativeTypePolicy.js';

function createTestDb() {
  const testDb = new Dexie('testInfoLoanInstallmentDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
    houses: 'name',
  });
  return testDb;
}

describe('Accounting — info loan installment (informative journal)', () => {
  let testDb;
  let journalManager;
  let budgetManager;
  let accounting;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();

    testDb = createTestDb();
    await testDb.open();

    await testDb.budget.put({
      name: 'budget_current',
      funds: 50,
      turn: 10,
      income: 1000,
      expenses: 0,
      dailyIncome: 0,
      totalTaxes: 0,
      netFlow: 1000,
      loans: [
        {
          id: 'loan_test_1',
          type: 'bank',
          amount: 1000,
          total: 1100,
          interest: 100,
          interestRate: 10,
          duration: 10,
          remainingTurns: 10,
        },
      ],
    });

    journalManager = new JournalManager();
    journalManager.db = testDb;

    budgetManager = new BudgetManager();
    budgetManager.db = testDb;
    budgetManager.journalManager = journalManager;

    accounting = getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    resetSessionLedgerBufferForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('uses explicit info_ type and info: business keys', async () => {
    const result = await accounting.recordInfoLoanInstallment({
      turn: 10,
      interestAmount: 10,
      principalAmount: 100,
      loanId: 'loan_test_1',
      loanType: 'bank',
    });

    expect(result.recorded).toBe(true);
    expect(result.linesRecorded).toBe(2);

    const entries = await journalManager.getJournalEntries();
    const interest = entries.find((e) => e.type === 'info_loan_interest');
    const principal = entries.find((e) => e.type === 'info_loan_repayment');

    expect(interest).toBeDefined();
    expect(principal).toBeDefined();
    expect(interest.businessKey).toBe(
      buildInfoMovementBusinessKey('loan_interest', 'loan_test_1', 10)
    );
    expect(principal.businessKey).toBe(
      buildInfoMovementBusinessKey('loan_repayment', 'loan_test_1', 10)
    );
    expect(interest.description.startsWith('[Informatif]')).toBe(true);
    expect(isInformativeJournalType('info_loan_interest')).toBe(true);

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(50);
    expect(budget.expenses).toBe(0);
  });

  test('skips duplicate info lines for same loan and turn', async () => {
    await accounting.recordInfoLoanInstallment({
      turn: 10,
      interestAmount: 10,
      principalAmount: 100,
      loanId: 'loan_test_1',
      loanType: 'bank',
    });

    const second = await accounting.recordInfoLoanInstallment({
      turn: 10,
      interestAmount: 99,
      principalAmount: 99,
      loanId: 'loan_test_1',
      loanType: 'bank',
    });

    expect(second.reason).toBe('duplicate_business_key');

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((e) => e.type === 'info_loan_interest')).toHaveLength(1);
  });

  test('advanceLoanInstallmentWithoutPayment persists remainingTurns', async () => {
    await budgetManager.advanceLoanInstallmentWithoutPayment('loan_test_1');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.loans).toHaveLength(1);
    expect(budget.loans[0].remainingTurns).toBe(9);
    expect(budget.loans[0].amount).toBe(1000);
  });

  test('processLoanPayments journals partial info when only interest is affordable', async () => {
    globalThis.window = globalThis.window ?? {};
    globalThis.window.budgetManager = budgetManager;

    await processLoanPayments();

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((e) => e.type === 'loan_interest')).toHaveLength(1);
    expect(entries.filter((e) => e.type === 'info_loan_repayment')).toHaveLength(1);
    expect(entries.filter((e) => e.type === 'info_loan_interest')).toHaveLength(0);

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(40);
    expect(budget.loans[0].remainingTurns).toBe(9);
  });

  test('processLoanPayments journals full info default when nothing is affordable', async () => {
    await testDb.budget.put({
      name: 'budget_current',
      funds: 0,
      turn: 10,
      income: 1000,
      expenses: 0,
      dailyIncome: 0,
      totalTaxes: 0,
      netFlow: 1000,
      loans: [
        {
          id: 'loan_test_1',
          type: 'bank',
          amount: 1000,
          total: 1100,
          interest: 100,
          interestRate: 10,
          duration: 10,
          remainingTurns: 10,
        },
      ],
    });

    globalThis.window = globalThis.window ?? {};
    globalThis.window.budgetManager = budgetManager;

    await processLoanPayments();

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((e) => e.type === 'loan_interest')).toHaveLength(0);
    expect(entries.filter((e) => e.type === 'info_loan_interest')).toHaveLength(1);
    expect(entries.filter((e) => e.type === 'info_loan_repayment')).toHaveLength(1);

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(0);
    expect(budget.loans[0].remainingTurns).toBe(9);
  });
});

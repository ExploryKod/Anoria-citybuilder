/**
 * Behavior tests — Accounting Phase 3½: RecordLedgerEntry (maintenance slice)
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JournalManager } from '../../../src/composition/accountingSessionJournal.js';
import { BudgetManager } from '../../../tests/helpers/testBudgetFacade.js';
import { resetSessionLedgerBufferForTests } from '../../../src/composition/accountingSessionJournal.js';
import {
  getOrCreateAccountingContext,
  resetAccountingContextForTests,
} from '../../../src/composition/createAccountingContext.js';
import { LegacyGameTimePort } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';

function createTestDb() {
  const testDb = new Dexie('testRecordLedgerEntryDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
    houses: 'name',
  });
  return testDb;
}

class FixedGameTimePort extends LegacyGameTimePort {
  constructor() {
    super({
      getTimeInfo: () => ({
        year: 0,
        monthIndex: 5,
        month: 'Juin',
      }),
    });
  }
}

describe('Accounting — RecordLedgerEntry (maintenance slice)', () => {
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
      funds: 1000,
      turn: 30,
      income: 0,
      expenses: 0,
      dailyExpenses: 0,
      totalBuildingMaintenance: 0,
      netFlow: 0,
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
      gameTimePort: new FixedGameTimePort(),
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('records maintenance journal line and debits treasury once', async () => {
    const result = await accounting.recordMaintenanceExpense({
      turn: 30,
      amount: 11,
      description: 'Maintenance mensuelle - Juin 1',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'maintenance')).toHaveLength(1);
    expect(entries[0].amount).toBe(11);
    expect(entries[0].businessKey).toBe('maintenance:0:5');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(989);
    expect(budget.expenses).toBe(11);
    expect(budget.totalBuildingMaintenance).toBe(11);
  });

  test('skips duplicate maintenance for same civil month (single treasury debit)', async () => {
    await accounting.recordMaintenanceExpense({
      turn: 30,
      amount: 11,
      description: 'Maintenance mensuelle - Juin 1',
    });

    const second = await accounting.recordMaintenanceExpense({
      turn: 31,
      amount: 99,
      description: 'Maintenance mensuelle - Juin duplicate',
    });

    expect(second).toMatchObject({
      recorded: false,
      skipped: true,
      treasuryApplied: false,
      reason: 'duplicate_business_key',
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'maintenance')).toHaveLength(1);
    expect(entries[0].amount).toBe(11);

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(989);
    expect(budget.totalBuildingMaintenance).toBe(11);
  });

  test('BudgetManager.addBuildingMaintenance delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const budget = await budgetManager.addBuildingMaintenance(
      11,
      'Maintenance mensuelle - Juin 1'
    );

    expect(budget.funds).toBe(989);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'maintenance')).toHaveLength(1);
  });
});

describe('Accounting — RecordLedgerEntry (construction slice)', () => {
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
      funds: 500,
      turn: 12,
      income: 0,
      expenses: 0,
      dailyExpenses: 0,
      totalInvestments: 0,
      netFlow: 0,
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
      gameTimePort: new FixedGameTimePort(),
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('records building purchase as investment (totalInvestments, not expenses)', async () => {
    const result = await accounting.recordConstructionExpense({
      turn: 12,
      amount: 20,
      description: 'Building: Farm-Carrot',
      buildingInstanceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('construction');
    expect(entries[0].businessKey).toBeUndefined();
    expect(entries[0].buildingInstanceId).toBe(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(480);
    expect(budget.totalInvestments).toBe(20);
    expect(budget.expenses).toBe(0);
    expect(budget.dailyExpenses).toBe(0);
  });

  test('creates one journal line per placement (no businessKey dedup)', async () => {
    await accounting.recordConstructionExpense({
      turn: 12,
      amount: 20,
      description: 'Building: House-Blue',
    });
    await accounting.recordConstructionExpense({
      turn: 12,
      amount: 20,
      description: 'Building: House-Blue',
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'construction')).toHaveLength(2);

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(460);
    expect(budget.totalInvestments).toBe(40);
  });

  test('non-building reason debits regular expenses', async () => {
    await accounting.recordConstructionExpense({
      turn: 12,
      amount: 50,
      description: 'Grosse dépense',
    });

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(450);
    expect(budget.expenses).toBe(50);
    expect(budget.totalInvestments ?? 0).toBe(0);
  });

  test('BudgetManager.addConstructionExpense delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const result = await budgetManager.addConstructionExpense(30, 'Building: House');

    expect(result.success).toBe(true);
    expect(result.budget.funds).toBe(470);
    expect(result.budget.totalInvestments).toBe(30);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'construction')).toHaveLength(1);
  });
});

describe('Accounting — RecordLedgerEntry (salary / payroll_tax slice)', () => {
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
      funds: 1000,
      turn: 30,
      income: 0,
      expenses: 0,
      dailyExpenses: 0,
      totalSalaries: 0,
      netFlow: 0,
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
      gameTimePort: new FixedGameTimePort(),
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('records salary journal line and debits treasury once', async () => {
    const result = await accounting.recordSalaryExpense({
      turn: 30,
      amount: 200,
      description: 'Salaires fonctionnaires - Juin 0 JC (2 fonct. × 100€)',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'salary')).toHaveLength(1);
    expect(entries[0].businessKey).toBe('salary:0:5');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(800);
    expect(budget.expenses).toBe(200);
    expect(budget.totalSalaries).toBe(200);
  });

  test('skips duplicate salary for same civil month', async () => {
    await accounting.recordSalaryExpense({
      turn: 30,
      amount: 200,
      description: 'Salaires fonctionnaires - Juin 1',
    });

    const second = await accounting.recordSalaryExpense({
      turn: 31,
      amount: 9999,
      description: 'Salaires fonctionnaires - Juin duplicate',
    });

    expect(second).toMatchObject({
      recorded: false,
      skipped: true,
      treasuryApplied: false,
      reason: 'duplicate_business_key',
    });

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(800);
    expect(budget.totalSalaries).toBe(200);
  });

  test('records payroll tax as income once per civil month', async () => {
    const result = await accounting.recordPayrollTaxIncome({
      turn: 30,
      amount: 560,
      description: 'Impôt sur les salaires - Juin 0 JC (20%)',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'payroll_tax')).toHaveLength(1);
    expect(entries[0].businessKey).toBe('payroll_tax:0:5');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(1560);
    expect(budget.income).toBe(560);
  });

  test('skips duplicate payroll tax for same civil month', async () => {
    await accounting.recordPayrollTaxIncome({
      turn: 30,
      amount: 560,
      description: 'Impôt sur les salaires - Juin 1',
    });

    const second = await accounting.recordPayrollTaxIncome({
      turn: 31,
      amount: 999,
      description: 'Impôt sur les salaires - Juin duplicate',
    });

    expect(second.reason).toBe('duplicate_business_key');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(1560);
    expect(budget.income).toBe(560);
  });

  test('BudgetManager.addSalaries delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const budget = await budgetManager.addSalaries(
      100,
      28,
      'Salaires fonctionnaires - Juin 0 JC (2 fonct. × 100€)'
    );

    expect(budget.funds).toBe(800);
    expect(budget.totalSalaries).toBe(200);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'salary')).toHaveLength(1);
  });

  test('BudgetManager.addSalaryTax delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const budget = await budgetManager.addSalaryTax(
      2800,
      0.2,
      'Impôt sur les salaires - Juin 0 JC (20%)'
    );

    expect(budget.funds).toBe(1560);
    expect(budget.income).toBe(560);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'payroll_tax')).toHaveLength(1);
  });

  test('records unemployment benefit journal line and debits treasury once', async () => {
    const result = await accounting.recordUnemploymentBenefitExpense({
      turn: 30,
      amount: 200,
      description: 'Salaires chômeurs - Juin 0 JC (4 chôm. × 100€ × 50%)',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'unemployment_benefit')).toHaveLength(1);
    expect(entries[0].businessKey).toBe('unemployment_benefit:0:5');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(800);
    expect(budget.expenses).toBe(200);
    expect(budget.totalUnemploymentBenefits).toBe(200);
  });
});

describe('Accounting — RecordLedgerEntry (citizen_tax slice)', () => {
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
      funds: 200,
      turn: 10,
      income: 0,
      expenses: 0,
      dailyIncome: 0,
      totalTaxes: 0,
      netFlow: 0,
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
      gameTimePort: new FixedGameTimePort(),
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('records citizen tax journal line and credits treasury once per year', async () => {
    const taxBreakdown = {
      'House-Blue': 300,
      'House-Red': 400,
      total: 700,
      population: 7,
    };

    const result = await accounting.recordCitizenTaxIncome({
      turn: 10,
      amount: 700,
      description: 'Impôt Citoyen (7 hab.) - Novembre',
      taxYear: 0,
      taxBreakdown,
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'citizen_tax')).toHaveLength(1);
    expect(entries[0].businessKey).toBe('citizen_tax:0');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(900);
    expect(budget.income).toBe(700);
    expect(budget.totalTaxes).toBe(700);
    expect(budget.lastTaxYear).toBe(0);
    expect(budget.taxBreakdown).toEqual(taxBreakdown);
  });

  test('skips duplicate citizen tax for same civil year', async () => {
    await accounting.recordCitizenTaxIncome({
      turn: 10,
      amount: 700,
      description: 'Impôt Citoyen (7 hab.) - Novembre',
      taxYear: 0,
    });

    const second = await accounting.recordCitizenTaxIncome({
      turn: 11,
      amount: 999,
      description: 'Impôt Citoyen duplicate',
      taxYear: 0,
    });

    expect(second).toMatchObject({
      recorded: false,
      skipped: true,
      treasuryApplied: false,
      reason: 'duplicate_business_key',
    });

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(900);
    expect(budget.totalTaxes).toBe(700);
  });

  test('BudgetManager.addTaxes delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    // Force a fixed 100€/capita rate so this test's hardcoded expectation
    // (7 habitants × 100€ = 700€) stays meaningful, independent of the real
    // default (25€, see LocalStorageFiscalSettingsRepository). `addTaxes`
    // builds a fresh accounting context per call (see accountingOps.js
    // collectCitizenTaxes), so the rate must be forced at the localStorage
    // source of truth rather than injected via context deps.
    localStorage.setItem('citizen_tax_amount', '100');

    // level: 2 — level 1 (autarkic) houses are tax-exempt, see CitizenTaxCollectionPolicy.
    await testDb.houses.bulkPut([
      { name: 'House-Blue-0-0', type: 'House-Blue', pop: 3, level: 2 },
      { name: 'House-Red-1-1', type: 'House-Red', pop: 4, level: 2 },
    ]);

    try {
      const budget = await budgetManager.addTaxes(10);

      expect(budget.totalTaxes).toBe(700);
      expect(budget.funds).toBe(900);
      expect(budget.lastTaxYear).toBe(0);

      const entries = await journalManager.getJournalEntries();
      expect(entries.filter((entry) => entry.type === 'citizen_tax')).toHaveLength(1);
    } finally {
      localStorage.removeItem('citizen_tax_amount');
    }
  });
});

describe('Accounting — RecordLedgerEntry (loans slice)', () => {
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
      funds: 500,
      turn: 5,
      income: 0,
      expenses: 0,
      loans: [],
      netFlow: 0,
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
      gameTimePort: new FixedGameTimePort(),
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('records loan capital as income (one line per draw)', async () => {
    const result = await accounting.recordLoanCapitalIncome({
      turn: 5,
      amount: 1000,
      description: 'Prêt court terme contracté (10 tours)',
      loanId: 'loan_test_1',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'loan_capital')).toHaveLength(1);
    expect(entries[0].businessKey).toBe('loan_capital:loan_test_1');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(1500);
    expect(budget.income).toBe(1000);
  });

  test('skips duplicate loan capital for same loanId', async () => {
    await accounting.recordLoanCapitalIncome({
      turn: 5,
      amount: 1000,
      description: 'Prêt contracté',
      loanId: 'loan_test_1',
    });

    const second = await accounting.recordLoanCapitalIncome({
      turn: 6,
      amount: 9999,
      description: 'Duplicate contract',
      loanId: 'loan_test_1',
    });

    expect(second.reason).toBe('duplicate_business_key');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(1500);
    expect(budget.income).toBe(1000);
  });

  test('records loan interest and repayment as separate expense lines', async () => {
    await accounting.recordLoanInterestExpense({
      turn: 6,
      amount: 20,
      description: 'Intérêts prêt court (loan_1)',
      loanId: 'loan_1',
    });

    await accounting.recordLoanRepaymentExpense({
      turn: 6,
      amount: 80,
      description: 'Remboursement prêt court (loan_1)',
      loanId: 'loan_1',
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'loan_interest')).toHaveLength(1);
    expect(entries.filter((entry) => entry.type === 'loan_repayment')).toHaveLength(1);

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(400);
    expect(budget.expenses).toBe(100);
    expect(budget.totalLoanInterest).toBe(20);
    expect(budget.totalLoanInterestExpenses).toBe(20);
    expect(budget.totalLoanRepayments).toBe(80);
  });

  test('skips duplicate loan interest for same loanId and turn', async () => {
    await accounting.recordLoanInterestExpense({
      turn: 6,
      amount: 20,
      description: 'Intérêts prêt',
      loanId: 'loan_1',
    });

    const second = await accounting.recordLoanInterestExpense({
      turn: 6,
      amount: 99,
      description: 'Duplicate interest',
      loanId: 'loan_1',
    });

    expect(second.reason).toBe('duplicate_business_key');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(480);
    expect(budget.totalLoanInterest).toBe(20);
  });

  test('allows loan interest on next turn for same loan', async () => {
    await accounting.recordLoanInterestExpense({
      turn: 6,
      amount: 20,
      description: 'Intérêts tour 6',
      loanId: 'loan_1',
    });

    await accounting.recordLoanInterestExpense({
      turn: 7,
      amount: 18,
      description: 'Intérêts tour 7',
      loanId: 'loan_1',
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'loan_interest')).toHaveLength(2);
  });

  test('BudgetManager.addLoan delegates journal + treasury and keeps loan portfolio', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const loanData = {
      id: 'loan_test_1',
      amount: 1000,
      total: 1100,
      duration: 10,
      remainingTurns: 10,
    };

    const budget = await budgetManager.addLoan(
      1000,
      'Prêt court terme contracté (10 tours)',
      loanData
    );

    expect(budget.funds).toBe(1500);
    expect(budget.income).toBe(1000);
    expect(budget.loans).toHaveLength(1);
    expect(budget.loanDebt).toBe(1000);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'loan_capital')).toHaveLength(1);
    expect(entries[0].businessKey).toBe('loan_capital:loan_test_1');
  });

  test('BudgetManager.repayLoan skips portfolio update when installment is duplicate', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    await testDb.budget.put({
      name: 'budget_current',
      funds: 500,
      turn: 6,
      income: 0,
      expenses: 0,
      loans: [
        {
          id: 'loan_test_1',
          amount: 1000,
          total: 1100,
          duration: 10,
          remainingTurns: 10,
        },
      ],
      loanDebt: 1000,
      netFlow: 0,
    });

    await budgetManager.repayLoan(
      100,
      'Remboursement prêt court (loan_test_1)',
      'loan_test_1'
    );

    const budgetAfterFirst = await budgetManager.repayLoan(
      100,
      'Remboursement duplicate',
      'loan_test_1'
    );

    expect(budgetAfterFirst.loans[0].amount).toBe(900);
    expect(budgetAfterFirst.totalLoanRepayments).toBe(100);
  });

  test('BudgetManager.repayLoan delegates and updates active loan', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    await testDb.budget.put({
      name: 'budget_current',
      funds: 500,
      turn: 6,
      income: 0,
      expenses: 0,
      loans: [
        {
          id: 'loan_test_1',
          amount: 1000,
          total: 1100,
          duration: 10,
          remainingTurns: 10,
        },
      ],
      loanDebt: 1000,
      netFlow: 0,
    });

    const budget = await budgetManager.repayLoan(
      100,
      'Remboursement prêt court (loan_test_1)',
      'loan_test_1'
    );

    expect(budget.funds).toBe(400);
    expect(budget.totalLoanRepayments).toBe(100);
    expect(budget.loans[0].amount).toBe(900);
    expect(budget.loanDebt).toBe(900);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'loan_repayment')).toHaveLength(1);
  });
});

describe('Accounting — RecordLedgerEntry (commerce slice)', () => {
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
      funds: 200,
      turn: 3,
      income: 0,
      expenses: 0,
      dailyExpenses: 0,
      dailyIncome: 0,
      totalImports: {},
      totalExports: {},
      netFlow: 0,
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
      gameTimePort: new FixedGameTimePort(),
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('records import expense with dynamic journal type and partnerId', async () => {
    const result = await accounting.recordCommerceImportExpense({
      turn: 3,
      amount: 15,
      description: 'Import wheat |BREAKDOWN|[{"label":"Savana"}]|BREAKDOWN|',
      productId: 'wheat',
      partnerId: 'city_savana',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: true,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('import_wheat');
    expect(entries[0].partnerId).toBe('city_savana');
    expect(entries[0].businessKey).toBeUndefined();

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(185);
    expect(budget.expenses).toBe(15);
    expect(budget.totalImports.wheat).toBe(15);
  });

  test('records export income with dynamic journal type', async () => {
    await accounting.recordCommerceExportIncome({
      turn: 3,
      amount: 25,
      description: 'Export wood',
      productId: 'wood',
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries[0].type).toBe('export_wood');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(225);
    expect(budget.income).toBe(25);
    expect(budget.totalExports.wood).toBe(25);
  });

  test('creates one journal line per commerce transaction', async () => {
    await accounting.recordCommerceImportExpense({
      turn: 3,
      amount: 5,
      description: 'Import wheat 1',
      productId: 'wheat',
    });
    await accounting.recordCommerceImportExpense({
      turn: 3,
      amount: 5,
      description: 'Import wheat 2',
      productId: 'wheat',
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((entry) => entry.type === 'import_wheat')).toHaveLength(2);

    const budget = await testDb.budget.get('budget_current');
    expect(budget.totalImports.wheat).toBe(10);
  });

  test('BudgetManager.addImportExpense delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const budget = await budgetManager.addImportExpense(
      5,
      'Import blé (1 panier × 5€)',
      'wheat',
      'city_savana'
    );

    expect(budget.funds).toBe(195);
    expect(budget.totalImports.wheat).toBe(5);

    const entries = await journalManager.getJournalEntries();
    expect(entries[0].type).toBe('import_wheat');
    expect(entries[0].partnerId).toBe('city_savana');
  });

  test('BudgetManager.addExportIncome delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const budget = await budgetManager.addExportIncome(
      15,
      'Export blé (1 panier × 15€)',
      'wheat'
    );

    expect(budget.funds).toBe(215);
    expect(budget.totalExports.wheat).toBe(15);

    const entries = await journalManager.getJournalEntries();
    expect(entries[0].type).toBe('export_wheat');
  });
});

describe('Accounting — RecordLedgerEntry (misc operational slice)', () => {
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
      funds: 200,
      turn: 2,
      income: 0,
      expenses: 0,
      netFlow: 0,
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
      gameTimePort: new FixedGameTimePort(),
    });
  });

  afterEach(async () => {
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('records capital funds journal line without treasury double-credit', async () => {
    await testDb.budget.put({
      name: 'budget_current',
      funds: 200,
      income: 200,
      expenses: 0,
      netFlow: 200,
      turn: 0,
    });

    const result = await accounting.recordCapitalFundsIncome({
      turn: 0,
      amount: 200,
      description: 'Capital de départ: 200€',
    });

    expect(result).toEqual({
      recorded: true,
      skipped: false,
      treasuryApplied: false,
    });

    const entries = await journalManager.getJournalEntries();
    expect(entries[0].type).toBe('capital_funds');
    expect(entries[0].businessKey).toBe('capital_funds:0');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(200);
    expect(budget.income).toBe(200);
  });

  test('skips duplicate capital funds line', async () => {
    await accounting.recordCapitalFundsIncome({
      turn: 0,
      amount: 200,
      description: 'Capital de départ: 200€',
    });

    const second = await accounting.recordCapitalFundsIncome({
      turn: 0,
      amount: 999,
      description: 'Duplicate capital',
    });

    expect(second.reason).toBe('duplicate_business_key');
    expect(await journalManager.getJournalEntries()).toHaveLength(1);
  });

  test('records exceptional expense and debits treasury', async () => {
    await accounting.recordExceptionalExpense({
      turn: 2,
      amount: 50,
      description: 'Incendie: Réparation - Maison détruite',
    });

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(150);
    expect(budget.expenses).toBe(50);

    const entries = await journalManager.getJournalEntries();
    expect(entries[0].type).toBe('exceptional_expenses');
  });

  test('records commercial route fee once per partner', async () => {
    await accounting.recordCommercialRouteExpense({
      turn: 2,
      amount: 500,
      description: 'Route commerciale - Juin 0 JC',
      partnerId: 'city_savana',
    });

    const second = await accounting.recordCommercialRouteExpense({
      turn: 3,
      amount: 500,
      description: 'Duplicate route',
      partnerId: 'city_savana',
    });

    expect(second.reason).toBe('duplicate_business_key');

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(-300);
    expect(budget.expenses).toBe(500);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((e) => e.type === 'commercial_route')).toHaveLength(1);
    expect(entries[0].partnerId).toBe('city_savana');
  });

  test('records construction refund and restores treasury investments', async () => {
    await accounting.recordConstructionExpense({
      turn: 2,
      amount: 80,
      description: 'Building: House',
      buildingInstanceId: 'house-1',
    });

    await accounting.recordConstructionRefundIncome({
      turn: 2,
      amount: 80,
      description: 'Refund for failed House',
      buildingInstanceId: 'house-1',
    });

    const budget = await testDb.budget.get('budget_current');
    expect(budget.funds).toBe(200);
    expect(budget.totalInvestments).toBe(0);
    expect(budget.income).toBe(0);

    const entries = await journalManager.getJournalEntries();
    expect(entries.some((e) => e.type === 'construction_refund')).toBe(true);
  });

  test('BudgetManager.addExceptionalExpense delegates to accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    const budget = await budgetManager.addExceptionalExpense(40, 'Réparation');

    expect(budget.funds).toBe(160);
    expect(budget.expenses).toBe(40);
  });

  test('BudgetManager.initialize records capital via accounting BC', async () => {
    resetAccountingContextForTests();
    getOrCreateAccountingContext({
      db: testDb,
      journalManager,
      budgetManager,
      gameTimePort: new FixedGameTimePort(),
    });

    await budgetManager.initialize(200);

    const entries = await journalManager.getJournalEntries();
    expect(entries.filter((e) => e.type === 'capital_funds')).toHaveLength(1);
  });
});

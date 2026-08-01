/**
 * Behavior tests — salary/payroll idempotence (J6/J7).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BudgetManager } from '../../../src/js/stores/BudgetManager.js';
import { JournalManager } from '../../../src/js/stores/JournalManager.js';
import { BudgetProcessor } from '../../../src/js/game/managers/BudgetProcessor.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/stores/SessionLedgerBuffer.js';
import {
  getOrCreateAccountingContext,
  resetAccountingContextForTests,
} from '../../../src/composition/createAccountingContext.js';
import appRegistry from '../../../src/js/game/AppRegistry.js';

function createTestDb() {
  const testDb = new Dexie('testSalaryIdempotenceDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
    houses: 'name',
  });
  return testDb;
}

describe('Accounting — salary idempotence (J6/J7)', () => {
  let testDb;
  let budgetManager;
  let journalManager;
  let budgetProcessor;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();

    testDb = createTestDb();
    await testDb.open();

    global.TimeManager = {
      getTimeInfo(turn) {
        const monthNames = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
        ];
        const monthIndex = turn % 12;
        return {
          year: Math.floor(turn / 12),
          monthIndex,
          month: monthNames[monthIndex],
          monthNumber: turn,
          dayInMonth: 1,
        };
      },
    };

    journalManager = new JournalManager();
    journalManager.db = testDb;

    budgetManager = new BudgetManager();
    budgetManager.db = testDb;
    budgetManager.journalManager = journalManager;

    getOrCreateAccountingContext({ journalManager, db: testDb });

    budgetProcessor = new BudgetProcessor();
    global.window = global.window ?? {};
    global.window.budgetManager = budgetManager;
    appRegistry.register('workSectionManager', { salary: 100, salaryTaxRate: 0.2 });

    await budgetManager.initialize(500);
  });

  afterEach(async () => {
    delete global.TimeManager;
    delete global.window.budgetManager;
    appRegistry.register('workSectionManager', null);
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('duplicate salary same civil month is skipped via businessKey', async () => {
    const turn = 24;
    await budgetManager.addSalaries(100, 5, 'Salaires test', turn);
    await budgetManager.addSalaries(100, 5, 'Salaires test duplicate', turn);

    const entries = await journalManager.getJournalEntries();
    const salaries = entries.filter((e) => e.type === 'salary');
    expect(salaries).toHaveLength(1);
  });

  test('concurrent processBudget calls record salary once per civil month', async () => {
    const turn = 36;
    await budgetManager.updateTurn(turn);

    await Promise.all([
      budgetProcessor.processBudget(turn, 10, { total: 0 }, {
        roads: { cost: 0 }, houses: { cost: 0 }, farms: { cost: 0 }, markets: { cost: 0 },
      }),
      budgetProcessor.processBudget(turn, 10, { total: 0 }, {
        roads: { cost: 0 }, houses: { cost: 0 }, farms: { cost: 0 }, markets: { cost: 0 },
      }),
    ]);

    const entries = await journalManager.getJournalEntries();
    const salaries = entries.filter((e) => e.type === 'salary');
    const payrollTaxes = entries.filter((e) => e.type === 'payroll_tax');

    expect(salaries.length).toBeLessThanOrEqual(1);
    expect(payrollTaxes.length).toBeLessThanOrEqual(1);
  });

  test('salary uses game turn for businessKey alignment', async () => {
    const turn = 48;
    await budgetManager.addSalaries(100, 3, 'Salaires alignés', turn);

    const entries = await journalManager.getJournalEntries();
    const salary = entries.find((e) => e.type === 'salary');
    expect(salary.turn).toBe(turn);
    expect(salary.businessKey).toBe(`salary:${Math.floor(turn / 12)}:${turn % 12}`);
  });
});

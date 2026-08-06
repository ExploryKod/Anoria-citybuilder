/**
 * Payroll tax must use Employment labor-pool population, not raw housing headcount.
 * Level-1 hunter-gatherers have no salary assiette (proposal.md).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JournalManager } from '../../../src/composition/accountingSessionJournal.js';
import { resetSessionLedgerBufferForTests } from '../../../src/composition/accountingSessionJournal.js';
import {
  getOrCreateAccountingContext,
  resetAccountingContextForTests,
} from '../../../src/composition/createAccountingContext.js';
import appRegistry from '../../../src/composition/AppRegistry.js';
import { TimeManager } from '../../../src/shared/time/TimeManager.js';

function createTestDb() {
  const testDb = new Dexie('testProcessTurnBudgetPayrollDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
    houses: 'name',
  });
  return testDb;
}

describe('ProcessTurnBudget — payroll tax assiette', () => {
  let testDb;
  let journalManager;
  let accounting;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();

    testDb = createTestDb();
    await testDb.open();

    appRegistry.register('timeManager', {
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
    });

    journalManager = new JournalManager();
    journalManager.db = testDb;

    accounting = getOrCreateAccountingContext({
      journalManager,
      db: testDb,
      getSalarySettings: () => ({
        salaryPerMonth: 100,
        salaryTaxRate: 0.1,
        unemploymentBenefitRate: 0.5,
      }),
      getCityTotalPopulation: async () => 6,
      getCityEmploymentSummary: async () => ({
        workerPool: 0,
        elitePool: 0,
        totalPopulation: 0,
        unemployed: 0,
      }),
      clearPopulationWithoutRoadAccess: async () => ({
        totalPopulationLost: 0,
        totalPopulationGained: 0,
        housesAffected: 0,
        message: '',
      }),
    });

    await accounting.initializeTreasury(500);
  });

  afterEach(async () => {
    appRegistry.register('timeManager', TimeManager);
    resetAccountingContextForTests();
    if (testDb) {
      await testDb.delete();
    }
  });

  test('skips payroll tax when only level-1 hunter-gatherers exist in housing', async () => {
    const turn = 5;

    await accounting.processTurnBudget({
      time: turn,
      totalPop: 6,
      buildingCounts: { total: 0 },
      maintenanceBreakdown: {
        roads: { cost: 0, count: 0 },
        houses: { cost: 0, count: 0 },
        farms: { cost: 0, count: 0 },
        markets: { cost: 0, count: 0 },
      },
    });

    const entries = await journalManager.getJournalEntries();
    const payrollTaxes = entries.filter((e) => e.type === 'payroll_tax');
    const salaries = entries.filter((e) => e.type === 'salary');

    expect(payrollTaxes).toHaveLength(0);
    expect(salaries).toHaveLength(0);
  });

  test('records payroll tax when employment summary has labor-pool population', async () => {
    resetAccountingContextForTests();
    accounting = getOrCreateAccountingContext({
      journalManager,
      db: testDb,
      getSalarySettings: () => ({
        salaryPerMonth: 100,
        salaryTaxRate: 0.1,
        unemploymentBenefitRate: 0.5,
      }),
      getCityTotalPopulation: async () => 6,
      getCityEmploymentSummary: async () => ({
        workerPool: 6,
        elitePool: 0,
        totalPopulation: 6,
        unemployed: 0,
      }),
      clearPopulationWithoutRoadAccess: async () => ({
        totalPopulationLost: 0,
        totalPopulationGained: 0,
        housesAffected: 0,
        message: '',
      }),
    });
    await accounting.initializeTreasury(500);

    const turn = 5;
    await accounting.processTurnBudget({
      time: turn,
      totalPop: 6,
      buildingCounts: { total: 0 },
      maintenanceBreakdown: {
        roads: { cost: 0, count: 0 },
        houses: { cost: 0, count: 0 },
        farms: { cost: 0, count: 0 },
        markets: { cost: 0, count: 0 },
      },
    });

    const entries = await journalManager.getJournalEntries();
    const payrollTax = entries.find((e) => e.type === 'payroll_tax');

    expect(payrollTax).toBeDefined();
    expect(payrollTax.amount).toBe(60);
  });
});

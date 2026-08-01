import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BudgetManager } from '../../../tests/helpers/testBudgetFacade.js';
import { JournalManager } from '../../../src/composition/accountingSessionJournal.js';
import { resetSessionLedgerBufferForTests } from '../../../src/composition/accountingSessionJournal.js';
import {
  getOrCreateAccountingContext,
  resetAccountingContextForTests,
} from '../../../src/composition/createAccountingContext.js';
import { getTreasuryJournalReconciliation } from '../../../src/composition/accountingOps.js';

class FixedGameTimePort {
  getTimeInfo(turn) {
    const year = Math.floor(turn / 12);
    const monthIndex = turn % 12;
    return { year, monthIndex, month: `M${monthIndex + 1}` };
  }
}

function createTestDb() {
  const db = new Dexie('reconciliationTestDb');
  db.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description, businessKey',
    houses: 'name',
    game: 'name',
    objectives: 'name',
    foodTraceability: '++id',
  });
  return db;
}

describe('GetTreasuryJournalReconciliation', () => {
  let testDb;
  let budgetManager;
  let journalManager;
  let accounting;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();

    testDb = createTestDb();
    await testDb.open();

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
    if (testDb?.isOpen()) {
      await testDb.delete();
    }
  });

  test('aligned after initialize (capital only)', async () => {
    await budgetManager.initialize(200);

    const result = await getTreasuryJournalReconciliation();

    expect(result.treasuryFunds).toBe(200);
    expect(result.journalBalance).toBe(200);
    expect(result.delta).toBe(0);
    expect(result.aligned).toBe(true);
  });

  test('aligned after construction expense and refund', async () => {
    await budgetManager.initialize(200);
    await budgetManager.addConstructionExpense(80, 'Building: House');
    await budgetManager.addConstructionRefund(80, 'Refund for failed House');

    const result = await accounting.getTreasuryJournalReconciliation();

    expect(result.treasuryFunds).toBe(200);
    expect(result.journalBalance).toBe(200);
    expect(result.aligned).toBe(true);
  });

  test('aligned after mixed operational entries', async () => {
    await budgetManager.initialize(200);
    await budgetManager.addConstructionExpense(50, 'Building: House');
    await budgetManager.addExportIncome(30, 'Export blé', 'wheat');
    await budgetManager.addImportExpense(10, 'Import blé', 'wheat');
    await budgetManager.addExceptionalExpense(15, 'Réparation');

    const budget = await budgetManager.getCurrentBudget();
    const result = await getTreasuryJournalReconciliation();

    expect(result.treasuryFunds).toBe(budget.funds);
    expect(result.journalBalance).toBe(budget.funds);
    expect(result.aligned).toBe(true);
  });

  test('records balance snapshot via syncTurnInformativeEntries', async () => {
    await budgetManager.initialize(200);
    await budgetManager.updateTurn(3);

    const entries = await journalManager.getJournalEntriesForTurn(3);
    const balance = entries.find((e) => e.type === 'balance');
    expect(balance).toBeDefined();
    expect(balance.amount).toBe(200);
  });

  test('creates year cumul and carry forward once at year boundary', async () => {
    await budgetManager.initialize(200);
    await budgetManager.updateTurn(11);

    await accounting.recordMaintenanceExpense({
      turn: 11,
      amount: 40,
      description: 'Maintenance Décembre',
    });

    await budgetManager.updateTurn(12);

    let entries = await journalManager.getJournalEntries();
    expect(entries.filter((e) => e.type === 'cumul_maintenance')).toHaveLength(1);
    expect(entries.filter((e) => e.type === 'carry_forward')).toHaveLength(1);

    await budgetManager.updateTurn(13);
    entries = await journalManager.getJournalEntries();
    expect(entries.filter((e) => e.type === 'carry_forward')).toHaveLength(1);
  });
});

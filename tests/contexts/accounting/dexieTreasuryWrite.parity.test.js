/**
 * Parity — DexieTreasuryWriteAdapter mutates budget row without BudgetManager.
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DexieTreasuryRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js';
import { DexieTreasuryWriteAdapter } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryWriteAdapter.js';
import { resetAccountingContextForTests } from '../../../src/composition/createAccountingContext.js';
import { JournalManager } from '../../../src/js/stores/JournalManager.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/stores/SessionLedgerBuffer.js';

function createTestDb() {
  const testDb = new Dexie('testDexieTreasuryWrite');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
  });
  return testDb;
}

describe('Accounting — DexieTreasuryWriteAdapter (Phase 4)', () => {
  let testDb;
  let treasuryRepository;
  let treasuryWriteAdapter;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();
    testDb = createTestDb();
    await testDb.open();

    treasuryRepository = new DexieTreasuryRepository({ db: testDb });
    treasuryWriteAdapter = new DexieTreasuryWriteAdapter(treasuryRepository);

    await treasuryRepository.createInitialBudgetRow(500);
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.delete();
    }
  });

  test('applyConstructionDebit reduces funds and increases investments', async () => {
    const budget = await treasuryWriteAdapter.applyConstructionDebit(30, 'Building: House');

    expect(budget.funds).toBe(470);
    expect(budget.totalInvestments).toBe(30);
    expect(budget.expenses).toBe(0);
  });

  test('applySalaryDebit and applyPayrollTaxCredit update aggregates', async () => {
    await treasuryWriteAdapter.applySalaryDebit(100);
    const budget = await treasuryWriteAdapter.applyPayrollTaxCredit(20);

    expect(budget.funds).toBe(420);
    expect(budget.totalSalaries).toBe(100);
    expect(budget.expenses).toBe(100);
    expect(budget.income).toBe(520);
  });

  test('applyConstructionRefundCredit restores funds after building expense', async () => {
    await treasuryWriteAdapter.applyConstructionDebit(30, 'Building: House');
    const budget = await treasuryWriteAdapter.applyConstructionRefundCredit(
      30,
      'Refund for failed House'
    );

    expect(budget.funds).toBe(500);
    expect(budget.totalInvestments).toBe(0);
  });
});

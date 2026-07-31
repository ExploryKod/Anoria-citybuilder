/**
 * Behavior tests — GetIncomeStatement / GetBalanceSheet (Phase 3).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { GetIncomeStatement } from '../../../src/contexts/accounting/application/queries/financial-statements/GetIncomeStatement.js';
import { GetBalanceSheet } from '../../../src/contexts/accounting/application/queries/financial-statements/GetBalanceSheet.js';
import { DexieJournalRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalRepository.js';
import { DexieTreasuryRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js';
import { GetTreasurySnapshot } from '../../../src/contexts/accounting/application/queries/treasury/GetTreasurySnapshot.js';
import { InitializeTreasury } from '../../../src/contexts/accounting/application/commands/treasury/InitializeTreasury.js';
import { TreasuryLoanPortfolio } from '../../../src/contexts/accounting/application/services/TreasuryLoanPortfolio.js';
import { LegacyGameTimePort } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import { RecordCapitalFundsIncome } from '../../../src/contexts/accounting/application/services/RecordCapitalFundsIncome.js';
import { SessionJournalWriteAdapter } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalWriteAdapter.js';
import { RecordLedgerEntry } from '../../../src/contexts/accounting/application/commands/journal/RecordLedgerEntry.js';
import { JournalManager } from '../../../src/js/stores/JournalManager.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/stores/SessionLedgerBuffer.js';

function createTestDb() {
  const testDb = new Dexie('testFinancialStatementsDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
  });
  return testDb;
}

class TestGameTimePort extends LegacyGameTimePort {
  getTimeInfo(turn) {
    const monthIndex = turn % 12;
    return { year: Math.floor(turn / 12), monthIndex, month: `M${monthIndex}` };
  }
}

class FakeCityAssetsPort {
  async getCityBuildingValuation() {
    return { totalValue: 300, pricesByType: { 'House-Blue': 30 } };
  }
}

describe('Accounting — financial statements (Phase 3)', () => {
  let testDb;
  let journalRepository;
  let gameTimePort;
  let getIncomeStatement;
  let getBalanceSheet;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    testDb = createTestDb();
    await testDb.open();

    gameTimePort = new TestGameTimePort({});
    journalRepository = new DexieJournalRepository({ db: testDb, gameTimePort });

    const journalManager = new JournalManager();
    journalManager.db = testDb;
    const journalWritePort = new SessionJournalWriteAdapter(journalManager);
    const recordLedgerEntry = new RecordLedgerEntry(journalWritePort, gameTimePort);
    const recordCapitalFundsIncome = new RecordCapitalFundsIncome(recordLedgerEntry);

    const treasuryRepository = new DexieTreasuryRepository({ db: testDb });
    const initializeTreasury = new InitializeTreasury(
      treasuryRepository,
      journalRepository,
      recordCapitalFundsIncome
    );
    const getTreasurySnapshot = new GetTreasurySnapshot(
      treasuryRepository,
      initializeTreasury
    );
    const treasuryLoanPortfolio = new TreasuryLoanPortfolio(
      treasuryRepository,
      getTreasurySnapshot
    );

    getIncomeStatement = new GetIncomeStatement(journalRepository, gameTimePort);
    getBalanceSheet = new GetBalanceSheet(
      getTreasurySnapshot,
      new FakeCityAssetsPort(),
      treasuryLoanPortfolio
    );

    await initializeTreasury.execute(500);

    const now = new Date().toISOString();
    await testDb.journal.bulkAdd([
      { turn: 12, date: now, type: 'citizen_tax', amount: 200, description: 'Impôt' },
      { turn: 13, date: now, type: 'salary', amount: 100, description: 'Salaires' },
      { turn: 14, date: now, type: 'maintenance', amount: 50, description: 'Maintenance' },
    ]);
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.delete();
    }
  });

  test('GetIncomeStatement aggregates journal by fiscal year', async () => {
    const statement = await getIncomeStatement.execute({ fiscalYear: 1 });

    expect(statement.totalProducts).toBe(200);
    expect(statement.totalCharges).toBe(150);
    expect(statement.netResult).toBe(50);
  });

  test('GetBalanceSheet balances actif and passif', async () => {
    const sheet = await getBalanceSheet.execute();

    expect(sheet.assets.cash).toBe(500);
    expect(sheet.assets.tangibleGross).toBe(300);
    expect(sheet.balanced).toBe(true);
    expect(sheet.assets.total).toBe(sheet.liabilities.total);
  });
});

/**
 * Parity tests — DexieJournalRepository vs JournalManager on the same Dexie data.
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JournalManager } from '../../../src/js/stores/JournalManager.js';
import { SessionJournalRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalRepository.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/stores/SessionLedgerBuffer.js';
import { LegacyGameTimePort } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import { TimeManager } from '../../../src/js/game/utils/TimeManager.js';

function createTestDb() {
  const testDb = new Dexie('testAccountingDexieRepo');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
  });
  return testDb;
}

/** Deterministic calendar: 12 turns per year, monthIndex = turn % 12 */
class TestGameTimePort extends LegacyGameTimePort {
  getTimeInfo(turn) {
    const monthIndex = turn % 12;
    return {
      year: Math.floor(turn / 12),
      monthIndex,
      month: `M${monthIndex}`,
    };
  }
}

describe('Accounting — Dexie persistence adapters (Phase 2a)', () => {
  let testDb;
  let journalManager;
  let sessionJournalRepository;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    testDb = createTestDb();
    await testDb.open();

    const timeManager = {
      getTimeInfo(turn) {
        const monthIndex = turn % 12;
        return {
          year: Math.floor(turn / 12),
          monthIndex,
          month: `M${monthIndex}`,
        };
      },
    };
    global.TimeManager = timeManager;

    journalManager = new JournalManager();
    journalManager.db = testDb;

    sessionJournalRepository = new SessionJournalRepository({
      journalManager,
      gameTimePort: new TestGameTimePort(timeManager),
    });
  });

  afterEach(async () => {
    delete global.TimeManager;
    if (testDb) {
      await testDb.delete();
    }
  });

  describe('SessionJournalRepository', () => {
    test('getJournalEntries matches JournalManager sort order', async () => {
      await journalManager.addJournalEntry(1, 'citizen_tax', 100, 'T1');
      await journalManager.addJournalEntry(3, 'maintenance', 50, 'T3');
      await journalManager.addJournalEntry(2, 'citizen_tax', 200, 'T2');

      const legacyEntries = await journalManager.getJournalEntries();
      const sessionEntries = await sessionJournalRepository.getJournalEntries();

      expect(sessionEntries.map((e) => e.turn)).toEqual(
        legacyEntries.map((e) => e.turn)
      );
    });

    test('getYearlyFinancialSummary matches JournalManager aggregations', async () => {
      await journalManager.addJournalEntry(0, 'capital_funds', 200, 'Capital');
      await journalManager.addJournalEntry(1, 'citizen_tax', 100, 'Taxes');
      await journalManager.addJournalEntry(2, 'construction', 40, 'Build');
      await journalManager.addJournalEntry(3, 'export_wheat', 15, 'Export');
      await journalManager.addJournalEntry(4, 'import_wheat', 5, 'Import');

      const legacyYearly = await journalManager.getYearlyFinancialSummary();
      const sessionYearly =
        await sessionJournalRepository.getYearlyFinancialSummary();

      expect(sessionYearly).toEqual(legacyYearly);
    });

    test('getCurrentBalance matches JournalManager', async () => {
      await journalManager.addJournalEntry(0, 'capital_funds', 200, 'Capital');
      await journalManager.addJournalEntry(1, 'citizen_tax', 100, 'Taxes');
      await journalManager.addJournalEntry(2, 'maintenance', 30, 'Maint');

      const legacyBalance = await journalManager.getCurrentBalance();
      const sessionBalance = await sessionJournalRepository.getCurrentBalance();

      expect(sessionBalance).toBe(legacyBalance);
    });
  });

  describe('DexieTreasuryRepository', () => {
    test('reads budget_current.funds', async () => {
      const { DexieTreasuryRepository } = await import(
        '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js'
      );

      await testDb.budget.put({
        name: 'budget_current',
        funds: 1234,
        turn: 5,
      });

      const repo = new DexieTreasuryRepository({ db: testDb });
      expect(await repo.getTreasuryBalance()).toBe(1234);
    });
  });
});

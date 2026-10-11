/**
 * Behavior tests — journal flush + JSON export (Phase 6.4).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { FlushJournalSession } from '../../../src/contexts/accounting/application/commands/journal/FlushJournalSession.js';
import { ExportJournalJson } from '../../../src/contexts/accounting/application/queries/journal/ExportJournalJson.js';
import { DexieJournalSessionPersistenceAdapter } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalSessionPersistenceAdapter.js';
import { SessionJournalRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalRepository.js';
import { LegacyGameTimePort } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import { TimeManager } from '../../../src/shared/time/TimeManager.js';
import { JournalManager } from '../../../src/composition/accountingSessionJournal.js';
import {
  buildJournalExportPayload,
} from '../../../src/contexts/accounting/presentation/JournalExportViewModel.js';
import { resetSessionLedgerBufferForTests } from '../../../src/composition/accountingSessionJournal.js';

function createTestDb() {
  const testDb = new Dexie('testJournalFlushExportDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
  });
  return testDb;
}

describe('Accounting — journal flush & export (Phase 6.4)', () => {
  let testDb;
  let journalManager;
  let gameTimePort;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    testDb = createTestDb();
    await testDb.open();

    journalManager = new JournalManager();
    journalManager.db = testDb;
    journalManager._sessionPersistence = null;

    gameTimePort = new LegacyGameTimePort(TimeManager);
  });

  afterEach(async () => {
    await testDb.delete();
    await testDb.close();
  });

  test('FlushJournalSession persists pending buffer rows to Dexie', async () => {
    await journalManager.addJournalEntry(1, 'citizen_tax', 50, 'Tax test');

    const flush = new FlushJournalSession(new DexieJournalSessionPersistenceAdapter(testDb));
    const result = await flush.execute();

    // Money lines are written on record (write-through): nothing is left pending to flush.
    expect(result.failed).toBe(false);
    expect(result.flushed).toBe(0);

    const rows = await testDb.journal.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('citizen_tax');
  });

  test('ExportJournalJson returns structured JSON via BC query', async () => {
    await journalManager.addJournalEntry(2, 'maintenance', 10, 'Maint test');
    await journalManager.flushSessionToDexie();

    const journalRepository = new SessionJournalRepository({
      journalManager,
      gameTimePort,
    });
    const exportJson = new ExportJournalJson(journalRepository);

    const jsonString = await exportJson.execute();
    const parsed = JSON.parse(jsonString);

    expect(parsed.entries.length).toBeGreaterThanOrEqual(1);
    expect(parsed.yearlySummary).toBeTruthy();
  });

  test('ExportJournalJson splits the journal in two files: the hamlet\'s own account, and the private flux of the companies and houses', async () => {
    const entries = [
      { id: 1, turn: 1, type: 'maintenance', amount: 10, description: 'city line', year: 0, month: 1 },
      { id: 2, turn: 1, type: 'import_coal', amount: 16.2, description: 'merchants line', year: 0, month: 1, accountBuildingId: 'house-1', accountKind: 'entreprise' },
      { id: 3, turn: 1, type: 'service_purchase', amount: 2, description: 'house line', year: 0, month: 1, accountBuildingId: 'house-1', accountKind: 'particulier' },
    ];
    const repository = {
      getJournalEntries: async () => entries,
      getYearlyFinancialSummary: async () => [{ year: 0, income: { total: 0 }, expenses: { total: 10 }, netFlow: -10, monthCount: 1 }],
    };
    const exportJson = new ExportJournalJson(repository);

    const city = JSON.parse(await exportJson.execute({ accountScope: 'city' }));
    const privateFlux = JSON.parse(await exportJson.execute({ accountScope: 'private' }));
    const all = JSON.parse(await exportJson.execute());

    expect(city.entries.map((e) => e.id)).toEqual([1]);
    expect(city.yearlySummary).toHaveLength(1); // the yearly summary is the city's figure
    expect(privateFlux.entries.map((e) => e.id)).toEqual([2, 3]);
    expect(privateFlux.yearlySummary).toEqual([]); // so a private export carries none
    expect(all.entries).toHaveLength(3);
    await expect(exportJson.execute({ accountScope: 'nobody' })).rejects.toThrow(/unknown export scope/);
  });

  test('buildJournalExportPayload maps entry fields', () => {
    const payload = buildJournalExportPayload({
      entries: [{ id: 1, turn: 0, date: '2026-01-01', type: 'citizen_tax', amount: 5, description: 'x' }],
      yearlySummary: [{ year: 0, income: { total: 5 }, expenses: { total: 0 }, netFlow: 5, monthCount: 1 }],
    });

    expect(payload.entries[0].type).toBe('citizen_tax');
    expect(payload.yearlySummary[0].income).toBe(5);
  });

});

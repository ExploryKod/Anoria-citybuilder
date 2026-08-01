/**
 * Behavior tests — journal flush + JSON export (Phase 6.4).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { FlushJournalSession } from '../../../src/contexts/accounting/application/commands/journal/FlushJournalSession.js';
import { ExportJournalJson } from '../../../src/contexts/accounting/application/queries/journal/ExportJournalJson.js';
import { DexieJournalSessionPersistenceAdapter } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalSessionPersistenceAdapter.js';
import { SessionJournalRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalRepository.js';
import { LegacyYearEndBalanceAdapter } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyYearEndBalanceAdapter.js';
import { LegacyGameTimePort } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import { TimeManager } from '../../../src/js/game/utils/TimeManager.js';
import { JournalManager } from '../../../src/js/acl/accountingSessionJournal.js';
import {
  buildJournalExportPayload,
} from '../../../src/contexts/accounting/presentation/JournalExportViewModel.js';
import { filterJournalEntriesForPdfExport } from '../../../src/contexts/accounting/domain/policies/JournalExportFilterPolicy.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/acl/accountingSessionJournal.js';

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

    expect(result.failed).toBe(false);
    expect(result.flushed).toBe(1);

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
    const exportJson = new ExportJournalJson(
      journalRepository,
      new LegacyYearEndBalanceAdapter()
    );

    const jsonString = await exportJson.execute();
    const parsed = JSON.parse(jsonString);

    expect(parsed.entries.length).toBeGreaterThanOrEqual(1);
    expect(parsed.yearlySummary).toBeTruthy();
    expect(Array.isArray(parsed.yearEndBalances)).toBe(true);
  });

  test('buildJournalExportPayload maps entry fields', () => {
    const payload = buildJournalExportPayload({
      entries: [{ id: 1, turn: 0, date: '2026-01-01', type: 'citizen_tax', amount: 5, description: 'x' }],
      yearlySummary: [{ year: 0, income: { total: 5 }, expenses: { total: 0 }, netFlow: 5, monthCount: 1 }],
      yearEndBalances: [],
    });

    expect(payload.entries[0].type).toBe('citizen_tax');
    expect(payload.yearlySummary[0].income).toBe(5);
  });

  test('filterJournalEntriesForPdfExport excludes informative cumul rows', () => {
    const filtered = filterJournalEntriesForPdfExport([
      { type: 'citizen_tax' },
      { type: 'cumul_maintenance' },
      { type: 'balance' },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('citizen_tax');
  });
});

/**
 * Treasury init — put + ensure-only must not throw under concurrent GetTreasurySnapshot.
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { resetAccountingContextForTests } from '../../../src/composition/createAccountingContext.js';
import sessionJournalStore, { resetSessionLedgerBufferForTests } from '../../../src/composition/accountingSessionJournal.js';
import {
  forceReinitializeTreasury,
  getTreasurySnapshot,
} from '../../../src/composition/accountingOps.js';

describe('Treasury initialization races', () => {
  beforeEach(async () => {
    resetAccountingContextForTests();
    resetSessionLedgerBufferForTests();
    await db.open();
    await db.budget.clear();
    await db.journal.clear();
  });

  test('concurrent getTreasurySnapshot with empty budget does not throw', async () => {
    const results = await Promise.all([
      getTreasurySnapshot(),
      getTreasurySnapshot(),
      getTreasurySnapshot(),
    ]);

    expect(results.every((r) => r && typeof r.funds === 'number')).toBe(true);
    const capitals = (await sessionJournalStore.getJournalEntries()).filter((entry) => entry.type === 'capital_funds');
    expect(capitals).toHaveLength(1);
  });

  test('forceReinitialize then concurrent snapshots stay stable', async () => {
    await forceReinitializeTreasury(5000);
    const results = await Promise.all([
      getTreasurySnapshot(),
      getTreasurySnapshot(),
    ]);
    expect(results[0].funds).toBe(results[1].funds);
    expect(results[0].funds).toBe(5000);
  });
});

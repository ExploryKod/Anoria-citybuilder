/**
 * A day that failed is told in the books (an informative line), once per turn, and it moves no money.
 */
import { test, expect } from '@jest/globals';
import sessionJournalStore, { resetSessionLedgerBufferForTests } from '../../../src/composition/accountingSessionJournal.js';
import { getTreasurySnapshot, resetAccountingContextForTests } from '../../../src/composition/accountingOps.js';
import { getOrCreateAccountingContext } from '../../../src/composition/createAccountingContext.js';
import { useGameTurnForTests } from '../../../src/composition/sessionRuntime.js';
import { isEcriture } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

test('a failed day is written once as an informative line and the treasury does not move', async () => {
  resetSessionLedgerBufferForTests();
  resetAccountingContextForTests();
  const accounting = getOrCreateAccountingContext({});
  await sessionJournalStore.addJournalEntry(0, 'capital_funds', 500, 'Capital', null, { businessKey: 'capital_funds:0' });
  useGameTurnForTests(7);
  const fundsBefore = (await getTreasurySnapshot()).funds;

  await accounting.recordDayFailure({ turn: 7, message: 'boom' });
  await accounting.recordDayFailure({ turn: 7, message: 'boom again' });

  const lines = (await sessionJournalStore.getJournalEntries()).filter((entry) => entry.type === 'info_day_failed');
  expect(lines).toHaveLength(1);
  expect(lines[0].description).toContain('boom');
  expect(isEcriture(lines[0].type)).toBe(false);
  expect((await getTreasurySnapshot()).funds).toBe(fundsBefore);
});

test('a purge folds the failure line into its year and the treasury does not move', async () => {
  resetSessionLedgerBufferForTests();
  resetAccountingContextForTests();
  const accounting = getOrCreateAccountingContext({});
  await sessionJournalStore.addJournalEntry(0, 'capital_funds', 500, 'Capital', null, { businessKey: 'capital_funds:0' });
  for (let year = 0; year < 8; year += 1) {
    await sessionJournalStore.addJournalEntry(year * 12 + 3, 'payroll_tax', 100, 'impôt');
  }
  useGameTurnForTests(4);
  await accounting.recordDayFailure({ turn: 4, message: 'boom' });
  useGameTurnForTests(8 * 12);
  const fundsBefore = (await getTreasurySnapshot()).funds;

  const result = await sessionJournalStore.cleanupOldJournalYears(5);

  expect(result.closed).toBeGreaterThan(0);
  expect((await getTreasurySnapshot()).funds).toBe(fundsBefore);
});

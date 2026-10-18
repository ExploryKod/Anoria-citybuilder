import { describe, expect, test } from '@jest/globals';
import { GetGeneralLedger } from '../../../src/contexts/accounting/application/queries/journal/GetGeneralLedger.js';

const ENTRIES = [
  { id: 1, hamletId: 'hamlet-a', turn: 3, date: '2026-01-03', type: 'citizen_tax', amount: 10, description: 'A' },
  { id: 2, hamletId: 'hamlet-b', turn: 3, date: '2026-01-03', type: 'citizen_tax', amount: 20, description: 'B' },
];

function ledgerQuery() {
  return new GetGeneralLedger(
    { getJournalEntries: async () => ENTRIES, getCurrentBalance: async () => 0 },
    { execute: async () => ({ funds: 0 }) },
    { getTimeInfo: () => ({ year: 2026 }), currentTurn: () => 3 }
  );
}

function entryIds(view) {
  return view.years.flatMap((year) => year.months.flatMap((month) => month.entries.map((entry) => entry.id)));
}

describe('GetGeneralLedger hamlet filter', () => {
  test('without a hamlet, every hamlet entry is listed', async () => {
    const view = await ledgerQuery().execute({ hamletId: null });

    expect(entryIds(view).sort()).toEqual([1, 2]);
  });

  test('with a hamlet, only that hamlet entries are listed and counted', async () => {
    const view = await ledgerQuery().execute({ hamletId: 'hamlet-a' });

    expect(entryIds(view)).toEqual([1]);
  });
});

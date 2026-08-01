import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TimeManager } from '../../../src/js/game/utils/TimeManager.js';
import {
  filterAndSortJournalEntries,
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
} from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/journalAggregations.js';
import {
  compareJournalEntriesInMonth,
  orderGeneralLedgerEntries,
} from '../../../src/contexts/accounting/domain/policies/GeneralLedgerPresentationPolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleLedgerPath = path.resolve(
  __dirname,
  '../../../docs/ledgers/journal-2026-07-30 (1).json'
);

describe('GeneralLedgerPresentationPolicy', () => {
  test('compareJournalEntriesInMonth sorts by turn then id', () => {
    expect(
      compareJournalEntriesInMonth(
        { type: 'capital_funds', turn: 0, id: 1, date: '2026-01-01' },
        { type: 'construction', turn: 1, id: 2, date: '2026-01-02' }
      )
    ).toBeLessThan(0);
    expect(
      compareJournalEntriesInMonth(
        { type: 'construction', turn: 1, id: 2, date: '2026-01-02' },
        { type: 'construction', turn: 1, id: 3, date: '2026-01-03' }
      )
    ).toBeLessThan(0);
  });

  test('orderGeneralLedgerEntries interleaves income and expenses chronologically', () => {
    const ordered = orderGeneralLedgerEntries(
      [{ type: 'capital_funds', turn: 0, id: 1, date: '2026-01-01' }],
      [
        { type: 'maintenance', turn: 2, id: 4, date: '2026-01-04' },
        { type: 'construction', turn: 1, id: 3, date: '2026-01-03' },
        { type: 'construction', turn: 1, id: 2, date: '2026-01-02' },
      ]
    );

    expect(ordered.map((entry) => entry.id)).toEqual([1, 2, 3, 4]);
  });

  test('year months are chronological so game start appears first in year block', () => {
    const raw = JSON.parse(fs.readFileSync(sampleLedgerPath, 'utf8'));
    const entries = filterAndSortJournalEntries(raw.entries);
    const getTimeInfo = (turn) => TimeManager.getTimeInfo(turn, 5);
    const monthly = buildMonthlyFinancialSummary(entries, getTimeInfo);
    const yearly = buildYearlyFinancialSummary(monthly);
    const year0 = yearly.find((year) => year.year === 0);

    expect(year0.months[0].monthName).toBe('Janvier');
    expect(year0.months.at(-1).monthName).toBe('Août');

    const january = year0.months[0];
    const ordered = orderGeneralLedgerEntries(
      january.income.entries,
      january.expenses.entries
    );

    expect(ordered[0].id).toBe(1);
    expect(ordered[0].type).toBe('capital_funds');
    expect(ordered.map((entry) => entry.id)).toEqual([1, 2, 3, 4]);
  });
});

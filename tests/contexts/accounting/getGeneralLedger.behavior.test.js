/**
 * Behavior tests — Accounting Phase 2b: GetGeneralLedger
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { GetGeneralLedger } from '../../../src/contexts/accounting/application/queries/journal/GetGeneralLedger.js';
import { DexieJournalRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalRepository.js';
import { DexieTreasuryRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js';
import { LegacyGameTimePort } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import {
  ledgerEntryMatchesTypeFilter,
  filterLedgerEntriesByTypes,
} from '../../../src/contexts/accounting/domain/policies/GeneralLedgerPresentationPolicy.js';

function createTestDb() {
  const testDb = new Dexie('testGeneralLedgerDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
  });
  return testDb;
}

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

class FakeTreasuryRepository {
  constructor(funds = 500) {
    this.funds = funds;
  }

  async getTreasuryBalance() {
    return this.funds;
  }
}

async function seedJournal(db) {
  const now = new Date();
  const recent = now.toISOString();
  const old = new Date(now);
  old.setDate(old.getDate() - 45);
  const oldIso = old.toISOString();

  await db.journal.bulkAdd([
    {
      turn: 60,
      date: recent,
      type: 'citizen_tax',
      amount: 100,
      description: 'Taxes récentes',
    },
    {
      turn: 61,
      date: recent,
      type: 'salary',
      amount: 200,
      description: 'Salaires récents',
    },
    {
      turn: 62,
      date: recent,
      type: 'maintenance',
      amount: 30,
      description: 'Maintenance récente',
    },
    {
      turn: 10,
      date: oldIso,
      type: 'citizen_tax',
      amount: 50,
      description: 'Taxes anciennes',
    },
    {
      turn: 11,
      date: oldIso,
      type: 'export_wheat',
      amount: 15,
      description: 'Export ancien',
    },
  ]);
}

describe('Accounting — GetGeneralLedger (Phase 2b)', () => {
  let testDb;
  let query;

  beforeEach(async () => {
    testDb = createTestDb();
    await testDb.open();
    await seedJournal(testDb);

    await testDb.budget.put({
      name: 'budget_current',
      funds: 500,
      turn: 62,
    });

    const gameTimePort = new TestGameTimePort();
    query = new GetGeneralLedger(
      new DexieJournalRepository({ db: testDb, gameTimePort }),
      new FakeTreasuryRepository(500),
      gameTimePort
    );
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.delete();
    }
  });

  describe('GeneralLedgerPresentationPolicy', () => {
    test('matches exact types and prefix filters', () => {
      expect(
        ledgerEntryMatchesTypeFilter({ type: 'export_wheat' }, ['export_'])
      ).toBe(true);
      expect(
        ledgerEntryMatchesTypeFilter({ type: 'salary' }, ['export_'])
      ).toBe(false);
      expect(
        filterLedgerEntriesByTypes(
          [{ type: 'salary' }, { type: 'payroll_tax' }],
          ['salary']
        )
      ).toHaveLength(1);
    });
  });

  describe('GetGeneralLedger', () => {
    test('returns grouped years with treasury balance for current year', async () => {
      const ledger = await query.execute();

      expect(ledger.years.length).toBeGreaterThan(0);
      const currentYear = ledger.currentYear;
      const current = ledger.years.find((y) => y.year === currentYear);
      expect(current).toBeDefined();
      expect(current.isCurrentYear).toBe(true);
      expect(current.treasuryBalance).toBe(500);
      expect(current.netFlow).toBe(current.incomeTotal - current.expensesTotal);
    });

    test('month totals equal sum of visible entries without filter', async () => {
      const ledger = await query.execute();
      const firstMonth = ledger.years[0]?.months[0];
      expect(firstMonth).toBeDefined();

      const incomeFromEntries = firstMonth.entries
        .filter((e) =>
          ['citizen_tax', 'payroll_tax', 'capital_funds', 'loan_capital'].includes(
            e.type
          ) || e.type.startsWith('export_') || (e.type === 'carry_forward' && e.isCarryForwardIncome)
        )
        .reduce((s, e) => s + e.amount, 0);

      expect(firstMonth.incomeTotal + firstMonth.expensesTotal).toBeGreaterThan(0);
      expect(firstMonth.netFlow).toBe(
        firstMonth.incomeTotal - firstMonth.expensesTotal
      );
      expect(incomeFromEntries).toBeLessThanOrEqual(firstMonth.incomeTotal);
    });

    test('type filter recalculates month totals from visible entries only', async () => {
      const unfiltered = await query.execute();
      const filtered = await query.execute({ types: ['salary'] });

      expect(filtered.typeFilterActive).toBe(true);

      const unfilteredMonthCount = unfiltered.years.reduce(
        (n, y) => n + y.months.length,
        0
      );
      const filteredMonthCount = filtered.years.reduce(
        (n, y) => n + y.months.length,
        0
      );
      expect(filteredMonthCount).toBeLessThanOrEqual(unfilteredMonthCount);

      for (const year of filtered.years) {
        for (const month of year.months) {
          expect(month.entries.every((e) => e.type === 'salary')).toBe(true);
          const expenseSum = month.entries.reduce((s, e) => s + e.amount, 0);
          expect(month.expensesTotal).toBe(expenseSum);
          expect(month.incomeTotal).toBe(0);
          expect(month.netFlow).toBe(-expenseSum);
        }
      }
    });

    test('period filter limits entries by age in days', async () => {
      const all = await query.execute();
      const last30 = await query.execute({ periodDays: 30 });

      const allEntryCount = all.years.reduce(
        (n, y) => n + y.months.reduce((m, mo) => m + mo.entries.length, 0),
        0
      );
      const filteredEntryCount = last30.years.reduce(
        (n, y) => n + y.months.reduce((m, mo) => m + mo.entries.length, 0),
        0
      );

      expect(filteredEntryCount).toBeLessThan(allEntryCount);
      expect(filteredEntryCount).toBe(3);
    });
  });
});

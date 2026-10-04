/**
 * Behavior tests — Accounting Phase 1: city ledger comparison
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { cityLedgerYearLinesFromJournalSummary } from '../../../src/contexts/accounting/domain/policies/CityLedgerLineMappingPolicy.js';
import {
  financialStatusMessageForCityLedger,
} from '../../../src/contexts/accounting/domain/policies/CityLedgerFinancialStatusPolicy.js';
import { createEmptyCityLedgerYearLines } from '../../../src/contexts/accounting/domain/value-objects/CityLedgerYearLines.js';
import { GetCityLedgerYearComparison } from '../../../src/contexts/accounting/application/queries/city-ledger/GetCityLedgerYearComparison.js';
import { GetTreasuryBalance } from '../../../src/contexts/accounting/application/queries/treasury/GetTreasuryBalance.js';
import { createAccountingContext } from '../../../src/composition/createAccountingContext.js';
import { resetAccountingContextForTests } from '../../../src/composition/accountingOps.js';

class FakeJournalRepository {
  constructor({ entries = [], yearlyData = [], currentBalance = 0 } = {}) {
    this.entries = entries;
    this.yearlyData = yearlyData;
    this.currentBalance = currentBalance;
  }

  async getJournalEntries() {
    return this.entries;
  }

  async getYearlyFinancialSummary() {
    return this.yearlyData;
  }

}

class FakeTreasuryRepository {
  constructor(funds = 0) {
    this.funds = funds;
  }

  async getTreasuryBalance() {
    return this.funds;
  }
}

/** The readers take the derived treasury snapshot; a fake treasury is exposed through it. */
function snapshotOf(treasury) {
  return { execute: async () => ({ funds: await treasury.getTreasuryBalance() }) };
}

class FakeGameTimePort {
  constructor(year = 0) {
    this.year = year;
  }

  getTimeInfo(_turn) {
    return { year: this.year };
  }
}

function yearSummary(year, incomeEntries, expenseEntries, netFlow = 0) {
  const incomeTotal = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const expenseTotal = expenseEntries.reduce((s, e) => s + e.amount, 0);
  return {
    year,
    netFlow,
    income: { total: incomeTotal, entries: incomeEntries },
    expenses: { total: expenseTotal, entries: expenseEntries },
  };
}

describe('Accounting — city ledger (Phase 1)', () => {
  beforeEach(() => {
    resetAccountingContextForTests();
  });

  describe('CityLedgerLineMappingPolicy', () => {
    test('aggregates journal types into city-ledger year lines', () => {
      const summary = yearSummary(
        1,
        [
          { type: 'capital_funds', amount: 200 },
          { type: 'citizen_tax', amount: 50 },
          { type: 'export_wheat', amount: 15 },
        ],
        [
          { type: 'construction', amount: 30 },
          { type: 'import_carrot', amount: 5 },
          { type: 'maintenance', amount: 10 },
        ]
      );

      const lines = cityLedgerYearLinesFromJournalSummary(summary, 220);

      expect(lines.initialFunds).toBe(200);
      expect(lines.incomeTax).toBe(50);
      expect(lines.exports).toBe(15);
      expect(lines.totalIncome).toBe(265);
      expect(lines.construction).toBe(30);
      expect(lines.imports).toBe(5);
      expect(lines.maintenance).toBe(10);
      expect(lines.totalExpenses).toBe(45);
      expect(lines.balance).toBe(220);
    });

    test('aggregates unemployment benefits into city-ledger year lines', () => {
      const summary = yearSummary(
        1,
        [{ type: 'citizen_tax', amount: 50 }],
        [
          { type: 'salary', amount: 100 },
          { type: 'unemployment_benefit', amount: 40 },
        ]
      );

      const lines = cityLedgerYearLinesFromJournalSummary(summary, 10);

      expect(lines.salary).toBe(100);
      expect(lines.unemploymentBenefit).toBe(40);
      expect(lines.totalExpenses).toBe(140);
    });
  });

  describe('CityLedgerFinancialStatusPolicy', () => {
    test('financial status message from year line balances', () => {
      const thisYear = { ...createEmptyCityLedgerYearLines(1), balance: 100 };
      const lastYear = { ...createEmptyCityLedgerYearLines(0), balance: 50 };

      expect(financialStatusMessageForCityLedger(thisYear, lastYear).type).toBe(
        'success'
      );
    });
  });

  describe('GetCityLedgerYearComparison', () => {
    test('assembles CityLedgerComparison from ports', async () => {
      const journal = new FakeJournalRepository({
        entries: [{ turn: 42, type: 'citizen_tax', amount: 10 }],
        yearlyData: [
          yearSummary(2, [{ type: 'citizen_tax', amount: 25 }], [], 25),
        ],
      });
      const treasury = new FakeTreasuryRepository(500);
      const time = new FakeGameTimePort(2);

      const query = new GetCityLedgerYearComparison(journal, snapshotOf(treasury), time);
      const result = await query.execute();

      expect(result.thisYear.balance).toBe(500);
      expect(result.thisYear.incomeTax).toBe(25);
      expect(result.debt).toBe(0);
    });

    test('debt on comparison when treasury is negative', async () => {
      const journal = new FakeJournalRepository({ entries: [{ turn: 1 }] });
      const query = new GetCityLedgerYearComparison(
        journal,
        snapshotOf(new FakeTreasuryRepository(-50)),
        new FakeGameTimePort(0)
      );
      const result = await query.execute();

      expect(result.debt).toBe(50);
    });
  });

  describe('GetCityLedgerYearComparison — hamlet scope', () => {
    const entry = (hamletId, type, amount) => ({ hamletId, type, amount, turn: 1 });

    function journalOfTwoHamlets() {
      const all = [
        entry('h1', 'citizen_tax', 100),
        entry('h1', 'construction', 30),
        entry('h2', 'citizen_tax', 40),
        entry('h2', 'maintenance', 10),
      ];
      return {
        getJournalEntries: async () => all,
        getYearlyFinancialSummary: async ({ hamletId = null } = {}) => {
          const mine = hamletId ? all.filter((e) => e.hamletId === hamletId) : all;
          const income = mine.filter((e) => e.type === 'citizen_tax');
          const expenses = mine.filter((e) => e.type !== 'citizen_tax');
          return [
            yearSummary(
              0,
              income,
              expenses,
              income.reduce((s, e) => s + e.amount, 0) - expenses.reduce((s, e) => s + e.amount, 0)
            ),
          ];
        },
      };
    }

    /** The treasury snapshot over the same lines: the balance of the scope it is asked for. */
    function snapshotOfLines(all) {
      return {
        execute: async ({ hamletId = null } = {}) => ({
          funds: (hamletId ? all.filter((e) => e.hamletId === hamletId) : all).reduce(
            (s, e) => s + (e.type === 'citizen_tax' ? e.amount : -e.amount),
            0
          ),
        }),
      };
    }

    test('each hamlet shows only its own journal lines and balance; hamlets add up to the whole city', async () => {
      const journal = journalOfTwoHamlets();
      const query = new GetCityLedgerYearComparison(
        journal,
        snapshotOfLines(await journal.getJournalEntries()),
        new FakeGameTimePort(0)
      );

      const h1 = await query.execute({ hamletId: 'h1' });
      const h2 = await query.execute({ hamletId: 'h2' });
      const city = await query.execute();

      expect(h1.thisYear.incomeTax).toBe(100);
      expect(h1.thisYear.construction).toBe(30);
      expect(h1.thisYear.balance).toBe(70);
      expect(h2.thisYear.incomeTax).toBe(40);
      expect(h2.thisYear.maintenance).toBe(10);
      expect(h2.thisYear.balance).toBe(30);

      for (const field of ['incomeTax', 'construction', 'maintenance', 'totalIncome', 'totalExpenses', 'netFlow']) {
        expect(h1.thisYear[field] + h2.thisYear[field]).toBe(city.thisYear[field]);
      }
      expect(h1.thisYear.balance + h2.thisYear.balance).toBe(city.thisYear.balance);
    });
  });

  describe('GetTreasuryBalance', () => {
    test('returns funds from treasury port', async () => {
      const query = new GetTreasuryBalance(snapshotOf(new FakeTreasuryRepository(1234)));
      expect(await query.execute()).toBe(1234);
    });
  });
});

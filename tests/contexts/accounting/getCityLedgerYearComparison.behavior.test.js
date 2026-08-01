/**
 * Behavior tests — Accounting Phase 1: city ledger comparison
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { cityLedgerYearLinesFromJournalSummary } from '../../../src/contexts/accounting/domain/policies/CityLedgerLineMappingPolicy.js';
import {
  cityLedgerBalanceForYear,
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

  async getCurrentBalance() {
    return this.currentBalance;
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
  });

  describe('CityLedgerFinancialStatusPolicy', () => {
    test('treasury balance for current year, netFlow for past years', () => {
      const past = yearSummary(0, [{ type: 'citizen_tax', amount: 100 }], [], 60);

      expect(cityLedgerBalanceForYear(past, 350, false)).toBe(60);
      expect(cityLedgerBalanceForYear(past, 350, true)).toBe(350);
    });

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

      const query = new GetCityLedgerYearComparison(journal, treasury, time);
      const result = await query.execute();

      expect(result.thisYear.balance).toBe(500);
      expect(result.thisYear.incomeTax).toBe(25);
      expect(result.debt).toBe(0);
    });

    test('debt on comparison when treasury is negative', async () => {
      const journal = new FakeJournalRepository({ entries: [{ turn: 1 }] });
      const query = new GetCityLedgerYearComparison(
        journal,
        new FakeTreasuryRepository(-50),
        new FakeGameTimePort(0)
      );
      const result = await query.execute();

      expect(result.debt).toBe(50);
    });
  });

  describe('GetTreasuryBalance', () => {
    test('returns funds from treasury port', async () => {
      const query = new GetTreasuryBalance(new FakeTreasuryRepository(1234));
      expect(await query.execute()).toBe(1234);
    });
  });

  describe('createAccountingContext with fakes', () => {
    test('wires injected ports for tests', async () => {
      const ctx = createAccountingContext({
        journalRepository: new FakeJournalRepository({
          entries: [{ turn: 1 }],
          yearlyData: [yearSummary(0, [{ type: 'capital_funds', amount: 200 }], [])],
        }),
        treasuryRepository: new FakeTreasuryRepository(200),
        gameTimePort: new FakeGameTimePort(0),
      });

      expect(await ctx.getTreasuryBalance()).toBe(200);
      const comparison = await ctx.getCityLedgerYearComparison();
      expect(comparison.thisYear.initialFunds).toBe(200);
      expect(comparison.thisYear.balance).toBe(200);
    });
  });
});

/**
 * Behavior tests — the city ledger (livret) is read from the fold of the journal's legs: the money that moved the city's cash in a year, by M57 account.
 */

import { describe, test, expect } from '@jest/globals';
import { cityLedgerYearLinesFromCashFlows } from '../../../src/contexts/accounting/domain/policies/CityLedgerLineMappingPolicy.js';
import { financialStatusMessageForCityLedger } from '../../../src/contexts/accounting/domain/policies/CityLedgerFinancialStatusPolicy.js';
import { createEmptyCityLedgerYearLines } from '../../../src/contexts/accounting/domain/value-objects/CityLedgerYearLines.js';
import { GetCityLedgerYearComparison } from '../../../src/contexts/accounting/application/queries/city-ledger/GetCityLedgerYearComparison.js';
import { GetTreasuryBalance } from '../../../src/contexts/accounting/application/queries/treasury/GetTreasuryBalance.js';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { booked } from '../../helpers/booked.js';

/** What moved the city's cash, by account, in centimes: the shape the fold gives. */
const flowsOf = (flows) => new Map(Object.entries(flows));

const line = (hamletId, year, type, amount) => booked({ hamletId, year, month: 1, turn: year * 12, type, amount, accountBuildingId: null });

/** The ports over a fold built from journal lines: the repository gives the fold, the treasury the cash of the same scope. */
function portsOf(lines, currentYear) {
  const fold = new LegsFold();
  for (const entry of lines) fold.add(entry);
  return {
    journal: { getLegsFold: async () => fold },
    treasury: {
      cashOf: async ({ hamletId = null, untilYear = null } = {}) => fold.balanceOf('512', { hamletId, accountKey: null, untilYear }) / 100,
    },
    time: { getTimeInfo: () => ({ year: currentYear }), currentTurn: () => currentYear * 12 },
  };
}

describe('Accounting — city ledger', () => {
  describe('CityLedgerLineMappingPolicy', () => {
    test('aggregates what moved the city\'s cash, by M57 account, into the lines of the ledger', () => {
      const flows = flowsOf({
        1021: { in: 20000, out: 0 },
        73111: { in: 5000, out: 0 },
        7348: { in: 1500, out: 0 },
        2131: { in: 0, out: 3000 },
        607: { in: 0, out: 500 },
        6156: { in: 0, out: 1000 },
      });

      const lines = cityLedgerYearLinesFromCashFlows(1, flows, { balanceForYear: 220, previousNetFlow: 0 });

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

    test('the unemployment benefit is paid out of what the city holds for the social body, and the contributions are what comes in on it', () => {
      const flows = flowsOf({ 73111: { in: 5000, out: 0 }, 6411: { in: 0, out: 10000 }, 431: { in: 2000, out: 4000 } });

      const lines = cityLedgerYearLinesFromCashFlows(1, flows, { balanceForYear: 10, previousNetFlow: 0 });

      expect(lines.salary).toBe(100);
      expect(lines.socialContributions).toBe(20);
      expect(lines.unemploymentBenefit).toBe(40);
      expect(lines.totalExpenses).toBe(140);
    });

    // Regression: the city giving back an income-tax advance leaves its treasury; the ledger shows it as a smaller income tax, so its totals agree with the treasury.
    test('an income tax refund reduces the income tax line, and a construction refund the constructions, so the ledger agrees with the treasury', () => {
      const flows = flowsOf({ 738: { in: 10000, out: 0 }, 7398: { in: 0, out: 2000 }, 2131: { in: 500, out: 3000 } });

      const lines = cityLedgerYearLinesFromCashFlows(1, flows, { balanceForYear: 80, previousNetFlow: 0 });

      expect(lines.payrollTax).toBe(80);
      expect(lines.totalIncome).toBe(80);
      expect(lines.construction).toBe(25);
    });

    test('money that moved against an account no line of the ledger takes is an error, never left out', () => {
      expect(() => cityLedgerYearLinesFromCashFlows(1, flowsOf({ 9999: { in: 100, out: 0 } }), { balanceForYear: 0, previousNetFlow: 0 })).toThrow(/9999/);
    });
  });

  describe('CityLedgerFinancialStatusPolicy', () => {
    test('financial status message from year line balances', () => {
      const thisYear = { ...createEmptyCityLedgerYearLines(1), balance: 100 };
      const lastYear = { ...createEmptyCityLedgerYearLines(0), balance: 50 };

      expect(financialStatusMessageForCityLedger(thisYear, lastYear).type).toBe('success');
    });
  });

  describe('GetCityLedgerYearComparison', () => {
    test('assembles the comparison from the fold: the lines of each year, its cash, the result carried from the year before', async () => {
      const { journal, treasury, time } = portsOf(
        [line('h1', 0, 'capital_funds', 475), line('h1', 1, 'citizen_tax', 10), line('h1', 2, 'citizen_tax', 25)],
        2
      );

      const result = await new GetCityLedgerYearComparison(journal, treasury, time).execute();

      expect(result.thisYear.balance).toBe(510);
      expect(result.thisYear.incomeTax).toBe(25);
      expect(result.lastYear.incomeTax).toBe(10);
      expect(result.lastYear.balance).toBe(485);
      expect(result.thisYear.carryForwardIncome).toBe(10);
      expect(result.debt).toBe(0);
    });

    test('debt on comparison when the cash is negative', async () => {
      const { journal, treasury, time } = portsOf([line('h1', 0, 'construction', 50)], 0);

      const result = await new GetCityLedgerYearComparison(journal, treasury, time).execute();

      expect(result.debt).toBe(50);
    });

    test('each hamlet shows only its own lines and cash; hamlets add up to the whole city', async () => {
      const { journal, treasury, time } = portsOf(
        [line('h1', 0, 'citizen_tax', 100), line('h1', 0, 'construction', 30), line('h2', 0, 'citizen_tax', 40), line('h2', 0, 'maintenance', 10)],
        0
      );
      const query = new GetCityLedgerYearComparison(journal, treasury, time);

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
    test('returns the cash of the fold', async () => {
      const query = new GetTreasuryBalance({ cashOf: async () => 1234 });
      expect(await query.execute()).toBe(1234);
    });
  });
});

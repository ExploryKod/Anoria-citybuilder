/**
 * The fold of the journal's legs is the one derivation of every balance: the cash is the balance of 512, for the city, a hamlet or an account, at any
 * point in time, and a year closed by a purge leaves it as it was.
 */
import { describe, test, expect } from '@jest/globals';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { buildYearClosingLine } from '../../../src/contexts/accounting/domain/policies/YearClosingPolicy.js';
import { booked } from '../../helpers/booked.js';

const line = (type, amount, extra = {}) => booked({ type, amount, turn: 1, year: 0, month: 1, hamletId: 'h1', accountBuildingId: null, accountKind: null, ...extra });
const foldOf = (lines) => {
  const fold = new LegsFold();
  for (const entry of lines) fold.add(entry);
  return fold;
};

describe('LegsFold — the cash is the balance of 512', () => {
  const lines = [
    line('capital_funds', 1000),
    line('construction', 300, { month: 4 }),
    line('citizen_tax', 50, { year: 1, month: 2 }),
    line('capital_funds', 200, { hamletId: 'h2' }),
    line('producer_revenue', 70, { accountBuildingId: 'farm' }),
  ];

  test('the city, a hamlet and a company each read their own cash, to the centime', () => {
    const fold = foldOf(lines);
    expect(fold.balanceOf('512', { accountKey: null })).toBe(95000);
    expect(fold.balanceOf('512', { accountKey: null, hamletId: 'h1' })).toBe(75000);
    expect(fold.balanceOf('512', { accountKey: 'farm' })).toBe(7000);
  });

  test('the cash at the end of a year or of a month leaves out what came after', () => {
    const fold = foldOf(lines);
    expect(fold.balanceOf('512', { accountKey: null, hamletId: 'h1', untilYear: 0 })).toBe(70000);
    expect(fold.balanceOf('512', { accountKey: null, hamletId: 'h1', untilYear: 0, untilMonth: 3 })).toBe(100000);
  });

  test('a year folded into its closing by a purge leaves the cash as it was', () => {
    // A closing is one hamlet's, one year's and one account's: here the city's own lines of year 0 in h1.
    const closed = lines.filter((entry) => entry.year === 0 && entry.hamletId === 'h1' && entry.accountBuildingId === null);
    const closing = buildYearClosingLine({ year: 0, hamletId: 'h1', accountBuildingId: null, accountKind: null, lines: closed, getTimeInfo: () => ({ monthIndex: 0 }) });
    const afterPurge = foldOf([closing, ...lines.filter((entry) => !closed.includes(entry))]);
    expect(afterPurge.balanceOf('512', { accountKey: null, hamletId: 'h1' })).toBe(75000);
    expect(afterPurge.balanceOf('512', { accountKey: null })).toBe(95000);
  });

  test('an écriture with no legs is a defect, naming it', () => {
    expect(() => new LegsFold().add({ type: 'citizen_tax', amount: 5, turn: 3, year: 0, month: 1, hamletId: 'h1' })).toThrow(/citizen_tax.*no legs/);
  });
});

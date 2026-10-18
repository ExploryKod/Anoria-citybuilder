/**
 * The statements of the city in the M57 model are read from the fold of the journal's legs: the compte de résultat by family of account, the balance sheet by
 * nature, and the two sides of the balance sheet balance because every écriture does.
 */
import { describe, test, expect } from '@jest/globals';
import { LegsFold } from '../../../src/contexts/accounting/domain/policies/LegsFold.js';
import { cityBalanceSheetOf, cityIncomeStatementOf, cityTrialBalanceOf } from '../../../src/contexts/accounting/domain/policies/CityStatementsPolicy.js';
import { booked } from '../../helpers/booked.js';

const line = (type, amount, extra = {}) => booked({ type, amount, turn: 1, year: 1, month: 1, hamletId: 'h1', accountBuildingId: null, ...extra });
const foldOf = (lines) => {
  const fold = new LegsFold();
  for (const entry of lines) fold.add(entry);
  return fold;
};

describe('the statements of the city (M57)', () => {
  const lines = [
    line('capital_funds', 3000, { year: 0 }),
    line('construction', 100, { year: 0 }),
    line('citizen_tax', 50),
    line('vat', 10),
    line('salary', 20),
  ];

  test('the compte de résultat of a year reads its products and its charges by family of account', () => {
    const fold = foldOf(lines);

    const { sections, results } = cityIncomeStatementOf(fold.totalsOf({ accountKey: null, year: 1 }));

    const line73 = sections.find((section) => section.id === 'operatingProducts').lines.find((candidate) => candidate.id === 'taxes');
    expect(line73.amount).toBe(60);
    expect(line73.accounts.map((item) => item.account)).toEqual(['73111', '735']);
    expect(sections.find((section) => section.id === 'operatingCharges').lines.find((candidate) => candidate.id === 'staff').amount).toBe(20);
    expect(results.net).toBe(40);
  });

  test('the balance sheet puts each account on the side its balance gives it, and balances', () => {
    const fold = foldOf(lines);
    const totals = fold.totalsOf({ accountKey: null, untilYear: 1 });

    const { assets, liabilities } = cityBalanceSheetOf(totals, { yearTotals: fold.totalsOf({ accountKey: null, year: 1 }) });

    expect(assets.groups.find((group) => group.id === 'fixedAssets').total).toBe(100);
    expect(assets.groups.find((group) => group.id === 'cash').total).toBe(2940);
    expect(liabilities.groups.find((group) => group.id === 'equity').total).toBe(3000);
    expect(liabilities.yearResult).toBe(40);
    expect(assets.total).toBe(3040);
    expect(liabilities.total).toBe(3040);
  });

  test('the city\'s cash is the treasury\'s: the same account, read once', () => {
    const fold = foldOf(lines);
    const { assets } = cityBalanceSheetOf(fold.totalsOf({ accountKey: null, untilYear: 1 }), { yearTotals: fold.totalsOf({ accountKey: null, year: 1 }) });

    expect(assets.groups.find((group) => group.id === 'cash').total * 100).toBe(fold.balanceOf('512', { accountKey: null, untilYear: 1 }));
  });

  test('an account below nothing is an overdraft, a debt of the city', () => {
    const fold = foldOf([line('construction', 100)]);

    const { assets, liabilities } = cityBalanceSheetOf(fold.totalsOf({ accountKey: null, untilYear: 1 }), { yearTotals: fold.totalsOf({ accountKey: null, year: 1 }) });

    expect(assets.groups.find((group) => group.id === 'cash').total).toBe(0);
    expect(liabilities.groups.find((group) => group.id === 'overdraft').total).toBe(100);
    expect(assets.total).toBe(liabilities.total);
  });

  test('the balance lists each account with its debits, its credits and its balance, and the two columns are equal', () => {
    const { accounts, totals } = cityTrialBalanceOf(foldOf(lines).totalsOf({ accountKey: null, untilYear: 1 }));

    expect(accounts.find((item) => item.account === '512')).toMatchObject({ debit: 3060, credit: 120, debitBalance: 2940, creditBalance: 0 });
    expect(accounts.find((item) => item.account === '1021')).toMatchObject({ credit: 3000, creditBalance: 3000 });
    expect(totals.debit).toBe(totals.credit);
    expect(() => cityTrialBalanceOf(new Map([['512', { debit: 100, credit: 0 }]]))).toThrow(/does not balance/);
  });

  test('a charge or a product that no line of the statement takes is an error, never left out', () => {
    expect(() => cityIncomeStatementOf(new Map([['69', { debit: 100, credit: 0 }]]))).toThrow(/69/);
  });
});

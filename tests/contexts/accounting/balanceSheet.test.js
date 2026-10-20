import { describe, test, expect } from '@jest/globals';
import { balanceSheetOf } from '../../../src/contexts/accounting/domain/policies/BalanceSheetPolicy.js';
import { buildYearClosingLine, isFoldedIntoClosing } from '../../../src/contexts/accounting/domain/policies/YearClosingPolicy.js';

import { booked } from '../../helpers/booked.js';

const line = (type, amount, extra = {}) => booked({ type, amount, turn: 1, year: 0, month: 1, accountBuildingId: 'b1', accountKind: null, ...extra });

describe('balance sheet of a company (derived from its journal)', () => {
  // 100 of purchases (60 still on the shelf), 70 of sales: the cash is -30, the result -30, the stock +60.
  const entries = [line('producer_purchase', 100), line('producer_revenue', 70)];
  const stock = [{ category: 'wheat', amount: 6, unitCost: 10, value: 60 }];

  test('assets equal liabilities, the stock entering the result as its variation', () => {
    const sheet = balanceSheetOf(entries, 'b1', { cash: -30, stock, currentYear: 0 });
    // The account is 30 below nothing: that is an overdraft, a debt, and only the stock is an asset.
    expect(sheet.assets.cash).toBe(0);
    expect(sheet.liabilities.overdraft).toBe(30);
    expect(sheet.assets.total).toBe(60);
    expect(sheet.liabilities.total).toBe(60);
    expect(sheet.liabilities.accumulatedResult).toBe(-30);
    expect(sheet.liabilities.stockVariation).toBe(60);
  });

  test('a cash that is not the sum of the lines is an error, never a plug', () => {
    expect(() => balanceSheetOf(entries, 'b1', { cash: 0, stock, currentYear: 0 })).toThrow('does not balance');
  });

  test('a household has no balance sheet', () => {
    expect(() => balanceSheetOf([], 'b1', { accountKind: 'particulier', cash: 0, stock: [], currentYear: 0 })).toThrow('no balance sheet');
  });
});

// What a company owes and cannot pay yet is a debt on the balance sheet, against the charge booked in the result; paid off, it leaves.
describe('the debts of a company on its balance sheet', () => {
  const entries = [line('producer_revenue', 500), line('producer_wage', 300), line('od_payable_wage', 100, { counterpartyBuildingId: 'house' })];

  test('a wage that is owed is a debt, the result carries the whole charge, and the sheet balances', () => {
    const sheet = balanceSheetOf(entries, 'b1', { cash: 200, stock: [], currentYear: 0 });
    expect(sheet.liabilities.payables).toEqual({ 421: 100 });
    expect(sheet.liabilities.accumulatedResult).toBe(100);
    expect(sheet.assets.total).toBe(sheet.liabilities.total);
  });

  test('paid off, the debt is gone and the result is unchanged', () => {
    const paid = [...entries, line('wage_debt_paid', 100, { counterpartyBuildingId: 'house' })];
    const sheet = balanceSheetOf(paid, 'b1', { cash: 100, stock: [], currentYear: 0 });
    expect(sheet.liabilities.payables).toEqual({});
    expect(sheet.liabilities.accumulatedResult).toBe(100);
    expect(sheet.assets.total).toBe(sheet.liabilities.total);
  });
});

// A purge never changes what an account owns and owes: the closing carries its balances, so the balance sheet reads the same once the lines are gone.
describe('a purged year leaves the balance sheet as it was', () => {
  const timeInfoOf = () => ({ monthIndex: 0 });
  const stock = [{ category: 'wheat', amount: 8, unitCost: 10, value: 80 }];
  const yearZero = [
    line('producer_purchase', 100),
    line('producer_revenue', 70),
    line('od_stock_up_merchandise', 60),
    line('od_depreciation', 5),
  ];
  const yearOne = [line('producer_revenue', 10, { year: 1, turn: 400 })];

  test('the balance sheet read before and after the year 0 is folded into its closing is the same', () => {
    const cash = -30 + 10;
    const before = balanceSheetOf([...yearZero, ...yearOne], 'b1', { cash, stock, currentYear: 1 });
    const closing = buildYearClosingLine({ year: 0, hamletId: 'h', accountBuildingId: 'b1', accountKind: null, lines: yearZero.filter(isFoldedIntoClosing), getTimeInfo: timeInfoOf });
    const after = balanceSheetOf([closing, ...yearOne], 'b1', { cash, stock, currentYear: 1 });
    expect(after).toEqual(before);
    expect(after.liabilities.carriedResult).toBe(25);
    expect(after.liabilities.yearResult).toBe(10);
  });
});

import { describe, test, expect } from '@jest/globals';
import { balanceSheetOf } from '../../../src/contexts/accounting/domain/policies/BalanceSheetPolicy.js';
import { incomeStatementOf } from '../../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';
import { trialBalanceOf } from '../../../src/contexts/accounting/domain/policies/AccountLedgerPolicy.js';
import { assetMovementsOf, monthlyDepreciationOf, postedAssetsOf, postedStockOf, stockVariationOf } from '../../../src/contexts/accounting/domain/policies/MonthClosingPolicy.js';
import { isInformativeJournalType } from '../../../src/contexts/accounting/domain/policies/JournalEntryClassificationPolicy.js';
import { moneyDirectionOf } from '../../../src/contexts/accounting/domain/policies/TreasuryFromJournalPolicy.js';

const line = (type, amount, extra = {}) => ({ type, amount, turn: 1, year: 0, month: 1, accountBuildingId: 'b1', accountKind: null, ...extra });

// The closing of the month writes lines that move no money: they must show in the books and never in the treasury.
describe('the closing of the month (opérations diverses)', () => {
  // 100 of goods bought, 70 sold, 60 still on the shelf: the closing posts that the stock grew by 60.
  const entries = [line('producer_purchase', 100), line('producer_revenue', 70), line('od_stock_up_merchandise', 60)];
  const stock = [{ category: 'wheat', amount: 6, unitCost: 10, value: 60 }];

  test('an opération diverse moves no money and is not a flow of the summaries', () => {
    expect(moneyDirectionOf(line('od_stock_up_merchandise', 60))).toBeNull();
    expect(isInformativeJournalType('od_depreciation')).toBe(true);
  });

  test('a stock that grew lowers the cost of the purchases in the compte de résultat: the result is the margin, not the cash', () => {
    const statement = incomeStatementOf(entries, 'b1', { year: 0, salesNature: 'merchandise' });
    expect(statement.sections.find((section) => section.id === 'operatingCharges').lines.find((l) => l.id === 'stockVariation').amount).toBe(-60);
    expect(statement.results.net).toBe(30);
  });

  test('the balance sheet balances with the closings posted, and the stock in progress is what was not posted yet', () => {
    const sheet = balanceSheetOf(entries, 'b1', { cash: -30, stock, currentYear: 0 });
    expect(sheet.assets.total).toBe(sheet.liabilities.total);
    expect(sheet.liabilities.stockVariation).toBe(0);
    const grown = balanceSheetOf(entries, 'b1', { cash: -30, stock: [{ category: 'wheat', amount: 8, unitCost: 10, value: 80 }], currentYear: 0 });
    expect(grown.liabilities.stockVariation).toBe(20);
    expect(grown.assets.total).toBe(grown.liabilities.total);
  });

  test('the balance still balances, the bank untouched', () => {
    const balance = trialBalanceOf(entries, 'b1', { salesNature: 'merchandise' });
    expect(balance.totals.debit).toBe(balance.totals.credit);
    expect(balance.accounts.find((account) => account.account === '37').debitBalance).toBe(60);
    expect(balance.accounts.find((account) => account.account === '512').creditBalance).toBe(30);
  });

  test('the variation to post is what the stock is worth now less what was posted, once', () => {
    expect(postedStockOf(entries, 'b1', null)).toBe(6000);
    expect(stockVariationOf({ live: 8000, posted: 6000, nature: 'merchandise' })).toEqual({ type: 'od_stock_up_merchandise', amount: 20 });
    expect(stockVariationOf({ live: 5000, posted: 6000, nature: 'production' })).toEqual({ type: 'od_stock_down_production', amount: 10 });
    expect(stockVariationOf({ live: 6000, posted: 6000, nature: 'merchandise' })).toBeNull();
  });

  // The owner's books follow the buildings: one new is a contribution of the city; one gone is released from the books, its depreciation so far soldé and
  // what it was still worth lost; the capital stays what the city contributed.
  test('a demolished building leaves the owner\'s books: depreciation released, net value lost, nothing left of it, even when another is built the same month', () => {
    const closingKey = 24;
    const old = { buildingId: 'old', cost: 120, builtKey: 12, years: 1, held: false };
    const fresh = { buildingId: 'fresh', cost: 30, builtKey: 23, years: 1, held: true };
    const movements = assetMovementsOf({ closingKey, constructions: [old, fresh], posted: new Map([['old', 12000]]) }, 12);
    expect(movements).toEqual([
      { buildingId: 'old', kind: 'disposal', cost: 12000, released: 11000, loss: 1000 },
      { buildingId: 'fresh', kind: 'contribution', cost: 3000, released: 0, loss: 0 },
    ]);
    const young = assetMovementsOf({ closingKey: 16, constructions: [{ ...old, builtKey: 12 }], posted: new Map([['old', 12000]]) }, 12);
    expect(young).toEqual([{ buildingId: 'old', kind: 'disposal', cost: 12000, released: 3000, loss: 9000 }]);
    expect(assetMovementsOf({ closingKey, constructions: [{ ...fresh, held: true }], posted: new Map([['fresh', 3000]]) }, 12)).toEqual([]);
  });

  test('the balance sheet after a disposal keeps the capital and shows the loss in the result, and still balances', () => {
    const owner = (extra) => line('od_asset_contribution', 120, { buildingInstanceId: 'old', ...extra });
    const entries = [
      owner(),
      line('od_depreciation', 30),
      line('od_asset_disposal_amortization', 30, { buildingInstanceId: 'old' }),
      line('od_asset_disposal_loss', 90, { buildingInstanceId: 'old' }),
    ];
    const sheet = balanceSheetOf(entries, 'b1', { cash: 0, stock: [], currentYear: 0 });
    expect(sheet.assets.fixedAssets).toBe(0);
    expect(sheet.assets.accumulatedDepreciation).toBe(0);
    expect(sheet.liabilities.capital).toBe(120);
    expect(sheet.liabilities.accumulatedResult).toBe(-120);
    expect(sheet.assets.total).toBe(sheet.liabilities.total);
    expect(postedAssetsOf(entries, 'b1', null).size).toBe(0);
  });

  test('a building loses its cost over its life, from the month after it was built, until it is worth nothing', () => {
    const building = { cost: 120, builtKey: 5, years: 1 };
    expect(monthlyDepreciationOf({ closingKey: 5, constructions: [building] }, 12)).toBe(0);
    expect(monthlyDepreciationOf({ closingKey: 6, constructions: [building] }, 12)).toBe(1000);
    expect(monthlyDepreciationOf({ closingKey: 17, constructions: [building] }, 12)).toBe(1000);
    expect(monthlyDepreciationOf({ closingKey: 18, constructions: [building] }, 12)).toBe(0);
  });
});

import { describe, expect, test } from '@jest/globals';
import { domesticProductOf, externalInterestOf, privateDebtOf, publicDebtOf, sortOfAccount } from '../../../src/contexts/accounting/domain/policies/HamletEconomyPolicy.js';
import { economyOf } from '../../../src/composition/purchasingPower.js';

const totals = (entries) => new Map(Object.entries(entries).map(([account, [debit, credit]]) => [account, { debit, credit }]));

describe('the economy of a hamlet, read from its fold', () => {
  test('the sales between two companies cancel: the product is the value added at each step, and the administration is counted at its cost', () => {
    // A farm sells 100 of wheat to a mill (no purchase). The mill buys it for 100, sells flour for 160 to the houses. The city pays 30 of wages.
    const byAccount = new Map([
      ['farm', totals({ 707: [0, 100] })],
      ['mill', totals({ 607: [100, 0], 707: [0, 160] })],
      ['house-1/particulier', totals({ 607: [160, 0], 512: [0, 160] })],
      [null, totals({ 6411: [30, 0] })],
    ]);
    const product = domesticProductOf(byAccount);
    expect(product).toMatchObject({ valueAdded: 160, publicOutput: 30, gdp: 190, companies: 2 });
  });

  test('a stock that grows adds to the production, one that is used up takes from it', () => {
    expect(domesticProductOf(new Map([['farm', totals({ 707: [0, 100], 713: [0, 40], 6037: [10, 0] })]])).valueAdded).toBe(130);
  });

  test('the public debt is the loans, the overdraft and the suppliers; the net debt takes off cash and what is owed, never the holdings in companies, but the loans it granted', () => {
    const debt = publicDebtOf(totals({ 512: [0, 500], 401: [0, 70], 411: [200, 0], 261: [300, 0], 274: [100, 0] }), { loans: [{ amount: 1000, lenderBuildingId: 'bank' }, { amount: 250 }] });
    expect(debt).toMatchObject({ loans: 125000, domesticLoans: 100000, overdraft: 500, suppliers: 70, gross: 125570, receivables: 200, holdings: 300, loansGranted: 100, cash: 0, net: 125270 });
  });

  test('the interest that leaves the economy is the share of the loans no bank of the game lent', () => {
    expect(externalInterestOf(totals({ 661: [100, 0] }), { loans: 1000, domesticLoans: 750 })).toBe(25);
    expect(externalInterestOf(totals({ 661: [100, 0] }), { loans: 0, domesticLoans: 0 })).toBe(0);
  });

  test('the debt of the companies counts their loans, overdrafts and unpaid charges, and the savings of the houses are told apart', () => {
    const debt = privateDebtOf(new Map([
      ['farm', totals({ 512: [0, 300], 421: [0, 80] })],
      ['mill', totals({ 512: [500, 0], 164: [0, 1000] })],
      ['house-1/particulier', totals({ 512: [250, 0] })],
    ]));
    // The mill has 500 in cash, the farm owes 300: only what a company holds counts as its cash.
    expect(debt).toMatchObject({ loans: 1000, overdrafts: 300, unpaid: 80, total: 1380, indebted: 1, companies: 2, householdSavings: 250, companyCash: 500 });
    expect([sortOfAccount(null), sortOfAccount('house-1/particulier'), sortOfAccount('house-1/entreprise:sci'), sortOfAccount('farm')]).toEqual(['city', 'household', 'business', 'company']);
  });

  test('the product in purchasing power parity is scaled by what the basket costs at the reference prices over what it costs here', () => {
    const publicDebt = { gross: 50, net: 40, loans: 50, domesticLoans: 25 };
    const economy = { ready: true, population: 10, gdp: 200, gni: 190, publicDebt, privateDebt: { total: 20 }, householdSavings: 25 };
    const baskets = [{ needs: [{ unitPrice: 2, cost: 10, referenceCost: 15 }, { unitPrice: null, cost: 0, referenceCost: 0 }] }];

    const read = economyOf({ economy, baskets });

    expect(read.parity).toBe(1.5);
    expect(read.gdpPpp).toBe(300);
    expect(read.perInhabitant).toMatchObject({ gdp: 20, gdpPpp: 30 });
    expect(read.ratios).toMatchObject({ grossDebtOfGdp: 25, netDebtOfGdp: 20, privateDebtOfGdp: 10, domesticShareOfLoans: 50, savingsCoverOfPublicDebt: 50 });
    // No market prices a need yet: there is nothing to compare, and nothing is made up.
    expect(economyOf({ economy, baskets: [{ needs: [{ unitPrice: null, cost: 0, referenceCost: 0 }] }] })).toMatchObject({ parity: null, gdpPpp: null });
  });
});

describe('the product is read over the last twelve months, not over a calendar year', () => {
  test('the fold sums the months of a range, both ends included, whatever the year they fall in', async () => {
    const { LegsFold } = await import('../../../src/contexts/accounting/domain/policies/LegsFold.js');
    const fold = new LegsFold();
    const sale = (year, month, amount) => ({ type: 'producer_revenue', turn: year * 60 + month, year, month, hamletId: 'h', accountBuildingId: 'farm', accountKind: null, journal: 'BQ', legs: [{ account: '512', debit: amount, credit: 0 }, { account: '707', debit: 0, credit: amount }] });
    // Sales of 100 in December of year 0 (key 11), 200 in January of year 1 (key 12), 400 in March of year 1 (key 14).
    for (const line of [sale(0, 12, 100), sale(1, 1, 200), sale(1, 3, 400)]) fold.add(line);

    const sales = (range) => fold.totalsByAccount({ hamletId: 'h', ...range }).get('farm')?.get('707')?.credit ?? 0;

    expect(sales({ fromKey: 12, toKey: 14 })).toBe(600);
    expect(sales({ fromKey: 11, toKey: 12 })).toBe(300);
    expect(sales({ year: 1 })).toBe(600);
    expect(sales({})).toBe(700);
  });
});

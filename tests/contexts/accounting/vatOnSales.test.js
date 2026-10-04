import { describe, test, expect } from '@jest/globals';
import { vatOnSales } from '../../../src/contexts/accounting/domain/policies/VatOnSalesPolicy.js';

describe('VAT on sales — levied on the HT price, the TTC is HT plus the VAT', () => {
  test('the VAT of each good is its rate on its HT sales, and the TTC adds it to the HT', () => {
    expect(
      vatOnSales({
        salesHT: { wheat: 80, oil: 20 },
        ratesPercent: { wheat: 10, oil: 25 },
      })
    ).toEqual({
      byGood: {
        wheat: { htAmount: 80, ratePercent: 10, vat: 8 },
        oil: { htAmount: 20, ratePercent: 25, vat: 5 },
      },
      htAmount: 100,
      vat: 13,
      ttcAmount: 113,
    });
  });

  test('a good without a rate throws rather than being taxed at a stand-in', () => {
    expect(() => vatOnSales({ salesHT: { wheat: 10 }, ratesPercent: {} })).toThrow(/wheat/);
  });
});

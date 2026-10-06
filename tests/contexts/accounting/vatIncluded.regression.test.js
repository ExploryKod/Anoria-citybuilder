import { describe, test, expect } from '@jest/globals';
import { splitVatIncluded } from '../../../src/contexts/accounting/domain/policies/VatIncludedPolicy.js';

// A good's price to the houses is final: the house pays it all, the seller keeps the price without the tax.
describe('VAT inside a final price — the tax is taken out of the price, the seller keeps the rest', () => {
  test('110 € TTC at 10 % is 100 € HT to the seller and 10 € of VAT to the city, and the two add back to the price', () => {
    expect(splitVatIncluded({ ttc: 110, ratePercent: 10 })).toEqual({ ttc: 110, ht: 100, vat: 10 });
  });

  test('a good without a rate throws rather than being taxed at a stand-in', () => {
    expect(() => splitVatIncluded({ ttc: 110, ratePercent: undefined })).toThrow(/VAT rate/);
  });
});

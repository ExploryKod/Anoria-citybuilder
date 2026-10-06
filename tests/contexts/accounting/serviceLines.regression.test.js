import { describe, test, expect } from '@jest/globals';
import { serviceSaleLines, serviceSubsidyLines } from '../../../src/contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { serviceSubsidyShare } from '../../../src/contexts/accounting/domain/policies/ServiceSubsidyPolicy.js';
import { addVatTo } from '../../../src/contexts/accounting/domain/policies/VatIncludedPolicy.js';

// The catalog's price is HT and a subsidy cannot be taken on a tax: the subsidy comes off the HT price, and the VAT is
// charged on what the house pays. The house pays that TTC, the company sells the HT, the city receives the VAT, and the
// city's subsidy goes to the company, without any VAT.
describe('service lines — the house pays the final price, the company gets the price without VAT, the city the VAT', () => {
  test('a partly subsidised service: the house pays its HT share plus the VAT, the company sells the HT, the city takes the VAT', () => {
    const share = serviceSubsidyShare({ units: 4, unitPrice: 2, subsidyPercent: 50 });
    const price = addVatTo({ ht: share.habitantShare, ratePercent: 10 });

    expect(serviceSaleLines({ sellerId: 'chapel', buyerId: 'house-1', ttc: price.ttc, ht: price.ht, vat: price.vat })).toEqual([
      { kind: 'service_purchase', amount: 4.4, holder: 'house-1', counterparty: 'chapel', accountKind: 'particulier' },
      { kind: 'service_sales', amount: 4, holder: 'chapel', counterparty: 'house-1' },
      { kind: 'vat', amount: 0.4, holder: null, counterparty: 'chapel' },
    ]);
    expect(serviceSubsidyLines({ sellerId: 'chapel', citySubsidy: share.citySubsidy })).toEqual([
      { kind: 'service_subsidy', amount: 4, holder: null, counterparty: 'chapel' },
      { kind: 'service_subsidy_received', amount: 4, holder: 'chapel', counterparty: null },
    ]);
  });

  test('a fully subsidised service costs the house nothing: no line on either side of the sale', () => {
    expect(serviceSaleLines({ sellerId: 'chapel', buyerId: 'house-1', ttc: 0, ht: 0, vat: 0 })).toEqual([]);
  });
});

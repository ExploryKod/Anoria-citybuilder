import { describe, test, expect } from '@jest/globals';
import { withholdIncomeTax } from '../../../src/contexts/accounting/domain/policies/ProducerChargePolicy.js';

// The income tax is withheld on each wage a house receives: only the part above the monthly threshold is taxed.
describe('income tax — the part of the wage above the threshold is taxed, the house keeps the net', () => {
  test('with no threshold, a 100 € wage at 10 % leaves 90 € and 10 € of tax; a rounded tax keeps the sum exact', () => {
    expect(withholdIncomeTax({ gross: 100, rate: 0.1, threshold: 0 })).toEqual({ gross: 100, incomeTax: 10, net: 90 });
    expect(withholdIncomeTax({ gross: 10, rate: 0.333, threshold: 0 })).toEqual({ gross: 10, incomeTax: 3.33, net: 6.67 });
  });

  test('a wage above the threshold pays the rate on the excess only; a wage under it pays nothing', () => {
    expect(withholdIncomeTax({ gross: 100, rate: 0.1, threshold: 40 })).toEqual({ gross: 100, incomeTax: 6, net: 94 });
    expect(withholdIncomeTax({ gross: 30, rate: 0.1, threshold: 40 })).toEqual({ gross: 30, incomeTax: 0, net: 30 });
  });
});

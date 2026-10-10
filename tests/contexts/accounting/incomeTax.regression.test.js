import { describe, test, expect } from '@jest/globals';
import { withholdIncomeTax } from '../../../src/contexts/accounting/domain/policies/ProducerChargePolicy.js';

// The income tax is withheld on each wage a house receives, progressive over three bands: exempt below threshold1,
// rate1 between the two thresholds, rate2 above threshold2 — each band taxes only its own slice.
describe('income tax — progressive over three bands, each band taxes only its own slice', () => {
  test('with both thresholds at 0, the whole wage is taxed at rate2; a rounded tax keeps the sum exact', () => {
    expect(withholdIncomeTax({ gross: 100, threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.1 })).toEqual({ gross: 100, incomeTax: 10, net: 90 });
    expect(withholdIncomeTax({ gross: 10, threshold1: 0, rate1: 0.1, threshold2: 0, rate2: 0.333 })).toEqual({ gross: 10, incomeTax: 3.33, net: 6.67 });
  });

  test('a wage under threshold1 pays nothing', () => {
    expect(withholdIncomeTax({ gross: 30, threshold1: 40, rate1: 0.1, threshold2: 100, rate2: 0.2 })).toEqual({ gross: 30, incomeTax: 0, net: 30 });
  });

  test('a wage between the two thresholds pays rate1 on the part above threshold1 only', () => {
    expect(withholdIncomeTax({ gross: 80, threshold1: 40, rate1: 0.1, threshold2: 100, rate2: 0.2 })).toEqual({ gross: 80, incomeTax: 4, net: 76 });
  });

  test('a wage above threshold2 pays rate1 on the first band and rate2 on the part above threshold2', () => {
    expect(withholdIncomeTax({ gross: 150, threshold1: 40, rate1: 0.1, threshold2: 100, rate2: 0.2 })).toEqual({ gross: 150, incomeTax: 16, net: 134 });
  });

  test('threshold2 below threshold1 is an invalid configuration: it throws rather than taxing nothing', () => {
    expect(() => withholdIncomeTax({ gross: 100, threshold1: 100, rate1: 0.1, threshold2: 50, rate2: 0.2 })).toThrow(/threshold2/);
  });
});

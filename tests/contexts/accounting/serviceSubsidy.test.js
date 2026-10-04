import { describe, test, expect } from '@jest/globals';
import { serviceSubsidyShare } from '../../../src/contexts/accounting/domain/policies/ServiceSubsidyPolicy.js';

describe('service subsidy — the city pays its share, the inhabitants the rest', () => {
  test('a subsidy of 50 % splits the delivered price in two', () => {
    expect(serviceSubsidyShare({ units: 4, unitPrice: 2, subsidyPercent: 50 })).toEqual({
      gross: 8,
      citySubsidy: 4,
      habitantShare: 4,
    });
  });

  test('no subsidy leaves the whole price to the inhabitants', () => {
    expect(serviceSubsidyShare({ units: 10, unitPrice: 1.5, subsidyPercent: 0 })).toEqual({
      gross: 15,
      citySubsidy: 0,
      habitantShare: 15,
    });
  });

  test('the city share is rounded to the centime, the inhabitants keep the rest', () => {
    expect(serviceSubsidyShare({ units: 1, unitPrice: 0.5, subsidyPercent: 50 })).toEqual({
      gross: 0.5,
      citySubsidy: 0.25,
      habitantShare: 0.25,
    });
  });

  test('a missing or out-of-range input throws rather than being priced at a stand-in', () => {
    expect(() => serviceSubsidyShare({ units: 1, unitPrice: 1, subsidyPercent: 120 })).toThrow(/subsidyPercent/);
    expect(() => serviceSubsidyShare({ units: -1, unitPrice: 1, subsidyPercent: 10 })).toThrow(/units/);
  });
});

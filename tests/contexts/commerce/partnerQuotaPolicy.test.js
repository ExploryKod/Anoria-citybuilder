import { describe, test, expect } from '@jest/globals';
import {
  hasRemainingYearlyQuota,
  isYearlyQuotaExhausted,
  getPartnerQuotaStatus,
} from '../../../src/contexts/commerce/domain/policies/PartnerQuotaPolicy.js';

describe('PartnerQuotaPolicy', () => {
  const partnerWithQuota = {
    id: 'olivea',
    isActive: true,
    buysFromUs: [{ productId: 'wood', yearlyQuota: 25, currentYearly: 0 }],
    sellsToUs: [{ productId: 'figs', yearlyQuota: 10, currentYearly: 0 }],
  };

  test('hasRemainingYearlyQuota when quotas not exhausted', () => {
    expect(hasRemainingYearlyQuota(partnerWithQuota)).toBe(true);
  });

  test('isYearlyQuotaExhausted when all trade lines hit quota', () => {
    const exhausted = {
      ...partnerWithQuota,
      buysFromUs: [{ productId: 'wood', yearlyQuota: 25, currentYearly: 25 }],
      sellsToUs: [{ productId: 'figs', yearlyQuota: 10, currentYearly: 10 }],
    };
    expect(isYearlyQuotaExhausted(exhausted)).toBe(true);
    expect(hasRemainingYearlyQuota(exhausted)).toBe(false);
  });

  test('getPartnerQuotaStatus lists exhausted trade lines', () => {
    const partial = {
      ...partnerWithQuota,
      buysFromUs: [{ productId: 'wood', productName: 'Bois', yearlyQuota: 25, currentYearly: 25 }],
    };
    const status = getPartnerQuotaStatus(partial);
    expect(status.exhaustedBuys).toHaveLength(1);
    expect(status.exhaustedBuys[0].productId).toBe('wood');
    expect(status.hasRemainingYearlyQuota).toBe(true);
  });
});

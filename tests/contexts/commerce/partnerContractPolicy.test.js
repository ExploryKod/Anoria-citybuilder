import { describe, test, expect } from '@jest/globals';
import {
  hasRemainingYearlyQuota,
  isYearlyQuotaExhausted,
  getPartnerQuotaStatus,
} from '../../../src/contexts/commerce/domain/policies/PartnerContractPolicy.js';

describe('PartnerContractPolicy', () => {
  const activePartner = {
    id: 'deserta',
    isActive: true,
    imports: [{ productId: 'carrot', maxOccurrences: 2, currentYearly: 1 }],
    exports: [{ productId: 'dattes', maxOccurrences: 1, currentYearly: 0 }],
  };

  const exhaustedPartner = {
    id: 'deserta',
    isActive: true,
    imports: [{ productId: 'carrot', productName: 'Carotte', maxOccurrences: 2, currentYearly: 2 }],
    exports: [{ productId: 'dattes', productName: 'Dattes', maxOccurrences: 1, currentYearly: 1 }],
  };

  test('hasRemainingYearlyQuota detects remaining annual quota', () => {
    expect(hasRemainingYearlyQuota(activePartner)).toBe(true);
    expect(hasRemainingYearlyQuota(exhaustedPartner)).toBe(false);
  });

  test('isYearlyQuotaExhausted requires active partner and all quotas used', () => {
    expect(isYearlyQuotaExhausted(activePartner)).toBe(false);
    expect(isYearlyQuotaExhausted(exhaustedPartner)).toBe(true);
    expect(isYearlyQuotaExhausted({ ...exhaustedPartner, isActive: false })).toBe(false);
  });

  test('getPartnerQuotaStatus lists exhausted trade lines', () => {
    const status = getPartnerQuotaStatus(exhaustedPartner);
    expect(status.hasRemainingYearlyQuota).toBe(false);
    expect(status.exhaustedImports).toHaveLength(1);
    expect(status.exhaustedExports).toHaveLength(1);
  });
});

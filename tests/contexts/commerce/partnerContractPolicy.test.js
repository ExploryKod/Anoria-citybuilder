import { describe, test, expect } from '@jest/globals';
import {
  hasActiveContract,
  isContractFinished,
  getContractStatus,
} from '../../../src/contexts/commerce/domain/policies/PartnerContractPolicy.js';

describe('PartnerContractPolicy', () => {
  const activePartner = {
    id: 'deserta',
    isActive: true,
    imports: [{ productId: 'carrot', maxOccurrences: 2, currentOccurrences: 1 }],
    exports: [{ productId: 'dattes', maxOccurrences: 1, currentOccurrences: 0 }],
  };

  const finishedPartner = {
    id: 'deserta',
    isActive: true,
    imports: [{ productId: 'carrot', productName: 'Carotte', maxOccurrences: 2, currentOccurrences: 2 }],
    exports: [{ productId: 'dattes', productName: 'Dattes', maxOccurrences: 1, currentOccurrences: 1 }],
  };

  test('hasActiveContract detects remaining occurrences', () => {
    expect(hasActiveContract(activePartner)).toBe(true);
    expect(hasActiveContract(finishedPartner)).toBe(false);
  });

  test('isContractFinished requires active partner and all trades done', () => {
    expect(isContractFinished(activePartner)).toBe(false);
    expect(isContractFinished(finishedPartner)).toBe(true);
    expect(isContractFinished({ ...finishedPartner, isActive: false })).toBe(false);
  });

  test('getContractStatus lists finished products', () => {
    const status = getContractStatus(finishedPartner);
    expect(status.hasActiveContract).toBe(false);
    expect(status.finishedImports).toHaveLength(1);
    expect(status.finishedExports).toHaveLength(1);
  });
});

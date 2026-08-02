import { describe, test, expect } from '@jest/globals';
import {
  validatePartnerCatalog,
  validatePartnerTradeLines,
  isMvpPartnerCatalog,
} from '../../../src/contexts/commerce/domain/policies/PartnerCatalogIntegrityPolicy.js';
import { createDefaultPartners } from '../../../src/contexts/commerce/domain/catalogs/PartnerCatalog.js';

describe('PartnerCatalogIntegrityPolicy', () => {
  test('MVP seed catalog is valid', () => {
    const partners = createDefaultPartners();
    expect(validatePartnerCatalog(partners).valid).toBe(true);
    expect(isMvpPartnerCatalog(partners)).toBe(true);
  });

  test('rejects same productId in buysFromUs and sellsToUs for one partner', () => {
    const result = validatePartnerTradeLines({
      id: 'bad',
      buysFromUs: [{ productId: 'wood' }],
      sellsToUs: [{ productId: 'wood' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('wood');
  });

  test('rejects unknown commerce products', () => {
    const result = validatePartnerTradeLines({
      id: 'bad',
      buysFromUs: [{ productId: 'wheat' }],
      sellsToUs: [],
    });
    expect(result.valid).toBe(false);
  });

  test('isMvpPartnerCatalog rejects non-MVP partner set', () => {
    expect(
      isMvpPartnerCatalog([
        { id: 'deserta', buysFromUs: [], sellsToUs: [] },
        { id: 'tropicala', buysFromUs: [], sellsToUs: [] },
      ])
    ).toBe(false);
  });
});

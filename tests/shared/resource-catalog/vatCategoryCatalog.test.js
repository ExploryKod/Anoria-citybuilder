import { describe, test, expect } from '@jest/globals';
import { getVatCategories, getVatCategoryOf, getVatItems } from '../../../src/shared/resource-catalog/VatCategoryCatalog.js';

describe('VAT categories — every good and service the VAT taxes belongs to one category', () => {
  test('each taxed item names a declared VAT category', () => {
    const categories = getVatCategories();
    for (const item of getVatItems()) {
      expect(categories).toContain(getVatCategoryOf(item));
    }
  });
});

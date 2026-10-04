import { describe, test, expect } from '@jest/globals';
import { getGoodCategories } from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';
import { getGoodVatCategory, getVatCategories } from '../../../src/shared/resource-catalog/VatCategoryCatalog.js';

describe('VAT categories — every good that houses buy belongs to one category', () => {
  test('each good names a declared VAT category', () => {
    const categories = getVatCategories();
    for (const good of getGoodCategories()) {
      expect(categories).toContain(getGoodVatCategory(good));
    }
  });
});

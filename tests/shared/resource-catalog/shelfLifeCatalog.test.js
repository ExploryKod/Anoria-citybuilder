import { describe, test, expect } from '@jest/globals';
import { getGoodCategories, getShelfLifeMonths } from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';

// Regression: gilded plate was a good and a trade want with no shelf life, so the monthly trade cycle threw every month.
describe('every good of the catalog declares a shelf life', () => {
  test('so that pricing a sale never meets a good without one', () => {
    for (const good of getGoodCategories()) {
      expect({ good, months: getShelfLifeMonths(good) }).toEqual({ good, months: expect.any(Number) });
    }
  });
});

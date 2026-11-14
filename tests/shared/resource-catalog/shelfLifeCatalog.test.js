import { describe, test, expect } from '@jest/globals';
import {
  RESOURCE_CATEGORY_PRESENTATION,
  getGoodCategories,
  getShelfLifeMonths,
} from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';

// Regression: gilded plate was a good and a trade want with no shelf life, so the monthly trade cycle threw every month.
// Same again for the import agreements ("dealPot", ...): a merchant's stock holds them, and the simulation threw every turn.
describe('every good of the catalog declares a shelf life', () => {
  test('so that pricing a sale never meets a good without one', () => {
    for (const good of getGoodCategories()) {
      expect({ good, months: getShelfLifeMonths(good) }).toEqual({ good, months: expect.any(Number) });
    }
  });

  test('and so does every import agreement, which can sit in a merchant\'s stock', () => {
    const deals = Object.keys(RESOURCE_CATEGORY_PRESENTATION).filter((category) => RESOURCE_CATEGORY_PRESENTATION[category].kind === 'importDeal');
    expect(deals.length).toBeGreaterThan(0);
    for (const category of deals) {
      expect({ category, months: getShelfLifeMonths(category) }).toEqual({ category, months: expect.any(Number) });
    }
  });
});

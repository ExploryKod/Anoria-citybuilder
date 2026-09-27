/**
 * Guard tests — the shared stock shape with MORE THAN ONE aggregate.
 *
 * Until now exactly one good declared a `totalKey` ('food'), so
 * getResourceStockShape could get away with a last-one-wins scan. The moment
 * a second good declares its own aggregate (a warehouse's capacity total),
 * that scan would silently hand back the WRONG total to the ~15 call sites
 * that read `getResourceStockShape().totalKey` meaning "what a citizen eats"
 * — and the second total would then be dropped from every row on read.
 *
 * The real catalog only declares one aggregate today, so these tests run
 * against a fake catalog holding two: it is the shape of the bug that is
 * being guarded, not today's numbers.
 */

import { describe, test, expect, jest } from '@jest/globals';

/**
 * Warehouse LAST on purpose: with the old last-one-wins scan, its 'goods'
 * aggregate is the one that would come back as "the" total.
 */
const FAKE_CATALOG = {
  'Fake-Farm': {
    resourceRoles: [{ role: 'producer', categories: ['wheat'], totalKey: 'food' }],
  },
  'Fake-House': {
    resourceRoles: [{ role: 'consumer', categories: ['wheat', 'fruit'], totalKey: 'food' }],
  },
  'Fake-Warehouse': {
    resourceRoles: [
      { role: 'collector', categories: ['wood', 'furniture'], totalKey: 'goods' },
      { role: 'hub', categories: ['wood', 'furniture'], totalKey: 'goods' },
    ],
  },
};

jest.unstable_mockModule('../../../src/shared/building-catalog/buildingCatalog.js', () => ({
  buildingCatalog: FAKE_CATALOG,
  getBuildingDefinition: (type) => FAKE_CATALOG[type],
}));

const { getResourceStockShape, createEmptyStocks } = await import(
  '../../../src/shared/building-catalog/resourceRoleQueries.js'
);
const { createSupplyStock } = await import(
  '../../../src/contexts/supply/domain/value-objects/SupplyStock.js'
);

describe('stock shape with several aggregates', () => {
  test('"the" total is the one the consumer declares, not the last one scanned', () => {
    expect(getResourceStockShape().totalKey).toBe('food');
  });

  test('every declared aggregate is listed, so a row can hold them all', () => {
    const { totalKeys, categories } = getResourceStockShape();
    expect([...totalKeys].sort()).toEqual(['food', 'goods']);
    expect(categories).toEqual(expect.arrayContaining(['wheat', 'fruit', 'wood', 'furniture']));
  });

  test('a fresh row zeroes every aggregate, not just the consumer one', () => {
    expect(createEmptyStocks()).toEqual({
      wheat: 0,
      fruit: 0,
      wood: 0,
      furniture: 0,
      food: 0,
      goods: 0,
    });
  });

  test('a second good\'s aggregate survives the round-trip', () => {
    const stock = createSupplyStock({ wheat: 3, food: 3, wood: 5, furniture: 2, goods: 7 });
    expect(stock.goods).toBe(7);
    expect(stock.food).toBe(3);
  });

  test('another aggregate is preserved as stored, never recomputed from its categories', () => {
    // A hub caps its own total below the sum of what it holds (see
    // CollectResourceToHub) — recomputing here would quietly undo that cap.
    const stock = createSupplyStock({ wood: 30, furniture: 30, goods: 40 });
    expect(stock.goods).toBe(40);
  });

  test('a missing aggregate reads as 0 rather than undefined', () => {
    expect(createSupplyStock({ wood: 5 }).goods).toBe(0);
  });
});

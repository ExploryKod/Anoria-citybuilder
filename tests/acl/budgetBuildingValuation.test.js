/**
 * ACL Budget — getCityBuildingValuation
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import db from '../../src/core/persistence/dexie/db.js';
import { resetCityAssetsContextForTests } from '../../src/composition/createCityAssetsContext.js';
import {
  getCityBuildingValuation,
  getCityTotalBuildingValue,
  getCityBuildingPricesByType,
} from '../../src/js/acl/budget.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';

async function clearHousesTable() {
  await db.open();
  await db.houses.clear();
}

describe('ACL Budget — city building valuation (1b)', () => {
  beforeEach(async () => {
    resetCityAssetsContextForTests();
    await clearHousesTable();
  });

  afterEach(async () => {
    resetCityAssetsContextForTests();
    await clearHousesTable();
  });

  test('returns zero valuation on empty city', async () => {
    const valuation = await getCityBuildingValuation();
    expect(valuation.totalValue).toBe(0);
    expect(valuation.pricesByType).toEqual({});
  });

  test('sums prices and keeps first price per type (legacy semantics)', async () => {
    await db.houses.bulkAdd([
      makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { price: 10 } }),
      makeHouseRecord({ type: 'House-Blue', x: 2, y: 2, extra: { price: 15 } }),
      makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { price: 20 } }),
    ]);

    expect(await getCityTotalBuildingValue()).toBe(45);

    const byType = await getCityBuildingPricesByType();
    expect(byType['House-Blue']).toBe(10);
    expect(byType['Farm-Wheat']).toBe(20);
  });
});

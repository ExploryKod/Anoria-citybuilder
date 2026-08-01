/**
 * ACL Housing — getCityTotalPopulation helper
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { resetHousingContextForTests } from '../../src/composition/createHousingContext.js';
import { clearBuildingsTable, seedBuilding } from '../helpers/buildingDb.js';
import { getCityTotalPopulation } from '../../src/composition/facades/housing.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';

describe('getCityTotalPopulation (H6)', () => {
  beforeEach(async () => {
    resetHousingContextForTests();
    await clearBuildingsTable();
  });

  afterEach(async () => {
    resetHousingContextForTests();
    await clearBuildingsTable();
  });

  test('returns 0 on empty database', async () => {
    expect(await getCityTotalPopulation()).toBe(0);
  });

  test('sums residential pop only', async () => {
    await seedBuilding(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 4 } }));
    await seedBuilding(makeHouseRecord({ type: 'House-Red', x: 2, y: 2, extra: { pop: 2 } }));
    await seedBuilding(makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { pop: 50 } }));

    expect(await getCityTotalPopulation()).toBe(6);
  });
});

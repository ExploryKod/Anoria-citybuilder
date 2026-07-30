/**
 * ACL Housing — getCityTotalPopulation helper
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import db from '../../src/core/persistence/dexie/db.js';
import { HouseStore } from '../../src/js/stores/HousesStore.js';
import { getCityTotalPopulation } from '../../src/js/acl/housing.js';
import { resetHousingContextForTests } from '../../src/composition/createHousingContext.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';

async function clearHousesTable() {
  await db.open();
  await db.houses.clear();
}

describe('getCityTotalPopulation (H6)', () => {
  /** @type {HouseStore} */
  let housesStore;

  beforeEach(async () => {
    resetHousingContextForTests();
    await clearHousesTable();
    housesStore = new HouseStore();
  });

  afterEach(async () => {
    resetHousingContextForTests();
    await clearHousesTable();
  });

  test('returns 0 on empty database', async () => {
    expect(await getCityTotalPopulation()).toBe(0);
  });

  test('sums residential pop only', async () => {
    await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 4 } }));
    await housesStore.addHouse(makeHouseRecord({ type: 'House-Red', x: 2, y: 2, extra: { pop: 2 } }));
    await housesStore.addHouse(makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { pop: 50 } }));

    expect(await getCityTotalPopulation()).toBe(6);
  });
});

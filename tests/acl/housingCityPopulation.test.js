/**
 * ACL Housing — getCityTotalPopulation helper
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HouseStore } from '../../src/js/stores/HousesStore.js';
import { getCityTotalPopulation } from '../../src/js/acl/housing.js';
import { resetHousingContextForTests } from '../../src/composition/createHousingContext.js';
import { makeHouseRecord } from '../fixtures/buildingRecord.js';

function createTestDb() {
  const db = new Dexie('testHousingPopDb');
  db.version(1).stores({
    houses: 'instanceId, kind, type, [anchorX+anchorY], [kind+type]',
    game: 'name',
    budget: 'name',
    objectives: 'name',
    journal: '++id, turn, date, type, amount, description',
    foodTraceability:
      '++id, turn, month, year, date, transactionType, fromInstanceId, fromCoords, toInstanceId, toCoords, foodType, quantity, price',
  });
  return db;
}

describe('getCityTotalPopulation (H6)', () => {
  /** @type {HouseStore} */
  let housesStore;
  /** @type {Dexie} */
  let testDb;

  beforeEach(async () => {
    resetHousingContextForTests();
    testDb = createTestDb();
    await testDb.open();
    housesStore = new HouseStore();
    housesStore.db = testDb;
  });

  afterEach(async () => {
    resetHousingContextForTests();
    if (testDb?.isOpen()) {
      await testDb.delete();
    }
  });

  test('returns 0 without store', async () => {
    expect(await getCityTotalPopulation(null)).toBe(0);
  });

  test('sums residential pop only', async () => {
    await housesStore.addHouse(makeHouseRecord({ type: 'House-Blue', x: 1, y: 1, extra: { pop: 4 } }));
    await housesStore.addHouse(makeHouseRecord({ type: 'House-Red', x: 2, y: 2, extra: { pop: 2 } }));
    await housesStore.addHouse(makeHouseRecord({ type: 'Farm-Wheat', x: 3, y: 3, extra: { pop: 50 } }));

    expect(await getCityTotalPopulation(housesStore)).toBe(6);
  });
});

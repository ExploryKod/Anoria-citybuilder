/**
 * ACL Housing — getCityTotalPopulation helper
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HouseStore } from '../../src/js/stores/HousesStore.js';
import { getCityTotalPopulation } from '../../src/js/acl/housing.js';
import { resetHousingContextForTests } from '../../src/composition/createHousingContext.js';

function createTestDb() {
  const db = new Dexie('testHousingPopDb');
  db.version(1).stores({
    houses: 'name, [name+price]',
    game: 'name',
    budget: 'name',
    objectives: 'name',
    journal: '++id, turn, date, type, amount, description',
    foodTraceability:
      '++id, turn, month, year, date, transactionType, fromId, fromCoords, toId, toCoords, foodType, quantity, price',
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
    await housesStore.addHouse({ name: 'House-Blue-1-1', type: 'House-Blue', pop: 4 });
    await housesStore.addHouse({ name: 'House-Red-2-2', type: 'House-Red', pop: 2 });
    await housesStore.addHouse({ name: 'Farm-Wheat-3-3', type: 'Farm-Wheat', pop: 50 });

    expect(await getCityTotalPopulation(housesStore)).toBe(6);
  });
});

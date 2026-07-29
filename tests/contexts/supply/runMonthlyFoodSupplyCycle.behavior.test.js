/**
 * Behavior tests — Supply: monthly food supply cycle
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createSupplyContext, resetSupplyContextForTests } from '../../../src/composition/createSupplyContext.js';
import { TimeManager } from '../../../src/js/game/utils/TimeManager.js';
import { toSupplySeason, toSupplyMonth } from '../../../src/js/acl/supply.js';
import { HouseStore } from '../../../src/js/stores/HousesStore.js';

function createTestDb() {
  const db = new Dexie('testMonthlySupplyDb');
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

describe('Supply — RunMonthlyFoodSupplyCycle', () => {
  let housesStore;
  let supply;
  let testDb;

  beforeEach(async () => {
    resetSupplyContextForTests();
    testDb = createTestDb();
    await testDb.open();
    housesStore = new HouseStore();
    housesStore.db = testDb;
    supply = createSupplyContext({ housesStore });
  });

  afterEach(async () => {
    resetSupplyContextForTests();
    if (testDb?.isOpen()) {
      await testDb.delete();
    }
  });

  async function runAtTime(time) {
    const timeInfo = TimeManager.getTimeInfo(time);
    await supply.runMonthlyFoodSupplyCycle({
      season: toSupplySeason(timeInfo.season),
      month: toSupplyMonth(timeInfo.month),
      timeInfo,
      maxDistance: 5,
    });
  }

  test('sets isBuying true in autumn', async () => {
    await housesStore.addHouse({
      id: 'Market-Stall-5-5',
      name: 'Market-Stall-5-5',
      type: 'Market-Stall',
      x: 5,
      y: 5,
      roads: 1,
      neighbors: [{ name: 'roads', isRoad: true }],
      employees: { worker: 2, worker_need: 2 },
    });

    await runAtTime(8);

    const marketData = await housesStore.getHouse('Market-Stall-5-5');
    expect(marketData.isBuying).toBe(true);
  });

  test('sets isBuying false outside autumn', async () => {
    await housesStore.addHouse({
      id: 'Market-Stall-5-5',
      name: 'Market-Stall-5-5',
      type: 'Market-Stall',
      x: 5,
      y: 5,
      roads: 1,
      neighbors: [{ name: 'roads', isRoad: true }],
      employees: { worker: 2, worker_need: 2 },
      isBuying: true,
    });

    await runAtTime(6);

    const marketData = await housesStore.getHouse('Market-Stall-5-5');
    expect(marketData.isBuying).toBe(false);
  });

  test('updates noFarmsNearby on markets', async () => {
    await housesStore.addHouse({
      id: 'Market-Stall-5-5',
      name: 'Market-Stall-5-5',
      type: 'Market-Stall',
      x: 5,
      y: 5,
      roads: 1,
      neighbors: [{ name: 'roads', isRoad: true }],
      employees: { worker: 2, worker_need: 2 },
    });

    await runAtTime(6);

    expect((await housesStore.getHouse('Market-Stall-5-5')).noFarmsNearby).toBe(true);

    await housesStore.updateHouseFields('Market-Stall-5-5', {
      neighbors: [
        { name: 'roads', isRoad: true },
        { name: 'Farm-Wheat-5-4', type: 'Farm-Wheat', x: 5, y: 4 },
      ],
    });

    await runAtTime(7);

    expect((await housesStore.getHouse('Market-Stall-5-5')).noFarmsNearby).toBe(false);
  });
});

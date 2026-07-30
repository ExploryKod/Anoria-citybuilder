/**
 * Behavior tests — Supply: monthly food supply cycle
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { createSupplyContext, resetSupplyContextForTests } from '../../../src/composition/createSupplyContext.js';
import { TimeManager } from '../../../src/js/game/utils/TimeManager.js';
import { toSupplySeason, toSupplyMonth } from '../../../src/js/acl/supply.js';
import { HouseStore } from '../../../src/js/stores/HousesStore.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../../fixtures/buildingRecord.js';

async function clearHousesTable() {
  await db.open();
  await db.houses.clear();
}

describe('Supply — RunMonthlyFoodSupplyCycle', () => {
  let housesStore;
  let supply;
  let marketId;

  beforeEach(async () => {
    resetSupplyContextForTests();
    await clearHousesTable();
    housesStore = new HouseStore();
    supply = createSupplyContext();
    marketId = createBuildingInstanceId();
  });

  afterEach(async () => {
    resetSupplyContextForTests();
    await clearHousesTable();
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
    await housesStore.addHouse(
      makeHouseRecord({
        instanceId: marketId,
        type: 'Market-Stall',
        x: 5,
        y: 5,
        extra: {
          roads: 1,
          neighbors: [{ name: 'roads', isRoad: true }],
          employees: { worker: 2, worker_need: 2 },
        },
      })
    );

    await runAtTime(8);

    const marketData = await housesStore.getHouse(marketId);
    expect(marketData.isBuying).toBe(true);
  });

  test('sets isBuying false outside autumn', async () => {
    await housesStore.addHouse(
      makeHouseRecord({
        instanceId: marketId,
        type: 'Market-Stall',
        x: 5,
        y: 5,
        extra: {
          roads: 1,
          neighbors: [{ name: 'roads', isRoad: true }],
          employees: { worker: 2, worker_need: 2 },
          isBuying: true,
        },
      })
    );

    await runAtTime(6);

    const marketData = await housesStore.getHouse(marketId);
    expect(marketData.isBuying).toBe(false);
  });

  test('updates noFarmsNearby on markets', async () => {
    await housesStore.addHouse(
      makeHouseRecord({
        instanceId: marketId,
        type: 'Market-Stall',
        x: 5,
        y: 5,
        extra: {
          roads: 1,
          neighbors: [{ name: 'roads', isRoad: true }],
          employees: { worker: 2, worker_need: 2 },
        },
      })
    );

    await runAtTime(6);

    expect((await housesStore.getHouse(marketId)).noFarmsNearby).toBe(true);

    const farmNeighborId = createBuildingInstanceId();
    await housesStore.updateHouseFields(marketId, {
      neighbors: [
        { name: 'roads', isRoad: true },
        {
          name: 'Farm-Wheat',
          type: 'Farm-Wheat',
          id: farmNeighborId,
          buildingId: farmNeighborId,
          x: 5,
          y: 4,
        },
      ],
    });

    await runAtTime(7);

    expect((await housesStore.getHouse(marketId)).noFarmsNearby).toBe(false);
  });
});

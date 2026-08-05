/**
 * Behavior tests — Supply: monthly food supply cycle
 */

import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createSupplyContext, resetSupplyContextForTests } from '../../../src/composition/createSupplyContext.js';
import { TimeManager } from '../../../src/shared/time/TimeManager.js';
import { toSupplySeason, toSupplyMonth } from '../../../src/composition/supplyOps.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { makeHouseRecord } from '../../fixtures/buildingRecord.js';
import { clearBuildingsTable, seedBuilding, getBuildingRow } from '../../helpers/buildingDb.js';
import { updateBuildingFields } from '../../../src/composition/constructionOps.js';

describe('Supply — RunMonthlyFoodSupplyCycle', () => {
  let supply;
  let marketId;

  beforeEach(async () => {
    resetSupplyContextForTests();
    await clearBuildingsTable();
    supply = createSupplyContext();
    marketId = createBuildingInstanceId();
  });

  afterEach(async () => {
    resetSupplyContextForTests();
    await clearBuildingsTable();
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

  test('marks marketTooFar when no windmill link exists', async () => {
    await seedBuilding(
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

    const marketData = await getBuildingRow(marketId);
    expect(marketData.marketTooFar).toBe(true);
  });

  test('clears noFarmsNearby flag on markets', async () => {
    await seedBuilding(
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

    expect((await getBuildingRow(marketId)).noFarmsNearby).toBe(false);

    const farmNeighborId = createBuildingInstanceId();
    await updateBuildingFields(marketId, {
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

    expect((await getBuildingRow(marketId)).noFarmsNearby).toBe(false);
  });
});

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

describe('Supply — RunMonthlyResourceCycle', () => {
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
    await supply.runMonthlyResourceCycle({
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
    expect(marketData.distributorTooFar).toBe(true);
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

    expect((await getBuildingRow(marketId)).noSourcesNearby).toBe(false);

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

    expect((await getBuildingRow(marketId)).noSourcesNearby).toBe(false);
  });

  test('logs each farm every month, and a farm only counts as active once a hub bought its harvest', async () => {
    const staffedId = createBuildingInstanceId();
    const idleId = createBuildingInstanceId();
    const hubId = createBuildingInstanceId();
    const build = (instanceId, type, x, employees) =>
      makeHouseRecord({
        instanceId,
        type,
        x,
        y: 1,
        extra: { roads: 1, neighbors: [{ name: 'roads', isRoad: true }], employees },
      });
    await seedBuilding(build(staffedId, 'Farm-Wheat', 1, { worker: 3, worker_need: 3 }));
    await seedBuilding(build(idleId, 'Farm-Wheat', 3, { worker: 0, worker_need: 3 }));
    await seedBuilding(build(hubId, 'Windmill-001', 5, { worker: 4, worker_need: 4 }));

    const firstDayOf = (predicate) => {
      let day = 0;
      while (!predicate(TimeManager.getTimeInfo(day))) day += 1;
      return day;
    };
    const rows = async (type) =>
      (await supply.getAllSupplyTraceabilityTransactions()).filter((t) => t.transactionType === type);

    await runAtTime(firstDayOf((info) => info.season === 'Automne'));

    const states = Object.fromEntries((await rows('producer_state')).map((t) => [t.fromId, t.quantity]));
    expect(states[staffedId]).toBe(1);
    expect(states[idleId]).toBe(0);
    expect(await rows('source_to_hub')).toHaveLength(0);

    await runAtTime(firstDayOf((info) => info.month === 'Décembre'));

    const sales = await rows('source_to_hub');
    expect(sales.map((t) => t.fromId)).toEqual([staffedId]);
    expect(sales[0].quantity).toBeGreaterThan(0);
  });
});

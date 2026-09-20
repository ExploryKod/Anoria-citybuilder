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

    const states = Object.fromEntries((await rows('chain_state')).map((t) => [t.fromId, t.quantity]));
    expect(states[staffedId]).toBe(1);
    expect(states[idleId]).toBe(0);
    expect(states[hubId]).toBe(1);
    expect(await rows('source_to_hub')).toHaveLength(0);

    await runAtTime(firstDayOf((info) => info.month === 'Décembre'));

    const sales = await rows('source_to_hub');
    expect(sales.map((t) => t.fromId)).toEqual([staffedId]);
    expect(sales[0].quantity).toBeGreaterThan(0);
  });

  test('logs the population of each house, and why a farm did not sell on the collection turn (a road is not one)', async () => {
    const rowFor = (instanceId, type, x, extra) =>
      makeHouseRecord({
        instanceId,
        type,
        x,
        y: 1,
        extra: { roads: 1, neighbors: [{ name: 'roads', isRoad: true }], ...extra },
      });
    const farmStock = { food: 78, wheat: 78, carrot: 0, cabbage: 0 };
    const houseId = createBuildingInstanceId();
    const roadlessId = createBuildingInstanceId();
    const noHarvestId = createBuildingInstanceId();
    const fullHubFarmId = createBuildingInstanceId();
    const hubId = createBuildingInstanceId();
    const staffed = { worker: 3, worker_need: 3 };

    await seedBuilding(rowFor(houseId, 'House-Red', 1, { pop: 12 }));
    await seedBuilding(rowFor(roadlessId, 'Farm-Wheat', 2, { roads: 0, stocks: farmStock, employees: staffed }));
    await seedBuilding(rowFor(noHarvestId, 'Farm-Wheat', 3, { employees: staffed }));
    await seedBuilding(rowFor(fullHubFarmId, 'Farm-Wheat', 4, { stocks: farmStock, employees: staffed }));
    // A hub already at its ceiling has no room for another basket
    await seedBuilding(
      rowFor(hubId, 'Windmill-001', 5, {
        stocks: { food: 1000, wheat: 1000, carrot: 0, cabbage: 0 },
        employees: { worker: 4, worker_need: 4 },
      })
    );

    let december = 0;
    while (TimeManager.getTimeInfo(december).month !== 'Décembre') december += 1;
    await runAtTime(december);

    const rows = await supply.getAllSupplyTraceabilityTransactions();
    const population = rows.filter((t) => t.transactionType === 'population_state');
    expect(population.map((t) => [t.fromId, t.quantity])).toEqual([[houseId, 12]]);

    const cause = Object.fromEntries(
      rows.filter((t) => t.transactionType === 'sale_missed').map((t) => [t.fromId, t.cause])
    );
    // Fields need no road: the roadless farm is held back by the full hub, like the others
    expect(cause[roadlessId]).toBe('hub_full');
    expect(cause[noHarvestId]).toBe('no_workers');
    expect(cause[fullHubFarmId]).toBe('hub_full');
  });

  test('a farm without a road is bought by the hub like any other', async () => {
    const roadlessId = createBuildingInstanceId();
    const hubId = createBuildingInstanceId();
    const row = (instanceId, type, x, extra) =>
      makeHouseRecord({
        instanceId,
        type,
        x,
        y: 1,
        extra: { roads: 1, neighbors: [{ name: 'roads', isRoad: true }], ...extra },
      });
    await seedBuilding(
      row(roadlessId, 'Farm-Wheat', 2, {
        roads: 0,
        stocks: { food: 78, wheat: 78, carrot: 0, cabbage: 0 },
        employees: { worker: 3, worker_need: 3 },
      })
    );
    await seedBuilding(row(hubId, 'Windmill-001', 5, { employees: { worker: 4, worker_need: 4 } }));

    let december = 0;
    while (TimeManager.getTimeInfo(december).month !== 'Décembre') december += 1;
    await runAtTime(december);

    const sales = (await supply.getAllSupplyTraceabilityTransactions()).filter(
      (t) => t.transactionType === 'source_to_hub' && t.fromId === roadlessId
    );
    expect(sales.map((t) => t.quantity)).toEqual([78]);
  });

  describe('the goods a house holds stay consistent with its total', () => {
    const CATEGORIES = ['wheat', 'carrot', 'cabbage', 'fruit', 'game'];
    const row = (instanceId, type, x, extra) =>
      makeHouseRecord({
        instanceId,
        type,
        x,
        y: 1,
        extra: { roads: 1, neighbors: [{ name: 'roads', isRoad: true }], ...extra },
      });

    test('a market delivery keeps what the house gathered, and the total is the sum of its goods', async () => {
      const houseId = createBuildingInstanceId();
      const marketId = createBuildingInstanceId();
      await seedBuilding(
        row(houseId, 'House-Red', 1, {
          pop: 1,
          stocks: { wheat: 0, carrot: 0, cabbage: 0, fruit: 3, game: 3, food: 6 },
        })
      );
      await seedBuilding(
        row(marketId, 'Market-Stall', 3, {
          stocks: { wheat: 40, carrot: 0, cabbage: 0, fruit: 0, game: 0, food: 40 },
          employees: { worker: 2, worker_need: 2 },
        })
      );

      await runAtTime(0);

      const { stocks } = await getBuildingRow(houseId);
      const sum = CATEGORIES.reduce((total, category) => total + (stocks[category] || 0), 0);
      // The delivery reached the house, and did not wipe the fruit and game it had
      expect(stocks.wheat).toBeGreaterThan(0);
      expect(stocks.fruit).toBeGreaterThanOrEqual(3);
      expect(stocks.game).toBeGreaterThanOrEqual(3);
      expect(stocks.food).toBe(sum);
    });

    test('a service rides the supply chain, and is logged as leaving the building that distributes it', async () => {
      const houseId = createBuildingInstanceId();
      const chapelId = createBuildingInstanceId();
      await seedBuilding(row(houseId, 'House-Red', 1, { pop: 12 }));
      await seedBuilding(row(chapelId, 'Chapel', 3, { employees: { worker: 2, worker_need: 2 } }));

      await runAtTime(0);

      const faith = (await supply.getAllSupplyTraceabilityTransactions()).filter(
        (t) => t.toId === houseId && t.foodType === 'faith'
      );
      expect(faith).toHaveLength(1);
      // From the chapel — and not typed as a market delivery
      expect(faith[0].fromId).toBe(chapelId);
      expect(faith[0].fromType).toBe('Chapel');
      expect(faith[0].transactionType).toBe('distributor_to_consumer');
    });
  });
});

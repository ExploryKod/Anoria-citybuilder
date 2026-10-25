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
import { getMaxStockForBuilding } from '../../../src/shared/building-catalog/resourceRoleQueries.js';
import { updateBuildingFields } from '../../../src/composition/constructionOps.js';
import { computeMonthlyDietStats } from '../../../src/presentation/dom/admin/supply-traceability/SupplyTraceabilityPanel.js';
import { buildSupplyTraceabilityExport, chainTotalKey } from '../../../src/presentation/dom/admin/supply-traceability/SupplyTraceabilityPresenter.js';
import { unlimitedConsumerMoney } from '../../helpers/unlimitedConsumerMoney.js';

describe('Supply — RunMonthlyResourceCycle', () => {
  let supply;
  let marketId;

  beforeEach(async () => {
    resetSupplyContextForTests();
    await clearBuildingsTable();
    supply = createSupplyContext({ consumerMoney: unlimitedConsumerMoney });
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
        type: 'Market-Stall-Red',
        x: 5,
        y: 5,
        extra: {
          roads: 1,
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
        type: 'Market-Stall-Red',
        x: 5,
        y: 5,
        extra: {
          roads: 1,
          employees: { worker: 2, worker_need: 2 },
        },
      })
    );

    await runAtTime(6);

    expect((await getBuildingRow(marketId)).noSourcesNearby).toBe(false);

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
        extra: { roads: 1, employees },
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
        extra: { roads: 1, ...extra },
      });
    const farmStock = { food: 78, wheat: 78, carrot: 0, cabbage: 0 };
    const houseId = createBuildingInstanceId();
    const roadlessId = createBuildingInstanceId();
    const noHarvestId = createBuildingInstanceId();
    const fullHubFarmId = createBuildingInstanceId();
    const hubId = createBuildingInstanceId();
    const staffed = { worker: 3, worker_need: 3 };
    const HUB_CAP = getMaxStockForBuilding('Windmill-001');

    await seedBuilding(rowFor(houseId, 'House-Red', 1, { pop: 12 }));
    await seedBuilding(rowFor(roadlessId, 'Farm-Wheat', 2, { roads: 0, stocks: farmStock, employees: staffed }));
    await seedBuilding(rowFor(noHarvestId, 'Farm-Wheat', 3, { employees: staffed }));
    await seedBuilding(rowFor(fullHubFarmId, 'Farm-Wheat', 4, { stocks: farmStock, employees: staffed }));
    // A hub already at its ceiling has no room for another basket
    await seedBuilding(
      rowFor(hubId, 'Windmill-001', 5, {
        stocks: { food: HUB_CAP, wheat: HUB_CAP, carrot: 0, cabbage: 0 },
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
        extra: { roads: 1, ...extra },
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
    const CATEGORIES = ['wheat', 'carrot', 'cabbage'];
    const row = (instanceId, type, x, extra) =>
      makeHouseRecord({
        instanceId,
        type,
        x,
        y: 1,
        extra: { roads: 1, ...extra },
      });

    test('a market delivery keeps what the house already held, and the total is the sum of its goods', async () => {
      const houseId = createBuildingInstanceId();
      const marketId = createBuildingInstanceId();
      await seedBuilding(
        row(houseId, 'House-Red', 1, {
          // 10 inhabitants eat 10 units a month: the house already holds some carrot and cabbage by the
          // time the market fills what is still missing.
          pop: 10,
          stocks: { wheat: 0, carrot: 3, cabbage: 3, food: 6 },
        })
      );
      await seedBuilding(
        row(marketId, 'Market-Stall-Red', 3, {
          stocks: { wheat: 40, carrot: 0, cabbage: 0, food: 40 },
          employees: { worker: 2, worker_need: 2 },
        })
      );

      await runAtTime(0);

      const { stocks, lastConsumption } = await getBuildingRow(houseId);
      const sum = CATEGORIES.reduce((total, category) => total + (stocks[category] || 0), 0);
      // The house asked for exactly this month's meal, so it holds nothing after eating: what it
      // ate says what reached it. The delivery came in, and the carrot and cabbage it had were not wiped.
      expect(lastConsumption.totalUnfed).toBe(0);
      expect(lastConsumption.takenByCategory.wheat).toBeGreaterThan(0);
      expect(lastConsumption.takenByCategory.carrot).toBeGreaterThanOrEqual(3);
      expect(lastConsumption.takenByCategory.cabbage).toBeGreaterThanOrEqual(3);
      expect(stocks.food).toBe(sum);
    });

    test('a service rides the supply chain, and is logged as leaving the building that distributes it', async () => {
      // Water is a quantity need: the tank produces and distributes it exactly like a market sells food — round-robin,
      // one unit per pass — so, like the wheat delivery above, this is several rows summing to the house's real need
      // (4 m³/resident/month), not one row of a flat amount.
      const houseId = createBuildingInstanceId();
      const tankId = createBuildingInstanceId();
      await seedBuilding(row(houseId, 'House-Red', 1, { pop: 12 }));
      await seedBuilding(row(tankId, 'WaterTank', 3, { employees: { worker: 2, worker_need: 2 } }));

      await runAtTime(0);

      const water = (await supply.getAllSupplyTraceabilityTransactions()).filter(
        (t) => t.toId === houseId && t.foodType === 'water'
      );
      expect(water.length).toBeGreaterThan(0);
      expect(water.reduce((sum, t) => sum + t.quantity, 0)).toBe(48);
      // From the tank — and not typed as a market delivery
      for (const transfer of water) {
        expect(transfer.fromId).toBe(tankId);
        expect(transfer.fromType).toBe('WaterTank');
        expect(transfer.transactionType).toBe('distributor_to_consumer');
      }
    });
  });

  describe('the city\'s history: building states and game events', () => {
    const row = (instanceId, type, x, extra) =>
      makeHouseRecord({
        instanceId,
        type,
        x,
        y: 1,
        extra: { roads: 1, ...extra },
      });
    const stateRows = async (buildingId) =>
      (await supply.getAllSupplyTraceabilityTransactions()).filter(
        (t) => t.transactionType === 'building_state' && t.fromId === buildingId
      );

    test('inhabitants born after the meal are not counted as unfed', () => {
      const at = { turn: 1, date: '2026-01-01', year: 0, month: 3 };
      const { dataByYearMonth } = computeMonthlyDietStats(
        [
          { ...at, transactionType: 'population_state', fromId: 'h1', quantity: 13 },
          { ...at, transactionType: 'house_consumption', foodType: chainTotalKey, fromId: 'h1', quantity: 12, pop: 12 },
        ],
        []
      );
      expect(dataByYearMonth['0-3']).toMatchObject({ fedPopulation: 12, unfedPopulation: 0 });
    });

    test('a farm demolished before the harvest is sold says so, instead of "unknown"', () => {
      const at = { turn: 1, date: '2026-01-01', year: 0 };
      const farm = (id) => ({ fromId: id, fromType: 'Farm-Wheat', fromCoords: '1,1' });
      const rows = [
        { ...at, month: 3, transactionType: 'chain_state', quantity: 1, ...farm('kept') },
        { ...at, month: 3, transactionType: 'chain_state', quantity: 1, ...farm('gone') },
        { ...at, month: 3, transactionType: 'chain_state', quantity: 1, fromId: 'mill', fromType: 'Windmill-001' },
        { ...at, month: 4, transactionType: 'game_event', event: 'building_demolished', ...farm('gone') },
        { ...at, month: 11, transactionType: 'source_to_hub', quantity: 78, toId: 'mill', ...farm('kept') },
      ];
      const [year] = buildSupplyTraceabilityExport(rows, [
        { year: 0, month: 3, fedPopulation: 1, unfedPopulation: 0 },
        { year: 0, month: 11, fedPopulation: 1, unfedPopulation: 0 },
      ]).years;

      expect(year.farms).toMatchObject({ total: 2, sold: 1, unsold: 1 });
      expect(year.farms.causes).toEqual([{ id: 'demolished', count: 1 }]);
    });

    test('a demolition carries what was demolished, by the catalog\'s category', async () => {
      await supply.recordBuildingEvent({
        timeInfo: TimeManager.getTimeInfo(0),
        event: 'demolished',
        building: { id: null, type: 'Tree-Pine-001', x: 2, y: 2 },
      });
      const demolition = (await supply.getAllSupplyTraceabilityTransactions()).find(
        (t) => t.event === 'building_demolished' && t.fromType === 'Tree-Pine-001'
      );
      expect(demolition.details).toEqual({ category: 'nature' });
    });

    test('house level changes, famine deaths and building placements are kept as events', async () => {
      const houseId = createBuildingInstanceId();
      await seedBuilding(row(houseId, 'House-Red', 1, { pop: 12, level: 2 }));
      const timeInfo = TimeManager.getTimeInfo(5);

      await supply.recordHouseChanges(timeInfo, [
        { houseId, previousLevel: 2, targetLevel: 3, previousPop: 12, targetPop: 18, reason: 'level2_to_level3' },
        { houseId, previousLevel: 3, targetLevel: 2, previousPop: 18, targetPop: 12, reason: 'level3_to_level2' },
      ]);
      await supply.recordFamineDeaths(timeInfo, 4);
      await supply.recordFamineDeaths(timeInfo, 0);
      await supply.recordBuildingEvent({
        timeInfo,
        event: 'demolished',
        building: { id: houseId, type: 'House-Red', x: 1, y: 1 },
      });

      // The table also holds the events of the other tests: keep this test's own
      const events = (await supply.getAllSupplyTraceabilityTransactions()).filter(
        (t) => t.transactionType === 'game_event' && (t.fromId === houseId || t.event === 'famine_deaths')
      );
      expect(events.map((t) => t.event).sort()).toEqual([
        'building_demolished',
        'famine_deaths',
        'house_level_down',
        'house_level_up',
      ]);
      expect(events.find((t) => t.event === 'famine_deaths').quantity).toBe(4);
      expect(events.find((t) => t.event === 'house_level_up').details).toMatchObject({
        previousLevel: 2,
        targetLevel: 3,
      });
    });

  });
});

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
import { computeMonthlyFoodStats } from '../../../src/presentation/dom/admin/food-traceability/FoodTraceabilityPanel.js';
import { buildFoodTraceabilityExport } from '../../../src/presentation/dom/admin/food-traceability/FoodTraceabilityPresenter.js';

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

  describe('the city\'s history: building states and game events', () => {
    const row = (instanceId, type, x, extra) =>
      makeHouseRecord({
        instanceId,
        type,
        x,
        y: 1,
        extra: { roads: 1, neighbors: [{ name: 'roads', isRoad: true }], ...extra },
      });
    const stateRows = async (buildingId) =>
      (await supply.getAllSupplyTraceabilityTransactions()).filter(
        (t) => t.transactionType === 'building_state' && t.fromId === buildingId
      );

    test('a building state is logged when it changes, and only then', async () => {
      const houseId = createBuildingInstanceId();
      const farmId = createBuildingInstanceId();
      await seedBuilding(row(houseId, 'House-Red', 1, { pop: 12, level: 2 }));
      await seedBuilding(row(farmId, 'Farm-Wheat', 3, { employees: { worker: 3, worker_need: 3 } }));

      await runAtTime(0);
      const first = await stateRows(farmId);
      expect(first).toHaveLength(1);
      expect(first[0].state).toMatchObject({ workers: 3, workerNeed: 3 });
      expect((await stateRows(houseId))[0].state).toMatchObject({ pop: 12, level: 2 });

      // Nothing moved on the farm: no new row. Its staff leaves: one new row.
      await runAtTime(0);
      expect(await stateRows(farmId)).toHaveLength(1);
      await updateBuildingFields(farmId, { employees: { worker: 0, worker_need: 3 } });
      await runAtTime(0);
      const afterLoss = await stateRows(farmId);
      expect(afterLoss).toHaveLength(2);
      expect(afterLoss[1].state.workers).toBe(0);
    });

    test('a house state is taken at the end of the tick: the meal and the services are in it', async () => {
      const houseId = createBuildingInstanceId();
      await seedBuilding(row(houseId, 'House-Red', 1, { pop: 6, stocks: { wheat: 6, food: 6 } }));

      await runAtTime(0);

      const [first] = await stateRows(houseId);
      // The meal happened during the tick, so this state already shows it
      expect(first.state.lastConsumption).toMatchObject({ month: 0, demand: 6, taken: 6 });
      expect(first.state).toHaveProperty('servedFlags');
      // And the meal itself remembers how many sat at the table
      const meals = (await supply.getAllSupplyTraceabilityTransactions()).filter(
        (t) => t.transactionType === 'house_consumption' && t.fromId === houseId
      );
      expect(meals.map((t) => t.pop)).toEqual([6]);
    });

    test('inhabitants born after the meal are not counted as unfed', () => {
      const at = { turn: 1, date: '2026-01-01', year: 0, month: 3 };
      const { dataByYearMonth } = computeMonthlyFoodStats(
        [
          { ...at, transactionType: 'population_state', fromId: 'h1', quantity: 13 },
          { ...at, transactionType: 'house_consumption', fromId: 'h1', quantity: 12, pop: 12 },
        ],
        []
      );
      expect(dataByYearMonth['0-3']).toMatchObject({ fedPopulation: 12, unfedPopulation: 0 });
    });

    test('the city\'s employment is logged when it changes, and the export shows it month by month', async () => {
      const summary = (unemployed) => ({
        totalPopulation: 48,
        laborPool: 44,
        totalAssigned: 44 - unemployed,
        totalNeed: 30,
        unemployed,
        unemploymentPercentage: Math.round((unemployed / 44) * 100),
        lack: 0,
        byGroup: { artisans: { workerPool: 24, assigned: 24 - unemployed, unemployed } },
        bySkill: {},
      });
      // Isolate this test from the employment rows other tests left in the table
      const start = TimeManager.getTimeInfo(0);
      const months = [
        { year: start.year, month: 0, fedPopulation: 1, unfedPopulation: 0 },
        { year: start.year, month: 1, fedPopulation: 1, unfedPopulation: 0 },
      ];

      await supply.recordEmploymentSummary({ ...start, turn: 10, monthIndex: 0 }, summary(10));
      await supply.recordEmploymentSummary({ ...start, turn: 11, monthIndex: 0 }, summary(10)); // unchanged: no row
      await supply.recordEmploymentSummary({ ...start, turn: 20, monthIndex: 1 }, summary(4));

      const rows = (await supply.getAllSupplyTraceabilityTransactions()).filter(
        (t) => t.transactionType === 'employment_summary' && [10, 11, 20].includes(t.turn)
      );
      expect(rows.map((t) => t.turn).sort((a, b) => a - b)).toEqual([10, 20]);

      const [year] = buildFoodTraceabilityExport(rows, months).years;
      expect(year.months.map((m) => m.unemployment.unemployed)).toEqual([10, 4]);
      expect(year.months[1].unemployment.byGroup.artisans.unemployed).toBe(4);
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
      const [year] = buildFoodTraceabilityExport(rows, [
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

    test('the export rebuilds each month\'s stocks, staff and house levels, and drops a demolished building', async () => {
      const houseId = createBuildingInstanceId();
      const farmId = createBuildingInstanceId();
      await seedBuilding(
        row(houseId, 'House-Red', 1, { pop: 12, level: 2, stocks: { wheat: 20, food: 20 } })
      );
      await seedBuilding(row(farmId, 'Farm-Wheat', 3, { employees: { worker: 3, worker_need: 3 } }));
      await runAtTime(0);

      // The table also holds the buildings of the other tests: keep this test's own
      const mine = async () =>
        (await supply.getAllSupplyTraceabilityTransactions()).filter(
          (t) => [houseId, farmId].includes(t.fromId)
        );
      const monthly = [{ year: 0, month: 0, fedPopulation: 12, unfedPopulation: 0 }];
      const [year] = buildFoodTraceabilityExport(await mine(), monthly).years;

      const january = year.months[0].buildings;
      expect(january.employment).toEqual({ workers: 3, workerNeed: 3, understaffedBuildings: 0 });
      expect(january.houseLevels).toEqual({ 2: 1 });
      // 20 in the pantry + 2 gathered - 12 eaten, all during the tick: the state is the end of it
      expect(january.stocks.houses).toBe(10);
      expect(year.endOfYearBuildings.map((b) => b.id).sort()).toEqual([farmId, houseId].sort());

      await supply.recordBuildingEvent({
        timeInfo: TimeManager.getTimeInfo(0),
        event: 'demolished',
        building: { id: farmId, type: 'Farm-Wheat', x: 3, y: 1 },
      });
      const after = buildFoodTraceabilityExport(await mine(), monthly);
      expect(after.years[0].endOfYearBuildings.map((b) => b.id)).toEqual([houseId]);
      expect(after.events.some((e) => e.event === 'building_demolished')).toBe(true);
    });
  });
});

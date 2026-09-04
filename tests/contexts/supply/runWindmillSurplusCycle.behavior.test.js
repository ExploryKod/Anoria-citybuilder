/**
 * Behavior tests — Supply: windmill surplus cycle (UUID)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { CollectResourceToHub } from '../../../src/contexts/supply/application/commands/surplus/CollectResourceToHub.js';
import { SetHubCollectingFlag } from '../../../src/contexts/supply/application/commands/surplus/SetHubCollectingFlag.js';
import { MarkSourceCollectedByHub } from '../../../src/contexts/supply/application/commands/surplus/MarkSourceCollectedByHub.js';
import { MarkHubCollectingSchedule } from '../../../src/contexts/supply/application/commands/surplus/MarkHubCollectingSchedule.js';
import { ResetSourcesCollectedFlag } from '../../../src/contexts/supply/application/commands/surplus/ResetSourcesCollectedFlag.js';
import { ProcessHubCollection } from '../../../src/contexts/supply/application/commands/surplus/ProcessHubCollection.js';
import { RunHubSurplusCycle } from '../../../src/contexts/supply/application/commands/surplus/RunHubSurplusCycle.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          stocks: { ...b.stocks },
          flags: { ...(b.flags || {}) },
          salesToHub: [...(b.salesToHub || [])],
          salesToDistributor: [...(b.salesToDistributor || [])],
          lastCollection: b.lastCollection ?? null,
        },
      ])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return createSupplyBuildingSnapshot({
      id: b.id,
      type: b.type,
      roadCount: b.roadCount,
      worker: b.worker,
      workerNeed: b.workerNeed,
      stocks: createSupplyStock(b.stocks),
      maxStock: b.maxStock,
    });
  }

  async findSupplyView(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return {
      id: b.id,
      collectedByHub: b.flags.collectedByHub === true,
      isCollecting: b.flags.isCollecting === true,
    };
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createSupplyStock(stocks) };
  }

  async saveSupplyFlags(id, flags) {
    const b = this.raw.get(id);
    if (b) b.flags = { ...b.flags, ...flags };
  }

  async saveHubLastCollection(id, lastCollection) {
    const b = this.raw.get(id);
    if (b) b.lastCollection = { ...lastCollection };
  }

  async recordSourceSaleToHub(sourceId, { year, productType, quantity, hubId }) {
    const b = this.raw.get(sourceId);
    if (!b) return;
    b.salesToHub.push({ year, productType, quantity, hubId, count: 1 });
  }

  async resetSourceSalesForYear(year) {
    for (const b of this.raw.values()) {
      if (!hasResourceRole(b.type, 'producer')) continue;
      b.salesToDistributor = b.salesToDistributor.filter((sale) => sale.year === year);
      b.salesToHub = b.salesToHub.filter((sale) => sale.year === year);
    }
  }

  async findByResourceRole(role, categories) {
    return [...this.raw.values()]
      .filter((b) => hasResourceRole(b.type, role, categories))
      .map((b) => this.#snapshot(b));
  }

  #snapshot(b) {
    return createSupplyBuildingSnapshot({
      id: b.id,
      type: b.type,
      x: b.x ?? null,
      y: b.y ?? null,
      roadCount: b.roadCount,
      worker: b.worker,
      workerNeed: b.workerNeed,
      stocks: createSupplyStock(b.stocks),
      maxStock: b.maxStock,
    });
  }
}

function windmill(id, stocks = { food: 0 }, extras = {}) {
  return {
    id,
    type: 'Windmill-001',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 1000,
    ...extras,
  };
}

function farm(id, type, stocks, extras = {}) {
  return {
    id,
    type,
    roadCount: 1,
    stocks,
    maxStock: 100,
    flags: { collectedByHub: false },
    ...extras,
  };
}

describe('Supply — windmill surplus cycle', () => {
  let repo;
  let runCycle;
  let windmillId;
  let wheatFarmId;
  let cabbageFarmId;

  beforeEach(() => {
    windmillId = createBuildingInstanceId();
    wheatFarmId = createBuildingInstanceId();
    cabbageFarmId = createBuildingInstanceId();
    repo = new InMemorySupplyBuildingRepository([
      windmill(windmillId),
      farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }),
      farm(cabbageFarmId, 'Farm-Cabbage', { cabbage: 4, food: 4 }, {
        flags: { collectedByHub: true },
      }),
    ]);

    const collect = new CollectResourceToHub(repo);
    const setCollecting = new SetHubCollectingFlag(repo);
    const markSold = new MarkSourceCollectedByHub(repo);
    const process = new ProcessHubCollection(
      repo,
      collect,
      setCollecting,
      markSold
    );
    const markSeason = new MarkHubCollectingSchedule(repo);
    const resetSold = new ResetSourcesCollectedFlag(repo);
    runCycle = new RunHubSurplusCycle(
      repo,
      markSeason,
      resetSold,
      process
    );
  });

  test('outside December clears soldToWindmill flags only when set', async () => {
    const outcome = await runCycle.execute({
      month: 'november',
      monthIndex: 10,
      dayInMonth: 15,
      year: 2,
    });

    expect(outcome.ranCollection).toBe(false);
    expect((await repo.findSupplyView(cabbageFarmId)).collectedByHub).toBe(false);
    expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(10);
  });

  test('December collects surplus and marks farms sold to windmill', async () => {
    const outcome = await runCycle.execute({
      month: 'december',
      monthIndex: 11,
      dayInMonth: 15,
      year: 2,
    });

    expect(outcome.ranCollection).toBe(true);
    expect(outcome.hubs).toHaveLength(1);
    expect(outcome.hubs[0].collected).toBe(true);
    expect(outcome.hubs[0].totalUnits).toBe(14);

    const mill = await repo.findById(windmillId);
    expect(mill.stocks.food).toBe(14);
    expect((await repo.findSupplyView(wheatFarmId)).collectedByHub).toBe(true);
    expect((await repo.findSupplyView(cabbageFarmId)).collectedByHub).toBe(true);
    expect(repo.raw.get(wheatFarmId).salesToHub).toHaveLength(1);
  });

  test('December day 1 resets farm sales for the year', async () => {
    repo.raw.get(wheatFarmId).salesToHub = [
      { year: 1, productType: 'wheat', quantity: 5 },
      { year: 2, productType: 'wheat', quantity: 3 },
    ];

    await runCycle.execute({
      month: 'december',
      monthIndex: 11,
      dayInMonth: 1,
      year: 2,
    });

    const sales = repo.raw.get(wheatFarmId).salesToHub;
    expect(sales.find((sale) => sale.year === 1)).toBeUndefined();
    expect(sales.some((sale) => sale.year === 2)).toBe(true);
  });
});

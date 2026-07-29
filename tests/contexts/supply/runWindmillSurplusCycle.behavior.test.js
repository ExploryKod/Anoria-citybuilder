/**
 * Behavior tests — Supply: windmill surplus cycle
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { WindmillCollectsFromAllFarms } from '../../../src/contexts/supply/application/commands/surplus/WindmillCollectsFromAllFarms.js';
import { SetWindmillCollectingFlag } from '../../../src/contexts/supply/application/commands/surplus/SetWindmillCollectingFlag.js';
import { MarkFarmSoldToWindmill } from '../../../src/contexts/supply/application/commands/surplus/MarkFarmSoldToWindmill.js';
import { MarkWindmillCollectingSeason } from '../../../src/contexts/supply/application/commands/surplus/MarkWindmillCollectingSeason.js';
import { ResetFarmsSoldToWindmill } from '../../../src/contexts/supply/application/commands/surplus/ResetFarmsSoldToWindmill.js';
import { ProcessWindmillCollection } from '../../../src/contexts/supply/application/commands/surplus/ProcessWindmillCollection.js';
import { RunWindmillSurplusCycle } from '../../../src/contexts/supply/application/commands/surplus/RunWindmillSurplusCycle.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          stocks: { ...b.stocks },
          flags: { ...(b.flags || {}) },
          salesToWindmill: [...(b.salesToWindmill || [])],
          salesToMarket: [...(b.salesToMarket || [])],
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
      stocks: createFoodStock(b.stocks),
      maxStock: b.maxStock,
    });
  }

  async findSupplyView(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return {
      id: b.id,
      soldToWindmill: b.flags.soldToWindmill === true,
      isCollecting: b.flags.isCollecting === true,
    };
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createFoodStock(stocks) };
  }

  async saveMarketFlags(id, flags) {
    const b = this.raw.get(id);
    if (b) b.flags = { ...b.flags, ...flags };
  }

  async saveWindmillLastCollection(id, lastCollection) {
    const b = this.raw.get(id);
    if (b) b.lastCollection = { ...lastCollection };
  }

  async recordFarmSaleToWindmill(farmId, { year, productType, quantity, windmillId }) {
    const b = this.raw.get(farmId);
    if (!b) return;
    b.salesToWindmill.push({ year, productType, quantity, windmillId, count: 1 });
  }

  async resetFarmSalesForYear(year) {
    for (const b of this.raw.values()) {
      if (!b.type.includes('Farm')) continue;
      b.salesToMarket = b.salesToMarket.filter((sale) => sale.year === year);
      b.salesToWindmill = b.salesToWindmill.filter((sale) => sale.year === year);
    }
  }

  async findWindmills() {
    return [...this.raw.values()]
      .filter((b) => b.type.includes('Windmill'))
      .map((b) => this.#snapshot(b));
  }

  async findFarms() {
    return [...this.raw.values()]
      .filter((b) => b.type.includes('Farm'))
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
      stocks: createFoodStock(b.stocks),
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
    flags: { soldToWindmill: false },
    ...extras,
  };
}

describe('Supply — windmill surplus cycle', () => {
  let repo;
  let runCycle;

  beforeEach(() => {
    repo = new InMemorySupplyBuildingRepository([
      windmill('Windmill-001-8-8'),
      farm('Farm-Wheat-4-5', 'Farm-Wheat', { wheat: 10, food: 10 }),
      farm('Farm-Cabbage-7-5', 'Farm-Cabbage', { cabbage: 4, food: 4 }, {
        flags: { soldToWindmill: true },
      }),
    ]);

    const collect = new WindmillCollectsFromAllFarms(repo);
    const setCollecting = new SetWindmillCollectingFlag(repo);
    const markSold = new MarkFarmSoldToWindmill(repo);
    const process = new ProcessWindmillCollection(
      repo,
      collect,
      setCollecting,
      markSold
    );
    const markSeason = new MarkWindmillCollectingSeason(repo);
    const resetSold = new ResetFarmsSoldToWindmill(repo);
    runCycle = new RunWindmillSurplusCycle(
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
    expect((await repo.findSupplyView('Farm-Cabbage-7-5')).soldToWindmill).toBe(false);
    expect((await repo.findById('Farm-Wheat-4-5')).stocks.wheat).toBe(10);
  });

  test('December collects surplus and marks farms sold to windmill', async () => {
    const outcome = await runCycle.execute({
      month: 'december',
      monthIndex: 11,
      dayInMonth: 15,
      year: 2,
    });

    expect(outcome.ranCollection).toBe(true);
    expect(outcome.windmills).toHaveLength(1);
    expect(outcome.windmills[0].collected).toBe(true);
    expect(outcome.windmills[0].totalBaskets).toBe(14);

    const mill = await repo.findById('Windmill-001-8-8');
    expect(mill.stocks.food).toBe(14);
    expect((await repo.findSupplyView('Farm-Wheat-4-5')).soldToWindmill).toBe(true);
    expect((await repo.findSupplyView('Farm-Cabbage-7-5')).soldToWindmill).toBe(true);
    expect(repo.raw.get('Farm-Wheat-4-5').salesToWindmill).toHaveLength(1);
  });

  test('December day 1 resets farm sales for the year', async () => {
    repo.raw.get('Farm-Wheat-4-5').salesToWindmill = [
      { year: 1, productType: 'wheat', quantity: 5 },
      { year: 2, productType: 'wheat', quantity: 3 },
    ];

    await runCycle.execute({
      month: 'december',
      monthIndex: 11,
      dayInMonth: 1,
      year: 2,
    });

    const sales = repo.raw.get('Farm-Wheat-4-5').salesToWindmill;
    expect(sales.find((sale) => sale.year === 1)).toBeUndefined();
    expect(sales.some((sale) => sale.year === 2)).toBe(true);
  });
});

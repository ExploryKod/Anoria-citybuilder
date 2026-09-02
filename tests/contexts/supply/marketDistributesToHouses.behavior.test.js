/**
 * Behavior tests — Supply: market distributes to houses (UUID)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { MARKET_DISTRIBUTE_CIRCUIT } from '../../../src/contexts/supply/domain/catalogs/FoodCircuits.js';
import { DistributeResourceToConsumers } from '../../../src/contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks } }]));
  }

  async findById(id) {
    const b = this.raw.get(id);
    return b ? { ...b, stocks: createFoodStock(b.stocks) } : null;
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createFoodStock(stocks) };
  }

  async saveMarketFlags() {}

  async findMarkets() {
    return [...this.raw.values()].filter((b) => b.type.includes('Market'));
  }
}

function market(id, stocks, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'Market-Stall',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 500,
    ...extras,
  });
}

function house(id, stocks = {}, roadCount = 1) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'House-Blue',
    roadCount,
    stocks,
    maxStock: 100,
  });
}

describe('Supply — market distribution to houses', () => {
  let repo;
  let useCase;
  let marketId;
  let house1Id;
  let house2Id;

  beforeEach(() => {
    marketId = createBuildingInstanceId();
    house1Id = createBuildingInstanceId();
    house2Id = createBuildingInstanceId();
    repo = new InMemorySupplyBuildingRepository([
      market(marketId, { wheat: 3, carrot: 2, cabbage: 1, food: 6 }),
      house(house1Id),
      house(house2Id),
    ]);
    useCase = new DistributeResourceToConsumers(repo);
  });

  test('distributes round-robin outside autumn', async () => {
    const outcome = await useCase.execute({
      sourceId: marketId,
      period: { season: 'winter' },
      circuit: MARKET_DISTRIBUTE_CIRCUIT,
      consumerRefs: [{ instanceId: house1Id }, { instanceId: house2Id }],
    });

    expect(outcome.distributed).toBe(true);
    expect(outcome.totalUnits).toBe(6);

    const m = await repo.findById(marketId);
    expect(m.stocks.food).toBe(0);
    expect(m.stocks.wheat).toBe(0);

    const h1 = await repo.findById(house1Id);
    const h2 = await repo.findById(house2Id);
    expect(h1.stocks.food + h2.stocks.food).toBe(6);
  });

  test('distributes in autumn as well', async () => {
    const outcome = await useCase.execute({
      sourceId: marketId,
      period: { season: 'autumn' },
      circuit: MARKET_DISTRIBUTE_CIRCUIT,
      consumerRefs: [{ instanceId: house1Id }],
    });
    expect(outcome.distributed).toBe(true);
    expect(outcome.totalUnits).toBe(6);
  });

  test('skips houses without road access', async () => {
    repo = new InMemorySupplyBuildingRepository([
      market(marketId, { wheat: 2, food: 2 }),
      house(house1Id, {}, 0),
    ]);
    useCase = new DistributeResourceToConsumers(repo);

    const outcome = await useCase.execute({
      sourceId: marketId,
      period: { season: 'spring' },
      circuit: MARKET_DISTRIBUTE_CIRCUIT,
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(outcome.distributed).toBe(false);
    expect((await repo.findById(marketId)).stocks.wheat).toBe(2);
  });

  test('returns transfers with house UUID', async () => {
    const outcome = await useCase.execute({
      sourceId: marketId,
      period: { season: 'summer' },
      circuit: MARKET_DISTRIBUTE_CIRCUIT,
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(outcome.transfers.length).toBeGreaterThan(0);
    expect(outcome.transfers.every((t) => t.consumerId === house1Id)).toBe(true);
  });

  test('ignore house refs without UUID', async () => {
    const outcome = await useCase.execute({
      sourceId: marketId,
      period: { season: 'winter' },
      circuit: MARKET_DISTRIBUTE_CIRCUIT,
      consumerRefs: [{ name: 'House-Purple-3-7', type: 'House-Purple', x: 3, y: 7 }],
    });
    expect(outcome.distributed).toBe(false);
    expect(outcome.reason).toBe('no_consumers');
  });
});

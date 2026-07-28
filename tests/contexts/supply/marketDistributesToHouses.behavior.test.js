/**
 * Behavior tests — Supply: market distributes to houses
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { DistributeFoodFromMarketToHouses } from '../../../src/contexts/supply/application/commands/DistributeFoodFromMarketToHouses.js';

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

  beforeEach(() => {
    repo = new InMemorySupplyBuildingRepository([
      market('Market-Stall-5-5', { wheat: 3, carrot: 2, cabbage: 1, food: 6 }),
      house('House-Blue-4-5'),
      house('House-Blue-6-5'),
    ]);
    useCase = new DistributeFoodFromMarketToHouses(repo);
  });

  test('distributes round-robin outside autumn', async () => {
    const outcome = await useCase.execute({
      marketId: 'Market-Stall-5-5',
      season: 'winter',
      houseRefs: [{ id: 'House-Blue-4-5' }, { id: 'House-Blue-6-5' }],
    });

    expect(outcome.distributed).toBe(true);
    expect(outcome.totalBaskets).toBe(6);

    const m = await repo.findById('Market-Stall-5-5');
    expect(m.stocks.food).toBe(0);
    expect(m.stocks.wheat).toBe(0);

    const h1 = await repo.findById('House-Blue-4-5');
    const h2 = await repo.findById('House-Blue-6-5');
    expect(h1.stocks.food + h2.stocks.food).toBe(6);
  });

  test('refuses in autumn', async () => {
    const outcome = await useCase.execute({
      marketId: 'Market-Stall-5-5',
      season: 'autumn',
      houseRefs: [{ id: 'House-Blue-4-5' }],
    });
    expect(outcome.distributed).toBe(false);
    expect(outcome.reason).toBe('not_distribution_season');
  });

  test('skips houses without road access', async () => {
    repo = new InMemorySupplyBuildingRepository([
      market('Market-Stall-5-5', { wheat: 2, food: 2 }),
      house('House-Blue-4-5', {}, 0),
    ]);
    useCase = new DistributeFoodFromMarketToHouses(repo);

    const outcome = await useCase.execute({
      marketId: 'Market-Stall-5-5',
      season: 'spring',
      houseRefs: [{ id: 'House-Blue-4-5' }],
    });

    expect(outcome.distributed).toBe(false);
    expect((await repo.findById('Market-Stall-5-5')).stocks.wheat).toBe(2);
  });

  test('returns transfers for legacy traceability', async () => {
    const outcome = await useCase.execute({
      marketId: 'Market-Stall-5-5',
      season: 'summer',
      houseRefs: [{ id: 'House-Blue-4-5' }],
    });

    expect(outcome.transfers.length).toBeGreaterThan(0);
    expect(outcome.transfers.every((t) => t.houseId === 'House-Blue-4-5')).toBe(true);
  });

  test('resolves HousesStore rows where name is the full building id', async () => {
    repo = new InMemorySupplyBuildingRepository([
      market('Market-Stall-5-5', { wheat: 2, food: 2 }),
      house('House-Purple-3-7', { food: 0 }),
    ]);
    useCase = new DistributeFoodFromMarketToHouses(repo);

    // Legacy listAllHouses shape: name = published id, type = building type, no `id`
    const outcome = await useCase.execute({
      marketId: 'Market-Stall-5-5',
      season: 'winter',
      houseRefs: [
        {
          name: 'House-Purple-3-7',
          type: 'House-Purple',
          x: 3,
          y: 7,
          roads: 1,
        },
      ],
    });

    expect(outcome.distributed).toBe(true);
    expect((await repo.findById('House-Purple-3-7')).stocks.wheat).toBeGreaterThan(0);
  });
});

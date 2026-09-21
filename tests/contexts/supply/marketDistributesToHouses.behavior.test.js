/**
 * Behavior tests — Supply: market distributes to houses (UUID)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { DistributeResourceToConsumers } from '../../../src/contexts/supply/application/commands/distribution/DistributeResourceToConsumers.js';
import { fairShares } from '../../../src/contexts/supply/application/services/RoundRobinDistribution.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks } }]));
  }

  async findById(id) {
    const b = this.raw.get(id);
    return b ? { ...b, stocks: createSupplyStock(b.stocks) } : null;
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createSupplyStock(stocks) };
  }

  async saveSupplyFlags() {}
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

function house(id, stocks = {}, roadCount = 1, pop = 10) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'House-Blue',
    roadCount,
    pop,
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
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(outcome.distributed).toBe(false);
    expect((await repo.findById(marketId)).stocks.wheat).toBe(2);
  });

  test('returns transfers with house UUID', async () => {
    const outcome = await useCase.execute({
      sourceId: marketId,
      period: { season: 'summer' },
      consumerRefs: [{ instanceId: house1Id }],
    });

    expect(outcome.transfers.length).toBeGreaterThan(0);
    expect(outcome.transfers.every((t) => t.consumerId === house1Id)).toBe(true);
  });

  test('ignore house refs without UUID', async () => {
    const outcome = await useCase.execute({
      sourceId: marketId,
      period: { season: 'winter' },
      consumerRefs: [{ name: 'House-Purple-3-7', type: 'House-Purple', x: 3, y: 7 }],
    });
    expect(outcome.distributed).toBe(false);
    expect(outcome.reason).toBe('no_consumers');
  });
});

describe('fairShares — split what is available under each taker\'s cap', () => {
  test('splits equally when every cap is out of reach', () => {
    expect(fairShares([Infinity, Infinity], 5)).toEqual([2, 3]);
  });

  test('serves the small needs fully and gives the rest to the others', () => {
    expect(fairShares([4, 20], 30)).toEqual([4, 20]);
    expect(fairShares([4, 20], 12)).toEqual([4, 8]);
  });

  test('never hands out more than is available or than a cap', () => {
    const shares = fairShares([3, 3, 3], 8);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(8);
    shares.forEach((share) => expect(share).toBeLessThanOrEqual(3));
  });

  test('gives nothing when nothing is available or nothing is needed', () => {
    expect(fairShares([5, 5], 0)).toEqual([0, 0]);
    expect(fairShares([0, 0], 9)).toEqual([0, 0]);
    expect(fairShares([], 9)).toEqual([]);
  });
});

describe('Supply — a market only fills what each house still needs', () => {
  // A house asks for one month of what its inhabitants eat (catalog `stockTarget`), 1 unit each.
  const stockOf = async (repo, id) => (await repo.findById(id)).stocks.food;

  async function distribute(buildings, marketId, houseIds) {
    const repo = new InMemorySupplyBuildingRepository(buildings);
    const outcome = await new DistributeResourceToConsumers(repo).execute({
      sourceId: marketId,
      period: { season: 'winter' },
      consumerRefs: houseIds.map((instanceId) => ({ instanceId })),
    });
    return { repo, outcome };
  }

  test('stops at the target and keeps the rest in the market', async () => {
    const marketId = createBuildingInstanceId();
    const houseId = createBuildingInstanceId();
    const { repo, outcome } = await distribute(
      [market(marketId, { wheat: 100, food: 100 }), house(houseId, {}, 1, 10)],
      marketId,
      [houseId],
    );

    expect(outcome.totalUnits).toBe(10);
    expect(await stockOf(repo, houseId)).toBe(10);
    expect((await repo.findById(marketId)).stocks.food).toBe(90);
  });

  test('a house already holding stock only receives the difference', async () => {
    const marketId = createBuildingInstanceId();
    const houseId = createBuildingInstanceId();
    const { repo } = await distribute(
      [market(marketId, { wheat: 100, food: 100 }), house(houseId, { wheat: 6, food: 6 }, 1, 10)],
      marketId,
      [houseId],
    );

    expect(await stockOf(repo, houseId)).toBe(10);
  });

  test('shares a short stock fairly between houses of different sizes', async () => {
    const marketId = createBuildingInstanceId();
    const bigId = createBuildingInstanceId();
    const smallId = createBuildingInstanceId();
    const { repo } = await distribute(
      [market(marketId, { wheat: 8, food: 8 }), house(bigId, {}, 1, 10), house(smallId, {}, 1, 2)],
      marketId,
      [bigId, smallId],
    );

    expect(await stockOf(repo, smallId)).toBe(2);
    expect(await stockOf(repo, bigId)).toBe(6);
  });

  test('spreads the variety of goods across houses instead of emptying one good first', async () => {
    const marketId = createBuildingInstanceId();
    const houseIds = [createBuildingInstanceId(), createBuildingInstanceId()];
    const { repo } = await distribute(
      [
        market(marketId, { wheat: 10, carrot: 10, food: 20 }),
        ...houseIds.map((id) => house(id, {}, 1, 5)),
      ],
      marketId,
      houseIds,
    );

    for (const id of houseIds) {
      const stocks = (await repo.findById(id)).stocks;
      expect(stocks.wheat).toBeGreaterThan(0);
      expect(stocks.carrot).toBeGreaterThan(0);
    }
  });
});

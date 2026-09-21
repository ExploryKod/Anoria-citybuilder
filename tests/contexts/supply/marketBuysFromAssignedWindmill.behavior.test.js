/**
 * Behavior tests — Supply: market pulls from its assigned windmill what its houses need
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { TransferHubToHub } from '../../../src/contexts/supply/application/commands/procurement/TransferHubToHub.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks } }]));
  }

  async findById(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return createSupplyBuildingSnapshot({
      ...b,
      stocks: createSupplyStock(b.stocks),
      linkedDistributors: b.linkedDistributors ?? [],
      supplyHubId: b.supplyHubId ?? null,
    });
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createSupplyStock(stocks) };
  }

  async updateBuildingFields(id, fields) {
    const b = this.raw.get(id);
    if (b) Object.assign(b, fields);
  }

  async saveHubLinkedDistributors(id, linkedDistributors) {
    const b = this.raw.get(id);
    if (b) b.linkedDistributors = linkedDistributors.map((entry) => ({ ...entry, allocatedStocks: { ...entry.allocatedStocks } }));
  }
}

function windmill(id, stocks, linkedDistributors) {
  return {
    id,
    type: 'Windmill-001',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 1000,
    linkedDistributors,
  };
}

function market(id, stocks, supplyHubId) {
  return {
    id,
    type: 'Market-Stall',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 500,
    supplyHubId,
  };
}

describe('Supply — market buys from assigned windmill', () => {
  let repo;
  let windmillId;
  let marketId;
  let command;

  beforeEach(() => {
    windmillId = createBuildingInstanceId();
    marketId = createBuildingInstanceId();
    repo = new InMemorySupplyBuildingRepository([
      windmill(windmillId, { wheat: 10, carrot: 0, cabbage: 0, food: 10 }, [
        {
          distributorId: marketId,
          x: 5,
          y: 5,
          allocatedStocks: { wheat: 6, carrot: 0, cabbage: 0 },
        },
      ]),
      market(marketId, { wheat: 0, carrot: 0, cabbage: 0, food: 0 }, windmillId),
    ]);
    command = new TransferHubToHub(repo);
  });

  const pull = (demand, targetId = marketId, period = {}) => command.execute({ targetId, period, demand });

  test('pulls what its houses need, not a fixed share', async () => {
    const outcome = await pull(6);

    expect(outcome.transferred).toBe(true);
    expect(outcome.totalUnits).toBe(6);

    const mill = await repo.findById(windmillId);
    const stall = await repo.findById(marketId);
    expect(mill.stocks.food).toBe(4);
    expect(stall.stocks.food).toBe(6);
  });

  test('takes no more than the windmill holds', async () => {
    const outcome = await pull(500);

    expect(outcome.totalUnits).toBe(10);
    expect((await repo.findById(windmillId)).stocks.food).toBe(0);
  });

  test('does not ask again for what the market already holds', async () => {
    repo.raw.get(marketId).stocks = { wheat: 4, carrot: 0, cabbage: 0, food: 4 };

    const outcome = await pull(6);

    expect(outcome.totalUnits).toBe(2);
    expect((await repo.findById(marketId)).stocks.food).toBe(6);
  });

  test('takes no more than the market has room for', async () => {
    repo.raw.get(marketId).maxStock = 3;

    const outcome = await pull(6);

    expect(outcome.totalUnits).toBe(3);
  });

  test('spreads what it takes over the goods the windmill holds', async () => {
    repo.raw.get(windmillId).stocks = { wheat: 10, carrot: 10, cabbage: 0, food: 20 };

    await pull(10);

    const stall = await repo.findById(marketId);
    expect(stall.stocks.wheat).toBe(5);
    expect(stall.stocks.carrot).toBe(5);
  });

  test('asks for nothing when its houses need nothing', async () => {
    const outcome = await pull(0);

    expect(outcome.transferred).toBe(false);
    expect(outcome.reason).toBe('no_demand');
    expect((await repo.findById(windmillId)).stocks.food).toBe(10);
  });

  test('the hub keeps how much left it this month, adding up across pulls, and starts over next month', async () => {
    const may = { year: 1, monthIndex: 4 };

    await pull(6, marketId, may);
    repo.raw.get(marketId).stocks = { wheat: 0, carrot: 0, cabbage: 0, food: 0 };
    await pull(3, marketId, may);
    expect((await repo.findById(windmillId)).lastOutflow).toEqual({ ...may, units: 9 });

    repo.raw.get(marketId).stocks = { wheat: 0, carrot: 0, cabbage: 0, food: 0 };
    await pull(1, marketId, { year: 1, monthIndex: 5 });
    expect((await repo.findById(windmillId)).lastOutflow).toEqual({ year: 1, monthIndex: 5, units: 1 });
  });

  test('refuses when market has no windmill link', async () => {
    const orphanId = createBuildingInstanceId();
    repo.raw.set(
      orphanId,
      market(orphanId, { wheat: 0, carrot: 0, cabbage: 0, food: 0 }, null)
    );

    const outcome = await command.execute({
      targetId: orphanId,
      period: {},
      demand: 6,
    });
    expect(outcome.transferred).toBe(false);
    expect(outcome.reason).toBe('no_source_link');
  });
});

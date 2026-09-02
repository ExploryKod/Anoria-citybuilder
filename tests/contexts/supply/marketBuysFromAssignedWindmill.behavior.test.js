/**
 * Behavior tests — Supply: market buys from assigned windmill allocation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { MARKET_WINDMILL_TRANSFER_CIRCUIT } from '../../../src/contexts/supply/domain/catalogs/FoodCircuits.js';
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
      stocks: createFoodStock(b.stocks),
      linkedMarkets: b.linkedMarkets ?? [],
      supplyWindmillId: b.supplyWindmillId ?? null,
    });
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createFoodStock(stocks) };
  }

  async saveLinkedMarkets(id, linkedMarkets) {
    const b = this.raw.get(id);
    if (b) b.linkedMarkets = linkedMarkets.map((entry) => ({ ...entry, allocatedStocks: { ...entry.allocatedStocks } }));
  }
}

function windmill(id, stocks, linkedMarkets) {
  return {
    id,
    type: 'Windmill-001',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 1000,
    linkedMarkets,
  };
}

function market(id, stocks, supplyWindmillId) {
  return {
    id,
    type: 'Market-Stall',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 500,
    supplyWindmillId,
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
          marketId,
          x: 5,
          y: 5,
          allocatedStocks: { wheat: 6, carrot: 0, cabbage: 0 },
        },
      ]),
      market(marketId, { wheat: 0, carrot: 0, cabbage: 0, food: 0 }, windmillId),
    ]);
    command = new TransferHubToHub(repo);
  });

  test('transfers only allocated amount to linked market', async () => {
    const outcome = await command.execute({
      targetId: marketId,
      period: {},
      circuit: MARKET_WINDMILL_TRANSFER_CIRCUIT,
    });

    expect(outcome.transferred).toBe(true);
    expect(outcome.totalUnits).toBe(6);

    const mill = await repo.findById(windmillId);
    const stall = await repo.findById(marketId);

    expect(mill.stocks.wheat).toBe(4);
    expect(stall.stocks.wheat).toBe(6);
    expect(mill.linkedMarkets[0].allocatedStocks.wheat).toBe(0);
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
      circuit: MARKET_WINDMILL_TRANSFER_CIRCUIT,
    });
    expect(outcome.transferred).toBe(false);
    expect(outcome.reason).toBe('no_source_link');
  });
});

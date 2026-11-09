/**
 * Behavior tests — Supply: market pulls from its assigned windmill what its houses need
 */

import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { TransferHubToHub } from '../../../src/contexts/supply/application/commands/procurement/TransferHubToHub.js';
import { getMaxStockForRole, hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { referencePriceBook } from '../../helpers/referencePriceBook.js';

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

  async findByResourceRole(role, categories) {
    const found = [];
    for (const row of this.raw.values()) if (hasResourceRole(row.type, role, categories)) found.push(await this.findById(row.id));
    return found;
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

function windmill(id, stocks, linkedDistributors, position = { x: 5, y: 5 }) {
  return {
    id,
    type: 'Windmill-001',
    ...position,
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 1000,
    linkedDistributors,
  };
}

function market(id, stocks, supplyHubId, position = { x: 5, y: 7 }) {
  return {
    id,
    type: 'Market-Stall-Red',
    ...position,
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
    command = new TransferHubToHub(repo, new HubServing(repo), referencePriceBook, async () => Infinity);
  });

  const pull = (demand, targetId = marketId, period = { turn: 1 }) => command.execute({ targetId, period, demand });

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

  test('a market with no money to spend buys nothing and says so: a shortfall of the game is not a failure', async () => {
    repo.raw.get(windmillId).stocks = { wheat: 10, carrot: 10, cabbage: 0, food: 20 };
    const broke = new TransferHubToHub(repo, new HubServing(repo), referencePriceBook, async () => 0);

    const outcome = await broke.execute({ targetId: marketId, period: { turn: 1 }, demand: 10 });

    expect(outcome).toMatchObject({ transferred: false, totalUnits: 0 });
    expect((await repo.findById(windmillId)).stocks.food).toBe(20);
  });

  test('takes no more than the market has room for', async () => {
    // The ceiling is the catalog's: leave the stall three units below it.
    const ceiling = getMaxStockForRole('Market-Stall-Red', 'distributor', 'wheat');
    repo.raw.get(marketId).stocks = { wheat: ceiling - 3, carrot: 0, cabbage: 0, food: ceiling - 3 };

    const outcome = await pull(ceiling + 10);

    expect(outcome.totalUnits).toBe(3);
  });

  test('spreads what it spends over the goods the windmill holds: the cheaper good comes in larger quantity', async () => {
    repo.raw.get(windmillId).stocks = { wheat: 10, carrot: 10, cabbage: 0, food: 20 };
    const priceOf = (category) => referencePriceBook.sellingPrice({ type: 'Windmill-001' }, category);

    const outcome = await pull(10);

    const stall = await repo.findById(marketId);
    expect(stall.stocks.wheat + stall.stocks.carrot).toBe(10);
    expect(stall.stocks.wheat).toBeGreaterThan(0);
    expect(stall.stocks.carrot).toBeGreaterThan(0);
    const [cheaper, dearer] = priceOf('wheat') <= priceOf('carrot') ? ['wheat', 'carrot'] : ['carrot', 'wheat'];
    expect(stall.stocks[cheaper]).toBeGreaterThanOrEqual(stall.stocks[dearer]);
    // Each transfer carries the price paid per unit, for the books.
    for (const transfer of outcome.transfers) expect(transfer.unitPrice).toBeCloseTo(priceOf(transfer.category), 2);
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

  test('refuses when the hamlet has no windmill at all', async () => {
    repo.raw.delete(windmillId);
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

  test('a market far from every windmill still draws on the nearest one: no reach limit', async () => {
    const farMarketId = createBuildingInstanceId();
    repo.raw.set(farMarketId, market(farMarketId, { wheat: 0, carrot: 0, cabbage: 0, food: 0 }, null, { x: 300, y: 300 }));

    const outcome = await command.execute({ targetId: farMarketId, period: { turn: 1 }, demand: 4 });

    expect(outcome.transferred).toBe(true);
    expect(outcome.transfers[0].sourceId).toBe(windmillId);
  });

  // The market draws on every granary in its reach, not only the one it remembers: the nearest first, the next for what the nearest cannot give.
  describe('several granaries in reach', () => {
    const empty = { wheat: 0, carrot: 0, cabbage: 0, food: 0 };
    const stocked = (wheat) => ({ wheat, carrot: 0, cabbage: 0, food: wheat });

    test('a market that remembers no granary draws on the one in reach', async () => {
      const lonelyId = createBuildingInstanceId();
      repo.raw.set(lonelyId, market(lonelyId, { ...empty }, null, { x: 5, y: 8 }));

      const outcome = await command.execute({ targetId: lonelyId, period: { turn: 1 }, demand: 4 });

      expect(outcome.transferred).toBe(true);
      expect(outcome.totalUnits).toBe(4);
    });

    test('takes from the nearest granary first, then from the next for what is still missing', async () => {
      const farId = createBuildingInstanceId();
      repo.raw.set(farId, windmill(farId, stocked(10), [], { x: 5, y: 12 })); // 5 tiles from the market at (5, 7)
      // The first granary (5, 5) is 2 tiles away and holds 10: lower its stock so it cannot fill the demand alone.
      repo.raw.get(windmillId).stocks = stocked(3);

      const outcome = await pull(8);

      expect(outcome.transfers.map((transfer) => [transfer.sourceId, transfer.amount])).toEqual([[windmillId, 3], [farId, 5]]);
      expect(repo.raw.get(farId).stocks.wheat).toBe(5);
    });

    test('two granaries as near as each other: the first orientation of the catalog\'s order wins', async () => {
      // The market at (5, 7): one granary 2 tiles north (5, 5), one 2 tiles south-east-ish (6, 8)? Use exactly equal distances: (5, 5) north, (7, 7) east.
      repo.raw.get(windmillId).stocks = stocked(10);
      const eastId = createBuildingInstanceId();
      repo.raw.set(eastId, windmill(eastId, stocked(10), [], { x: 7, y: 7 }));

      const outcome = await pull(4);

      // MARKET_SILO_DIRECTION_ORDER ranks east before north: the east granary serves first.
      expect(outcome.transfers.map((transfer) => transfer.sourceId)).toEqual([eastId]);
    });
  });
});

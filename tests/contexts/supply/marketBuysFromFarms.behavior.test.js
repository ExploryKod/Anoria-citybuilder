/**
 * Behavior tests — Supply: market buys from farms (UUID)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { cropFromFarmType } from '../../../src/contexts/supply/domain/value-objects/CropType.js';
import { canMarketBuyFromFarms } from '../../../src/contexts/supply/domain/policies/BuyingSeasonPolicy.js';
import { remainingMarketCapacity } from '../../../src/contexts/supply/domain/policies/MarketCapacityPolicy.js';
import { isOperational } from '../../../src/contexts/supply/domain/policies/OperationalGatePolicy.js';
import { MarketBuysFromNearbyFarms } from '../../../src/contexts/supply/application/commands/procurement/MarketBuysFromNearbyFarms.js';
import { toSupplySeason } from '../../../src/composition/supplyOps.js';
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

function farm(id, type, stocks, roadCount = 1) {
  return createSupplyBuildingSnapshot({
    id,
    type,
    roadCount,
    stocks,
    maxStock: 100,
  });
}

describe('Supply — market buying', () => {
  describe('domain policies', () => {
    test('markets no longer buy directly from farms', () => {
      expect(canMarketBuyFromFarms('autumn')).toBe(false);
      expect(canMarketBuyFromFarms('winter')).toBe(false);
      expect(toSupplySeason('Automne')).toBe('autumn');
      expect(toSupplySeason('Hiver')).toBe('winter');
    });

    test('crop from farm type', () => {
      expect(cropFromFarmType('Farm-Wheat')).toBe('wheat');
      expect(cropFromFarmType('Farm-Carrot')).toBe('carrot');
      expect(cropFromFarmType('House-Blue')).toBeNull();
    });

    test('operational gate requires road and staff when needed', () => {
      expect(isOperational({ roadCount: 1, worker: 1, workerNeed: 1 })).toBe(true);
      expect(isOperational({ roadCount: 0, worker: 1, workerNeed: 1 })).toBe(false);
      expect(isOperational({ roadCount: 1, worker: 0, workerNeed: 1 })).toBe(false);
      expect(isOperational({ roadCount: 1, worker: 0, workerNeed: 0 })).toBe(true);
    });

    test('remaining capacity', () => {
      expect(remainingMarketCapacity(100, 500)).toBe(400);
      expect(remainingMarketCapacity(500, 500)).toBe(0);
    });
  });

  describe('MarketBuysFromNearbyFarms', () => {
    let repo;
    let useCase;
    let marketId;
    let wheatFarmId;
    let carrotFarmId;

    beforeEach(() => {
      marketId = createBuildingInstanceId();
      wheatFarmId = createBuildingInstanceId();
      carrotFarmId = createBuildingInstanceId();
      repo = new InMemorySupplyBuildingRepository([
        market(marketId, { wheat: 0, carrot: 0, cabbage: 0, food: 0 }),
        farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }),
        farm(carrotFarmId, 'Farm-Carrot', { carrot: 5, food: 5 }),
      ]);
      useCase = new MarketBuysFromNearbyFarms(repo);
    });

    test('no longer buys from farms directly', async () => {
      const outcome = await useCase.execute({
        marketId,
        season: 'autumn',
        farmRefs: [{ instanceId: wheatFarmId }, { instanceId: carrotFarmId }],
      });

      expect(outcome.bought).toBe(false);
      expect(outcome.reason).toBe('not_buying_season');
    });

    test('refuses outside autumn as well', async () => {
      const outcome = await useCase.execute({
        marketId,
        season: 'summer',
        farmRefs: [{ instanceId: wheatFarmId }],
      });
      expect(outcome.bought).toBe(false);
      expect(outcome.reason).toBe('not_buying_season');
    });

    test('skips farms without road access', async () => {
      repo = new InMemorySupplyBuildingRepository([
        market(marketId, { food: 0 }),
        farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }, 0),
      ]);
      useCase = new MarketBuysFromNearbyFarms(repo);

      const outcome = await useCase.execute({
        marketId,
        season: 'autumn',
        farmRefs: [{ instanceId: wheatFarmId }],
      });

      expect(outcome.bought).toBe(false);
      expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(10);
    });

    test('does not buy when direct farm procurement is disabled', async () => {
      repo = new InMemorySupplyBuildingRepository([
        market(
          marketId,
          { wheat: 0, carrot: 0, cabbage: 0, food: 498 },
          { maxStock: 500 }
        ),
        farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }),
      ]);
      useCase = new MarketBuysFromNearbyFarms(repo);

      const outcome = await useCase.execute({
        marketId,
        season: 'autumn',
        farmRefs: [{ instanceId: wheatFarmId }],
      });

      expect(outcome.bought).toBe(false);
      expect(outcome.totalBaskets).toBe(0);
      expect((await repo.findById(marketId)).stocks.food).toBe(498);
      expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(10);
    });

    test('ignore farm refs without UUID', async () => {
      const outcome = await useCase.execute({
        marketId,
        season: 'autumn',
        farmRefs: [{ name: 'Farm-Wheat-4-5', type: 'Farm-Wheat', x: 4, y: 5 }],
      });
      expect(outcome.bought).toBe(false);
    });
  });
});

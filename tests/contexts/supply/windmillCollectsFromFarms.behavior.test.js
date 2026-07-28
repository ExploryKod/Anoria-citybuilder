/**
 * Behavior tests — Supply: windmill collects from all farms (December)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { canWindmillCollectFromFarms } from '../../../src/contexts/supply/domain/policies/CollectingMonthPolicy.js';
import { WindmillCollectsFromAllFarms } from '../../../src/contexts/supply/application/commands/WindmillCollectsFromAllFarms.js';
import { toSupplyMonth } from '../../../src/js/acl/supply.js';

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
    return [];
  }
}

function windmill(id, stocks, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'Windmill-001',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 1000,
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

describe('Supply — windmill collection', () => {
  describe('domain policies', () => {
    test('collecting month is december only', () => {
      expect(canWindmillCollectFromFarms('december')).toBe(true);
      expect(canWindmillCollectFromFarms('october')).toBe(false);
      expect(canWindmillCollectFromFarms('november')).toBe(false);
      expect(toSupplyMonth('Décembre')).toBe('december');
      expect(toSupplyMonth('Octobre')).toBe('october');
    });
  });

  describe('WindmillCollectsFromAllFarms', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        windmill('Windmill-001-8-8', { wheat: 0, carrot: 0, cabbage: 0, food: 0 }),
        farm('Farm-Wheat-4-5', 'Farm-Wheat', { wheat: 10, food: 10 }),
        farm('Farm-Carrot-6-5', 'Farm-Carrot', { carrot: 5, food: 5 }),
        farm('Farm-Cabbage-7-5', 'Farm-Cabbage', { cabbage: 3, food: 3 }),
      ]);
      useCase = new WindmillCollectsFromAllFarms(repo);
    });

    test('collects from all farms in december', async () => {
      const outcome = await useCase.execute({
        windmillId: 'Windmill-001-8-8',
        month: 'december',
        farmRefs: [
          { id: 'Farm-Wheat-4-5' },
          { id: 'Farm-Carrot-6-5' },
          { id: 'Farm-Cabbage-7-5' },
        ],
      });

      expect(outcome.collected).toBe(true);
      expect(outcome.totalBaskets).toBe(18);
      expect(outcome.transfers).toHaveLength(3);

      const mill = await repo.findById('Windmill-001-8-8');
      expect(mill.stocks.wheat).toBe(10);
      expect(mill.stocks.carrot).toBe(5);
      expect(mill.stocks.cabbage).toBe(3);
      expect(mill.stocks.food).toBe(18);

      expect((await repo.findById('Farm-Wheat-4-5')).stocks.wheat).toBe(0);
      expect((await repo.findById('Farm-Carrot-6-5')).stocks.carrot).toBe(0);
    });

    test('refuses outside december', async () => {
      const outcome = await useCase.execute({
        windmillId: 'Windmill-001-8-8',
        month: 'november',
        farmRefs: [{ id: 'Farm-Wheat-4-5' }],
      });

      expect(outcome.collected).toBe(false);
      expect(outcome.reason).toBe('not_collecting_month');
      expect((await repo.findById('Farm-Wheat-4-5')).stocks.wheat).toBe(10);
    });

    test('skips farms without road access', async () => {
      repo = new InMemorySupplyBuildingRepository([
        windmill('Windmill-001-8-8', { food: 0 }),
        farm('Farm-Wheat-4-5', 'Farm-Wheat', { wheat: 10, food: 10 }, 0),
      ]);
      useCase = new WindmillCollectsFromAllFarms(repo);

      const outcome = await useCase.execute({
        windmillId: 'Windmill-001-8-8',
        month: 'december',
        farmRefs: [{ id: 'Farm-Wheat-4-5' }],
      });

      expect(outcome.collected).toBe(false);
      expect(outcome.reason).toBe('nothing_to_collect');
      expect((await repo.findById('Farm-Wheat-4-5')).stocks.wheat).toBe(10);
    });

    test('refuses when windmill has no road access', async () => {
      repo = new InMemorySupplyBuildingRepository([
        windmill('Windmill-001-8-8', { food: 0 }, { roadCount: 0 }),
        farm('Farm-Wheat-4-5', 'Farm-Wheat', { wheat: 10, food: 10 }),
      ]);
      useCase = new WindmillCollectsFromAllFarms(repo);

      const outcome = await useCase.execute({
        windmillId: 'Windmill-001-8-8',
        month: 'december',
        farmRefs: [{ id: 'Farm-Wheat-4-5' }],
      });

      expect(outcome.collected).toBe(false);
      expect(outcome.reason).toBe('windmill_not_operational');
    });

    test('respects windmill capacity', async () => {
      repo = new InMemorySupplyBuildingRepository([
        windmill('Windmill-001-8-8', { wheat: 0, food: 0 }, { maxStock: 4 }),
        farm('Farm-Wheat-4-5', 'Farm-Wheat', { wheat: 10, food: 10 }),
        farm('Farm-Carrot-6-5', 'Farm-Carrot', { carrot: 5, food: 5 }),
      ]);
      useCase = new WindmillCollectsFromAllFarms(repo);

      const outcome = await useCase.execute({
        windmillId: 'Windmill-001-8-8',
        month: 'december',
        farmRefs: [
          { id: 'Farm-Wheat-4-5' },
          { id: 'Farm-Carrot-6-5' },
        ],
      });

      expect(outcome.collected).toBe(true);
      expect(outcome.totalBaskets).toBe(4);
      expect((await repo.findById('Windmill-001-8-8')).stocks.food).toBe(4);
      expect((await repo.findById('Farm-Wheat-4-5')).stocks.wheat).toBe(6);
      expect((await repo.findById('Farm-Carrot-6-5')).stocks.carrot).toBe(5);
    });
  });
});

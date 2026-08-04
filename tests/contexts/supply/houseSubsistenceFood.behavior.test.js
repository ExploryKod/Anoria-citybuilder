/**
 * Behavior tests — Supply: level 1 (autarky) house subsistence food.
 *
 * Level 1 houses feed themselves directly — bypassing farms/markets — via
 * `HouseSubsistencePolicy` + `ProduceHouseSubsistenceFood`. See
 * `ConsumeHouseFood` for the complementary level-1 skip on the demand side.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { computeSubsistenceFoodCredit } from '../../../src/contexts/supply/domain/policies/HouseSubsistencePolicy.js';
import { ProduceHouseSubsistenceFood } from '../../../src/contexts/supply/application/commands/subsistence/ProduceHouseSubsistenceFood.js';
import { ProduceAllHouseSubsistenceFood } from '../../../src/contexts/supply/application/commands/subsistence/ProduceAllHouseSubsistenceFood.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          stocks: { ...b.stocks },
          lastSubsistenceMonth: b.lastSubsistenceMonth ?? null,
        },
      ])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return createSupplyBuildingSnapshot({ ...b, stocks: createFoodStock(b.stocks) });
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createFoodStock(stocks) };
  }

  async saveSubsistenceMetadata(id, { lastSubsistenceMonth }) {
    const b = this.raw.get(id);
    if (!b) return;
    if (lastSubsistenceMonth !== undefined) b.lastSubsistenceMonth = lastSubsistenceMonth;
  }

  async findHouses() {
    return [...this.raw.values()]
      .filter((b) => b.type.includes('House'))
      .map((b) => createSupplyBuildingSnapshot({ ...b, stocks: createFoodStock(b.stocks) }));
  }
}

function house(id, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'House-Blue',
    roadCount: 0,
    pop: 3,
    level: 1,
    stocks: { wheat: 0, carrot: 0, cabbage: 0, food: 0 },
    ...extras,
  });
}

describe('Supply — house subsistence food (level 1)', () => {
  describe('HouseSubsistencePolicy.computeSubsistenceFoodCredit', () => {
    test('tops food up to the monthly need when short', () => {
      const result = computeSubsistenceFoodCredit({
        pop: 4,
        stocks: { food: 1, wheat: 1, carrot: 0, cabbage: 0 },
      });
      expect(result.credited).toBe(3);
      expect(result.nextStock.food).toBe(4);
      // Crops themselves are untouched — only the aggregate `food` is credited.
      expect(result.nextStock.wheat).toBe(1);
    });

    test('never reduces stock when already sufficient', () => {
      const result = computeSubsistenceFoodCredit({
        pop: 2,
        stocks: { food: 10 },
      });
      expect(result.credited).toBe(0);
      expect(result.nextStock.food).toBe(10);
    });

    test('zero population credits nothing', () => {
      const result = computeSubsistenceFoodCredit({ pop: 0, stocks: { food: 0 } });
      expect(result.credited).toBe(0);
      expect(result.nextStock.food).toBe(0);
    });
  });

  describe('ProduceHouseSubsistenceFood', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 3, stocks: { food: 0 } }),
      ]);
      useCase = new ProduceHouseSubsistenceFood(repo);
    });

    test('credits food for a level 1 house and marks the month', async () => {
      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });

      expect(outcome.produced).toBe(true);
      expect(outcome.credited).toBe(3);
      expect(outcome.food).toBe(3);

      const updated = await repo.findById('House-Blue-1-2');
      expect(updated.stocks.food).toBe(3);
      expect(updated.lastSubsistenceMonth).toBe(4);
    });

    test('refuses a second production in the same month', async () => {
      await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });
      const second = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });

      expect(second.produced).toBe(false);
      expect(second.reason).toBe('already_produced_this_month');
    });

    test('skips level 2 (specialized) houses — they use the market/farm cycle instead', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 3, level: 2, stocks: { food: 0 } }),
      ]);
      useCase = new ProduceHouseSubsistenceFood(repo);

      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });
      expect(outcome.produced).toBe(false);
      expect(outcome.reason).toBe('not_autarkic');
    });

    test('skips houses with zero population', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 0, stocks: { food: 0 } }),
      ]);
      useCase = new ProduceHouseSubsistenceFood(repo);

      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });
      expect(outcome.produced).toBe(false);
      expect(outcome.reason).toBe('no_population');
    });
  });

  describe('ProduceAllHouseSubsistenceFood', () => {
    test('produces for every level 1 house, skips level 2 and uninhabited ones', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 2, stocks: { food: 0 } }),
        house('House-Purple-3-4', { type: 'House-Purple', pop: 1, stocks: { food: 0 } }),
        house('House-Red-5-6', { type: 'House-Red', pop: 3, level: 2, stocks: { food: 0 } }),
        house('House-Blue-7-8', { pop: 0, stocks: { food: 0 } }),
      ]);
      const produceOne = new ProduceHouseSubsistenceFood(repo);
      const produceAll = new ProduceAllHouseSubsistenceFood(repo, produceOne);

      const outcome = await produceAll.execute({ monthIndex: 2 });

      expect(outcome.producedCount).toBe(2);
      expect((await repo.findById('House-Blue-1-2')).stocks.food).toBe(2);
      expect((await repo.findById('House-Purple-3-4')).stocks.food).toBe(1);
      expect((await repo.findById('House-Red-5-6')).stocks.food).toBe(0);
      expect((await repo.findById('House-Blue-7-8')).stocks.food).toBe(0);
    });
  });
});

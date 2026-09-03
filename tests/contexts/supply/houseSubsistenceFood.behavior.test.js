/**
 * Behavior tests — Supply: monthly house gathering (fruit + game).
 *
 * Every inhabited house gains a FIXED basket of foraged fruit and hunted
 * game each month (1 each, regardless of population size — see
 * HouseSubsistencePolicy.js), independent from farms and markets. Level 2
 * houses still consume farm crops via `ConsumeResource`.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import {
  computeMonthlyGatheringCredit,
  computeSubsistenceFoodCredit,
} from '../../../src/contexts/supply/domain/policies/HouseSubsistencePolicy.js';
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

  async updateBuildingFields(id, fields) {
    const b = this.raw.get(id);
    if (!b) return;
    for (const key of Object.keys(fields)) {
      if (fields[key] !== undefined) b[key] = fields[key];
    }
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
    stocks: { wheat: 0, carrot: 0, cabbage: 0, fruit: 0, game: 0, food: 0 },
    ...extras,
  });
}

describe('Supply — house gathering (fruit & game)', () => {
  describe('HouseSubsistencePolicy.computeMonthlyGatheringCredit', () => {
    test('adds a fixed fruit and game basket per house each month, regardless of population', () => {
      const result = computeMonthlyGatheringCredit({
        pop: 4,
        stocks: { food: 1, wheat: 1, fruit: 2, game: 1 },
      });

      expect(result.credited).toEqual({ fruit: 1, game: 1 });
      expect(result.nextStock.fruit).toBe(3);
      expect(result.nextStock.game).toBe(2);
      expect(result.nextStock.wheat).toBe(1);
      expect(result.nextStock.food).toBe(6);
    });

    test('accumulates on top of existing gathering stocks', () => {
      const first = computeMonthlyGatheringCredit({ pop: 2, stocks: { fruit: 0, game: 0 } });
      const second = computeMonthlyGatheringCredit({ pop: 2, stocks: first.nextStock });

      expect(second.nextStock.fruit).toBe(2);
      expect(second.nextStock.game).toBe(2);
    });

    test('zero population credits nothing', () => {
      const result = computeMonthlyGatheringCredit({ pop: 0, stocks: { food: 0 } });
      expect(result.credited).toEqual({ fruit: 0, game: 0 });
      expect(result.nextStock.food).toBe(0);
    });

    test('legacy computeSubsistenceFoodCredit sums fruit + game credited', () => {
      const result = computeSubsistenceFoodCredit({ pop: 3, stocks: { food: 0 } });
      expect(result.credited).toBe(2);
      expect(result.nextStock.fruit).toBe(1);
      expect(result.nextStock.game).toBe(1);
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

    test('credits fruit and game for an inhabited house and marks the month', async () => {
      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });

      expect(outcome.produced).toBe(true);
      expect(outcome.credited).toEqual({ fruit: 1, game: 1 });
      expect(outcome.food).toBe(2);

      const updated = await repo.findById('House-Blue-1-2');
      expect(updated.stocks.fruit).toBe(1);
      expect(updated.stocks.game).toBe(1);
      expect(updated.stocks.food).toBe(2);
      expect(updated.lastSubsistenceMonth).toBe(4);
    });

    test('refuses a second production in the same month', async () => {
      await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });
      const second = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });

      expect(second.produced).toBe(false);
      expect(second.reason).toBe('already_produced_this_month');
    });

    test('also produces for level 2 houses — gathering is independent from the market cycle', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 3, level: 2, stocks: { food: 0 } }),
      ]);
      useCase = new ProduceHouseSubsistenceFood(repo);

      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 4 });
      expect(outcome.produced).toBe(true);
      expect(outcome.credited).toEqual({ fruit: 1, game: 1 });
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
    test('produces for every inhabited house, skips uninhabited ones', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 2, stocks: { food: 0 } }),
        house('House-Purple-3-4', { type: 'House-Purple', pop: 1, stocks: { food: 0 } }),
        house('House-Red-5-6', { type: 'House-Red', pop: 3, level: 2, stocks: { food: 0 } }),
        house('House-Blue-7-8', { pop: 0, stocks: { food: 0 } }),
      ]);
      const produceOne = new ProduceHouseSubsistenceFood(repo);
      const produceAll = new ProduceAllHouseSubsistenceFood(repo, produceOne);

      const outcome = await produceAll.execute({ monthIndex: 2 });

      expect(outcome.producedCount).toBe(3);
      expect((await repo.findById('House-Blue-1-2')).stocks).toMatchObject({ fruit: 1, game: 1 });
      expect((await repo.findById('House-Purple-3-4')).stocks).toMatchObject({ fruit: 1, game: 1 });
      expect((await repo.findById('House-Red-5-6')).stocks).toMatchObject({ fruit: 1, game: 1 });
      expect((await repo.findById('House-Blue-7-8')).stocks.food).toBe(0);
    });
  });
});

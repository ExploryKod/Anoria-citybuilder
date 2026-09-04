/**
 * Behavior tests — Supply: house food consumption
 *
 * Simplified model: "fed or not" from total food quantity only (1 basket
 * per citizen per month, drawn from whichever category has stock) — diet
 * variety is a separate, not-yet-built feature. See ConsumeResource.js and
 * the house 'consumer' resourceRoles fact in buildingEconomy.js.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { getAmountForRole, hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { HOUSE_FOOD_CONSUMPTION_BOOKKEEPING } from '../../../src/contexts/supply/domain/catalogs/FoodCircuits.js';
import { ConsumeResource } from '../../../src/contexts/supply/application/commands/consumption/ConsumeResource.js';
import { ConsumeAllHouseFood } from '../../../src/contexts/supply/application/commands/consumption/ConsumeAllHouseFood.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          stocks: { ...b.stocks },
          lastConsumptionMonth: b.lastConsumptionMonth ?? null,
          pop: b.pop ?? 0,
        },
      ])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return createSupplyBuildingSnapshot({
      ...b,
      stocks: createFoodStock(b.stocks),
    });
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

  async findByResourceRole(role, categories) {
    return [...this.raw.values()]
      .filter((b) => hasResourceRole(b.type, role, categories))
      .map((b) =>
        createSupplyBuildingSnapshot({
          ...b,
          stocks: createFoodStock(b.stocks),
        })
      );
  }
}

function house(id, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'House-Blue',
    roadCount: 1,
    pop: 3,
    level: 2,
    stocks: { wheat: 0, carrot: 0, cabbage: 0, food: 0 },
    ...extras,
  });
}

describe('Supply — house consumption', () => {
  describe('domain policy', () => {
    test('one basket per citizen per month', () => {
      expect(getAmountForRole('House-Blue', 'consumer')).toBe(1);
    });
  });

  describe('ConsumeResource (house food consumption)', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', {
          pop: 4,
          stocks: { fruit: 4, game: 4, food: 8 },
        }),
      ]);
      useCase = new ConsumeResource(repo);
    });

    test('consumes once per month and updates stocks', async () => {
      const outcome = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 5 },
        bookkeeping: HOUSE_FOOD_CONSUMPTION_BOOKKEEPING,
      });

      expect(outcome.consumed).toBe(true);
      expect(outcome.pop).toBe(4);
      expect(outcome.demand).toBe(4);
      expect(outcome.taken).toBe(4);
      expect(outcome.totalUnfed).toBe(0);

      const updated = await repo.findById('House-Blue-1-2');
      expect(updated.stocks.food).toBe(4);
      expect(updated.lastConsumptionMonth).toBe(5);
    });

    test('refuses second consumption in same month', async () => {
      await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 5 },
        bookkeeping: HOUSE_FOOD_CONSUMPTION_BOOKKEEPING,
      });
      const second = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 5 },
        bookkeeping: HOUSE_FOOD_CONSUMPTION_BOOKKEEPING,
      });

      expect(second.consumed).toBe(false);
      expect(second.reason).toBe('already_consumed_this_period');
    });

    test('reports unfed citizens when stock is short — drains whatever category has any', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 2, stocks: { food: 0 } }),
      ]);
      useCase = new ConsumeResource(repo);

      const outcome = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 1 },
        bookkeeping: HOUSE_FOOD_CONSUMPTION_BOOKKEEPING,
      });
      expect(outcome.consumed).toBe(true);
      expect(outcome.totalUnfed).toBe(2);
      expect((await repo.findById('House-Blue-1-2')).lastConsumptionMonth).toBe(1);
    });

    test('drains from whichever categories have stock, not a specific one', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 3, stocks: { wheat: 2, food: 2 } }),
      ]);
      useCase = new ConsumeResource(repo);

      const outcome = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 1 },
        bookkeeping: HOUSE_FOOD_CONSUMPTION_BOOKKEEPING,
      });

      expect(outcome.taken).toBe(2);
      expect(outcome.totalUnfed).toBe(1);
      expect((await repo.findById('House-Blue-1-2')).stocks.wheat).toBe(0);
    });

    test('skips houses with zero population', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 0, stocks: { wheat: 5, food: 5 } }),
      ]);
      useCase = new ConsumeResource(repo);

      const outcome = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 1 },
        bookkeeping: HOUSE_FOOD_CONSUMPTION_BOOKKEEPING,
      });
      expect(outcome.consumed).toBe(false);
      expect(outcome.reason).toBe('no_population');
      expect((await repo.findById('House-Blue-1-2')).stocks.wheat).toBe(5);
    });
  });

  describe('ConsumeAllHouseFood', () => {
    test('consumes for every house with population', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', {
          pop: 2,
          stocks: { fruit: 2, game: 2, food: 4 },
        }),
        house('House-Purple-3-4', {
          type: 'House-Purple',
          pop: 1,
          stocks: { fruit: 1, game: 1, food: 2 },
        }),
        house('House-Blue-5-6', { pop: 0, stocks: { wheat: 5, food: 5 } }),
      ]);
      const consumeOne = new ConsumeResource(repo);
      const consumeAll = new ConsumeAllHouseFood(repo, consumeOne);

      const outcome = await consumeAll.execute({ monthIndex: 7 });

      expect(outcome.consumedCount).toBe(2);
      expect((await repo.findById('House-Blue-1-2')).stocks.food).toBe(2);
      expect((await repo.findById('House-Purple-3-4')).stocks.food).toBe(1);
      expect((await repo.findById('House-Blue-5-6')).stocks.wheat).toBe(5);
    });
  });
});

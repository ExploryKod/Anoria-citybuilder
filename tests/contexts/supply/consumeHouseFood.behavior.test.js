/**
 * Behavior tests — Supply: house food consumption
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import {
  applyHouseFoodConsumption,
  basketsPerCitizenPerMonth,
} from '../../../src/contexts/supply/domain/policies/HouseConsumptionPolicy.js';
import { HOUSE_FOOD_CONSUMPTION_CIRCUIT } from '../../../src/contexts/supply/domain/catalogs/FoodCircuits.js';
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

  async findHouses() {
    return [...this.raw.values()]
      .filter((b) => b.type.includes('House'))
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
    // level 2 (group profession) — the market/farm-fed cycle this file
    // exercises only applies past autarky; see `HouseSubsistencePolicy` for
    // level 1's bypass mechanism.
    level: 2,
    stocks: { wheat: 0, carrot: 0, cabbage: 0, food: 0 },
    ...extras,
  });
}

describe('Supply — house consumption', () => {
  describe('domain policy', () => {
    test('one basket per citizen per month', () => {
      expect(basketsPerCitizenPerMonth()).toBe(1);
    });

    test('applyHouseFoodConsumption splits demand across a level-1 house essential types', () => {
      const result = applyHouseFoodConsumption({
        stock: createFoodStock({ fruit: 5, game: 5, food: 10 }),
        population: 4,
        level: 1,
      });

      expect(result.consumed.fruit).toBe(2);
      expect(result.consumed.game).toBe(2);
      expect(result.totalUnfed).toBe(0);
      expect(result.nextStock.fruit).toBe(3);
      expect(result.nextStock.game).toBe(3);
    });

    test('applyHouseFoodConsumption reports unfed citizens when stock is short', () => {
      const result = applyHouseFoodConsumption({
        stock: createFoodStock({ fruit: 0, game: 0, food: 0 }),
        population: 2,
        level: 1,
      });

      expect(result.consumed.fruit).toBe(0);
      expect(result.consumed.game).toBe(0);
      expect(result.totalUnfed).toBe(2);
    });
  });

  describe('ConsumeResource (house food consumption circuit)', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', {
          pop: 4,
          level: 1,
          stocks: { fruit: 4, game: 4, food: 8 },
        }),
      ]);
      useCase = new ConsumeResource(repo);
    });

    test('consumes once per month and updates stocks', async () => {
      const outcome = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 5 },
        circuit: HOUSE_FOOD_CONSUMPTION_CIRCUIT,
      });

      expect(outcome.consumed).toBe(true);
      expect(outcome.pop).toBe(4);
      expect(outcome.consumedByCategory.fruit).toBe(2);
      expect(outcome.consumedByCategory.game).toBe(2);
      expect(outcome.unfed).toBe(0);

      const updated = await repo.findById('House-Blue-1-2');
      expect(updated.stocks.food).toBe(4);
      expect(updated.lastConsumptionMonth).toBe(5);
    });

    test('refuses second consumption in same month', async () => {
      await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 5 },
        circuit: HOUSE_FOOD_CONSUMPTION_CIRCUIT,
      });
      const second = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 5 },
        circuit: HOUSE_FOOD_CONSUMPTION_CIRCUIT,
      });

      expect(second.consumed).toBe(false);
      expect(second.reason).toBe('already_consumed_this_period');
    });

    test('marks month even when stock is empty', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 2, level: 1, stocks: { food: 0 } }),
      ]);
      useCase = new ConsumeResource(repo);

      const outcome = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 1 },
        circuit: HOUSE_FOOD_CONSUMPTION_CIRCUIT,
      });
      expect(outcome.consumed).toBe(true);
      expect(outcome.unfed).toBe(2);
      expect((await repo.findById('House-Blue-1-2')).lastConsumptionMonth).toBe(1);
    });

    test('skips houses with zero population', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 0, stocks: { wheat: 5, food: 5 } }),
      ]);
      useCase = new ConsumeResource(repo);

      const outcome = await useCase.execute({
        buildingId: 'House-Blue-1-2',
        period: { monthIndex: 1 },
        circuit: HOUSE_FOOD_CONSUMPTION_CIRCUIT,
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
          level: 1,
          stocks: { fruit: 2, game: 2, food: 4 },
        }),
        house('House-Purple-3-4', {
          type: 'House-Purple',
          pop: 1,
          level: 1,
          stocks: { fruit: 1, game: 1, food: 2 },
        }),
        house('House-Blue-5-6', { pop: 0, stocks: { wheat: 5, food: 5 } }),
      ]);
      const consumeOne = new ConsumeResource(repo);
      const consumeAll = new ConsumeAllHouseFood(repo, consumeOne);

      const outcome = await consumeAll.execute({ monthIndex: 7 });

      expect(outcome.consumedCount).toBe(2);
      expect((await repo.findById('House-Blue-1-2')).stocks.food).toBe(2);
      expect((await repo.findById('House-Purple-3-4')).stocks.food).toBe(2);
      expect((await repo.findById('House-Blue-5-6')).stocks.wheat).toBe(5);
    });
  });
});

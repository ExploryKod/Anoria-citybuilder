/**
 * Behavior tests — Supply: house food consumption
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import {
  applyHouseFoodConsumption,
  basketsPerCitizenPerMonth,
  HOUSE_FOOD_CONSUMPTION_ORDER,
} from '../../../src/contexts/supply/domain/policies/HouseConsumptionPolicy.js';
import { ConsumeHouseFood } from '../../../src/contexts/supply/application/commands/consumption/ConsumeHouseFood.js';
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

  async saveConsumptionMetadata(id, { lastConsumptionMonth }) {
    const b = this.raw.get(id);
    if (!b) return;
    if (lastConsumptionMonth !== undefined) b.lastConsumptionMonth = lastConsumptionMonth;
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
    test('consumption order is gathering then market crops', () => {
      expect(HOUSE_FOOD_CONSUMPTION_ORDER).toEqual([
        'fruit',
        'game',
        'wheat',
        'carrot',
        'cabbage',
      ]);
      expect(basketsPerCitizenPerMonth()).toBe(1);
    });

    test('applyHouseFoodConsumption prioritizes gathering before wheat', () => {
      const result = applyHouseFoodConsumption(
        createFoodStock({ fruit: 1, game: 1, wheat: 2, carrot: 5, cabbage: 5, food: 14 }),
        4
      );

      expect(result.consumed).toEqual({
        fruit: 1,
        game: 1,
        wheat: 2,
        carrot: 0,
        cabbage: 0,
      });
      expect(result.demand).toBe(4);
      expect(result.unfed).toBe(0);
      expect(result.nextStock.fruit).toBe(0);
      expect(result.nextStock.game).toBe(0);
      expect(result.nextStock.wheat).toBe(0);
      expect(result.nextStock.carrot).toBe(5);
      expect(result.nextStock.cabbage).toBe(5);
      expect(result.nextStock.food).toBe(10);
    });

    test('applyHouseFoodConsumption prioritizes wheat after gathering is exhausted', () => {
      const result = applyHouseFoodConsumption(
        createFoodStock({ wheat: 2, carrot: 5, cabbage: 5, food: 12 }),
        4
      );

      expect(result.consumed).toEqual({
        fruit: 0,
        game: 0,
        wheat: 2,
        carrot: 2,
        cabbage: 0,
      });
      expect(result.demand).toBe(4);
      expect(result.unfed).toBe(0);
      expect(result.nextStock.wheat).toBe(0);
      expect(result.nextStock.carrot).toBe(3);
      expect(result.nextStock.cabbage).toBe(5);
      expect(result.nextStock.food).toBe(8);
    });

    test('applyHouseFoodConsumption reports unfed citizens', () => {
      const result = applyHouseFoodConsumption(
        createFoodStock({ wheat: 1, carrot: 0, cabbage: 0, food: 1 }),
        3
      );

      expect(result.consumed).toEqual({
        fruit: 0,
        game: 0,
        wheat: 1,
        carrot: 0,
        cabbage: 0,
      });
      expect(result.unfed).toBe(2);
    });
  });

  describe('ConsumeHouseFood', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', {
          pop: 4,
          stocks: { wheat: 2, carrot: 2, cabbage: 0, food: 4 },
        }),
      ]);
      useCase = new ConsumeHouseFood(repo);
    });

    test('consumes once per month and updates stocks', async () => {
      const outcome = await useCase.execute({
        houseId: 'House-Blue-1-2',
        monthIndex: 5,
      });

      expect(outcome.consumed).toBe(true);
      expect(outcome.pop).toBe(4);
      expect(outcome.crops).toEqual({
        fruit: 0,
        game: 0,
        wheat: 2,
        carrot: 2,
        cabbage: 0,
      });
      expect(outcome.unfed).toBe(0);

      const updated = await repo.findById('House-Blue-1-2');
      expect(updated.stocks.food).toBe(0);
      expect(updated.lastConsumptionMonth).toBe(5);
    });

    test('refuses second consumption in same month', async () => {
      await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 5 });
      const second = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 5 });

      expect(second.consumed).toBe(false);
      expect(second.reason).toBe('already_consumed_this_month');
    });

    test('marks month even when stock is empty', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 2, stocks: { food: 0 } }),
      ]);
      useCase = new ConsumeHouseFood(repo);

      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 1 });
      expect(outcome.consumed).toBe(true);
      expect(outcome.unfed).toBe(2);
      expect((await repo.findById('House-Blue-1-2')).lastConsumptionMonth).toBe(1);
    });

    test('skips houses with zero population', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 0, stocks: { wheat: 5, food: 5 } }),
      ]);
      useCase = new ConsumeHouseFood(repo);

      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 1 });
      expect(outcome.consumed).toBe(false);
      expect(outcome.reason).toBe('no_population');
      expect((await repo.findById('House-Blue-1-2')).stocks.wheat).toBe(5);
    });

    test('level 1 houses consume gathering stocks after monthly production', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', {
          pop: 2,
          level: 1,
          stocks: { fruit: 2, game: 2, food: 4 },
        }),
      ]);
      useCase = new ConsumeHouseFood(repo);

      const outcome = await useCase.execute({ houseId: 'House-Blue-1-2', monthIndex: 1 });
      expect(outcome.consumed).toBe(true);
      expect(outcome.crops).toEqual({
        fruit: 2,
        game: 0,
        wheat: 0,
        carrot: 0,
        cabbage: 0,
      });
      expect((await repo.findById('House-Blue-1-2')).stocks.food).toBe(2);
    });
  });

  describe('ConsumeAllHouseFood', () => {
    test('consumes for every house with population', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', {
          pop: 2,
          stocks: { wheat: 2, food: 2 },
        }),
        house('House-Purple-3-4', {
          type: 'House-Purple',
          pop: 1,
          stocks: { carrot: 1, food: 1 },
        }),
        house('House-Blue-5-6', { pop: 0, stocks: { wheat: 5, food: 5 } }),
      ]);
      const consumeOne = new ConsumeHouseFood(repo);
      const consumeAll = new ConsumeAllHouseFood(repo, consumeOne);

      const outcome = await consumeAll.execute({ monthIndex: 7 });

      expect(outcome.consumedCount).toBe(2);
      expect((await repo.findById('House-Blue-1-2')).stocks.wheat).toBe(0);
      expect((await repo.findById('House-Purple-3-4')).stocks.carrot).toBe(0);
      expect((await repo.findById('House-Blue-5-6')).stocks.wheat).toBe(5);
    });
  });
});

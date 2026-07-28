/**
 * Behavior tests — Supply: house market reach (`marketTooFar`)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { isWithinMarketRange } from '../../../src/contexts/supply/domain/policies/MarketRangePolicy.js';
import { UpdateHousesMarketReach } from '../../../src/contexts/supply/application/commands/UpdateHousesMarketReach.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks }, flags: {} }])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    return b ? { ...b, stocks: createFoodStock(b.stocks) } : null;
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createFoodStock(stocks) };
  }

  async saveMarketFlags(id, flags) {
    const b = this.raw.get(id);
    if (b) b.flags = { ...b.flags, ...flags };
  }

  async findMarkets() {
    return [...this.raw.values()].filter((b) => b.type.includes('Market'));
  }

  async findHouses() {
    return [...this.raw.values()].filter(
      (b) => b.type.includes('House') || b.type.includes('house')
    );
  }

  flag(id, key) {
    return this.raw.get(id)?.flags?.[key];
  }
}

function market(id, x, y, roadCount = 1) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'Market-Stall',
    x,
    y,
    roadCount,
    stocks: { food: 0 },
  });
}

function house(id, x, y) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'House-Blue',
    x,
    y,
    roadCount: 1,
    stocks: { food: 0 },
  });
}

describe('Supply — house market reach', () => {
  test('isWithinMarketRange uses Manhattan distance', () => {
    expect(isWithinMarketRange({ x: 0, y: 0 }, { x: 3, y: 2 }, 5)).toBe(true);
    expect(isWithinMarketRange({ x: 0, y: 0 }, { x: 4, y: 2 }, 5)).toBe(false);
  });

  describe('UpdateHousesMarketReach', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        market('Market-Stall-5-5', 5, 5),
        house('House-Blue-5-6', 5, 6), // distance 1
        house('House-Blue-0-0', 0, 0), // distance 10
      ]);
      useCase = new UpdateHousesMarketReach(repo);
    });

    test('marks houses outside range as marketTooFar', async () => {
      const outcome = await useCase.execute({ maxDistance: 5 });

      expect(outcome.houses).toBe(2);
      expect(outcome.marketsWithRoad).toBe(1);
      expect(outcome.inRange).toBe(1);
      expect(outcome.tooFar).toBe(1);
      expect(repo.flag('House-Blue-5-6', 'marketTooFar')).toBe(false);
      expect(repo.flag('House-Blue-0-0', 'marketTooFar')).toBe(true);
    });

    test('ignores markets without road access', async () => {
      repo = new InMemorySupplyBuildingRepository([
        market('Market-Stall-5-5', 5, 5, 0),
        house('House-Blue-5-6', 5, 6),
      ]);
      useCase = new UpdateHousesMarketReach(repo);

      const outcome = await useCase.execute({ maxDistance: 5 });

      expect(outcome.marketsWithRoad).toBe(0);
      expect(outcome.tooFar).toBe(1);
      expect(repo.flag('House-Blue-5-6', 'marketTooFar')).toBe(true);
    });

    test('in range of any road-connected market is enough', async () => {
      repo = new InMemorySupplyBuildingRepository([
        market('Market-Stall-5-5', 5, 5, 0),
        market('Market-Stall-1-1', 1, 1, 1),
        house('House-Blue-1-2', 1, 2),
      ]);
      useCase = new UpdateHousesMarketReach(repo);

      await useCase.execute({ maxDistance: 5 });

      expect(repo.flag('House-Blue-1-2', 'marketTooFar')).toBe(false);
    });
  });
});

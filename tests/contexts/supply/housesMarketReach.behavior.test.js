/**
 * Behavior tests — Supply: house market reach (`marketTooFar`)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { isWithinRange } from '../../../src/contexts/supply/domain/policies/ResourceRangePolicy.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { UpdateConsumerDistributorReach } from '../../../src/contexts/supply/application/commands/distribution/UpdateConsumerDistributorReach.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks }, flags: {} }])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    return b ? { ...b, stocks: createSupplyStock(b.stocks) } : null;
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createSupplyStock(stocks) };
  }

  async saveSupplyFlags(id, flags) {
    const b = this.raw.get(id);
    if (b) b.flags = { ...b.flags, ...flags };
  }

  async findByResourceRole(role, categories) {
    return [...this.raw.values()].filter((b) => hasResourceRole(b.type, role, categories));
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
  test('isWithinRange uses Manhattan distance', () => {
    expect(isWithinRange({ x: 0, y: 0 }, { x: 3, y: 2 }, 5)).toBe(true);
    expect(isWithinRange({ x: 0, y: 0 }, { x: 4, y: 2 }, 5)).toBe(false);
  });

  describe('UpdateConsumerDistributorReach', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        market('Market-Stall-5-5', 5, 5),
        house('House-Blue-5-6', 5, 6), // distance 1
        house('House-Blue-0-0', 0, 0), // distance 10
      ]);
      useCase = new UpdateConsumerDistributorReach(repo);
    });

    test('every road-connected house is in range — Market-Stall has unlimited reach (debugging aid, 2026-09-11)', async () => {
      // `maxDistance: 5` here is only the FALLBACK for a distributor with no
      // catalog-declared range — Market-Stall declares its own (`Infinity`,
      // see buildingEconomy.js), which always wins via `?? maxDistance`, so
      // even the house at distance 10 is in range.
      const outcome = await useCase.execute({ maxDistance: 5 });

      expect(outcome.houses).toBe(2);
      expect(outcome.marketsWithRoad).toBe(1);
      expect(outcome.inRange).toBe(2);
      expect(outcome.tooFar).toBe(0);
      expect(repo.flag('House-Blue-5-6', 'distributorTooFar')).toBe(false);
      expect(repo.flag('House-Blue-0-0', 'distributorTooFar')).toBe(false);
    });

    test('ignores markets without road access', async () => {
      repo = new InMemorySupplyBuildingRepository([
        market('Market-Stall-5-5', 5, 5, 0),
        house('House-Blue-5-6', 5, 6),
      ]);
      useCase = new UpdateConsumerDistributorReach(repo);

      const outcome = await useCase.execute({ maxDistance: 5 });

      expect(outcome.marketsWithRoad).toBe(0);
      expect(outcome.tooFar).toBe(1);
      expect(repo.flag('House-Blue-5-6', 'distributorTooFar')).toBe(true);
    });

    test('in range of any road-connected market is enough', async () => {
      repo = new InMemorySupplyBuildingRepository([
        market('Market-Stall-5-5', 5, 5, 0),
        market('Market-Stall-1-1', 1, 1, 1),
        house('House-Blue-1-2', 1, 2),
      ]);
      useCase = new UpdateConsumerDistributorReach(repo);

      await useCase.execute({ maxDistance: 5 });

      expect(repo.flag('House-Blue-1-2', 'distributorTooFar')).toBe(false);
    });
  });
});

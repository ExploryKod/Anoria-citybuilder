/**
 * Behavior tests — Housing: city-wide food supply (gathering + market channels)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import { computeCityFoodSupply } from '../../../src/contexts/housing/domain/policies/CityFoodSupplyPolicy.js';
import {
  marketBasketsFromStocks,
  totalFoodFromStocks,
} from '../../../src/contexts/housing/domain/value-objects/FoodStocks.js';
import { GetCityFoodSupply } from '../../../src/contexts/housing/application/queries/GetCityFoodSupply.js';

class InMemoryHousingRepository {
  constructor(buildings = []) {
    this.raw = buildings.map((b) => ({
      ...b,
      stocks: { ...b.stocks },
    }));
  }

  async listAllResidentialSnapshots() {
    return this.raw.map((b) => createHousingBuildingSnapshot(b));
  }
}

function residential(id, type, extras = {}) {
  return createHousingBuildingSnapshot({
    id,
    type,
    pop: 0,
    stocks: { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
    ...extras,
  });
}

describe('Housing — city food supply', () => {
  describe('FoodStocks helpers', () => {
    test('counts the baskets the market delivered', () => {
      const stocks = { wheat: 4, carrot: 1, cabbage: 0, food: 5 };
      expect(marketBasketsFromStocks(stocks)).toBe(5);
      expect(totalFoodFromStocks(stocks)).toBe(5);
    });
  });

  describe('CityFoodSupplyPolicy.computeCityFoodSupply', () => {
    test('aggregates the food stocks across houses', () => {
      const result = computeCityFoodSupply([
        residential('h1', 'House-Red', {
          pop: 6,
          stocks: { wheat: 1, carrot: 0, cabbage: 0, food: 1 },
        }),
        residential('h2', 'House-Blue', {
          pop: 4,
          stocks: { wheat: 0, carrot: 3, cabbage: 2, food: 5 },
        }),
      ]);

      expect(result.totalPopulation).toBe(10);
      expect(result.marketBaskets).toBe(6);
      expect(result.totalBaskets).toBe(6);
    });
  });

  describe('GetCityFoodSupply query', () => {
    let repo;
    let query;

    beforeEach(() => {
      repo = new InMemoryHousingRepository([
        residential('House-Red-1-1', 'House-Red', {
          pop: 3,
          stocks: { wheat: 3, carrot: 0, cabbage: 0, food: 3 },
        }),
      ]);
      query = new GetCityFoodSupply(repo);
    });

    test('returns city totals from repository snapshots', async () => {
      await expect(query.execute()).resolves.toEqual({
        totalPopulation: 3,
        marketBaskets: 3,
        totalBaskets: 3,
      });
    });
  });
});

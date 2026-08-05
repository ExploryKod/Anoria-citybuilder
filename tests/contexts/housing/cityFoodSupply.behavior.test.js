/**
 * Behavior tests — Housing: city-wide food supply (gathering + market channels)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import { computeCityFoodSupply } from '../../../src/contexts/housing/domain/policies/CityFoodSupplyPolicy.js';
import {
  gatheringBasketsFromStocks,
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
    stocks: { food: 0, wheat: 0, carrot: 0, cabbage: 0, fruit: 0, game: 0 },
    ...extras,
  });
}

describe('Housing — city food supply', () => {
  describe('FoodStocks helpers', () => {
    test('splits gathering and market baskets', () => {
      const stocks = { fruit: 3, game: 2, wheat: 4, carrot: 1, cabbage: 0, food: 10 };
      expect(gatheringBasketsFromStocks(stocks)).toBe(5);
      expect(marketBasketsFromStocks(stocks)).toBe(5);
      expect(totalFoodFromStocks(stocks)).toBe(10);
    });
  });

  describe('CityFoodSupplyPolicy.computeCityFoodSupply', () => {
    test('aggregates gathering and market stocks across houses', () => {
      const result = computeCityFoodSupply([
        residential('h1', 'House-Red', {
          pop: 6,
          stocks: { fruit: 2, game: 2, wheat: 1, carrot: 0, cabbage: 0, food: 5 },
        }),
        residential('h2', 'House-Blue', {
          pop: 4,
          stocks: { fruit: 1, game: 1, wheat: 0, carrot: 3, cabbage: 2, food: 7 },
        }),
      ]);

      expect(result.totalPopulation).toBe(10);
      expect(result.gatheringBaskets).toBe(6);
      expect(result.marketBaskets).toBe(6);
      expect(result.totalBaskets).toBe(12);
    });
  });

  describe('GetCityFoodSupply query', () => {
    let repo;
    let query;

    beforeEach(() => {
      repo = new InMemoryHousingRepository([
        residential('House-Red-1-1', 'House-Red', {
          pop: 3,
          stocks: { fruit: 2, game: 1, wheat: 0, carrot: 0, cabbage: 0, food: 3 },
        }),
      ]);
      query = new GetCityFoodSupply(repo);
    });

    test('returns city totals from repository snapshots', async () => {
      await expect(query.execute()).resolves.toEqual({
        totalPopulation: 3,
        gatheringBaskets: 3,
        marketBaskets: 0,
        totalBaskets: 3,
      });
    });
  });
});

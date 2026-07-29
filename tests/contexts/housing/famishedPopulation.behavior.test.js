/**
 * Behavior tests — Housing: famished population query
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import {
  fedPopulationAtHouse,
  famishedPopulationAtHouse,
  computeCityFamishedPopulation,
} from '../../../src/contexts/housing/domain/policies/FamishedPopulationPolicy.js';
import { GetFamishedPopulation } from '../../../src/contexts/housing/application/queries/GetFamishedPopulation.js';

class InMemoryFamishedRepository {
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

describe('Housing — famished population', () => {
  describe('FamishedPopulationPolicy', () => {
    test('fed population is min(pop, stocks.food)', () => {
      expect(fedPopulationAtHouse(6, { food: 3 })).toBe(3);
      expect(famishedPopulationAtHouse(6, { food: 3 })).toBe(3);
    });

    test('no famished when food covers pop', () => {
      expect(famishedPopulationAtHouse(3, { food: 5 })).toBe(0);
    });

    test('computeCityFamishedPopulation aggregates residential houses', () => {
      const result = computeCityFamishedPopulation([
        residential('h1', 'House-Blue', { pop: 6, stocks: { food: 3 } }),
        residential('h2', 'House-Red', { pop: 4, stocks: { food: 2 } }),
      ]);
      expect(result.totalPopulation).toBe(10);
      expect(result.fedPopulation).toBe(5);
      expect(result.famishedPopulation).toBe(5);
    });
  });

  describe('GetFamishedPopulation query', () => {
    let repo;
    let query;

    beforeEach(() => {
      repo = new InMemoryFamishedRepository([
        residential('House-Blue-1-1', 'House-Blue', {
          pop: 3,
          stocks: { food: 5 },
        }),
      ]);
      query = new GetFamishedPopulation(repo);
    });

    test('returns famishedPopulation for city', async () => {
      await expect(query.execute()).resolves.toEqual({
        totalPopulation: 3,
        fedPopulation: 3,
        famishedPopulation: 0,
      });
    });

    test('matches legacy HousesStore scenario (6 pop, 3 food)', async () => {
      repo = new InMemoryFamishedRepository([
        residential('House-Blue-1-1', 'House-Blue', {
          pop: 6,
          stocks: { food: 3 },
        }),
        residential('House-Red-2-2', 'House-Red', {
          pop: 4,
          stocks: { food: 2 },
        }),
      ]);
      query = new GetFamishedPopulation(repo);

      const result = await query.execute();
      expect(result.famishedPopulation).toBe(5);
    });

    test('returns zeros when no residential houses', async () => {
      repo = new InMemoryFamishedRepository([]);
      query = new GetFamishedPopulation(repo);
      await expect(query.execute()).resolves.toEqual({
        totalPopulation: 0,
        fedPopulation: 0,
        famishedPopulation: 0,
      });
    });
  });
});

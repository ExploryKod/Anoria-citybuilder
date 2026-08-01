/**
 * Behavior tests — Housing: monthly population growth
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import {
  isResidentialHouseType,
  maxPopulationForHouseType,
} from '../../../src/contexts/housing/domain/policies/HouseCapacityPolicy.js';
import { computePopulationAfterGrowth } from '../../../src/contexts/housing/domain/policies/PopulationGrowthPolicy.js';
import { GrowHousePopulation } from '../../../src/contexts/housing/application/commands/growth/GrowHousePopulation.js';
import { GrowAllHousePopulation } from '../../../src/contexts/housing/application/commands/growth/GrowAllHousePopulation.js';
import { GetCityPopulationSummary } from '../../../src/contexts/housing/application/queries/GetCityPopulationSummary.js';

class InMemoryHousingBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          lastPopulationGrowthMonth: b.lastPopulationGrowthMonth ?? null,
        },
      ])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    return b ? createHousingBuildingSnapshot(b) : null;
  }

  async findResidentialHouses() {
    return [...this.raw.values()]
      .filter((b) => isResidentialHouseType(b.type))
      .map((b) => createHousingBuildingSnapshot(b));
  }

  async listAllResidentialSnapshots() {
    return this.findResidentialHouses();
  }

  async savePopulation(id, payload) {
    const b = this.raw.get(id);
    if (!b) return;
    b.pop = payload.pop;
    if (payload.lastPopulationGrowthMonth !== undefined) {
      b.lastPopulationGrowthMonth = payload.lastPopulationGrowthMonth;
    }
  }
}

function house(id, type, extras = {}) {
  return createHousingBuildingSnapshot({
    id,
    type,
    roadCount: 1,
    pop: 0,
    ...extras,
  });
}

describe('Housing — population growth', () => {
  describe('domain policies', () => {
    test('residential house types include blue/red/purple/palace', () => {
      expect(isResidentialHouseType('House-Blue')).toBe(true);
      expect(isResidentialHouseType('House-Red')).toBe(true);
      expect(isResidentialHouseType('House-Purple')).toBe(true);
      expect(isResidentialHouseType('House-2Story')).toBe(true);
      expect(isResidentialHouseType('Farm-Wheat')).toBe(false);
    });

    test('regular house cap is 6, palace cap is 7', () => {
      expect(maxPopulationForHouseType('House-Red')).toBe(6);
      expect(maxPopulationForHouseType('House-2Story')).toBe(7);
    });

    test('grows by 1 per month up to cap when road connected', () => {
      expect(
        computePopulationAfterGrowth({
          type: 'House-Red',
          currentPop: 2,
          roadCount: 1,
          monthIndex: 4,
          lastPopulationGrowthMonth: 3,
        })
      ).toEqual({
        pop: 3,
        changed: true,
        lastPopulationGrowthMonth: 4,
        reason: 'monthly_growth',
      });
    });

    test('does not grow twice in the same month', () => {
      expect(
        computePopulationAfterGrowth({
          type: 'House-Red',
          currentPop: 3,
          roadCount: 1,
          monthIndex: 4,
          lastPopulationGrowthMonth: 4,
        })
      ).toEqual({
        pop: 3,
        changed: false,
        lastPopulationGrowthMonth: 4,
      });
    });

    test('zeros population without road access', () => {
      expect(
        computePopulationAfterGrowth({
          type: 'House-Red',
          currentPop: 4,
          roadCount: 0,
          monthIndex: 4,
        })
      ).toEqual({
        pop: 0,
        changed: true,
        reason: 'no_road_access',
      });
    });
  });

  describe('GrowHousePopulation command', () => {
    let repo;
    let command;

    beforeEach(() => {
      repo = new InMemoryHousingBuildingRepository([
        house('h1', 'House-Red', { pop: 1, roadCount: 1 }),
      ]);
      command = new GrowHousePopulation(repo);
    });

    test('persists growth to repository', async () => {
      const result = await command.execute({ houseId: 'h1', monthIndex: 2 });
      expect(result.changed).toBe(true);
      expect(result.pop).toBe(2);

      const updated = await repo.findById('h1');
      expect(updated.pop).toBe(2);
      expect(updated.lastPopulationGrowthMonth).toBe(2);
    });
  });

  describe('GrowAllHousePopulation command', () => {
    test('processes every residential house', async () => {
      const repo = new InMemoryHousingBuildingRepository([
        house('h1', 'House-Red', { pop: 0, roadCount: 1 }),
        house('h2', 'House-Blue', { pop: 0, roadCount: 0 }),
        house('farm', 'Farm-Wheat', { pop: 0, roadCount: 1 }),
      ]);
      const growOne = new GrowHousePopulation(repo);
      const growAll = new GrowAllHousePopulation(repo, growOne);

      const result = await growAll.execute({ monthIndex: 1 });

      expect(result.housesProcessed).toBe(2);
      expect(result.housesChanged).toBe(1);
      expect(result.changes[0].houseId).toBe('h1');
    });
  });

  describe('GetCityPopulationSummary query', () => {
    test('sums pop across residential houses', async () => {
      const repo = new InMemoryHousingBuildingRepository([
        house('h1', 'House-Red', { pop: 3 }),
        house('h2', 'House-Purple', { pop: 5 }),
        house('farm', 'Farm-Wheat', { pop: 99 }),
      ]);
      const query = new GetCityPopulationSummary(repo);

      await expect(query.execute()).resolves.toEqual({
        totalPop: 8,
        houseCount: 2,
      });
    });
  });
});

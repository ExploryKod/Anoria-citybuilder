import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import { isResidentialHouseType } from '../../../src/contexts/housing/domain/policies/HouseCapacityPolicy.js';
import {
  computeMonthlyFamineDeathsAtHouse,
  didHouseGoHungryLastConsumption,
} from '../../../src/contexts/housing/domain/policies/FamineConsequencesPolicy.js';
import { GrowHousePopulation } from '../../../src/contexts/housing/application/commands/growth/GrowHousePopulation.js';

class InMemoryHousingBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          lastPopulationGrowthMonth: b.lastPopulationGrowthMonth ?? null,
          lastFamineDeathMonth: b.lastFamineDeathMonth ?? null,
          lastConsumption: b.lastConsumption ?? null,
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

  async savePopulation(id, payload) {
    const b = this.raw.get(id);
    if (!b) return;
    b.pop = payload.pop;
    if (payload.lastPopulationGrowthMonth !== undefined) {
      b.lastPopulationGrowthMonth = payload.lastPopulationGrowthMonth;
    }
    if (payload.lastFamineDeathMonth !== undefined) {
      b.lastFamineDeathMonth = payload.lastFamineDeathMonth;
    }
  }
}

describe('Famine consequences', () => {
  test('detects hunger from lastConsumption.totalUnfed', () => {
    expect(didHouseGoHungryLastConsumption({ totalUnfed: 2 })).toBe(true);
    expect(didHouseGoHungryLastConsumption({ totalUnfed: 0 })).toBe(false);
    expect(didHouseGoHungryLastConsumption(null)).toBe(false);
  });

  test('monthly deaths are at most 1 per hungry house', () => {
    expect(computeMonthlyFamineDeathsAtHouse({
      pop: 6,
      lastConsumption: { totalUnfed: 4 },
    })).toBe(1);
    expect(computeMonthlyFamineDeathsAtHouse({
      pop: 6,
      lastConsumption: { totalUnfed: 0 },
    })).toBe(0);
  });

  describe('GrowHousePopulation with famine limits', () => {
    /** @type {InMemoryHousingBuildingRepository} */
    let repo;
    /** @type {GrowHousePopulation} */
    let grow;

    beforeEach(() => {
      repo = new InMemoryHousingBuildingRepository([
        createHousingBuildingSnapshot({
          id: 'h1',
          type: 'House-Blue',
          roadCount: 1,
          pop: 4,
          level: 1,
          lastConsumption: { month: 3, totalUnfed: 2 },
        }),
      ]);
      grow = new GrowHousePopulation(repo);
    });

    test('blocks growth and applies one death when limits on', async () => {
      const result = await grow.execute({
        houseId: 'h1',
        monthIndex: 4,
        applyFamineLimits: true,
      });

      expect(result.deaths).toBe(1);
      expect(result.reason).toBe('famine_blocked_growth');
      expect(result.pop).toBe(3);
      expect(repo.raw.get('h1').pop).toBe(3);
    });

    test('grows normally when limits off despite hunger', async () => {
      const result = await grow.execute({
        houseId: 'h1',
        monthIndex: 4,
        applyFamineLimits: false,
      });

      expect(result.deaths).toBe(0);
      expect(result.reason).toBe('monthly_growth');
      expect(result.pop).toBe(5);
    });

    test('does not kill twice in the same month', async () => {
      await grow.execute({ houseId: 'h1', monthIndex: 4, applyFamineLimits: true });
      const second = await grow.execute({ houseId: 'h1', monthIndex: 4, applyFamineLimits: true });
      expect(second.deaths).toBe(0);
      expect(repo.raw.get('h1').pop).toBe(3);
    });
  });
});

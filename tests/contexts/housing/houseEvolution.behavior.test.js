/**
 * Behavior tests — Housing: house progression.
 *
 * Houses are permanent social groups (see
 * `HouseGroupSectorEligibilityPolicy` in Employment); only their `level`
 * (1 = autarky, 2 = group profession) evolves — see `HouseLevelPolicy`.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import {
  HOUSE_LEVEL_AUTARKY,
  HOUSE_LEVEL_SPECIALIZED,
  resolveHouseLevel,
} from '../../../src/contexts/housing/domain/policies/HouseLevelPolicy.js';
import {
  maxPopulationForLevel,
} from '../../../src/contexts/housing/domain/policies/HouseCapacityPolicy.js';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';
import { EvolveHouseBuilding } from '../../../src/contexts/housing/application/commands/evolution/EvolveHouseBuilding.js';
import { EvolveAllHouseBuildings } from '../../../src/contexts/housing/application/commands/evolution/EvolveAllHouseBuildings.js';

class InMemoryHousingEvolutionRepository {
  constructor(buildings = []) {
    this.raw = new Map(buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks } }]));
  }

  async findById(id) {
    const row = this.raw.get(id);
    return row ? createHousingBuildingSnapshot(row) : null;
  }

  async findResidentialHouses() {
    return [...this.raw.values()].map((b) => createHousingBuildingSnapshot(b));
  }

  async applyLevelChange({ houseId, targetLevel, targetPop }) {
    const house = this.raw.get(houseId);
    house.level = targetLevel;
    house.pop = targetPop;
  }
}

function house(id, type, extras = {}) {
  return createHousingBuildingSnapshot({
    id,
    type,
    x: extras.x ?? 2,
    y: extras.y ?? 3,
    roadCount: 1,
    pop: 0,
    level: 1,
    stocks: { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
    ...extras,
  });
}

const HOUSE_TYPE_BLUE = 'House-Blue';
const HOUSE_TYPE_RED = 'House-Red';

describe('Housing — house progression', () => {
  describe('HouseCapacityPolicy.maxPopulationForLevel', () => {
    test('each tier reads its ceiling from the social-category catalog', () => {
      for (const group of ['artisans', 'merchants', 'scholars']) {
        for (const [level, tier] of Object.entries(SOCIAL_CATEGORY[group].tiers)) {
          expect(maxPopulationForLevel(Number(level), group)).toBe(tier.maxPopulation);
        }
      }
    });

    test('a deeper tier never holds fewer residents than the one below it', () => {
      const tiers = SOCIAL_CATEGORY.artisans.tiers;
      const levels = Object.keys(tiers).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < levels.length; i++) {
        expect(tiers[levels[i]].maxPopulation).toBeGreaterThan(tiers[levels[i - 1]].maxPopulation);
      }
    });

    test('an unknown group has no declared ceiling', () => {
      expect(maxPopulationForLevel(1, 'nobody')).toBe(0);
    });
  });

  describe('HouseLevelPolicy.resolveHouseLevel (Blue/Red/Purple)', () => {
    test('level 1 -> 2 requires road access, a positive population, and faith coverage', () => {
      const result = resolveHouseLevel({
        level: 1,
        pop: 3,
        roadCount: 1,
        residentialGroup: 'artisans',
        servedFlags: { faith: 5 },
        periodKey: 5,
      });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
      expect(result.changed).toBe(true);
      expect(result.reason).toBe('level1_to_level2');
    });

    test('level 1 does not advance to level 2 without faith coverage, even with road and population', () => {
      const result = resolveHouseLevel({
        level: 1,
        pop: 3,
        roadCount: 1,
        residentialGroup: 'artisans',
        servedFlags: {},
        periodKey: 5,
      });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('a demotion says which requirement of the tier no longer holds', () => {
      // The lowest tier that asks for goods variety; every other requirement of it is met
      const tiers = SOCIAL_CATEGORY.artisans.tiers;
      const level = Number(
        Object.keys(tiers).find((n) => tiers[n].requirements.some((r) => r.kind === 'goodsVariety'))
      );
      const periodKey = 5;
      const servedFlags = Object.fromEntries(
        Object.values(tiers)
          .flatMap((tier) => tier.requirements)
          .filter((r) => r.kind === 'serviceCoverage')
          .map((r) => [r.category, periodKey])
      );

      const result = resolveHouseLevel({
        level,
        pop: 12,
        roadCount: 1,
        residentialGroup: 'artisans',
        servedFlags,
        // The house ate, but drew from one good only
        lastConsumption: { month: periodKey, demand: 12, taken: 12, totalUnfed: 0, categoriesTaken: ['carrot'] },
        periodKey,
      });

      expect(result.changed).toBe(true);
      expect(result.reason).toMatch(/requirements_lost$/);
      expect(result.unmetRequirements).toEqual([
        expect.objectContaining({ kind: 'goodsVariety', min: 2, current: 1, target: 2 }),
      ]);
    });

    test('level 1 stays autarkic without road access', () => {
      const result = resolveHouseLevel({ level: 1, pop: 3, roadCount: 0, residentialGroup: 'artisans' });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('level 1 stays autarkic when uninhabited, even with road access', () => {
      const result = resolveHouseLevel({ level: 1, pop: 0, roadCount: 1, residentialGroup: 'artisans' });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('level 2 regresses to level 1 when road access is lost, population clamped to the level-1 cap', () => {
      const result = resolveHouseLevel({ level: 2, pop: 10, roadCount: 0, residentialGroup: 'artisans' });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.targetPop).toBe(SOCIAL_CATEGORY.artisans.tiers[1].maxPopulation);
      expect(result.changed).toBe(true);
      expect(result.reason).toBe('level2_to_level1_requirements_lost');
    });

    test('level 2 stays specialized while road access and faith are kept, below tier 3\'s population threshold', () => {
      const result = resolveHouseLevel({
        level: 2,
        pop: 2,
        roadCount: 1,
        residentialGroup: 'artisans',
        servedFlags: { faith: 5 },
        periodKey: 5,
      });
      expect(result.changed).toBe(false);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
    });

    test('level 2 regresses to level 1 when faith coverage is lost, even with road and population kept', () => {
      const result = resolveHouseLevel({
        level: 2,
        pop: 2,
        roadCount: 1,
        residentialGroup: 'artisans',
        servedFlags: {},
        periodKey: 5,
      });
      expect(result.changed).toBe(true);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.reason).toBe('level2_to_level1_requirements_lost');
    });

    test('level 2 advances to level 3 once population, fed, and doctor coverage are all met', () => {
      const result = resolveHouseLevel({
        level: 2,
        pop: 4,
        roadCount: 1,
        residentialGroup: 'artisans',
        servedFlags: { faith: 5, doctor: 5 },
        lastConsumption: { month: 5, totalUnfed: 0 },
        periodKey: 5,
      });
      expect(result.changed).toBe(true);
      expect(result.targetLevel).toBe(3);
      expect(result.reason).toBe('level2_to_level3');
    });

    test('level 2 does not advance to level 3 on population alone, missing fed/doctor coverage', () => {
      const result = resolveHouseLevel({
        level: 2,
        pop: 4,
        roadCount: 1,
        residentialGroup: 'artisans',
        servedFlags: { faith: 5 },
        periodKey: 5,
      });
      expect(result.changed).toBe(false);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
    });

    test('scholars stay at level 2 without faith coverage even with population and road access', () => {
      const result = resolveHouseLevel({
        level: 1,
        pop: 3,
        roadCount: 1,
        residentialGroup: 'scholars',
        servedFlags: {},
        periodKey: 5,
      });
      expect(result.changed).toBe(false);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
    });

    test('scholars advance to level 2 once faith is served for the current period', () => {
      const result = resolveHouseLevel({
        level: 1,
        pop: 3,
        roadCount: 1,
        residentialGroup: 'scholars',
        servedFlags: { faith: 5 },
        periodKey: 5,
      });
      expect(result.changed).toBe(true);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
    });

    test('unknown residential group never advances past tier 1', () => {
      const result = resolveHouseLevel({ level: 1, pop: 3, roadCount: 1, residentialGroup: null });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });
  });

  describe('EvolveHouseBuilding command', () => {
    let repo;
    let command;

    beforeEach(() => {
      repo = new InMemoryHousingEvolutionRepository([
        house('House-Red-2-3', HOUSE_TYPE_RED, {
          pop: 2,
          level: 1,
          roadCount: 1,
          servedFlags: { faith: 5 },
        }),
      ]);
      command = new EvolveHouseBuilding(repo);
    });

    test('promotes a Blue/Red/Purple house to level 2 without ever changing its color', async () => {
      const result = await command.execute({ houseId: 'House-Red-2-3', periodKey: 5 });
      expect(result.changed).toBe(true);
      expect(result.previousLevel).toBe(1);
      expect(result.targetLevel).toBe(2);
      expect(result.targetType).toBe(HOUSE_TYPE_RED);
      expect(result.houseId).toBe('House-Red-2-3');

      const updated = await repo.findById('House-Red-2-3');
      expect(updated.type).toBe(HOUSE_TYPE_RED);
      expect(updated.level).toBe(2);
    });

    test('reports unchanged when already stable (autarkic, no road)', async () => {
      repo = new InMemoryHousingEvolutionRepository([
        house('House-Blue-2-3', HOUSE_TYPE_BLUE, { pop: 0, level: 1, roadCount: 0 }),
      ]);
      command = new EvolveHouseBuilding(repo);

      const result = await command.execute({ houseId: 'House-Blue-2-3' });
      expect(result.changed).toBe(false);
      expect(result.targetType).toBe(HOUSE_TYPE_BLUE);
      expect(result.targetLevel).toBe(1);
    });
  });

  describe('EvolveAllHouseBuildings — who leaves when standing drops', () => {
    test('reports the inhabitants brought back to the lower cap, and which requirements no longer held', async () => {
      const periodKey = 5;
      const servedFlags = Object.fromEntries(
        Object.values(SOCIAL_CATEGORY.artisans.tiers)
          .flatMap((tier) => tier.requirements)
          .filter((r) => r.kind === 'serviceCoverage')
          .map((r) => [r.category, periodKey])
      );
      const starving = (id, x) => ({
        ...house(id, 'House-Red', { x }),
        level: 3,
        pop: 18,
        servedFlags,
        lastConsumption: { month: periodKey, demand: 18, taken: 0, totalUnfed: 18, categoriesTaken: [] },
      });
      const repository = new InMemoryHousingEvolutionRepository([starving('a', 1), starving('b', 2)]);
      const evolveAll = new EvolveAllHouseBuildings(repository, new EvolveHouseBuilding(repository));

      const result = await evolveAll.execute({ periodKey });

      // Two houses go from 18 residents to the level-2 cap: everyone above it leaves
      const cap = maxPopulationForLevel(2, 'artisans');
      expect(result.departure).toMatchObject({ count: 2 * (18 - cap), houses: 2 });
      expect(result.departure.unmet).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'demandMet' })]));
    });

    test('no departure when nobody had to leave', async () => {
      const repository = new InMemoryHousingEvolutionRepository([house('a', 'House-Red', { pop: 3 })]);
      const evolveAll = new EvolveAllHouseBuildings(repository, new EvolveHouseBuilding(repository));

      const result = await evolveAll.execute({ periodKey: 5 });

      expect(result.departure).toBeNull();
    });
  });
});

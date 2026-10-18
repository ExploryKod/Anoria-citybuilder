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
    const PERIOD = 5;
    /**
     * What a house must show for every requirement of a tier to hold this period, read from the catalog itself so the
     * tests follow the ladder instead of copying it.
     */
    function meeting(level, group = 'artisans') {
      const requirements = SOCIAL_CATEGORY[group].tiers[level].requirements;
      const facts = { pop: 0, servedFlags: {}, outcomes: {}, lastConsumption: null, activityAccess: false };
      for (const r of requirements) {
        if (r.kind === 'population') facts.pop = Math.max(facts.pop, r.min);
        if (r.kind === 'serviceCoverage') facts.servedFlags[r.category] = PERIOD;
        if (r.kind === 'serviceDemandMet') facts.outcomes[r.outcomeField] = { month: PERIOD, totalUnfed: 0, categoriesTaken: [] };
        if (r.kind === 'goodsVariety') {
          facts.outcomes[r.outcomeField] = { month: PERIOD, totalUnfed: 0, categoriesTaken: Array.from({ length: r.min }, (_, n) => `good${n}`) };
        }
        if (r.kind === 'demandMet') facts.lastConsumption = { month: PERIOD, demand: 1, taken: 1, totalUnfed: 0, categoriesTaken: ['wheat'] };
        if (r.kind === 'activityAccess') facts.activityAccess = true;
      }
      return facts;
    }
    const resolve = (level, group, facts, extra = {}) =>
      resolveHouseLevel({ level, roadCount: 1, residentialGroup: group, periodKey: PERIOD, ...facts, ...extra });

    test('level 1 -> 2 once road access, population, food, water and a dispensary all hold', () => {
      const result = resolve(1, 'artisans', meeting(2));
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
      expect(result.changed).toBe(true);
      expect(result.reason).toBe('level1_to_level2');
    });

    test('level 1 does not advance to level 2 without water, even with everything else', () => {
      const facts = meeting(2);
      delete facts.outcomes.lastWaterConsumption;
      const result = resolve(1, 'artisans', facts);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('a demotion says which requirement of the tier no longer holds', () => {
      // A level-3 house whose every need holds but the goods: it drew from no retail good this period.
      const facts = meeting(3);
      facts.outcomes.lastGoodsConsumption = { month: PERIOD, totalUnfed: 0, categoriesTaken: [] };
      const result = resolve(3, 'artisans', { ...facts, pop: 6 });

      expect(result.changed).toBe(true);
      expect(result.reason).toMatch(/requirements_lost$/);
      expect(result.unmetRequirements).toEqual([
        expect.objectContaining({ kind: 'goodsVariety', min: 1, current: 0, target: 1 }),
      ]);
    });

    test('level 1 stays autarkic without road access', () => {
      const result = resolve(1, 'artisans', { ...meeting(2), pop: 3 }, { roadCount: 0 });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('level 1 stays autarkic when uninhabited, even with road access', () => {
      const result = resolve(1, 'artisans', { ...meeting(2), pop: 0 });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('level 2 regresses to level 1 when road access is lost, population clamped to the level-1 cap', () => {
      const result = resolve(2, 'artisans', { ...meeting(2), pop: 10 }, { roadCount: 0 });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.targetPop).toBe(SOCIAL_CATEGORY.artisans.tiers[1].maxPopulation);
      expect(result.changed).toBe(true);
      expect(result.reason).toBe('level2_to_level1_requirements_lost');
    });

    test('level 2 stays specialized while its own needs are kept, below tier 3\'s population threshold', () => {
      const result = resolve(2, 'artisans', { ...meeting(2), pop: 2 });
      expect(result.changed).toBe(false);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
    });

    test('level 2 regresses to level 1 when water is lost, even with road and population kept', () => {
      const facts = meeting(2);
      delete facts.outcomes.lastWaterConsumption;
      const result = resolve(2, 'artisans', { ...facts, pop: 2 });
      expect(result.changed).toBe(true);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.reason).toBe('level2_to_level1_requirements_lost');
    });

    test('level 2 advances to level 3 once goods, fire cover, a warehouse and energy join the earlier needs', () => {
      const result = resolve(2, 'artisans', meeting(3));
      expect(result.changed).toBe(true);
      expect(result.targetLevel).toBe(3);
      expect(result.reason).toBe('level2_to_level3');
    });

    test('level 2 does not advance to level 3 on population alone, missing the level-2 list', () => {
      const result = resolve(2, 'artisans', { ...meeting(2), pop: 4 });
      expect(result.changed).toBe(false);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
    });

    test('level 2 does not advance without a warehouse within reach of its business', () => {
      const result = resolve(2, 'artisans', { ...meeting(3), activityAccess: false });
      expect(result.changed).toBe(false);
    });

    test('scholars stay at level 1 without water even with population and road access', () => {
      const result = resolve(1, 'scholars', { pop: 3 });
      expect(result.changed).toBe(false);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
    });

    test('scholars advance to level 2 once their level-1 list is met this period', () => {
      const result = resolve(1, 'scholars', meeting(2, 'scholars'));
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
    const PERIOD = 5;
    /** A house row showing the needs of its next tier met this period (the fields the supply writes on it). */
    function readyHouse(id, type, group, level) {
      const row = { pop: 2, level, roadCount: 1, servedFlags: {} };
      for (const r of SOCIAL_CATEGORY[group].tiers[level + 1].requirements) {
        if (r.kind === 'population') row.pop = Math.max(row.pop, r.min);
        if (r.kind === 'serviceCoverage') row.servedFlags[r.category] = PERIOD;
        if (r.kind === 'serviceDemandMet') row[r.outcomeField] = { month: PERIOD, totalUnfed: 0, categoriesTaken: [] };
        if (r.kind === 'demandMet') row.lastConsumption = { month: PERIOD, totalUnfed: 0, categoriesTaken: ['wheat'] };
      }
      return house(id, type, row);
    }
    let repo;
    let command;

    beforeEach(() => {
      repo = new InMemoryHousingEvolutionRepository([readyHouse('House-Red-2-3', HOUSE_TYPE_RED, 'artisans', 1)]);
      command = new EvolveHouseBuilding(repo);
      command.setActivityAccessCheck(async () => true);
    });

    test('promotes a Blue/Red/Purple house to level 2 without ever changing its color', async () => {
      const result = await command.execute({ houseId: 'House-Red-2-3', periodKey: PERIOD });
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
      command.setActivityAccessCheck(async () => true);

      const result = await command.execute({ houseId: 'House-Blue-2-3' });
      expect(result.changed).toBe(false);
      expect(result.targetType).toBe(HOUSE_TYPE_BLUE);
      expect(result.targetLevel).toBe(1);
    });

    test('asking whether a warehouse is within reach, before the composition said how, throws: no quiet "no access"', async () => {
      const unwired = new EvolveHouseBuilding(repo);
      await expect(unwired.execute({ houseId: 'House-Red-2-3', periodKey: PERIOD })).rejects.toThrow(/activity-access check was never set/);
    });
  });

  describe('EvolveAllHouseBuildings — who leaves when standing drops', () => {
    test('reports the inhabitants brought back to the lower cap, and which requirements no longer held', async () => {
      const periodKey = 5;
      // Level 3 houses of 18 residents that kept every need but food: it was cut off this period.
      const starving = (id, x) => {
        const row = { x, level: 3, pop: 18, roadCount: 1, servedFlags: {} };
        for (const r of SOCIAL_CATEGORY.artisans.tiers[3].requirements) {
          if (r.kind === 'serviceCoverage') row.servedFlags[r.category] = periodKey;
          if (r.kind === 'serviceDemandMet') row[r.outcomeField] = { month: periodKey, totalUnfed: 0, categoriesTaken: [] };
          if (r.kind === 'goodsVariety') row[r.outcomeField] = { month: periodKey, totalUnfed: 0, categoriesTaken: ['pot'] };
        }
        row.lastConsumption = { month: periodKey, demand: 18, taken: 0, totalUnfed: 18, categoriesTaken: [] };
        return house(id, 'House-Red', row);
      };
      const repository = new InMemoryHousingEvolutionRepository([starving('a', 1), starving('b', 2)]);
      const evolve = new EvolveHouseBuilding(repository);
      evolve.setActivityAccessCheck(async () => true);
      const evolveAll = new EvolveAllHouseBuildings(repository, evolve);

      const result = await evolveAll.execute({ periodKey });

      // Two houses go from 18 residents to the level-2 cap: everyone above it leaves
      const cap = maxPopulationForLevel(2, 'artisans');
      expect(result.departure).toMatchObject({ count: 2 * (18 - cap), houses: 2 });
      expect(result.departure.unmet).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'demandMet' })]));
    });

    test('no departure when nobody had to leave', async () => {
      const repository = new InMemoryHousingEvolutionRepository([house('a', 'House-Red', { pop: 3 })]);
      const evolve = new EvolveHouseBuilding(repository);
      evolve.setActivityAccessCheck(async () => true);
      const evolveAll = new EvolveAllHouseBuildings(repository, evolve);

      const result = await evolveAll.execute({ periodKey: 5 });

      expect(result.departure).toBeNull();
    });
  });
});

/**
 * Behavior tests — Housing: house progression.
 *
 * Blue/Red/Purple houses are permanent social groups (see
 * `HouseGroupSectorEligibilityPolicy` in Employment); only their `level`
 * (1 = autarky, 2 = group profession) evolves — see `HouseLevelPolicy`.
 * Palace (`House-2Story`) keeps its own frozen color-ladder path via
 * `HouseEvolutionPolicy.resolveHouseEvolution` // TODO(elites).
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import {
  HOUSE_TYPE_BLUE,
  HOUSE_TYPE_RED,
  HOUSE_TYPE_PALACE,
} from '../../../src/contexts/housing/domain/HouseTypeCatalog.js';
import {
  resolveHouseEvolution,
  popAfterPalaceRegression,
} from '../../../src/contexts/housing/domain/policies/HouseEvolutionPolicy.js';
import {
  HOUSE_LEVEL_AUTARKY,
  HOUSE_LEVEL_SPECIALIZED,
  resolveHouseLevel,
} from '../../../src/contexts/housing/domain/policies/HouseLevelPolicy.js';
import {
  HOUSE_LEVEL_1_MAX_POP,
  HOUSE_LEVEL_2_MAX_POP,
  maxPopulationForLevel,
} from '../../../src/contexts/housing/domain/policies/HouseCapacityPolicy.js';
import { EvolveHouseBuilding } from '../../../src/contexts/housing/application/commands/evolution/EvolveHouseBuilding.js';

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

  async applyEvolution({ oldId, targetType, targetPop }) {
    const house = this.raw.get(oldId);
    const newId = `${targetType}-${house.x}-${house.y}`;
    if (newId !== oldId) {
      this.raw.delete(oldId);
      this.raw.set(newId, {
        ...house,
        id: newId,
        type: targetType,
        pop: targetPop,
      });
    } else {
      house.pop = targetPop;
    }
    return { newId, previousId: oldId };
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

describe('Housing — house progression', () => {
  describe('HouseCapacityPolicy.maxPopulationForLevel', () => {
    test('level 1 caps at 6, level 2 doubles to 12', () => {
      expect(maxPopulationForLevel(1)).toBe(HOUSE_LEVEL_1_MAX_POP);
      expect(maxPopulationForLevel(1)).toBe(6);
      expect(maxPopulationForLevel(2)).toBe(HOUSE_LEVEL_2_MAX_POP);
      expect(maxPopulationForLevel(2)).toBe(12);
    });
  });

  describe('HouseLevelPolicy.resolveHouseLevel (Blue/Red/Purple)', () => {
    test('level 1 -> 2 requires road access and a positive population', () => {
      const result = resolveHouseLevel({ level: 1, pop: 3, roadCount: 1 });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
      expect(result.changed).toBe(true);
      expect(result.reason).toBe('level1_to_level2');
    });

    test('level 1 stays autarkic without road access', () => {
      const result = resolveHouseLevel({ level: 1, pop: 3, roadCount: 0 });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('level 1 stays autarkic when uninhabited, even with road access', () => {
      const result = resolveHouseLevel({ level: 1, pop: 0, roadCount: 1 });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.changed).toBe(false);
    });

    test('level 2 regresses to level 1 when road access is lost, population clamped to the level-1 cap', () => {
      const result = resolveHouseLevel({ level: 2, pop: 10, roadCount: 0 });
      expect(result.targetLevel).toBe(HOUSE_LEVEL_AUTARKY);
      expect(result.targetPop).toBe(HOUSE_LEVEL_1_MAX_POP);
      expect(result.changed).toBe(true);
      expect(result.reason).toBe('level2_to_level1_no_road');
    });

    test('level 2 stays specialized while road access is kept', () => {
      const result = resolveHouseLevel({ level: 2, pop: 10, roadCount: 1 });
      expect(result.changed).toBe(false);
      expect(result.targetLevel).toBe(HOUSE_LEVEL_SPECIALIZED);
    });
  });

  describe('Palace evolution (frozen legacy path — HouseEvolutionPolicy)', () => {
    test('palace regresses when palace conditions fail', () => {
      const result = resolveHouseEvolution({
        type: HOUSE_TYPE_PALACE,
        pop: 7,
        roadCount: 1,
        stocks: { food: 2, wheat: 2 },
      });
      expect(result.targetType).toBe(HOUSE_TYPE_RED);
      expect(result.targetPop).toBe(popAfterPalaceRegression(HOUSE_TYPE_PALACE, 7));
    });
  });

  describe('EvolveHouseBuilding command', () => {
    let repo;
    let command;

    beforeEach(() => {
      repo = new InMemoryHousingEvolutionRepository([
        house('House-Red-2-3', HOUSE_TYPE_RED, { pop: 2, level: 1, roadCount: 1 }),
      ]);
      command = new EvolveHouseBuilding(repo);
    });

    test('promotes a Blue/Red/Purple house to level 2 without ever changing its color', async () => {
      const result = await command.execute({ houseId: 'House-Red-2-3' });
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

    test('Palace houses still use the frozen resolveHouseEvolution path', async () => {
      repo = new InMemoryHousingEvolutionRepository([
        house(`${HOUSE_TYPE_PALACE}-2-3`, HOUSE_TYPE_PALACE, {
          pop: 7,
          roadCount: 1,
          stocks: { food: 2, wheat: 2 },
        }),
      ]);
      command = new EvolveHouseBuilding(repo);

      const result = await command.execute({ houseId: `${HOUSE_TYPE_PALACE}-2-3` });
      expect(result.changed).toBe(true);
      expect(result.targetType).toBe(HOUSE_TYPE_RED);
      expect(result.houseId).toBe(`${HOUSE_TYPE_RED}-2-3`);
    });
  });
});

/**
 * Behavior tests — Housing: house evolution policies and commands
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createHousingBuildingSnapshot } from '../../../src/contexts/housing/domain/HousingBuildingSnapshot.js';
import {
  HOUSE_TYPE_BLUE,
  HOUSE_TYPE_RED,
  HOUSE_TYPE_PURPLE,
  HOUSE_TYPE_PALACE,
} from '../../../src/contexts/housing/domain/HouseTypeCatalog.js';
import { checkFoodAffluence } from '../../../src/contexts/housing/domain/policies/FoodAffluencePolicy.js';
import {
  canEvolveToPurple,
  canEvolveToPalace,
  resolveHouseEvolution,
  popAfterPalaceEvolution,
  popAfterPalaceRegression,
} from '../../../src/contexts/housing/domain/policies/HouseEvolutionPolicy.js';
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
    stocks: { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
    ...extras,
  });
}

describe('Housing — house evolution', () => {
  describe('domain policies', () => {
    test('blue evolves to red when inhabited', () => {
      const result = resolveHouseEvolution({
        type: HOUSE_TYPE_BLUE,
        pop: 2,
        roadCount: 1,
        stocks: { food: 0 },
      });
      expect(result.targetType).toBe(HOUSE_TYPE_RED);
      expect(result.changed).toBe(true);
    });

    test('red evolves to purple when fed and nearly full', () => {
      expect(
        canEvolveToPurple({
          stocks: { food: 6, wheat: 6 },
          population: 6,
          buildingType: HOUSE_TYPE_RED,
          hasRoadAccess: true,
        }).canEvolve
      ).toBe(true);

      const result = resolveHouseEvolution({
        type: HOUSE_TYPE_RED,
        pop: 6,
        roadCount: 1,
        stocks: { food: 6, wheat: 6 },
      });
      expect(result.targetType).toBe(HOUSE_TYPE_PURPLE);
    });

    test('purple evolves to palace when food goal and variety met', () => {
      const result = resolveHouseEvolution({
        type: HOUSE_TYPE_PURPLE,
        pop: 6,
        roadCount: 1,
        stocks: { food: 15, wheat: 8, carrot: 7 },
      });
      expect(result.targetType).toBe(HOUSE_TYPE_PALACE);
      expect(result.targetPop).toBe(popAfterPalaceEvolution(6));
    });

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

    test('checkFoodAffluence matches palace food goal rule', () => {
      expect(checkFoodAffluence({ food: 13 }, 6).meetsFoodGoal).toBe(true);
      expect(checkFoodAffluence({ food: 12 }, 6).meetsFoodGoal).toBe(false);
    });

    test('canEvolveToPalace requires two crop types', () => {
      expect(
        canEvolveToPalace({
          stocks: { food: 15, wheat: 15, carrot: 0 },
          population: 6,
          buildingType: HOUSE_TYPE_PURPLE,
        }).reason
      ).toBe('insufficient_food_variety');
    });
  });

  describe('EvolveHouseBuilding command', () => {
    let repo;
    let command;

    beforeEach(() => {
      repo = new InMemoryHousingEvolutionRepository([
        house('House-Blue-2-3', HOUSE_TYPE_BLUE, { pop: 1 }),
      ]);
      command = new EvolveHouseBuilding(repo);
    });

    test('persists type change to repository', async () => {
      const result = await command.execute({ houseId: 'House-Blue-2-3' });
      expect(result.changed).toBe(true);
      expect(result.targetType).toBe(HOUSE_TYPE_RED);
      expect(result.houseId).toBe('House-Red-2-3');

      const updated = await repo.findById('House-Red-2-3');
      expect(updated.type).toBe(HOUSE_TYPE_RED);
    });
  });
});

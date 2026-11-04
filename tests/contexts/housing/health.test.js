/**
 * Health: the environment of a house is the breakdown the evolution takes its level from (the parts add up to the level), a citizen's
 * health settles towards that level and never past it, and a house is judged once a month, its citizens and that mark written together.
 */
import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { describeHealthEnvironment } from '../../../src/contexts/housing/domain/policies/HealthEnvironmentPolicy.js';
import { nextHealthOf } from '../../../src/contexts/housing/domain/policies/HealthEvolutionPolicy.js';
import { EvolveHealthOfHouses } from '../../../src/contexts/housing/application/commands/health/EvolveHealthOfHouses.js';
import { DexieHousingBuildingRepository } from '../../../src/contexts/housing/infrastructure/dexie/DexieHousingBuildingRepository.js';
import { DexieCitizenRegistry } from '../../../src/shared/citizens/DexieCitizenRegistry.js';
import { HEALTH_BASE_LEVEL } from '../../../src/shared/population/HealthFactorCatalog.js';
import { seedBuilding, clearBuildingsTable } from '../../helpers/buildingDb.js';
import { makeHouseRecord } from '../../fixtures/buildingRecord.js';

const PERIOD = 5;
const wellServed = {
  servedFlags: { doctor: PERIOD, primarySchool: PERIOD },
  lastWaterConsumption: { month: PERIOD, totalUnfed: 0 },
  lastConsumption: { month: PERIOD, totalUnfed: 0, categoriesTaken: ['wheat', 'carrot'] },
};

describe('health environment — the parts add up to the level', () => {
  test('a house that gives nothing sits at the base level', () => {
    const environment = describeHealthEnvironment({ servedFlags: {}, lastConsumption: null }, PERIOD);
    expect(environment.level).toBe(HEALTH_BASE_LEVEL);
    expect(environment.parts.every((part) => part.points === 0)).toBe(true);
  });

  test('a served house: each factor gives its points, and base plus parts is exactly the level', () => {
    const environment = describeHealthEnvironment(wellServed, PERIOD);
    expect(environment.parts.map((part) => [part.id, part.points])).toEqual([
      ['foodVariety', 16], ['prevention', 12], ['water', 12], ['primaryEducation', 6],
    ]);
    expect(environment.base + environment.parts.reduce((sum, part) => sum + part.points, 0)).toBe(environment.level);
  });

  test('a record of another month is not a fact of this one', () => {
    const environment = describeHealthEnvironment({ ...wellServed, servedFlags: { doctor: PERIOD - 2 } }, PERIOD);
    expect(environment.parts.find((part) => part.id === 'prevention').points).toBe(0);
  });
});

describe('health evolution — settles towards the environment, never past it', () => {
  const environment = { base: 40, level: 86 };
  const citizen = (health, convergence, sensitivity) => ({ health, constitution: { convergence, sensitivity } });

  test.each([
    [10, 0.5, 1], [95, 0.5, 1], [60, 0.1, 1.5], [60, 1, 0.5], [0, 0.3, 1.5],
  ])('from %d (convergence %d, sensitivity %d) it stays in [0, 100] and ends at its target', (start, convergence, sensitivity) => {
    const target = Math.min(100, 40 + sensitivity * 46);
    let current = citizen(start, convergence, sensitivity);
    for (let month = 0; month < 200; month += 1) {
      const next = nextHealthOf(current, environment);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThanOrEqual(100);
      // never past the target: the gap shrinks without changing sign
      expect(Math.abs(target - next)).toBeLessThanOrEqual(Math.abs(target - current.health) + 1e-9);
      current = { ...current, health: next };
    }
    expect(current.health).toBeCloseTo(target, 3);
  });
});

describe('monthly judgement of the houses', () => {
  let registry;
  let repository;
  let command;
  let houseId;

  beforeEach(async () => {
    await clearBuildingsTable();
    await db.citizens.clear();
    let sequence = 0;
    registry = new DexieCitizenRegistry({
      currentTurn: () => 0,
      random: () => 0.5,
      newId: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
    });
    repository = new DexieHousingBuildingRepository({ citizens: registry });
    command = new EvolveHealthOfHouses(repository, registry);
    const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10, extra: wellServed });
    houseId = record.instanceId;
    await seedBuilding(record);
    await repository.savePopulation(houseId, { pop: 3 });
  });

  test('each citizen moves towards the level of its house, and the month is judged once', async () => {
    const house = await repository.findById(houseId);
    const before = await registry.forHouse({ houseId, hamletId: house.hamletId, pop: 3 });
    const environment = describeHealthEnvironment(house, PERIOD);

    expect(await command.execute({ monthKey: 7, periodKey: PERIOD })).toEqual({ judged: 1 });

    const after = await registry.forHouse({ houseId, hamletId: house.hamletId, pop: 3 });
    after.forEach((citizen, index) => {
      expect(citizen.id).toBe(before[index].id);
      expect(citizen.health).toBeCloseTo(nextHealthOf(before[index], environment), 9);
    });
    expect((await repository.findById(houseId)).lastHealthMonth).toBe(7);

    expect(await command.execute({ monthKey: 7, periodKey: PERIOD })).toEqual({ judged: 0 });
    expect(await command.execute({ monthKey: 8, periodKey: PERIOD })).toEqual({ judged: 1 });
  });
});

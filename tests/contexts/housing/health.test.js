/**
 * Health: the environment of a house is the breakdown the evolution takes its level from (the parts add up to the level), a citizen's
 * health settles towards that level and never past it, and a house is judged once a month, its citizens and that mark written together.
 */
import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { describeCitizenEnvironment, describeHealthEnvironment, describeMentalEnvironment } from '../../../src/contexts/housing/domain/policies/HealthEnvironmentPolicy.js';
import { nextHealthOf } from '../../../src/contexts/housing/domain/policies/HealthEvolutionPolicy.js';
import { EvolveHealthOfHouses } from '../../../src/contexts/housing/application/commands/health/EvolveHealthOfHouses.js';
import { DexieHousingBuildingRepository } from '../../../src/contexts/housing/infrastructure/dexie/DexieHousingBuildingRepository.js';
import { DexieCitizenRegistry } from '../../../src/shared/citizens/DexieCitizenRegistry.js';
import {
  CONTAGION_RADIUS,
  HEALTH_BASE_LEVEL,
  HEALTH_DEATH_RISK_AT_ZERO,
  HEALTH_SEVERE_BELOW,
  HEALTH_SICK_BELOW,
  INVALIDITY_MONTHS,
  MENTAL_BASE_LEVEL,
  SUICIDE_RISK_AT_ZERO,
  healthDeathRisk,
  neighbourSickShareOf,
  suicideRisk,
  unemployedShareOf,
  workplaceExposureOf,
} from '../../../src/shared/population/HealthFactorCatalog.js';
import { invalidityAfter, isInvalid } from '../../../src/contexts/housing/domain/policies/InvalidityPolicy.js';
import { surroundingsOf, surroundingsOfCitizen } from '../../../src/contexts/housing/domain/policies/HealthSurroundingsPolicy.js';
import { withHealth, withInvalidity, withMentalHealth } from '../../../src/shared/citizens/Citizen.js';
import { DescribeHouseHealth } from '../../../src/contexts/housing/application/queries/DescribeHouseHealth.js';
import { getBuildingDefinition } from '../../../src/shared/building-catalog/buildingCatalog.js';
import {
  getCumulativeDeaths,
  getDeathsByCause,
  isDeathGameOverReached,
  recordDeaths,
  resetCumulativeDeaths,
} from '../../../src/composition/gameplayMortalityState.js';
import { seedBuilding, clearBuildingsTable } from '../../helpers/buildingDb.js';
import { makeHouseRecord } from '../../fixtures/buildingRecord.js';

const PERIOD = 5;
// What does not come from the house itself: the pollution of its workers' workplaces and the share of its neighbours who are sick.
const around = (workplaceExposure = 0, neighbourSickShare = 0, unemployedShare = 0) => ({ workplaceExposure, neighbourSickShare, unemployedShare });
const wellServed = {
  servedFlags: { doctor: PERIOD, primarySchool: PERIOD },
  lastWaterConsumption: { month: PERIOD, totalUnfed: 0 },
  lastConsumption: { month: PERIOD, totalUnfed: 0, categoriesTaken: ['wheat', 'carrot'] },
};

describe('health environment — the parts add up to the level', () => {
  test('a house that gives nothing sits at the base level', () => {
    const environment = describeHealthEnvironment({ servedFlags: {}, lastConsumption: null }, PERIOD, around());
    expect(environment.level).toBe(HEALTH_BASE_LEVEL);
    expect(environment.parts.every((part) => part.points === 0)).toBe(true);
  });

  test('a served house: each factor gives its points, and base plus parts is exactly the level', () => {
    const environment = describeHealthEnvironment(wellServed, PERIOD, around());
    expect(environment.parts.map((part) => [part.id, part.points])).toEqual([
      ['foodVariety', 16], ['prevention', 12], ['water', 12], ['primaryEducation', 6], ['pollution', 0], ['contagion', 0],
    ]);
    expect(environment.base + environment.parts.reduce((sum, part) => sum + part.points, 0)).toBe(environment.level);
  });

  // The work itself exposes the workers (a mine, a coal plant, a pottery...): the pollution takes points off, in proportion to the average level of their workplaces.
  test('pollution takes points off the environment in proportion to the level the workers are exposed to, and the parts still add up to the level', () => {
    const polluted = describeHealthEnvironment(wellServed, PERIOD, around(2));
    expect(polluted.parts.find((part) => part.id === 'pollution').points).toBe(-8);
    expect(polluted.level).toBe(describeHealthEnvironment(wellServed, PERIOD, around()).level - 8);
    expect(polluted.base + polluted.parts.reduce((sum, part) => sum + part.points, 0)).toBe(polluted.level);
    // No level beyond the top of the scale declared in the catalog counts.
    expect(describeHealthEnvironment(wellServed, PERIOD, around(99)).parts.find((part) => part.id === 'pollution').points).toBe(-12);
    expect(() => describeHealthEnvironment(wellServed, PERIOD, undefined)).toThrow(/pollution of a house's workplaces/);
  });

  // The sick of the houses around spread their illness: points off in proportion to their share, half as many where a doctor or a hospital covers the house.
  test('the sick around take points off, and a doctor or a hospital halves it', () => {
    const uncovered = { servedFlags: {}, lastConsumption: null };
    const covered = { servedFlags: { doctor: PERIOD }, lastConsumption: null };

    expect(describeHealthEnvironment(uncovered, PERIOD, around(0, 0.4)).parts.find((part) => part.id === 'contagion').points).toBeCloseTo(-6, 9);
    expect(describeHealthEnvironment(covered, PERIOD, around(0, 0.4)).parts.find((part) => part.id === 'contagion').points).toBeCloseTo(-3, 9);
    expect(describeHealthEnvironment({ servedFlags: { hospital: PERIOD }, lastConsumption: null }, PERIOD, around(0, 0.4)).parts.find((part) => part.id === 'contagion').points).toBeCloseTo(-3, 9);
    expect(neighbourSickShareOf({ sick: 3, residents: 12 })).toBe(0.25);
    expect(neighbourSickShareOf(undefined)).toBe(0);
    expect(() => describeHealthEnvironment(uncovered, PERIOD, around(0, 1.5))).toThrow(/share of sick neighbours/);
  });

  test('a house\'s exposure is the average level of its workers\' workplaces, and none when its residents do not work', () => {
    expect(workplaceExposureOf({ workers: 4, exposure: 3 * 3 + 0 })).toBeCloseTo(2.25, 9);
    expect(workplaceExposureOf(undefined)).toBe(0);
    expect(workplaceExposureOf({ workers: 0, exposure: 0 })).toBe(0);
  });

  test('a record of another month is not a fact of this one', () => {
    const environment = describeHealthEnvironment({ ...wellServed, servedFlags: { doctor: PERIOD - 2 } }, PERIOD, around());
    expect(environment.parts.find((part) => part.id === 'prevention').points).toBe(0);
  });
});

describe('a citizen\'s environment — the histogram is the breakdown of his real target', () => {
  test.each([0.5, 1, 1.5])('sensitivity %d: the parts add up to the level, which stays on the scale', (sensitivity) => {
    const citizenEnvironment = describeCitizenEnvironment(describeHealthEnvironment(wellServed, PERIOD, around()), { sensitivity });
    expect(citizenEnvironment.base + citizenEnvironment.parts.reduce((sum, part) => sum + part.points, 0)).toBeCloseTo(citizenEnvironment.level, 9);
    expect(citizenEnvironment.level).toBeLessThanOrEqual(100);
    expect(citizenEnvironment.level).toBeCloseTo(Math.min(100, 40 + sensitivity * 46), 9);
  });
});

describe('health evolution — settles towards the environment, never past it', () => {
  const environment = describeHealthEnvironment(wellServed, PERIOD, around()); // base 40, level 86
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
  // The draw of the deaths, fixed by each test (0 kills every sick citizen, 0.99 spares them).
  let nextDraw = 0.5;
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
    command = new EvolveHealthOfHouses(repository, registry, () => nextDraw);
    const record = makeHouseRecord({ type: 'House-Blue', x: 8, y: 10, extra: wellServed });
    houseId = record.instanceId;
    await seedBuilding(record);
    await repository.savePopulation(houseId, { pop: 3 });
  });

  test('each citizen moves towards the level of its house, and the month is judged once', async () => {
    const house = await repository.findById(houseId);
    const before = await registry.forHouse({ houseId, hamletId: house.hamletId, pop: 3 });
    const environment = describeHealthEnvironment(house, PERIOD, around());

    expect(await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: false })).toEqual({ judged: 1, deaths: 0, suicides: 0 });

    const after = await registry.forHouse({ houseId, hamletId: house.hamletId, pop: 3 });
    after.forEach((citizen, index) => {
      expect(citizen.id).toBe(before[index].id);
      expect(citizen.health).toBeCloseTo(nextHealthOf(before[index], environment), 9);
    });
    expect((await repository.findById(houseId)).lastHealthMonth).toBe(7);
    expect((await repository.findById(houseId)).sickCount).toBe(after.filter((citizen) => citizen.health < HEALTH_SICK_BELOW).length);

    expect(await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: false })).toEqual({ judged: 0, deaths: 0, suicides: 0 });
    expect(await command.execute({ monthKey: 8, periodKey: PERIOD, deathsEnabled: false })).toEqual({ judged: 1, deaths: 0, suicides: 0 });
  });

  // A grave illness (under the severe threshold) three months in a row makes a citizen invalid; whether for good is his category's fact: the artisans' is, the merchants' is not.
  describe('invalidity', () => {
    const sicken = async (id, { severeMonths = 2, health = 5 } = {}) => {
      const hamletId = (await repository.findById(id)).hamletId;
      const inhabitants = await registry.forHouse({ houseId: id, hamletId, pop: 3 });
      await db.transaction('rw', db.houses, db.citizens, () => registry.updateHealth(inhabitants.map((citizen) => withInvalidity(withHealth(citizen, health), { severeMonths, invalid: false }))));
      registry.resetForTests();
      return hamletId;
    };
    const seedHouse = async (type, x, y) => {
      const record = makeHouseRecord({ type, x, y });
      await seedBuilding(record);
      await repository.savePopulation(record.instanceId, { pop: 3 });
      return record.instanceId;
    };

    test('invalidityAfter counts the months in a row under the severe threshold and sets a permanent category\'s invalidity for good', () => {
      const permanent = { permanent: true };
      expect(invalidityAfter({ severeMonths: 1, invalid: false }, HEALTH_SEVERE_BELOW - 1, permanent)).toEqual({ severeMonths: 2, invalid: false });
      expect(invalidityAfter({ severeMonths: INVALIDITY_MONTHS - 1, invalid: false }, 3, permanent)).toEqual({ severeMonths: INVALIDITY_MONTHS, invalid: true });
      // Recovering resets the count, but not an invalidity that is for good.
      expect(invalidityAfter({ severeMonths: 5, invalid: true }, 80, permanent)).toEqual({ severeMonths: 0, invalid: true });
      expect(invalidityAfter({ severeMonths: INVALIDITY_MONTHS - 1, invalid: false }, 3, { permanent: false })).toEqual({ severeMonths: INVALIDITY_MONTHS, invalid: false });
      expect(invalidityAfter({ severeMonths: 2, invalid: false }, 3, null)).toEqual({ severeMonths: 0, invalid: false });
      expect(isInvalid({ severeMonths: INVALIDITY_MONTHS, invalid: false }, { permanent: false })).toBe(true);
      expect(isInvalid({ severeMonths: INVALIDITY_MONTHS, invalid: false }, null)).toBe(false);
    });

    test('an artisan house: three months of grave illness make its citizens invalid for good, even when their health recovers', async () => {
      const id = await seedHouse('House-Red', 20, 20);
      const hamletId = await sicken(id);

      await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: false });

      let row = await repository.findById(id);
      expect(row.invalidCount).toBe(3);
      expect(row.sickCount).toBe(0); // invalid, so counted apart from the sick
      expect((await registry.forHouse({ houseId: id, hamletId, pop: 3 })).every((citizen) => citizen.invalid)).toBe(true);

      await sicken(id, { severeMonths: 0, health: 80 }); // they recover: their invalidity does not
      const recovered = await registry.forHouse({ houseId: id, hamletId, pop: 3 });
      await db.transaction('rw', db.houses, db.citizens, () => registry.updateHealth(recovered.map((citizen) => withInvalidity(citizen, { severeMonths: 0, invalid: true }))));
      registry.resetForTests();
      await command.execute({ monthKey: 8, periodKey: PERIOD, deathsEnabled: false });
      row = await repository.findById(id);
      expect(row.invalidCount).toBe(3);
    });

    test('a merchant house: the same illness makes them invalid only while they stay that ill', async () => {
      const id = await seedHouse('House-Blue', 30, 30);
      const hamletId = await sicken(id);

      await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: false });
      expect((await repository.findById(id)).invalidCount).toBe(3);
      expect((await registry.forHouse({ houseId: id, hamletId, pop: 3 })).some((citizen) => citizen.invalid)).toBe(false);

      await sicken(id, { severeMonths: 5, health: 80 }); // healthy again: not invalid any more
      await command.execute({ monthKey: 8, periodKey: PERIOD, deathsEnabled: false });
      expect((await repository.findById(id)).invalidCount).toBe(0);
    });
  });

  // The mind has its own score and environment: culture lifts it, unemployment, hunger and the nuisance of work weigh on it; a gravely ill mind ends in suicide where the
  // game has defeat, and counts towards invalidity like a gravely ill body.
  describe('the mind', () => {
    const setScores = async (id, scores) => {
      const hamletId = (await repository.findById(id)).hamletId;
      const inhabitants = await registry.forHouse({ houseId: id, hamletId, pop: scores.length });
      await db.transaction('rw', db.houses, db.citizens, () => registry.updateHealth(inhabitants.map((citizen, index) => withMentalHealth(withHealth(citizen, scores[index].health), scores[index].mental))));
      registry.resetForTests();
    };
    const seedHouse = async (type, x, y, pop = 3) => {
      const record = makeHouseRecord({ type, x, y });
      await seedBuilding(record);
      await repository.savePopulation(record.instanceId, { pop });
      return record.instanceId;
    };

    test('the environment of the mind: culture lifts it, and unemployment, hunger and the nuisance of work take points off', () => {
      const bare = { servedFlags: {}, lastConsumption: null };
      expect(describeMentalEnvironment(bare, PERIOD, around()).level).toBe(MENTAL_BASE_LEVEL);
      expect(describeMentalEnvironment({ ...bare, servedFlags: { library: PERIOD, theatre: PERIOD } }, PERIOD, around()).level).toBe(MENTAL_BASE_LEVEL + 10);
      expect(describeMentalEnvironment(bare, PERIOD, around(0, 0, 0.5)).parts.find((part) => part.id === 'unemployment').points).toBe(-10);
      expect(describeMentalEnvironment(bare, PERIOD, around(2)).parts.find((part) => part.id === 'workNuisance').points).toBe(-6);
      expect(describeMentalEnvironment({ ...bare, lastConsumption: { month: PERIOD, totalUnfed: 2 } }, PERIOD, around()).parts.find((part) => part.id === 'hunger').points).toBe(-15);
      const everything = describeMentalEnvironment({ servedFlags: {}, lastConsumption: { month: PERIOD, totalUnfed: 2 } }, PERIOD, around(3, 0, 1));
      expect(everything.base + everything.parts.reduce((sum, part) => sum + part.points, 0)).toBe(everything.level);
      expect(unemployedShareOf(4, 1)).toBe(0.75);
      expect(unemployedShareOf(0, 0)).toBe(0);
    });

    // Regression: the unemployment (a share of the house's job seekers) and the pollution of work (an average over its workers) weighed on every resident of the house, so a
    // resident who works was hit by the unemployment of his housemates, and one with no job by the pollution of a workplace he does not go to.
    test('unemployment weighs only on the residents with no job, and the pollution of work only on those who work', async () => {
      const id = await seedHouse('House-Blue', 90, 90);
      const mine = makeHouseRecord({ type: 'Mine', x: 80, y: 80, extra: { employees: { worker: 1, worker_need: 3, workerSources: { [id]: 1 } } } });
      await seedBuilding(mine);
      await setScores(id, [{ health: 80, mental: 60 }, { health: 80, mental: 60 }, { health: 80, mental: 60 }]);
      const hamletOfHouse = (await repository.findById(id)).hamletId;
      const [first] = await registry.forHouse({ houseId: id, hamletId: hamletOfHouse, pop: 3 });
      await registry.assignWorkplaces(hamletOfHouse, [{ citizen: first, workplaceId: mine.instanceId }]);
      registry.resetForTests();

      await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: false });

      const hamletId = (await repository.findById(id)).hamletId;
      const [worker, firstUnemployed, secondUnemployed] = await registry.forHouse({ houseId: id, hamletId, pop: 3 });
      // Constitution of the suite: convergence 0.3, sensitivity 1. The worker's body is pulled to 40 − 12 (the mine, level 3) and his mind to 60 − 9 (its nuisance), with no
      // unemployment; the others' body to 40 and their mind to 60 − 20 (all the job seekers who have none are theirs), with no pollution.
      expect(worker.health).toBeCloseTo(80 + 0.3 * (28 - 80), 9);
      expect(worker.mentalHealth).toBeCloseTo(60 + 0.3 * (51 - 60), 9);
      for (const unemployed of [firstUnemployed, secondUnemployed]) {
        expect(unemployed.health).toBeCloseTo(80 + 0.3 * (40 - 80), 9);
        expect(unemployed.mentalHealth).toBeCloseTo(60 + 0.3 * (40 - 60), 9);
      }
    });

    test('a citizen\'s situation is his own: no job weighs as unemployment only where jobs are sought, a job exposes to the level of that workplace', () => {
      const neighbours = { sick: 2, residents: 8 };
      const pollution = new Map([['mine', 3], ['bank', 0]]);
      expect(surroundingsOfCitizen({ id: 'a', workplaceId: null }, 3, neighbours, pollution)).toEqual({ workplaceExposure: 0, neighbourSickShare: 0.25, unemployedShare: 1 });
      expect(surroundingsOfCitizen({ id: 'a', workplaceId: null }, 0, neighbours, pollution)).toEqual({ workplaceExposure: 0, neighbourSickShare: 0.25, unemployedShare: 0 });
      expect(surroundingsOfCitizen({ id: 'a', workplaceId: 'mine' }, 3, neighbours, pollution)).toEqual({ workplaceExposure: 3, neighbourSickShare: 0.25, unemployedShare: 0 });
      expect(surroundingsOfCitizen({ id: 'a', workplaceId: 'bank' }, 3, neighbours, pollution).workplaceExposure).toBe(0);
      expect(() => surroundingsOfCitizen({ id: 'a', workplaceId: 'gone' }, 3, neighbours, pollution)).toThrow(/not a workplace/);
      expect(surroundingsOf({ pop: 3, seeking: 3 }, { workers: 1, exposure: 3 }, neighbours)).toEqual({ workplaceExposure: 3, neighbourSickShare: 0.25, unemployedShare: 2 / 3 });
    });

    test('the suicide risk is nothing from the severe threshold up and grows to its top at nothing', () => {
      expect(suicideRisk(HEALTH_SEVERE_BELOW)).toBe(0);
      expect(suicideRisk(80)).toBe(0);
      expect(suicideRisk(0)).toBe(SUICIDE_RISK_AT_ZERO);
    });

    test('a gravely ill mind in a healthy body ends in suicide where deaths are enabled, and is counted apart from the deaths of the body', async () => {
      const id = await seedHouse('House-Blue', 40, 40);
      await setScores(id, [{ health: 90, mental: 3 }, { health: 90, mental: 90 }, { health: 90, mental: 90 }]);
      nextDraw = 0;

      const result = await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: true });

      expect(result).toMatchObject({ deaths: 0, suicides: 1 });
      expect((await repository.findById(id)).pop).toBe(2);
    });

    test('nobody takes his own life where deaths are not enabled, nor in the administrators\' house', async () => {
      const merchants = await seedHouse('House-Blue', 40, 40);
      const mayor = await seedHouse('House-Mayor', 50, 50);
      await setScores(merchants, [{ health: 90, mental: 3 }, { health: 90, mental: 3 }, { health: 90, mental: 3 }]);
      await setScores(mayor, [{ health: 90, mental: 3 }, { health: 90, mental: 3 }, { health: 90, mental: 3 }]);
      nextDraw = 0;

      expect(await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: false })).toMatchObject({ suicides: 0 });
      expect((await repository.findById(merchants)).pop).toBe(3);
      expect(await command.execute({ monthKey: 8, periodKey: PERIOD, deathsEnabled: true })).toMatchObject({ suicides: 3 });
      expect((await repository.findById(mayor)).pop).toBe(3);
    });

    test('a gravely ill mind makes invalid like a gravely ill body: the lower of the two scores counts', async () => {
      const id = await seedHouse('House-Red', 60, 60);
      await setScores(id, [{ health: 90, mental: 3 }, { health: 90, mental: 3 }, { health: 90, mental: 3 }]);
      const hamletId = (await repository.findById(id)).hamletId;
      const inhabitants = await registry.forHouse({ houseId: id, hamletId, pop: 3 });
      await db.transaction('rw', db.houses, db.citizens, () => registry.updateHealth(inhabitants.map((citizen) => withInvalidity(citizen, { severeMonths: INVALIDITY_MONTHS - 1, invalid: false }))));
      registry.resetForTests();

      await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: false });

      expect((await repository.findById(id)).invalidCount).toBe(3);
    });

    test('the HUD\'s four counts: the body and the mind, the mildly ill (under the sick threshold) and the gravely ill (under the severe one)', async () => {
      const id = await seedHouse('House-Blue', 70, 70);
      await setScores(id, [{ health: 40, mental: 80 }, { health: 10, mental: 30 }, { health: 80, mental: 10 }]);

      const illness = await new DescribeHouseHealth(repository, registry).illnessOfHamlet();

      // The test house of the suite (3 healthy citizens at 72 and 72) adds nobody to any count.
      expect(illness).toEqual({ physical: { mild: 1, severe: 1 }, mental: { mild: 1, severe: 1 } });
    });
  });

  // The sick of the houses around spread their illness: a house reads the sick and the residents of the houses within the radius, not its own.
  test('the neighbours of a house are the other houses within the radius, with their sick and their residents', async () => {
    const near = makeHouseRecord({ type: 'House-Red', x: 10, y: 12, extra: { sickCount: 2 } });
    const far = makeHouseRecord({ type: 'House-Red', x: 60, y: 60, extra: { sickCount: 3 } });
    await seedBuilding(near);
    await seedBuilding(far);
    await repository.savePopulation(near.instanceId, { pop: 4 });
    await repository.savePopulation(far.instanceId, { pop: 5 });

    const neighbours = await repository.neighbourSickByHouse(CONTAGION_RADIUS);

    // The test house (8, 10; 3 residents, nobody known sick) sees the near one (|10−8| + |12−10| = 4, within the radius) and not the far one.
    expect(neighbours.get(houseId)).toEqual({ sick: 2, residents: 4 });
    expect(neighbours.get(far.instanceId)).toEqual({ sick: 0, residents: 0 });
    expect(neighbours.get(near.instanceId)).toEqual({ sick: 0, residents: 3 });
  });

  // The work exposes the workers: a house's exposure is read from the workplaces that employ its residents, by the pollution the catalog gives their type.
  test('the exposure of a house is read from its workers\' workplaces: a mine (3) and a place that exposes to nothing', async () => {
    await seedBuilding(makeHouseRecord({ type: 'Mine', x: 2, y: 2, extra: { employees: { worker: 2, worker_need: 3, workerSources: { [houseId]: 2 } } } }));
    await seedBuilding(makeHouseRecord({ type: 'Bank', x: 4, y: 4, extra: { employees: { worker: 1, worker_need: 3, workerSources: { [houseId]: 1 } } } }));

    const exposure = await repository.workplaceExposureByHouse();

    expect(exposure.get(houseId)).toEqual({ workers: 3, exposure: 6 });
    expect(workplaceExposureOf(exposure.get(houseId))).toBe(2);
    expect(getBuildingDefinition('Mine').employment.pollution).toBe(3);
    expect(getBuildingDefinition('Bank').employment.pollution).toBeUndefined();
  });

  // Poor health kills: a sick citizen dies by the risk of his health, leaving with the same write that lowers the house's population.
  describe('deaths of poor health', () => {
    const hamletOf = async () => (await repository.findById(houseId)).hamletId;
    const makeEveryoneVerySick = async () => {
      const hamletId = await hamletOf();
      const inhabitants = await registry.forHouse({ houseId, hamletId, pop: 3 });
      await db.transaction('rw', db.houses, db.citizens, () => registry.updateHealth(inhabitants.map((citizen) => withHealth(citizen, 5))));
      registry.resetForTests();
    };

    test('with a draw that always kills, every sick citizen dies, the population follows, and the books still agree', async () => {
      await makeEveryoneVerySick();
      nextDraw = 0;

      expect(await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: true })).toEqual({ judged: 1, deaths: 3, suicides: 0 });

      const house = await repository.findById(houseId);
      expect(house.pop).toBe(0);
      expect(house.sickCount).toBe(0);
      expect(await registry.forHouse({ houseId, hamletId: house.hamletId, pop: house.pop })).toEqual([]);
    });

    test('the same sick citizens survive a draw that spares them, and where deaths are not enabled', async () => {
      await makeEveryoneVerySick();
      nextDraw = 0.99;
      expect(await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: true })).toEqual({ judged: 1, deaths: 0, suicides: 0 });
      expect((await repository.findById(houseId)).pop).toBe(3);

      nextDraw = 0;
      expect(await command.execute({ monthKey: 8, periodKey: PERIOD, deathsEnabled: false })).toEqual({ judged: 1, deaths: 0, suicides: 0 });
      expect((await repository.findById(houseId)).pop).toBe(3);
    });

    // The administrators stand outside health: their house cannot be demolished and holds the owner of every building, so it is never judged — no one falls ill, is invalid
    // or dies there, whatever the draw — and no figure of health counts them.
    test('the administrators\' house is outside health: it is not judged, nobody there dies, and no figure counts them', async () => {
      const mayor = makeHouseRecord({ type: 'House-Mayor', x: 12, y: 12, extra: wellServed });
      await seedBuilding(mayor);
      await repository.savePopulation(mayor.instanceId, { pop: 3 });
      const hamletId = (await repository.findById(mayor.instanceId)).hamletId;
      const inhabitants = await registry.forHouse({ houseId: mayor.instanceId, hamletId, pop: 3 });
      await db.transaction('rw', db.houses, db.citizens, () => registry.updateHealth(inhabitants.map((citizen) => withHealth(citizen, 5))));
      registry.resetForTests();
      nextDraw = 0;

      // Only the test house of the suite is judged; the administrators' house is skipped.
      expect(await command.execute({ monthKey: 7, periodKey: PERIOD, deathsEnabled: true })).toEqual({ judged: 1, deaths: 0, suicides: 0 });

      const row = await repository.findById(mayor.instanceId);
      expect(row.pop).toBe(3);
      expect(row.lastHealthMonth).toBeUndefined();
      expect(row.sickCount).toBeUndefined();
      // Their very low scores stay as they are, and no count of the HUD, no average and no description includes them.
      const describe = new DescribeHouseHealth(repository, registry);
      expect(await describe.illnessOfHamlet()).toEqual({ physical: { mild: 0, severe: 0 }, mental: { mild: 0, severe: 0 } });
      expect(await describe.ofHouse({ houseId: mayor.instanceId, periodKey: PERIOD })).toEqual({ outsideHealth: true });
      expect((await describe.ofHamlet({ periodKey: PERIOD })).citizens).toBe(3);
    });

    test('the risk is nothing at the sick threshold and grows to its top at nothing', () => {
      expect(healthDeathRisk(HEALTH_SICK_BELOW)).toBe(0);
      expect(healthDeathRisk(90)).toBe(0);
      expect(healthDeathRisk(0)).toBe(HEALTH_DEATH_RISK_AT_ZERO);
      expect(healthDeathRisk(HEALTH_SICK_BELOW / 2)).toBeCloseTo(HEALTH_DEATH_RISK_AT_ZERO / 2, 9);
    });

    test('a death is counted under its cause, both causes count towards the end of the game', () => {
      resetCumulativeDeaths();
      recordDeaths(10, 'famine');
      recordDeaths(14, 'health');

      expect(getDeathsByCause()).toEqual({ famine: 10, health: 14, suicide: 0, accident: 0 });
      expect(getCumulativeDeaths()).toBe(24);
      expect(isDeathGameOverReached()).toBe(false);
      recordDeaths(1, 'health');
      expect(isDeathGameOverReached()).toBe(true);
      expect(() => recordDeaths(1, 'plague')).toThrow(/unknown cause/);
      resetCumulativeDeaths();
    });
  });
});

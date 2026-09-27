/**
 * Branchement ECS — createGameRuntime (comportement du tick simulation)
 */

import { describe, test, expect } from '@jest/globals';
import { createGameRuntime } from '../../src/composition/createGameRuntime.js';
import { TimeManager } from '../../src/shared/time/TimeManager.js';

function fakeParcels() {
  let calls = 0;
  return {
    calls: () => calls,
    recalculateAllRoadAccess: {
      execute: async () => {
        calls += 1;
        return { processed: 0, updated: 0 };
      },
    },
  };
}

function fakeSupply() {
  let foodCalls = 0;
  const employmentRecords = [];
  return {
    foodCalls: () => foodCalls,
    employmentRecords: () => employmentRecords,
    runMonthlyResourceCycle: async () => {
      foodCalls += 1;
    },
    recordEmploymentSummary: async (_timeInfo, summary) => {
      employmentRecords.push(summary);
    },
  };
}

function fakeHousing() {
  let growthCalls = 0;
  let evolutionCalls = 0;
  return {
    growthCalls: () => growthCalls,
    evolutionCalls: () => evolutionCalls,
    growAllHousePopulation: async () => {
      growthCalls += 1;
      return { housesProcessed: 0, housesChanged: 0, changes: [] };
    },
    evolveAllHouseBuildings: async () => {
      evolutionCalls += 1;
      return { housesProcessed: 0, housesChanged: 0, changes: [] };
    },
  };
}

function fakeEmployment() {
  let redistributeCalls = 0;
  return {
    redistributeCalls: () => redistributeCalls,
    distributeCityWorkers: async () => {
      redistributeCalls += 1;
      return { assigned: 0, workplacesProcessed: 0 };
    },
    getCityEmploymentSummary: async () => ({ unemployed: 3 }),
  };
}

function fakeGameplay() {
  let eventCalls = 0;
  return {
    eventCalls: () => eventCalls,
    randomEventsSimulation: {
      simulate: async () => {
        eventCalls += 1;
      },
    },
  };
}

function fakeIntelligence() {
  let newsCalls = 0;
  return {
    newsCalls: () => newsCalls,
    generateMonthlyNews: async () => {
      newsCalls += 1;
      return [];
    },
  };
}

function baseRuntimeDeps(overrides = {}) {
  return {
    parcels: fakeParcels(),
    supply: fakeSupply(),
    housing: fakeHousing(),
    employment: fakeEmployment(),
    gameplay: fakeGameplay(),
    intelligence: fakeIntelligence(),
    getTimeInfo: (turn) => TimeManager.getTimeInfo(turn),
    toSupplySeason: () => 'summer',
    toSupplyMonth: () => 'july',
    getSkillPriorities: () => ({}),
    ...overrides,
  };
}

describe('createGameRuntime', () => {
  test('enregistre tous les systèmes dans le pipeline simulation', () => {
    const runtime = createGameRuntime(baseRuntimeDeps());

    expect(runtime.pipeline.getGroupNames()).toEqual(['simulation']);
    expect(runtime.pipeline.getSystemNames('simulation')).toEqual([
      'parcels.roadAccess',
      'supply.monthlyResourceCycle',
      'housing.populationGrowth',
      'housing.evolution',
      'employment.redistribute',
      'history.employmentSummary',
      'gameplay.randomEvents',
      'intelligence.monthlyNews',
    ]);
    expect(runtime.world).toBeDefined();
  });

  test('runSimulation délègue aux BC du pipeline', async () => {
    const parcels = fakeParcels();
    const supply = fakeSupply();
    const housing = fakeHousing();
    const employment = fakeEmployment();
    const gameplay = fakeGameplay();
    const intelligence = fakeIntelligence();
    const runtime = createGameRuntime(
      baseRuntimeDeps({
        parcels,
        supply,
        housing,
        employment,
        gameplay,
        intelligence,
        // Jour 1 du mois → déclenche la génération mensuelle intelligence
        getTimeInfo: () => ({ dayInMonth: 1, monthIndex: 0 }),
      })
    );

    await runtime.runSimulation({
      time: 0,
      city: { size: 1, tiles: [[]] },
    });

    expect(parcels.calls()).toBe(1);
    expect(supply.foodCalls()).toBe(1);
    expect(housing.growthCalls()).toBe(1);
    expect(housing.evolutionCalls()).toBe(1);
    expect(employment.redistributeCalls()).toBe(1);
    expect(gameplay.eventCalls()).toBe(1);
    expect(intelligence.newsCalls()).toBe(1);
    // The last day of the month (a one-day month here) puts the city's employment in its history
    expect(supply.employmentRecords()).toEqual([{ unemployed: 3 }]);
  });

  test('history.employmentSummary ne tourne qu\'au dernier jour du mois', async () => {
    const supply = fakeSupply();
    const runtime = createGameRuntime(
      baseRuntimeDeps({
        supply,
        getTimeInfo: () => ({ dayInMonth: TimeManager.DAYS_PER_MONTH + 1, monthIndex: 0 }),
      })
    );

    await runtime.runSimulation({ time: 2, city: { size: 1, tiles: [[]] } });
    expect(supply.employmentRecords()).toEqual([]);
  });

  test('intelligence.monthlyNews ne tourne pas hors 1er jour du mois', async () => {
    const intelligence = fakeIntelligence();
    const runtime = createGameRuntime(
      baseRuntimeDeps({
        intelligence,
        getTimeInfo: () => ({ dayInMonth: 3, monthIndex: 0 }),
      })
    );

    await runtime.runSimulation({ time: 2, city: { size: 1, tiles: [[]] } });
    expect(intelligence.newsCalls()).toBe(0);
  });

  test('refuse un contexte invalide', () => {
    expect(() => createGameRuntime({})).toThrow(/parcels/);
    expect(() => createGameRuntime({ parcels: fakeParcels() })).toThrow(/supply/);
    expect(() =>
      createGameRuntime({ parcels: fakeParcels(), supply: fakeSupply() })
    ).toThrow(/housing/);
    expect(() =>
      createGameRuntime({
        parcels: fakeParcels(),
        supply: fakeSupply(),
        housing: fakeHousing(),
      })
    ).toThrow(/employment/);
    expect(() =>
      createGameRuntime({
        parcels: fakeParcels(),
        supply: fakeSupply(),
        housing: fakeHousing(),
        employment: fakeEmployment(),
      })
    ).toThrow(/gameplay/);
    expect(() =>
      createGameRuntime({
        parcels: fakeParcels(),
        supply: fakeSupply(),
        housing: fakeHousing(),
        employment: fakeEmployment(),
        gameplay: fakeGameplay(),
      })
    ).toThrow(/intelligence/);
  });
});

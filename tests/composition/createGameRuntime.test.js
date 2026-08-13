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
  let factoryCalls = 0;
  let syncDemandCalls = 0;
  let allocateWorkersCalls = 0;
  let commerceCalls = 0;
  return {
    foodCalls: () => foodCalls,
    factoryCalls: () => factoryCalls,
    syncDemandCalls: () => syncDemandCalls,
    allocateWorkersCalls: () => allocateWorkersCalls,
    commerceCalls: () => commerceCalls,
    runMonthlyFoodSupplyCycle: async () => {
      foodCalls += 1;
    },
    syncFactoryWorkerDemandFromCaps: async () => {
      syncDemandCalls += 1;
    },
    allocateFactoryWorkersToCommodityLines: async () => {
      allocateWorkersCalls += 1;
    },
    runCityFactoryProductionCycle: async () => {
      factoryCalls += 1;
    },
    runMonthlyCommerceSupplyCycle: async () => {
      commerceCalls += 1;
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
  };
}

function fakeCommerce() {
  let turnCalls = 0;
  return {
    turnCalls: () => turnCalls,
    simulation: {
      simulate: async () => {
        turnCalls += 1;
      },
    },
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
    commerce: fakeCommerce(),
    gameplay: fakeGameplay(),
    intelligence: fakeIntelligence(),
    getTimeInfo: (turn) => TimeManager.getTimeInfo(turn),
    toSupplySeason: () => 'summer',
    toSupplyMonth: () => 'july',
    getSectorPriorities: () => ({}),
    ...overrides,
  };
}

describe('createGameRuntime', () => {
  test('enregistre tous les systèmes dans le pipeline simulation', () => {
    const runtime = createGameRuntime(baseRuntimeDeps());

    expect(runtime.pipeline.getGroupNames()).toEqual(['simulation']);
    expect(runtime.pipeline.getSystemNames('simulation')).toEqual([
      'parcels.roadAccess',
      'supply.monthlyFood',
      'housing.populationGrowth',
      'housing.evolution',
      'supply.syncFactoryWorkerDemand',
      'employment.redistribute',
      'supply.allocateFactoryWorkers',
      'supply.factoryProduction',
      'supply.monthlyCommerce',
      'commerce.turn',
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
    const commerce = fakeCommerce();
    const gameplay = fakeGameplay();
    const intelligence = fakeIntelligence();
    const runtime = createGameRuntime(
      baseRuntimeDeps({
        parcels,
        supply,
        housing,
        employment,
        commerce,
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
    expect(supply.syncDemandCalls()).toBe(1);
    expect(employment.redistributeCalls()).toBe(1);
    expect(supply.allocateWorkersCalls()).toBe(1);
    expect(supply.factoryCalls()).toBe(1);
    expect(supply.commerceCalls()).toBe(1);
    expect(commerce.turnCalls()).toBe(1);
    expect(gameplay.eventCalls()).toBe(1);
    expect(intelligence.newsCalls()).toBe(1);
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
    ).toThrow(/commerce/);
    expect(() =>
      createGameRuntime({
        parcels: fakeParcels(),
        supply: fakeSupply(),
        housing: fakeHousing(),
        employment: fakeEmployment(),
        commerce: fakeCommerce(),
      })
    ).toThrow(/gameplay/);
    expect(() =>
      createGameRuntime({
        parcels: fakeParcels(),
        supply: fakeSupply(),
        housing: fakeHousing(),
        employment: fakeEmployment(),
        commerce: fakeCommerce(),
        gameplay: fakeGameplay(),
      })
    ).toThrow(/intelligence/);
  });
});

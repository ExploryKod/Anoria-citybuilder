/**
 * Branchement ECS — createGameRuntime (comportement du tick simulation)
 */

import { describe, test, expect } from '@jest/globals';
import { createGameRuntime } from '../../src/composition/createGameRuntime.js';
import { TimeManager } from '../../src/js/game/utils/TimeManager.js';

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
  return {
    foodCalls: () => foodCalls,
    factoryCalls: () => factoryCalls,
    runMonthlyFoodSupplyCycle: async () => {
      foodCalls += 1;
    },
    runCityFactoryProductionCycle: async () => {
      factoryCalls += 1;
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

describe('createGameRuntime', () => {
  test('enregistre parcels, supply, housing et employment dans le pipeline simulation', () => {
    const runtime = createGameRuntime({
      parcels: fakeParcels(),
      supply: fakeSupply(),
      housing: fakeHousing(),
      employment: fakeEmployment(),
      timeManager: TimeManager,
      toSupplySeason: () => 'summer',
      toSupplyMonth: () => 'july',
      getSectorPriorities: () => ({}),
    });

    expect(runtime.pipeline.getGroupNames()).toEqual(['simulation']);
    expect(runtime.pipeline.getSystemNames('simulation')).toEqual([
      'parcels.roadAccess',
      'supply.monthlyFood',
      'housing.populationGrowth',
      'housing.evolution',
      'employment.redistribute',
      'supply.factoryProduction',
    ]);
    expect(runtime.world).toBeDefined();
  });

  test('runSimulation délègue aux BC Parcels, Supply, Housing et Employment', async () => {
    const parcels = fakeParcels();
    const supply = fakeSupply();
    const housing = fakeHousing();
    const employment = fakeEmployment();
    const runtime = createGameRuntime({
      parcels,
      supply,
      housing,
      employment,
      timeManager: TimeManager,
      toSupplySeason: () => 'summer',
      toSupplyMonth: () => 'july',
      getSectorPriorities: () => ({}),
    });

    await runtime.runSimulation({
      time: 3,
      city: { size: 1, tiles: [[]] },
    });

    expect(parcels.calls()).toBe(1);
    expect(supply.foodCalls()).toBe(1);
    expect(housing.growthCalls()).toBe(1);
    expect(housing.evolutionCalls()).toBe(1);
    expect(employment.redistributeCalls()).toBe(1);
    expect(supply.factoryCalls()).toBe(1);
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
  });
});

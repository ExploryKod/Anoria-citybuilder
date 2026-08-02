import { describe, test, expect } from '@jest/globals';
import { SUPPLY_FLOW } from '../../../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';
import {
  FACTORY_BUILDING_MAX_WORKERS,
  computeFactoryCommodityWorkerDemand,
  computeFactoryTotalWorkerNeed,
  computeFactoryProductWorkerDistribution,
  computeFactoryProductProductionPercentages,
  isFactoryCommodityLineActive,
  listFactoryCommodityLinesForFactory,
} from '../../../../src/contexts/supply/domain/manufacturing/FactoryProductWorkerDistributionPolicy.js';
import { factoryLineDestinationKey } from '../../../../src/contexts/supply/domain/manufacturing/FactoryLineAllocationPolicy.js';

describe('FactoryProductWorkerDistributionPolicy', () => {
  test('lists commerce factory commodity lines', () => {
    const factory = { supplyFlow: SUPPLY_FLOW.COMMERCE };
    expect(listFactoryCommodityLinesForFactory(factory)).toEqual(['wood', 'furniture']);
  });

  test('worker demand scales with destination caps', () => {
    const fullCap = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 200,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 0,
      },
    };
    const halfCap = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 100,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 0,
      },
    };
    const zeroCap = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 0,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 0,
      },
    };

    expect(computeFactoryCommodityWorkerDemand(fullCap, 'wood')).toBe(2);
    expect(computeFactoryCommodityWorkerDemand(halfCap, 'wood')).toBe(1);
    expect(computeFactoryCommodityWorkerDemand(zeroCap, 'wood')).toBe(0);
    expect(isFactoryCommodityLineActive(zeroCap, 'wood')).toBe(false);
  });

  test('disabled commodity production frees workers regardless of caps', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 200,
        [factoryLineDestinationKey('furniture', 'direct')]: 200,
      },
      commodityProductionEnabled: {
        furniture: false,
      },
    };

    expect(computeFactoryCommodityWorkerDemand(factory, 'furniture')).toBe(0);
    expect(isFactoryCommodityLineActive(factory, 'furniture')).toBe(false);
    expect(computeFactoryTotalWorkerNeed(factory)).toBe(2);
    expect(computeFactoryProductWorkerDistribution({ ...factory, employees: { worker: 2 } })).toEqual({
      wood: 2,
    });
  });

  test('total worker need sums commodity demands capped at building max', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.CITY,
      lineMaxCaps: Object.fromEntries(
        ['wood', 'rock', 'clay', 'iron', 'gold', 'furniture', 'weapons', 'pottery', 'jewelry'].flatMap(
          (id) => [
            [factoryLineDestinationKey(id, 'direct'), 200],
            [factoryLineDestinationKey(id, 'manufacturing'), 0],
          ]
        )
      ),
    };

    expect(computeFactoryTotalWorkerNeed(factory)).toBe(FACTORY_BUILDING_MAX_WORKERS);
  });

  test('distributes assigned workers by demand priority', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      employees: { worker: 3 },
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 200,
        [factoryLineDestinationKey('furniture', 'direct')]: 200,
      },
    };

    expect(computeFactoryProductWorkerDistribution(factory)).toEqual({
      wood: 2,
      furniture: 1,
    });
  });

  test('skips lines with zero demand', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      employees: { worker: 4 },
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 0,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 0,
        [factoryLineDestinationKey('furniture', 'direct')]: 200,
      },
    };

    expect(computeFactoryProductWorkerDistribution(factory)).toEqual({
      furniture: 2,
    });
  });

  test('derives production percentages from worker counts', () => {
    expect(
      computeFactoryProductProductionPercentages(
        { employees: { worker: 3 } },
        { wood: 2, furniture: 1 }
      )
    ).toEqual({
      wood: 100,
      furniture: 50,
    });
  });
});

import { describe, test, expect } from '@jest/globals';
import { SUPPLY_FLOW } from '../../../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';
import {
  isFactoryCommodityProductionEnabled,
  withFactoryCommodityProductionEnabled,
} from '../../../../src/contexts/supply/domain/manufacturing/FactoryCommodityProductionPolicy.js';
import { factoryLineDestinationKey } from '../../../../src/contexts/supply/domain/manufacturing/FactoryLineAllocationPolicy.js';
import { isFactoryLineDestinationEnabled } from '../../../../src/contexts/supply/domain/manufacturing/FactoryLineAllocationPolicy.js';

describe('FactoryCommodityProductionPolicy', () => {
  test('missing flag defaults to enabled', () => {
    expect(isFactoryCommodityProductionEnabled({}, 'wood')).toBe(true);
    expect(isFactoryCommodityProductionEnabled({ commodityProductionEnabled: {} }, 'wood')).toBe(
      true
    );
  });

  test('explicit false disables production', () => {
    const factory = {
      commodityProductionEnabled: { jewelry: false },
      employees: { worker: 2 },
      productWorkerDistribution: { jewelry: 2 },
      lineMaxCaps: {
        [factoryLineDestinationKey('jewelry', 'direct')]: 100,
      },
    };

    expect(isFactoryCommodityProductionEnabled(factory, 'jewelry')).toBe(false);
    expect(isFactoryLineDestinationEnabled(factory, 'jewelry', 'direct')).toBe(false);
  });

  test('withFactoryCommodityProductionEnabled merges flags', () => {
    expect(withFactoryCommodityProductionEnabled({ wood: false }, 'furniture', true)).toEqual({
      wood: false,
      furniture: true,
    });
  });
});

import { describe, test, expect } from '@jest/globals';
import {
  FACTORY_COMMODITY_KIND,
  getFactoryCommodity,
} from '../../../../src/contexts/supply/domain/manufacturing/ProductRecipeCatalog.js';
import {
  getFactoryLineDestinationsForCommodity,
  getFactoryLineMaxCapsPair,
  isFactoryLineDestinationEnabled,
  rebalanceFactoryLineMaxCaps,
  factoryLineDestinationKey,
} from '../../../../src/contexts/supply/domain/manufacturing/FactoryLineAllocationPolicy.js';

describe('ProductRecipeCatalog — factory commodity definitions', () => {
  test('each commodity declares kind and line destinations', () => {
    expect(getFactoryCommodity('wood')).toMatchObject({
      kind: FACTORY_COMMODITY_KIND.RAW_MATERIAL,
      lineDestinations: ['direct', 'manufacturing'],
    });
    expect(getFactoryCommodity('rock')).toMatchObject({
      kind: FACTORY_COMMODITY_KIND.RAW_MATERIAL,
      lineDestinations: ['direct', 'manufacturing'],
    });
    expect(getFactoryCommodity('furniture')).toMatchObject({
      kind: FACTORY_COMMODITY_KIND.FINISHED_PRODUCT,
      lineDestinations: ['direct'],
      recipe: { logs: 4 },
    });
    expect(getFactoryCommodity('jewelry')).toMatchObject({
      kind: FACTORY_COMMODITY_KIND.FINISHED_PRODUCT,
      lineDestinations: ['direct'],
    });
  });

  test('finished products only expose direct sale destination in UI', () => {
    expect(getFactoryLineDestinationsForCommodity('furniture')).toEqual([
      { id: 'direct', label: 'vente directe' },
    ]);
    expect(getFactoryLineDestinationsForCommodity('wood')).toHaveLength(2);
  });

  test('finished product caps are direct-only (no manufacturing split)', () => {
    const factory = {
      productWorkerDistribution: { furniture: 2 },
      lineMaxCaps: {
        [factoryLineDestinationKey('furniture', 'direct')]: 40,
        [factoryLineDestinationKey('furniture', 'manufacturing')]: 60,
      },
    };

    expect(getFactoryLineMaxCapsPair(factory, 'furniture', 100)).toEqual({
      direct: 40,
      manufacturing: 0,
    });

    expect(
      rebalanceFactoryLineMaxCaps('furniture', 'direct', 75, 100)[
        factoryLineDestinationKey('furniture', 'manufacturing')
      ]
    ).toBe(0);

    expect(isFactoryLineDestinationEnabled(factory, 'furniture', 'manufacturing')).toBe(false);
    expect(isFactoryLineDestinationEnabled(factory, 'furniture', 'direct')).toBe(true);
  });
});

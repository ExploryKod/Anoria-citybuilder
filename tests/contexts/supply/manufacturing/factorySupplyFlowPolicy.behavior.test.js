import { describe, test, expect } from '@jest/globals';
import {
  normalizeSupplyFlow,
  getBuildingSupplyFlow,
  getBarnSupplyFlow,
  isCommerceBarn,
  isCityBarn,
  SUPPLY_FLOW,
} from '../../../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';
import {
  canFactoryCollectResource,
  canFactoryProduceProduct,
  isCommerceFactory,
} from '../../../../src/contexts/supply/domain/manufacturing/FactorySupplyFlowPolicy.js';
import {
  isFactoryLineDestinationEnabled,
  getDirectSaleStockAmount,
  getManufacturingEligibleStock,
  factoryLineDestinationKey,
  computeFactoryLineProductionMax,
  getFactoryLineMaxCap,
  normalizeFactoryLineMaxCap,
  getFactoryLineMaxCapsPair,
  rebalanceFactoryLineMaxCaps,
} from '../../../../src/contexts/supply/domain/manufacturing/FactoryLineAllocationPolicy.js';

describe('SupplyFlow', () => {
  test('normalizeSupplyFlow defaults to city', () => {
    expect(normalizeSupplyFlow(undefined)).toBe(SUPPLY_FLOW.CITY);
    expect(normalizeSupplyFlow('commerce')).toBe(SUPPLY_FLOW.COMMERCE);
  });

  test('getBarnSupplyFlow defaults missing barns to commerce hubs', () => {
    expect(getBarnSupplyFlow({})).toBe(SUPPLY_FLOW.COMMERCE);
    expect(getBarnSupplyFlow({ supplyFlow: SUPPLY_FLOW.CITY })).toBe(SUPPLY_FLOW.CITY);
    expect(isCommerceBarn({ type: 'Barn-001' })).toBe(true);
    expect(isCityBarn({ type: 'Barn-001', supplyFlow: SUPPLY_FLOW.CITY })).toBe(true);
  });
});

describe('FactorySupplyFlowPolicy', () => {
  test('commerce factory only allows wood and furniture lines', () => {
    const factory = { supplyFlow: SUPPLY_FLOW.COMMERCE };
    expect(canFactoryCollectResource(factory, 'wood')).toBe(true);
    expect(canFactoryCollectResource(factory, 'gold')).toBe(false);
    expect(canFactoryProduceProduct(factory, 'furniture')).toBe(true);
    expect(canFactoryProduceProduct(factory, 'jewelry')).toBe(false);
    expect(isCommerceFactory(factory)).toBe(true);
  });

  test('city factory allows all MVP lines', () => {
    const factory = { supplyFlow: SUPPLY_FLOW.CITY };
    expect(canFactoryCollectResource(factory, 'gold')).toBe(true);
    expect(canFactoryProduceProduct(factory, 'jewelry')).toBe(true);
  });

  test('missing supplyFlow is treated as city', () => {
    expect(getBuildingSupplyFlow({})).toBe(SUPPLY_FLOW.CITY);
  });
});

describe('FactoryLineAllocationPolicy', () => {
  test('line max cap at zero disables destination', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      productWorkerDistribution: { wood: 2 },
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 0,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 200,
      },
    };
    expect(isFactoryLineDestinationEnabled(factory, 'wood', 'direct')).toBe(false);
    expect(isFactoryLineDestinationEnabled(factory, 'wood', 'manufacturing')).toBe(true);
  });

  test('getDirectSaleStockAmount returns 0 when direct max is zero', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      productWorkerDistribution: { wood: 2 },
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 0,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 200,
      },
    };
    expect(getDirectSaleStockAmount(factory, 'wood', 10)).toBe(0);
  });

  test('getDirectSaleStockAmount returns full stock when only direct has cap', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      productWorkerDistribution: { wood: 2 },
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 200,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 0,
      },
    };
    expect(getDirectSaleStockAmount(factory, 'wood', 10)).toBe(10);
  });

  test('computeFactoryLineProductionMax scales with workers', () => {
    const factory = {
      productWorkerDistribution: { wood: 2 },
    };
    expect(computeFactoryLineProductionMax(factory, 'wood')).toBe(200);
    expect(computeFactoryLineProductionMax({ productWorkerDistribution: { wood: 1 } }, 'wood')).toBe(
      100
    );
    expect(computeFactoryLineProductionMax({ productWorkerDistribution: { wood: 0 } }, 'wood')).toBe(
      0
    );
  });

  test('lineMaxCaps clamp direct and manufacturing amounts', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      productWorkerDistribution: { wood: 2 },
      lineMaxCaps: {
        [factoryLineDestinationKey('wood', 'direct')]: 5,
        [factoryLineDestinationKey('wood', 'manufacturing')]: 3,
      },
    };
    const productionMax = computeFactoryLineProductionMax(factory, 'wood');
    expect(getFactoryLineMaxCap(factory, 'wood', 'direct', productionMax)).toBe(5);
    expect(getDirectSaleStockAmount(factory, 'wood', 12, productionMax)).toBe(5);
    expect(getManufacturingEligibleStock(factory, 'wood', 12, productionMax)).toBe(3);
  });

  test('normalizeFactoryLineMaxCap cannot exceed production max', () => {
    expect(normalizeFactoryLineMaxCap(999, 200)).toBe(200);
    expect(normalizeFactoryLineMaxCap(-5, 200)).toBe(0);
  });

  test('getFactoryLineMaxCapsPair defaults to full direct allocation', () => {
    expect(getFactoryLineMaxCapsPair({}, 'wood', 100)).toEqual({
      direct: 100,
      manufacturing: 0,
    });
  });

  test('rebalanceFactoryLineMaxCaps adjusts sibling cap (communicating vessels)', () => {
    const caps = rebalanceFactoryLineMaxCaps('wood', 'manufacturing', 60, 100);
    expect(caps[factoryLineDestinationKey('wood', 'direct')]).toBe(40);
    expect(caps[factoryLineDestinationKey('wood', 'manufacturing')]).toBe(60);

    const caps2 = rebalanceFactoryLineMaxCaps('wood', 'direct', 50, 100);
    expect(caps2[factoryLineDestinationKey('wood', 'direct')]).toBe(50);
    expect(caps2[factoryLineDestinationKey('wood', 'manufacturing')]).toBe(50);
  });
});

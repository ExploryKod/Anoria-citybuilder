import { describe, test, expect } from '@jest/globals';
import {
  normalizeSupplyFlow,
  getBuildingSupplyFlow,
  SUPPLY_FLOW,
} from '../../../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';
import {
  canFactoryCollectResource,
  canFactoryProduceProduct,
  isCommerceFactory,
} from '../../../../src/contexts/supply/domain/manufacturing/FactorySupplyFlowPolicy.js';
import {
  normalizeLineAllocation,
  getFactoryLineAllocation,
  manufacturingEligibleStock,
  directOutputReservedStock,
} from '../../../../src/contexts/supply/domain/manufacturing/FactoryLineAllocationPolicy.js';

describe('SupplyFlow', () => {
  test('normalizeSupplyFlow defaults to city', () => {
    expect(normalizeSupplyFlow(undefined)).toBe(SUPPLY_FLOW.CITY);
    expect(normalizeSupplyFlow('commerce')).toBe(SUPPLY_FLOW.COMMERCE);
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
  test('normalizeLineAllocation rescales to 100%', () => {
    expect(normalizeLineAllocation({ direct: 30, manufacturing: 30 })).toEqual({
      direct: 50,
      manufacturing: 50,
    });
  });

  test('commerce factory defaults wood to 100% direct export', () => {
    expect(getFactoryLineAllocation({ supplyFlow: SUPPLY_FLOW.COMMERCE }, 'wood')).toEqual({
      direct: 100,
      manufacturing: 0,
    });
  });

  test('manufacturingEligibleStock respects allocation percentage', () => {
    const allocation = { direct: 60, manufacturing: 40 };
    expect(manufacturingEligibleStock(10, allocation)).toBe(4);
    expect(directOutputReservedStock(10, allocation)).toBe(6);
  });

  test('factory lineAllocations override defaults', () => {
    const factory = {
      supplyFlow: SUPPLY_FLOW.COMMERCE,
      lineAllocations: { wood: { direct: 25, manufacturing: 75 } },
    };
    expect(getFactoryLineAllocation(factory, 'wood')).toEqual({
      direct: 25,
      manufacturing: 75,
    });
  });
});

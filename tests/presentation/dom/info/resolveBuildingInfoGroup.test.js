import { describe, test, expect } from '@jest/globals';
import {
  BUILDING_INFO_GROUPS,
  resolveBuildingInfoGroup,
} from '../../../../src/presentation/dom/info/resolveBuildingInfoGroup.js';

describe('resolveBuildingInfoGroup', () => {
  test('a flag-distributor service (Chapel, School, ...) routes to its own group, not market', () => {
    expect(
      resolveBuildingInfoGroup({ buildingRow: { category: 'public' }, supplyView: { kind: 'service' } }),
    ).toBe(BUILDING_INFO_GROUPS.service);
  });

  test('a quantity-distributor market still routes to market', () => {
    expect(
      resolveBuildingInfoGroup({ buildingRow: { category: 'markets' }, supplyView: { kind: 'market' } }),
    ).toBe(BUILDING_INFO_GROUPS.market);
  });

  test('house/farm/windmill/nature/generic routing is unaffected', () => {
    expect(resolveBuildingInfoGroup({ buildingRow: {}, supplyView: { kind: 'house' } })).toBe(
      BUILDING_INFO_GROUPS.house,
    );
    expect(resolveBuildingInfoGroup({ buildingRow: {}, supplyView: { kind: 'farm' } })).toBe(
      BUILDING_INFO_GROUPS.farm,
    );
    expect(resolveBuildingInfoGroup({ buildingRow: {}, supplyView: { kind: 'windmill' } })).toBe(
      BUILDING_INFO_GROUPS.hubStorage,
    );
    expect(resolveBuildingInfoGroup({ buildingRow: { category: 'nature' }, supplyView: null })).toBe(
      BUILDING_INFO_GROUPS.nature,
    );
    expect(resolveBuildingInfoGroup({ buildingRow: {}, supplyView: { kind: 'other' } })).toBe(
      BUILDING_INFO_GROUPS.generic,
    );
  });
});

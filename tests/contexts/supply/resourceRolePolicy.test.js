import { describe, test, expect } from '@jest/globals';
import {
  getResourceRoles,
  hasResourceRole,
  getCategoriesForRole,
  getRangeForRole,
  getResourceStockShape,
} from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';

describe('ResourceRolePolicy', () => {
  test('a farm is a producer of its own crop', () => {
    expect(hasResourceRole('Farm-Wheat', 'producer')).toBe(true);
    expect(hasResourceRole('Farm-Wheat', 'producer', 'wheat')).toBe(true);
    expect(hasResourceRole('Farm-Wheat', 'producer', 'carrot')).toBe(false);
    expect(getCategoriesForRole('Farm-Wheat', 'producer')).toEqual(['wheat']);
  });

  test('a market is a distributor with a range', () => {
    expect(hasResourceRole('Market-Stall', 'distributor', 'wheat')).toBe(true);
    expect(getRangeForRole('Market-Stall', 'distributor')).toBe(5);
  });

  test('a windmill holds both a collector and a hub role, with no range', () => {
    expect(hasResourceRole('Windmill-001', 'collector')).toBe(true);
    expect(hasResourceRole('Windmill-001', 'hub')).toBe(true);
    expect(getRangeForRole('Windmill-001', 'collector')).toBeUndefined();
  });

  test('a house is a consumer', () => {
    expect(hasResourceRole('House-Blue', 'consumer', 'fruit')).toBe(true);
  });

  test('a building with no resourceRoles fact has none', () => {
    expect(getResourceRoles('StonePath-001')).toEqual([]);
    expect(hasResourceRole('StonePath-001', 'producer')).toBe(false);
    expect(getRangeForRole('StonePath-001', 'distributor')).toBeUndefined();
  });

  describe('getResourceStockShape — the shared stock shape for every building row', () => {
    test('includes a producer-only category with no consumer anywhere yet (pottery)', () => {
      // Regression guard: this shape used to only look at 'consumer'
      // 'quantity' entries, so a producer-only good (e.g. Factory-Plate's
      // 'plate', which nothing consumes yet) would silently vanish on every
      // stock round-trip (createSupplyStock only keeps listed categories).
      const { categories } = getResourceStockShape();
      expect(categories).toEqual(expect.arrayContaining(['plate', 'pot', 'amphora']));
    });

    test('still aggregates food under the one shared totalKey — pottery does not get one', () => {
      const { categories, totalKey } = getResourceStockShape();
      expect(totalKey).toBe('food');
      expect(categories).toEqual(expect.arrayContaining(['wheat', 'carrot', 'cabbage', 'fruit', 'game']));
    });
  });
});
